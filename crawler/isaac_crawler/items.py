import scrapy

class IsaacItem(scrapy.Item):
    url = scrapy.Field()
    title = scrapy.Field()
    content = scrapy.Field()
    snippet = scrapy.Field()
    backlinks = scrapy.Field()
    images = scrapy.Field()
