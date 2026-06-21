import logging
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

def discover_seeds_from_pages(db):
    """
    Scan existing Firestore indexed pages for domains and discover potential crawl seeds.
    """
    added = 0
    total_discovered = 0
    skipped_due_to_crawled = 0
    
    try:
        # Retrieve docs from the 'pages' collection
        pages_ref = db.collection('pages')
        docs = pages_ref.stream()
        
        crawled_urls = set()
        domains = set()
        for doc in docs:
            data = doc.to_dict()
            url = data.get('url')
            if url:
                crawled_urls.add(url)
                parsed = urlparse(url)
                if parsed.netloc:
                    domains.add(parsed.netloc)
        
        seeds_ref = db.collection('seeds')
        for domain in domains:
            try:
                # Clean key for Firestore ID formatting
                doc_id = domain.replace('.', '_').replace('/', '_').replace(':', '_')
                doc_ref = seeds_ref.document(doc_id)
                
                if not doc_ref.get().exists:
                    doc_ref.set({
                        "url": f"https://{domain}",
                        "domain": domain,
                        "source": "discovered"
                    })
                    added += 1
                else:
                    skipped_due_to_crawled += 1
                total_discovered += 1
            except Exception as inner_err:
                logger.error(f"Failed to write seed document for {domain}: {inner_err}")
                
    except Exception as e:
        logger.error(f"Error in discover_seeds_from_pages: {e}")
        
    return {
        "added": added,
        "total_discovered": total_discovered,
        "skipped_due_to_crawled": skipped_due_to_crawled
    }

def discover_seeds_from_whois(db):
    """
    Create default seed entries if the 'seeds' collection is completely empty.
    """
    added = 0
    try:
        seeds_ref = db.collection('seeds')
        # Check if empty
        existing_seeds = list(seeds_ref.limit(1).stream())
        
        if not existing_seeds:
            defaults = [
                {"url": "https://news.ycombinator.com", "domain": "news.ycombinator.com", "source": "whois"},
                {"url": "https://www.wikipedia.org", "domain": "wikipedia.org", "source": "whois"},
                {"url": "https://archive.org", "domain": "archive.org", "source": "whois"}
            ]
            for seed in defaults:
                doc_id = seed["domain"].replace('.', '_')
                seeds_ref.document(doc_id).set(seed)
                added += 1
    except Exception as e:
        logger.error(f"Error in discover_seeds_from_whois: {e}")
        
    return {"added": added}
