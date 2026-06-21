import os

BOT_NAME = "isaac_crawler"

SPIDER_MODULES = ["isaac_crawler.spiders"]
NEWSPIDER_MODULE = "isaac_crawler.spiders"

# Respect robots.txt rules
ROBOTSTXT_OBEY = True

# Max depth limit for safety
DEPTH_LIMIT = 3

# Configure item pipelines
ITEM_PIPELINES = {
    "isaac_crawler.pipelines.IsaacPipeline": 300,
}

# Autothrottling for polite crawling
AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 1.0
AUTOTHROTTLE_MAX_DELAY = 10.0

# Set backend endpoint URL for reporting content
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")
