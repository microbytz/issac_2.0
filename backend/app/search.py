import os
import logging
from urllib.parse import urlparse
from whoosh.index import create_in, open_dir, exists_in
from whoosh.fields import Schema, TEXT, ID, NUMERIC
from whoosh.qparser import MultifieldParser, OrGroup, QueryParser
from whoosh.scoring import BM25F


logger = logging.getLogger(__name__)

INDEX_DIR = os.getenv("WHOOSH_INDEX_DIR", "search_index")

# BM25 field weights matching information retrieval priorities
TITLE_WEIGHT = 3.0
SNIPPET_WEIGHT = 1.5
CONTENT_WEIGHT = 1.0

def get_schema():
    return Schema(
        id=ID(stored=True, unique=True),
        url=ID(stored=True),
        canonical_url=TEXT(stored=True),
        title=TEXT(stored=True, field_boost=TITLE_WEIGHT),
        content=TEXT(stored=True, field_boost=CONTENT_WEIGHT),
        snippet=TEXT(stored=True, field_boost=SNIPPET_WEIGHT),
        indexed_at=TEXT(stored=True),
        indexed_time=NUMERIC(stored=True, numtype=float),
        backlinks=NUMERIC(stored=True, numtype=int)
    )

def init_index():
    if not os.path.exists(INDEX_DIR):
        os.makedirs(INDEX_DIR)
    schema = get_schema()
    if not exists_in(INDEX_DIR):
        return create_in(INDEX_DIR, schema)
    try:
        ix = open_dir(INDEX_DIR)
        return ix
    except Exception as e:
        logger.error(f"Whoosh index corrupted or unreadable: {e}. Recreating index.")
        return create_in(INDEX_DIR, schema)

def index_page(page_id, url, title, content, snippet, canonical_url=None, indexed_at=None, indexed_time=None, backlinks=0):
    try:
        ix = init_index()
        writer = ix.writer()
        
        import time
        if not indexed_at:
            indexed_at = time.asctime()
        if indexed_time is None:
            indexed_time = time.time()
            
        writer.update_document(
            id=str(page_id),
            url=url,
            canonical_url=canonical_url or "",
            title=title or "",
            content=content or "",
            snippet=snippet or "",
            indexed_at=str(indexed_at),
            indexed_time=float(indexed_time),
            backlinks=int(backlinks)
        )
        writer.commit()
    except Exception as e:
        logger.error(f"Whoosh indexing failed: {e}")

def search_query(q, page=1, limit=10, domain=None, date_from=None, date_to=None, min_backlinks=None, sort_by="relevance"):
    try:
        ix = init_index()
        # Use BM25F scoring model configured with optimal k1=1.2 and b=0.75
        bm25_model = BM25F(B=0.75, K1=1.2)
        with ix.searcher(weighting=bm25_model) as searcher:
            # Multifield query parser with weighted title vs. snippet vs. content
            field_boosts = {
                "title": TITLE_WEIGHT,
                "snippet": SNIPPET_WEIGHT,
                "content": CONTENT_WEIGHT
            }
            parser = MultifieldParser(["title", "snippet", "content"], ix.schema, fieldboosts=field_boosts, group=OrGroup.factory(0.9))
            query = parser.parse(q)
            results = searcher.search(query, limit=200)
            
            hit_list = []
            q_terms = [t.lower() for t in q.strip().split() if t.strip()]
            for hit in results:
                # domain filter
                url = hit.get("url") or ""
                if domain:
                    parsed_domain = urlparse(url).netloc.lower() or url.lower()
                    if domain.lower() not in parsed_domain:
                        continue
                        
                # date range filter
                hit_time = hit.get("indexed_time") or 0.0
                if date_from is not None:
                    try:
                        if hit_time < float(date_from):
                            continue
                    except:
                        pass
                if date_to is not None:
                    try:
                        if hit_time > float(date_to):
                            continue
                    except:
                        pass
                                
                # backlinks filter
                backlinks = hit.get("backlinks") or 0
                if min_backlinks is not None:
                    try:
                        if int(backlinks) < int(min_backlinks):
                            continue
                    except:
                        pass

                raw_score = float(hit.score) if hasattr(hit, "score") and hit.score is not None else 1.0
                title_str = hit.get("title") or ""
                snippet_str = hit.get("snippet") or (hit.highlights("content") if hasattr(hit, "highlights") else "")
                content_str = hit.get("content") or ""
                
                title_matches = sum(title_str.lower().count(t) for t in q_terms) if q_terms else 0
                snippet_matches = sum(snippet_str.lower().count(t) for t in q_terms) if q_terms else 0
                content_matches = sum(content_str.lower().count(t) for t in q_terms) if q_terms else 0

                hit_list.append({
                    "id": hit.get("id"),
                    "url": hit.get("url"),
                    "title": title_str,
                    "snippet": snippet_str,
                    "indexed_at": hit.get("indexed_at") or "",
                    "indexed_time": hit.get("indexed_time") or 0.0,
                    "backlinks": int(hit.get("backlinks") or 0),
                    "score": round(raw_score, 4),
                    "bm25_score": round(raw_score, 4),
                    "bm25_details": {
                        "total": round(raw_score, 4),
                        "titleWeight": TITLE_WEIGHT,
                        "snippetWeight": SNIPPET_WEIGHT,
                        "contentWeight": CONTENT_WEIGHT,
                        "titleMatches": title_matches,
                        "snippetMatches": snippet_matches,
                        "contentMatches": content_matches
                    }
                })
            
            # sorting
            if sort_by == "relevance" or not sort_by:
                hit_list.sort(key=lambda x: x.get("bm25_score", 0.0), reverse=True)
            elif sort_by == "date_desc":
                hit_list.sort(key=lambda x: x.get("indexed_time", 0.0), reverse=True)
            elif sort_by == "date_asc":
                hit_list.sort(key=lambda x: x.get("indexed_time", 0.0))
            elif sort_by == "backlinks_desc":
                hit_list.sort(key=lambda x: x.get("backlinks", 0), reverse=True)
            elif sort_by == "title_asc":
                hit_list.sort(key=lambda x: (x.get("title") or "").lower())
            elif sort_by == "title_desc":
                hit_list.sort(key=lambda x: (x.get("title") or "").lower(), reverse=True)
                
            # pagination slicing
            total_hits = len(hit_list)
            start_idx = (page - 1) * limit
            end_idx = start_idx + limit
            paginated_hits = hit_list[start_idx:end_idx]
            
            return {
                "total": total_hits,
                "page": page,
                "limit": limit,
                "results": paginated_hits
            }
    except Exception as e:
        logger.error(f"Search query error: {e}")
        return {"total": 0, "page": page, "limit": limit, "results": []}

def get_suggestions(q, limit=5):
    try:
        ix = init_index()
        suggestions = []
        with ix.searcher() as searcher:
            corrector = searcher.corrector("content")
            suggestions = corrector.suggest(q, limit=limit)
        return suggestions
    except Exception as e:
        logger.error(f"Suggestions fetching error: {e}")
        return []

def get_spell_correction(q):
    try:
        ix = init_index()
        with ix.searcher() as searcher:
            corrector = searcher.corrector("content")
            words = q.split()
            corrected_words = []
            changed = False
            for word in words:
                suggestions = corrector.suggest(word, limit=1)
                if suggestions and suggestions[0] != word:
                    corrected_words.append(suggestions[0])
                    changed = True
                else:
                    corrected_words.append(word)
            
            if changed:
                return " ".join(corrected_words)
        return None
    except Exception as e:
        logger.error(f"Spellcheck error: {e}")
        return None


def download_index_from_storage():
    """Download Whoosh search index binary files from Firebase Storage to local search_index directory."""
    from . import database

    logger.info("Syncing Whoosh search index from Firebase Storage on startup...")
    try:
        bucket = database.get_storage_bucket()
        if not bucket:
            logger.warning("No firebase storage bucket configured. Index sync skipped.")
            return

        os.makedirs("search_index", exist_ok=True)
        blobs = list(bucket.list_blobs(prefix="search_index/"))
        
        if not blobs:
            logger.info("No index files found in Firebase Storage, starting with blank index.")
            return

        cnt = 0
        for blob in blobs:
            # We skip directory placeholder blobs if any
            if blob.name.endswith('/'):
                continue
            
            # Make sure parent directory exists locally
            local_path = blob.name
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            blob.download_to_filename(local_path)
            cnt += 1
            
        logger.info(f"Synchronized {cnt} search index files from GCS bucket.")
    except Exception as e:
        logger.error(f"Error copying Whoosh index files from Firebase Storage: {e}")

def upload_index_to_storage():
    """Upload updated local Whoosh search index files to Firebase Storage to ensure global syncing."""
    from . import database

    logger.info("Uploading local Whoosh search index files to Firebase Storage...")
    try:
        bucket = database.get_storage_bucket()
        if not bucket:
            logger.warning("No storage bucket configured. Cannot back up index.")
            return
            
        index_dir = "search_index"
        if not os.path.exists(index_dir):
            return
            
        for root, _, files in os.walk(index_dir):
            for file in files:
                local_path = os.path.join(root, file)
                # Blob path inside GCS bucket
                blob_name = local_path.replace("\\", "/")
                blob = bucket.blob(blob_name)
                blob.upload_from_filename(local_path)
                
        logger.info("Search index backup upload to GCS completed successfully.")
    except Exception as e:
        logger.error(f"Failed to backup search index to Cloud Storage: {e}")
