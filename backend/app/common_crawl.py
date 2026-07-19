import logging
import requests
import json
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

DEFAULT_INDEXES = [
    "CC-MAIN-2024-18",
    "CC-MAIN-2024-10",
    "CC-MAIN-2023-50",
    "CC-MAIN-2023-40"
]

def get_latest_common_crawl_index() -> str:
    """
    Fetch the list of current active indexes from Common Crawl index directory
    and return the ID of the latest one. Falls back to a robust default list.
    """
    try:
        url = "https://index.commoncrawl.org/collinfo.json"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                # The first item in the list is usually the latest index
                latest_index = data[0].get("id")
                if latest_index:
                    logger.info(f"Discovered latest Common Crawl index: {latest_index}")
                    return latest_index
    except Exception as e:
        logger.warning(f"Failed to fetch Common Crawl index directory: {e}. Using fallback indexes.")
    
    return DEFAULT_INDEXES[0]

def query_common_crawl_urls(domain: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Query Common Crawl index for URLs matching the given domain pattern.
    Cleans, deduplicates, and returns a list of discovered HTML page URLs and their metadata.
    """
    index = get_latest_common_crawl_index()
    
    # Common Crawl CDX server endpoint
    cdx_url = f"https://index.commoncrawl.org/{index}-index"
    
    # We want to match all pages on the domain and its subdomains.
    # The CDX server supports prefix querying using a wildcard or matchType.
    # Best query format for domain paths is url=domain/* or matchType=prefix
    params = {
        "url": f"{domain}/*",
        "output": "json",
        "limit": limit * 2,  # Fetch extra so we can filter down to clean HTML links
        "fl": "url,timestamp,mime,status"
    }
    
    logger.info(f"Querying Common Crawl index {index} for domain: {domain}")
    discovered = []
    seen_urls = set()
    
    try:
        response = requests.get(cdx_url, params=params, timeout=10)
        if response.status_code == 200:
            # Common Crawl outputs newline-delimited JSON
            lines = response.text.strip().split("\n")
            for line in lines:
                if not line.strip():
                    continue
                try:
                    record = json.loads(line)
                    url = record.get("url")
                    mime = record.get("mime", "")
                    status = record.get("status", "200")
                    
                    if not url:
                        continue
                        
                    # Filter for clean HTML text pages and successful HTTP status codes
                    is_html = "text/html" in mime.lower() or not mime
                    is_success = status in ["200", "301", "302"]
                    
                    # Avoid binary file formats
                    is_binary = any(url.lower().endswith(ext) for ext in [
                        ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".zip", ".tar", ".gz", ".exe", ".dmg", ".mp4", ".mp3"
                    ])
                    
                    if is_html and is_success and not is_binary:
                        if url not in seen_urls:
                            seen_urls.add(url)
                            discovered.append({
                                "url": url,
                                "timestamp": record.get("timestamp"),
                                "mime": mime,
                                "status": status
                            })
                            if len(discovered) >= limit:
                                break
                except Exception as parse_err:
                    logger.debug(f"Error parsing CDX record: {parse_err}")
        else:
            logger.warning(f"Common Crawl CDX query failed with status {response.status_code}: {response.text}")
    except Exception as e:
        logger.error(f"Error querying Common Crawl CDX server: {e}")
        
    return discovered
