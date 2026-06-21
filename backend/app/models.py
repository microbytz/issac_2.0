# Since the database has migrated to Firestore, SQL Models are deprecated.
# This file provides Pydantic data schemas/types for compatibility.

from pydantic import BaseModel, HttpUrl
from typing import Optional, List

class PageModel(BaseModel):
    url: str
    title: Optional[str] = None
    content: Optional[str] = None
    snippet: Optional[str] = None
    indexed_at: Optional[str] = None

class BacklinkModel(BaseModel):
    source_url: str
    target_url: str

class ImageModel(BaseModel):
    url: str
    alt_text: Optional[str] = None
    source_url: str
    title: Optional[str] = None
