export interface PageItem {
  id: string;
  url: string;
  title: string;
  snippet: string;
  canonical_url?: string;
  content?: string;
  backlinks?: number;
  indexed_at?: string;
  cache_hit?: boolean;
  likes?: number;
  author?: string;
  language?: string;
  tags?: string[];
  meta_description?: string;
  keywords?: string[] | string;
}

export interface SearchCollection {
  id: string;
  name: string;
  description?: string;
  pages: PageItem[];
  created_at: string;
  notes?: string;
}

export interface BulkExportOptions {
  includeContent: boolean;
  includeNotes: boolean;
  includeMetadata: boolean;
  includeAnalytics: boolean;
  prettyPrint: boolean;
}

export interface ExportStats {
  totalBookmarks: number;
  uniqueDomains: string[];
  uniqueTags: string[];
  totalBacklinks: number;
  totalLikes: number;
  estimatedWords: number;
  estimatedReadingTimeMin: number;
}

export function extractDomain(urlString: string): string {
  try {
    const parsed = new URL(urlString);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return urlString.replace(/^https?:\/\//i, '').split('/')[0] || 'unknown-domain';
  }
}

export function calculateExportStats(pages: PageItem[]): ExportStats {
  const domainSet = new Set<string>();
  const tagSet = new Set<string>();
  let backlinks = 0;
  let likes = 0;
  let wordCount = 0;

  pages.forEach(p => {
    domainSet.add(extractDomain(p.url));
    if (p.tags && Array.isArray(p.tags)) {
      p.tags.forEach(t => tagSet.add(t.toLowerCase()));
    }
    backlinks += p.backlinks || 0;
    likes += p.likes || 0;

    const textToCount = `${p.title || ''} ${p.snippet || ''} ${p.content || ''}`;
    const words = textToCount.trim().split(/\s+/).filter(Boolean).length;
    wordCount += words;
  });

  const estimatedReadingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  return {
    totalBookmarks: pages.length,
    uniqueDomains: Array.from(domainSet),
    uniqueTags: Array.from(tagSet),
    totalBacklinks: backlinks,
    totalLikes: likes,
    estimatedWords: wordCount,
    estimatedReadingTimeMin
  };
}

export function generateCollectionJsonArchive(
  folder: SearchCollection,
  options: BulkExportOptions = {
    includeContent: true,
    includeNotes: true,
    includeMetadata: true,
    includeAnalytics: true,
    prettyPrint: true
  },
  selectedPageIds?: string[]
): { data: Record<string, any>; jsonString: string; filename: string; stats: ExportStats } {
  const filteredPages = selectedPageIds && selectedPageIds.length > 0
    ? (folder.pages || []).filter(p => selectedPageIds.includes(p.id))
    : (folder.pages || []);

  const stats = calculateExportStats(filteredPages);
  const now = new Date();
  const exportedAtIso = now.toISOString();
  const exportedAtUtc = now.toUTCString();

  const domainFrequency: Record<string, number> = {};
  filteredPages.forEach(p => {
    const dom = extractDomain(p.url);
    domainFrequency[dom] = (domainFrequency[dom] || 0) + 1;
  });

  const bookmarksData = filteredPages.map((page, index) => {
    const item: Record<string, any> = {
      index: index + 1,
      id: page.id,
      title: page.title,
      url: page.url,
      domain: extractDomain(page.url),
      snippet: page.snippet || ''
    };

    if (options.includeContent && page.content) {
      item.content = page.content;
    }

    if (options.includeMetadata) {
      item.author = page.author || 'Unknown';
      item.language = page.language || 'English';
      item.tags = page.tags || [];
      item.keywords = Array.isArray(page.keywords)
        ? page.keywords
        : typeof page.keywords === 'string'
        ? page.keywords.split(',').map(k => k.trim())
        : [];
      item.meta_description = page.meta_description || '';
      if (page.canonical_url) {
        item.canonical_url = page.canonical_url;
      }
    }

    if (options.includeAnalytics) {
      item.metrics = {
        backlinks: page.backlinks || 0,
        likes: page.likes || 0,
        indexed_at: page.indexed_at || null,
        cache_hit: page.cache_hit || false
      };
    }

    return item;
  });

  const payload: Record<string, any> = {
    $schema: 'https://isaac-search.app/schema/research-archive-v1.json',
    archive_format: 'isaac_collections_bulk_archive',
    version: '1.2.0',
    app: 'Isaac Search Engine & Research Workspace',
    exported_at_iso: exportedAtIso,
    exported_at_utc: exportedAtUtc,
    folder: {
      id: folder.id,
      name: folder.name,
      description: folder.description || '',
      created_at: folder.created_at || exportedAtUtc,
      total_bookmarks: filteredPages.length,
      is_partial_export: selectedPageIds && selectedPageIds.length > 0 && selectedPageIds.length < (folder.pages?.length || 0)
    }
  };

  if (options.includeNotes && folder.notes) {
    payload.folder.research_notes = folder.notes;
  }

  if (options.includeAnalytics) {
    payload.research_summary = {
      total_bookmarks_archived: filteredPages.length,
      unique_domains_count: stats.uniqueDomains.length,
      domain_distribution: domainFrequency,
      unique_tags_count: stats.uniqueTags.length,
      tags_list: stats.uniqueTags,
      total_accumulated_backlinks: stats.totalBacklinks,
      total_accumulated_upvotes: stats.totalLikes,
      estimated_total_words: stats.estimatedWords,
      estimated_reading_time_minutes: stats.estimatedReadingTimeMin
    };
  }

  payload.bookmarks = bookmarksData;

  const jsonString = options.prettyPrint
    ? JSON.stringify(payload, null, 2)
    : JSON.stringify(payload);

  const safeFolderName = folder.name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'collection';

  const dateSlug = now.toISOString().split('T')[0];
  const filename = `${safeFolderName}_research_archive_${dateSlug}.json`;

  return {
    data: payload,
    jsonString,
    filename,
    stats
  };
}

export function downloadCollectionJsonArchive(
  folder: SearchCollection,
  options?: BulkExportOptions,
  selectedPageIds?: string[],
  customFilename?: string
): { success: boolean; filename: string; count: number } {
  try {
    const { jsonString, filename: defaultFilename, stats } = generateCollectionJsonArchive(
      folder,
      options,
      selectedPageIds
    );

    const finalFilename = customFilename && customFilename.trim().length > 0
      ? (customFilename.endsWith('.json') ? customFilename : `${customFilename}.json`)
      : defaultFilename;

    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      filename: finalFilename,
      count: stats.totalBookmarks
    };
  } catch (error) {
    console.error('Failed to trigger bulk export download:', error);
    return {
      success: false,
      filename: '',
      count: 0
    };
  }
}

export interface MasterCollectionsBackup {
  $schema: string;
  archive_format: string;
  version: string;
  app: string;
  exported_at_iso: string;
  exported_at_utc: string;
  total_collections: number;
  total_bookmarks: number;
  metadata: {
    generator: string;
    description: string;
    summary: {
      collections_count: number;
      total_bookmarks_count: number;
      unique_domains_count: number;
      unique_domains: string[];
      unique_tags_count: number;
      unique_tags: string[];
      total_backlinks: number;
      total_likes: number;
      estimated_total_words: number;
      estimated_reading_time_minutes: number;
    };
    collection_manifest: Array<{
      id: string;
      name: string;
      description?: string;
      bookmark_count: number;
      created_at: string;
    }>;
  };
  collections: Array<{
    id: string;
    name: string;
    description?: string;
    created_at: string;
    notes?: string;
    total_bookmarks: number;
    pages: PageItem[];
  }>;
}

export function generateMasterCollectionsJsonArchive(
  collections: SearchCollection[],
  options: BulkExportOptions = {
    includeContent: true,
    includeNotes: true,
    includeMetadata: true,
    includeAnalytics: true,
    prettyPrint: true
  },
  selectedCollectionIds?: string[]
): {
  data: MasterCollectionsBackup;
  jsonString: string;
  filename: string;
  stats: ExportStats;
  collectionsCount: number;
  totalBookmarks: number;
} {
  const targetCollections = selectedCollectionIds && selectedCollectionIds.length > 0
    ? collections.filter(c => selectedCollectionIds.includes(c.id))
    : collections;

  const now = new Date();
  const exportedAtIso = now.toISOString();
  const exportedAtUtc = now.toUTCString();

  const domainSet = new Set<string>();
  const tagSet = new Set<string>();
  const domainFrequency: Record<string, number> = {};
  let totalBacklinks = 0;
  let totalLikes = 0;
  let totalWords = 0;
  let totalBookmarks = 0;

  const sanitizedCollections = targetCollections.map(col => {
    const rawPages = col.pages || [];
    totalBookmarks += rawPages.length;

    const sanitizedPages = rawPages.map((page, idx) => {
      const dom = extractDomain(page.url);
      domainSet.add(dom);
      domainFrequency[dom] = (domainFrequency[dom] || 0) + 1;

      if (page.tags && Array.isArray(page.tags)) {
        page.tags.forEach(t => tagSet.add(t.toLowerCase()));
      }

      totalBacklinks += page.backlinks || 0;
      totalLikes += page.likes || 0;

      const pageText = `${page.title || ''} ${page.snippet || ''} ${page.content || ''}`;
      const pageWords = pageText.trim().split(/\s+/).filter(Boolean).length;
      totalWords += pageWords;

      const item: Record<string, any> = {
        index: idx + 1,
        id: page.id,
        title: page.title,
        url: page.url,
        domain: dom,
        snippet: page.snippet || ''
      };

      if (options.includeContent && page.content) {
        item.content = page.content;
      }

      if (options.includeMetadata) {
        item.author = page.author || 'Unknown';
        item.language = page.language || 'English';
        item.tags = page.tags || [];
        item.keywords = Array.isArray(page.keywords)
          ? page.keywords
          : typeof page.keywords === 'string'
          ? page.keywords.split(',').map(k => k.trim())
          : [];
        item.meta_description = page.meta_description || '';
        if (page.canonical_url) {
          item.canonical_url = page.canonical_url;
        }
      }

      if (options.includeAnalytics) {
        item.metrics = {
          backlinks: page.backlinks || 0,
          likes: page.likes || 0,
          indexed_at: page.indexed_at || null,
          cache_hit: page.cache_hit || false
        };
      }

      return item as PageItem;
    });

    const colObj: Record<string, any> = {
      id: col.id,
      name: col.name,
      description: col.description || '',
      created_at: col.created_at || exportedAtUtc,
      total_bookmarks: sanitizedPages.length,
      pages: sanitizedPages
    };

    if (options.includeNotes && col.notes) {
      colObj.notes = col.notes;
    }

    return colObj as {
      id: string;
      name: string;
      description?: string;
      created_at: string;
      notes?: string;
      total_bookmarks: number;
      pages: PageItem[];
    };
  });

  const estimatedReadingTimeMin = Math.max(1, Math.ceil(totalWords / 200));

  const stats: ExportStats = {
    totalBookmarks,
    uniqueDomains: Array.from(domainSet),
    uniqueTags: Array.from(tagSet),
    totalBacklinks,
    totalLikes,
    estimatedWords: totalWords,
    estimatedReadingTimeMin
  };

  const payload: MasterCollectionsBackup = {
    $schema: 'https://isaac-search.app/schema/master-collections-backup-v1.json',
    archive_format: 'isaac_master_collections_backup',
    version: '1.0.0',
    app: 'Isaac Search Engine & Research Workspace',
    exported_at_iso: exportedAtIso,
    exported_at_utc: exportedAtUtc,
    total_collections: sanitizedCollections.length,
    total_bookmarks: totalBookmarks,
    metadata: {
      generator: 'Isaac Search Master Backup & Migration Engine',
      description: 'Master JSON bundle containing all categorized bookmark collections, metadata, and research notes.',
      summary: {
        collections_count: sanitizedCollections.length,
        total_bookmarks_count: totalBookmarks,
        unique_domains_count: domainSet.size,
        unique_domains: Array.from(domainSet),
        unique_tags_count: tagSet.size,
        unique_tags: Array.from(tagSet),
        total_backlinks: totalBacklinks,
        total_likes: totalLikes,
        estimated_total_words: totalWords,
        estimated_reading_time_minutes: estimatedReadingTimeMin
      },
      collection_manifest: sanitizedCollections.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        bookmark_count: c.total_bookmarks,
        created_at: c.created_at
      }))
    },
    collections: sanitizedCollections
  };

  const jsonString = options.prettyPrint
    ? JSON.stringify(payload, null, 2)
    : JSON.stringify(payload);

  const dateSlug = now.toISOString().split('T')[0];
  const filename = `isaac_master_collections_backup_${dateSlug}.json`;

  return {
    data: payload,
    jsonString,
    filename,
    stats,
    collectionsCount: sanitizedCollections.length,
    totalBookmarks
  };
}

export function downloadMasterCollectionsJsonArchive(
  collections: SearchCollection[],
  options?: BulkExportOptions,
  selectedCollectionIds?: string[],
  customFilename?: string
): { success: boolean; filename: string; collectionsCount: number; totalBookmarks: number } {
  try {
    const { jsonString, filename: defaultFilename, collectionsCount, totalBookmarks } = generateMasterCollectionsJsonArchive(
      collections,
      options,
      selectedCollectionIds
    );

    const finalFilename = customFilename && customFilename.trim().length > 0
      ? (customFilename.endsWith('.json') ? customFilename : `${customFilename}.json`)
      : defaultFilename;

    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return {
      success: true,
      filename: finalFilename,
      collectionsCount,
      totalBookmarks
    };
  } catch (error) {
    console.error('Failed to trigger master bulk export download:', error);
    return {
      success: false,
      filename: '',
      collectionsCount: 0,
      totalBookmarks: 0
    };
  }
}
