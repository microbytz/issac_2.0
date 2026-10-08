import os
import json
import time
import logging
import threading

logger = logging.getLogger(__name__)

SEARCH_KEY_PREFIX = "search:"

_redis_client = None
_redis_checked = False
_memory_cache = {}
_memory_lock = threading.Lock()


def get_redis_client():
    """Return a connected Redis client, or None when REDIS_URL is unset or unreachable."""
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client
    _redis_checked = True
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        return None
    try:
        import redis
        client = redis.Redis.from_url(redis_url, socket_connect_timeout=2, socket_timeout=2)
        client.ping()
        _redis_client = client
    except Exception as e:
        logger.warning(f"Redis unavailable, using in-memory cache: {e}")
        _redis_client = None
    return _redis_client


def cache_get(key):
    client = get_redis_client()
    if client:
        try:
            raw = client.get(key)
            return json.loads(raw) if raw is not None else None
        except Exception as e:
            logger.warning(f"Redis get failed for {key}: {e}")
            return None
    with _memory_lock:
        entry = _memory_cache.get(key)
        if not entry:
            return None
        expires_at, value = entry
        if expires_at < time.time():
            _memory_cache.pop(key, None)
            return None
        return value


def cache_set(key, value, ttl=60):
    client = get_redis_client()
    if client:
        try:
            client.setex(key, ttl, json.dumps(value))
        except Exception as e:
            logger.warning(f"Redis set failed for {key}: {e}")
        return
    with _memory_lock:
        _memory_cache[key] = (time.time() + ttl, value)


def invalidate_search_cache():
    client = get_redis_client()
    if client:
        try:
            keys = list(client.scan_iter(match=f"{SEARCH_KEY_PREFIX}*"))
            if keys:
                client.delete(*keys)
        except Exception as e:
            logger.warning(f"Redis search cache invalidation failed: {e}")
        return
    with _memory_lock:
        for key in [k for k in _memory_cache if k.startswith(SEARCH_KEY_PREFIX)]:
            _memory_cache.pop(key, None)
