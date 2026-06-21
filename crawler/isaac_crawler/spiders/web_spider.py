import scrapy
from urllib.parse import urljoin, urlparse
from ..items import IsaacItem

class WebSpider(scrapy.Spider):
    name = "web_spider"
    
    def __init__(self, start_url=None, *args, **kwargs):
        super(WebSpider, self).__init__(*args, **kwargs)
        if start_url:
            self.start_urls = [start_url]
        else:
            self.start_urls = [
                "https://news.ycombinator.com",
                "https://en.wikipedia.org/wiki/Search_engine"
            ]
            
    def parse(self, response):
        if not hasattr(response, 'text'):
            return

        # Extract title
        title = response.css('title::text').get()
        if title:
            title = title.strip()
            
        # Extract main text content using native xpath selectors
        texts = response.xpath('//body//text()').getall()
        # Clean text tokens and filter structural tags / white noises
        content = " ".join([t.strip() for t in texts if t.strip()])
        content = ' '.join(content.split())
        
        # Extract metadata description or slice fallback content
        meta_desc = response.css('meta[name="description"]::attr(content)').get()
        if meta_desc:
            snippet = meta_desc.strip()
        else:
            snippet = content[:160] + "..." if len(content) > 160 else content

        # Gather links for backlink mapping representation
        backlinks = []
        links = response.css('a::attr(href)').getall()
        
        for link in links:
            absolute_url = urljoin(response.url, link)
            parsed_link = urlparse(absolute_url)
            
            # Filter non-html extensions
            if parsed_link.scheme in ['http', 'https'] and not parsed_link.path.endswith(('.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip')):
                backlinks.append(absolute_url)
                
                # Recursively parse standard links under the same domain
                # Yield scrapy requests up to DEPTH_LIMIT settings safety bounds
                yield scrapy.Request(absolute_url, callback=self.parse)

        # Extract images from the web page
        images_found = []
        for img in response.css('img'):
            src = img.css('::attr(src)').get()
            alt = img.css('::attr(alt)').get() or ""
            img_title = img.css('::attr(title)').get() or alt or title or "Scraped Image"
            if src:
                absolute_img_url = urljoin(response.url, src)
                parsed_img = urlparse(absolute_img_url)
                if parsed_img.scheme in ['http', 'https']:
                    images_found.append({
                        "url": absolute_img_url,
                        "alt_text": alt.strip(),
                        "source_url": response.url,
                        "title": img_title.strip()
                    })

        # Filter images to keep only standard/relevant ones and cap them
        valid_images = []
        for img in images_found:
            lower_url = img["url"].lower()
            if "spacer" in lower_url or lower_url.endswith(".gif") or "tracking" in lower_url or "analytics" in lower_url:
                continue
            valid_images.append(img)
            if len(valid_images) >= 12:  # Cap to keep it compact
                break

        # Build structure Downstream Isaac Item
        item = IsaacItem()
        item['url'] = response.url
        item['title'] = title or response.url
        item['content'] = content
        item['snippet'] = snippet
        item['backlinks'] = list(set(backlinks))[:15]  # Cap linked lists
        item['images'] = valid_images
        
        yield item
