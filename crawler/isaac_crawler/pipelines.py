import os
import hashlib
import requests
import logging
import firebase_admin
from firebase_admin import credentials, firestore

logger = logging.getLogger(__name__)

class IsaacPipeline:
    def __init__(self, backend_url, cred_path):
        self.backend_url = backend_url or "http://backend:8000"
        self.cred_path = cred_path
        self.db = None

    @classmethod
    def from_crawler(cls, crawler):
        return cls(
            backend_url=crawler.settings.get('BACKEND_URL'),
            cred_path=os.getenv("FIREBASE_CREDENTIALS_PATH")
        )

    def open_spider(self, spider):
        # Safely open/initialize Firebase application
        if not firebase_admin._apps:
            if self.cred_path and os.path.exists(self.cred_path):
                cred = credentials.Certificate(self.cred_path)
                firebase_admin.initialize_app(cred)
            else:
                try:
                    cred = credentials.ApplicationDefault()
                    firebase_admin.initialize_app(cred)
                except Exception:
                    # Generic initialization
                    firebase_admin.initialize_app()
                    
        self.db = firestore.client()
        spider.log("IsaacPipeline: Firestore client connected for crawler deduplication.")

    def process_item(self, item, spider):
        url = item.get('url')
        if not url:
            return item

        # Hash URL for Firestore document ID checking (O(1) verification)
        url_hash = hashlib.sha256(url.encode('utf-8')).hexdigest()
        doc_ref = self.db.collection('pages').document(url_hash)

        # Step 3 constraint: Verify records via the Firestore SDK first
        try:
            if doc_ref.get().exists:
                spider.log(f"IsaacPipeline: URL already indexed (found in Firestore): {url}. Skipping.")
                return item
        except Exception as e:
            spider.log(f"IsaacPipeline: Error checking Firestore for duplicate {url}: {e}. Retrying with direct check.", level=logging.WARNING)

        # If it doesn't already exist, index it and upload components 
        spider.log(f"IsaacPipeline: Fresh document crawled: {url}. Sending indexing payload.")
        try:
            payload = {
                "url": url,
                "title": item.get('title'),
                "content": item.get('content'),
                "snippet": item.get('snippet')
            }
            response = requests.post(f"{self.backend_url}/index", json=payload, timeout=8)
            if response.status_code in [200, 201]:
                spider.log(f"IsaacPipeline: Successfully indexed {url}")
            else:
                spider.log(f"IsaacPipeline: Error indexing {url}: {response.text}", level=logging.ERROR)

            # Store backlinks if crawled
            backlinks = item.get('backlinks', [])
            if backlinks:
                links_csv = ",".join(backlinks)
                requests.post(f"{self.backend_url}/index/backlinks", params={
                    "source_url": url,
                    "links": links_csv
                }, timeout=5)

            # Store crawled images if scrapable
            images = item.get('images', [])
            for img in images:
                try:
                    payload_img = {
                        "url": img["url"],
                        "alt_text": img["alt_text"],
                        "source_url": img["source_url"],
                        "title": img["title"]
                    }
                    requests.post(f"{self.backend_url}/index/image", json=payload_img, timeout=4)
                except Exception as img_err:
                    spider.log(f"IsaacPipeline: Failed to index crawled image {img.get('url')}: {img_err}", level=logging.WARNING)

        except Exception as e:
            spider.log(f"IsaacPipeline: Failed network action invoking backend API for {url}: {e}", level=logging.ERROR)

        return item
