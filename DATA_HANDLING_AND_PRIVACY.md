# Isaac Search Engine — Data Handling, Collection & Privacy Architecture

This document provides a technical breakdown of how **Isaac Search Engine** collects, processes, stores, transmits, retains, and deletes user and application data across its React frontend, Express/Node.js backend (`server.ts`), optional Python FastAPI/Firestore/Whoosh services (`backend/` & `crawler/`), and external metasearch/AI providers.

---

## 1. Core Data Architecture & Privacy Principles

1. **Zero Mandatory Account Tracking**: The application does not require user registration, personal identifiers (name, email, phone number), or authentication cookies to use search, crawling, graph analysis, collections, or research workspaces.
2. **Local-First Persistence**: User workspaces (Collections, Research Projects, Notebook drafts, Tag hierarchies, Theme preferences, and Blocked Domains) are persisted directly in the user's browser via `localStorage` and `sessionStorage`.
3. **Ephemeral Session ID**: A random UUID (`sessionId`) is generated in memory (`uuidv4()`) on page load solely to scope search history requests during that active session.
4. **Explicit Ephemeral Controls**: Users can enable **"Clear History on Exit"** (which automatically wipes persistent search history upon tab/window unload) or trigger **"Simulate Session Termination"** and **"Reset Local Cache & Reload"** at any time.

---

## 2. What Data the App Collects & Processes

### A. User-Entered Search & Discovery Data
- **Search Queries (`searchQuery`)**: Keywords, phrases, domain filters (`filterDomain`), date ranges, backlink thresholds, and inner result filters (`searchWithinQuery`) entered in Web Search, Image Search, or Fireplexity AI Search.
- **Voice Search Input (Optional)**: When the user clicks the microphone button, audio is processed locally by the browser's native Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) and converted into text for the search bar. Raw audio is never uploaded to the application's backend.
- **Read-Aloud Output (Optional)**: Uses the browser's native `window.speechSynthesis` API locally on the client device.

### B. User-Created Workspace & Curation Data
- **Search Collections (`collections`)**: Custom bookmark folders, folder descriptions, saved page references, and folder-specific research notes.
- **Research Projects (`projects`)**: Project titles, descriptions, status, target dates, nested tasks/subtasks, linked collections, and Markdown notebook contents.
- **Community Notes & Votes**: User-submitted contextual notes on indexed URLs and helpful/not-helpful votes.
- **Custom Indexed Pages & Crawler Seeds**: URLs, titles, snippets, canonical URLs, authors, languages, keywords, and topical tags manually indexed or imported via Common Crawl / Crawler Seed controls.

### C. System & Preferences Data
- **UI & Search Preferences**: Theme mode (`dark` / `light`), SearXNG fallback toggle (`isaac_searxng_fallback_enabled`), Read-Through Auto-Indexing toggle (`isaac_searxng_auto_index`), Clear History on Exit setting (`isaac_clear_history_on_exit`), and Blocked/Excluded domains (`blocked_domains`).

---

## 3. Client-Side Storage Inventory (`localStorage` & `sessionStorage`)

All client-side state is stored in standard Web Storage APIs scoped to the application origin. Below is the complete inventory of storage keys used by the app:

### `localStorage` Keys

| Storage Key | Component / Hook | Data Stored | Purpose & Lifecycle |
| :--- | :--- | :--- | :--- |
| `isaac_theme` | `src/App.tsx` | `'dark'` \| `'light'` | Persists user UI theme preference across sessions. |
| `isaac_history` | `src/App.tsx`, `SettingsModal.tsx` | `string[]` (recent search queries) | Stores recent search queries. Automatically wiped on tab close if `isaac_clear_history_on_exit` is `'true'`. |
| `isaac_clear_history_on_exit` | `src/App.tsx` | `'true'` \| `'false'` | Controls whether search history is automatically purged when the browser session ends. |
| `isaac_collections` | `src/App.tsx` | `SearchCollection[]` (JSON) | Stores user bookmark folders, saved pages, and folder notes. |
| `isaac_projects` | `src/App.tsx` | `ResearchProject[]` (JSON) | Stores research projects, nested tasks/subtasks, linked collections, and notes. |
| `isaac_notebook_draft_<projectId>` | `src/hooks/useNotebookAutosave.ts` | `string` (Markdown text) | Debounced autosave draft of the active project's research notebook. |
| `blocked_domains` | `src/App.tsx` | `string[]` (JSON) | Domains explicitly blocked by the user via the three-dot result menu; filtered out of all future searches. |
| `isaac_searxng_fallback_enabled` | `src/App.tsx` | `boolean` (JSON) | Whether sparse local search results automatically fall back to live SearXNG metasearch. |
| `isaac_searxng_auto_index` | `src/App.tsx` | `boolean` (JSON) | Whether live SearXNG fallback results are automatically saved to the catalog and crawler seeds. |
| `isaac_crawler_seeds` | `src/App.tsx` | `SeedItem[]` (JSON) | Fallback client-side cache of active crawler seed URLs and domains. |
| `isaac_auto_crawl_enabled` | `src/App.tsx` | `boolean` (JSON) | Persists the state of the Autonomous Background Spider toggle. |
| `isaac_fireplexity_turns` | `src/components/FireplexityTab.tsx` | `ConversationTurn[]` (JSON) | Stores multi-turn AI research threads, citations, and follow-up questions in the Fireplexity tab. |
| `isaac_fireplexity_auto_index` | `src/components/FireplexityTab.tsx` | `'true'` \| `'false'` | Controls whether web sources scraped during Fireplexity searches are auto-indexed into the catalog. |
| `isaac_tag_hierarchy_relationships` | `src/components/TagHierarchyTree.tsx` | `Record<string, string>` (JSON) | Stores custom parent-child tag taxonomy relationships configured by the user. |
| `isaac_community_notes_<url>` | `src/components/CommunityNotesSection.tsx` | `CommunityNote[]` (JSON) | Local cache of community notes attached to a specific URL. |
| `isaac_community_note_votes_<url>` | `src/components/CommunityNotesSection.tsx` | `Record<string, 'up' \| 'down'>` | Tracks which community notes the user has upvoted or downvoted on a URL. |

### `sessionStorage` Keys

| Storage Key | Component | Data Stored | Purpose & Lifecycle |
| :--- | :--- | :--- | :--- |
| `isaac_session_active` | `src/App.tsx` | `'true'` | Detects whether the current page load is a fresh browser session vs. an in-tab reload. Cleared when the browser tab/window closes. |
| `isaac_history_session_cache` | `src/App.tsx`, `SettingsModal.tsx` | `string[]` (JSON) | Preserves search history across page refreshes within the same tab while "Clear History on Exit" is enabled, disappearing once the tab is closed. |

---

## 4. Backend Server Data Handling (`server.ts`)

The Node.js/Express server (`server.ts`) processes API requests under `/api/*` and maintains non-persistent, in-memory data structures for fast local indexing and search:

1. **In-Memory Search Index (`serverIndexedPages`)**:
   - Holds the initial seed corpus plus any pages added via `POST /api/index` or auto-indexed during SearXNG/Fireplexity read-through fallback.
   - Supports BM25 relevance scoring, tag/domain/date/backlink filtering, and pagination (`GET /api/search`).
2. **In-Memory Search History (`sessionSearchHistory`)**:
   - Keyed by the client's ephemeral `session_id`.
   - Accessed via `GET /api/history`, updated on search, and purged immediately when `DELETE /api/history?session_id=...` is called.
3. **In-Memory Crawler State (`serverSeeds`, `serverSchedule`, `serverCrawlHistory`)**:
   - Stores crawler seed URLs (`/api/crawler/seeds`), recurring schedule settings (`/api/crawler/schedule`), and crawl run telemetry logs (`/api/crawler/history`).
4. **In-Memory Community Notes (`communityNotesByUrl`)**:
   - Stores community notes and helpfulness scores per URL (`/api/community-notes`).

> **Note on Persistence**: All in-memory structures in `server.ts` reset to their clean default seed state whenever the server process restarts. If the optional Python backend (`backend/main.py`) with Google Cloud Firestore is connected, indexed pages, crawl history, and schedules are persisted to the configured Firestore collections (`pages`, `crawler_history`, `crawler_seeds`).

---

## 5. External & Third-Party Data Flows

When performing live web searches, metasearch fallbacks, or AI synthesis, the backend sends **only the search query (and optional domain filter)** to external APIs. No personal user data, cookies, or browser storage contents are transmitted to third parties.

| External Service | Trigger Condition | Data Sent | Purpose |
| :--- | :--- | :--- | :--- |
| **SearXNG Instances** (`SEARXNG_URL` or public instances) | `GET /api/search` when local index matches `< min_results` (or `force_fallback=true`) | Search query (`q`), page number (`pageno`), language (`en`) | Privacy-respecting metasearch fallback to retrieve live web results and auto-seed the index. |
| **Wikipedia REST / MediaWiki API** (`en.wikipedia.org/w/api.php`) | SearXNG cascade fallback & Fireplexity multi-source retrieval | Search query (`gsrsearch`) | Retrieves encyclopedia extracts, URLs, and thumbnail images. |
| **Hacker News Algolia API** (`hn.algolia.com/api/v1/search`) | SearXNG cascade fallback & Fireplexity news retrieval | Search query (`query`) | Retrieves technical articles, community discussions, and news items. |
| **DuckDuckGo Instant Answer API** (`api.duckduckgo.com`) | SearXNG cascade fallback | Search query (`q`) | Retrieves instant answer abstracts and related topic links. |
| **Common Crawl CDX API** (`index.commoncrawl.org`) | User clicks "Search Common Crawl" in Crawler tab | Target domain (`domain`) and result limit (`limit`) | Discovers historical crawled URLs for seed import. |
| **Firecrawl API** (`api.firecrawl.dev`) *(Optional)* | Fireplexity search when `FIRECRAWL_API_KEY` is configured on server | Search query (`query`) | Scrapes live web pages into clean Markdown for citation synthesis. |
| **Groq API / Google Gemini API** *(Optional)* | Fireplexity synthesis (`POST /api/fireplexity`) or AI Tag Suggestion when server API keys (`GROQ_API_KEY` / `GEMINI_API_KEY`) are set | Search query and scraped public web excerpts | Generates cited Markdown synthesis, follow-up questions, and topical metadata tags. |

---

## 6. User Data Controls, Export & Deletion Mechanisms

Users have full ownership and granular control over their data directly within the UI:

1. **Clear Search History**:
   - Available in **Settings (`Ctrl+,`)** and the search bar history dropdown.
   - Immediately removes `isaac_history` from `localStorage`, clears `isaac_history_session_cache` from `sessionStorage`, and sends `DELETE /api/history` to wipe server-side session history.
2. **Clear History on Exit (Ephemeral Mode)**:
   - Toggleable in **SettingsModal**. When active, a `beforeunload` listener removes `isaac_history` from `localStorage` when the tab or browser closes.
3. **Simulate Session Termination**:
   - Available in **SettingsModal** to test and verify immediate history destruction without closing the browser.
4. **Domain Blocking & Filtering**:
   - Users can exclude a domain for a single search or permanently block a domain via the result card menu, or clear all blocked domains in one click.
5. **Data Portability (Export & Import)**:
   - **Search Results**: Exportable to PDF.
   - **Collections**: Exportable and importable as structured `.json`, `.csv`, or `.md` files (single folder or batch export).
   - **Research Projects**: Exportable as Markdown, JSON, CSV, or formatted PDF briefs.
   - **Crawler Logs**: Exportable as raw `.log` text files.
6. **Full Factory Reset**:
   - The root error boundary and browser storage clear (`localStorage.clear()` / `sessionStorage.clear()`) wipe all locally stored state and restore the application to its initial default state.
