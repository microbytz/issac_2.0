import os
import logging
from whoosh.index import create_in, open_dir, exists_in
from whoosh.fields import Schema, TEXT, ID, NUMERIC
from whoosh.qparser import QueryParser
from whoosh.spelling import SpellChecker

logger = logging.getLogger(__name__)
INDEX_DIR = os.getenv("WHOOSH_INDEX_DIR", "search_index")

def get_schema():
    return Schema(
        id=ID(stored=True, unique=True),
        url=ID(stored=True),
        title=TEXT(stored=True),
        content=TEXT(stored=True),
        snippet=TEXT(stored=True),
        indexed_at=TEXT(stored=True),
        indexed_time=NUMERIC(stored=True, type=float),
        backlinks=NUMERIC(stored=True, type=int)
    )

def init_index():
    if not os.path.exists(INDEX_DIR):
        os.makedirs(INDEX_DIR)
    schema = get_schema()
    if not exists_in(INDEX_DIR):
        return create_in(INDEX_DIR, schema)
    try:
        ix = open_dir(INDEX_DIR)
        # Recreate the index if schemas do not match, avoiding FormatError
        if ix.schema != schema:
            logger.info("Whoosh Schema mismatch detected. Recreating index.")
            return create_in(INDEX_DIR, schema)
        return ix
    except Exception as e:
        logger.error(f"Whoosh index corrupted or unreadable: {e}. Recreating index.")
        return create_in(INDEX_DIR, schema)

def index_page(page_id, url, title, content, snippet, indexed_at=None, indexed_time=None, backlinks=0):
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

def search_query(q, page=1, limit=10, domain=None, date_from=None, date_to=None, min_backlinks=None, sort_by=None):
    try:
        ix = init_index()
        with ix.searcher() as searcher:
            query = QueryParser("content", ix.schema).parse(q)
            results = searcher.search(query, limit=200)
            
            hit_list = []
            for hit in results:
                # domain filter
                url = hit.get("url") or ""
                if domain:
                    from urllib.parse import urlparse
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
                
                hit_list.append({
                    "id": hit.get("id"),
                    "url": hit.get("url"),
                    "title": hit.get("title"),
                    "snippet": hit.get("snippet") or (hit.highlights("content") if hasattr(hit, 'highlights') else ""),
                    "indexed_at": hit.get("indexed_at") or "",
                    "indexed_time": hit.get("indexed_time") or 0.0,
                    "backlinks": int(hit.get("backlinks") or 0)
                })
            
            # sorting
            if sort_by == "date_desc":
                hit_list.sort(key=lambda x: x.get("indexed_time", 0.0), reverse=True)
            elif sort_by == "date_asc":
                hit_list.sort(key=lambda x: x.get("indexed_time", 0.0))
            elif sort_by == "backlinks_desc":
                hit_list.sort(key=lambda x: x.get("backlinks", 0), reverse=True)
                
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
            # Simple term autocomplete
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
