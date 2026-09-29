import { PageItem, SearchCollection, extractDomain } from './collectionExport';

export interface ProjectTask {
  id: string;
  text: string;
  completed: boolean;
  subtasks?: ProjectTask[];
}

export interface ResearchProject {
  id: string;
  name: string;
  description: string;
  status: 'planning' | 'in_progress' | 'review' | 'completed';
  created_at: string;
  target_date?: string;
  notes: string;
  tasks: ProjectTask[];
  collectionIds: string[];
  linkedPages?: PageItem[];
}

export interface ProjectExportStats {
  totalTasks: number;
  completedTasks: number;
  totalSubtasks?: number;
  completedSubtasks?: number;
  totalActionableItems?: number;
  completedActionableItems?: number;
  taskProgressPct: number;
  totalFolders: number;
  totalReferences: number;
  directPagesCount: number;
  folderPagesCount: number;
  notesWordCount: number;
  uniqueDomainsCount: number;
}

/**
 * Escapes a cell value for standard RFC 4180 CSV output.
 */
export function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) {
    return '""';
  }
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Collects all pages associated with a research project (direct links + linked collections).
 */
export function getAllProjectPages(
  project: ResearchProject,
  linkedCols: SearchCollection[]
): (PageItem & { folderName: string; isDirect: boolean })[] {
  const directPages = (project.linkedPages || []).map(p => ({
    ...p,
    folderName: 'Direct Link',
    isDirect: true
  }));
  const folderPages = linkedCols.flatMap(col =>
    (col.pages || []).map(p => ({
      ...p,
      folderName: col.name,
      isDirect: false
    }))
  );
  return [...directPages, ...folderPages];
}

/**
 * Calculates summary metrics for project export.
 */
export function calculateProjectExportStats(
  project: ResearchProject,
  linkedCols: SearchCollection[]
): ProjectExportStats {
  const allPages = getAllProjectPages(project, linkedCols);
  const directCount = (project.linkedPages || []).length;
  const folderCount = allPages.length - directCount;
  
  let totalTasks = 0;
  let completedTasks = 0;
  let totalSubtasks = 0;
  let completedSubtasks = 0;

  (project.tasks || []).forEach(t => {
    totalTasks += 1;
    if (t.completed) completedTasks += 1;
    (t.subtasks || []).forEach(st => {
      totalSubtasks += 1;
      if (st.completed) completedSubtasks += 1;
    });
  });

  const totalActionableItems = totalTasks + totalSubtasks;
  const completedActionableItems = completedTasks + completedSubtasks;
  const taskProgressPct = totalActionableItems > 0
    ? Math.round((completedActionableItems / totalActionableItems) * 100)
    : (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0);
  
  const domainSet = new Set<string>();
  allPages.forEach(p => {
    domainSet.add(extractDomain(p.url));
  });

  const notesWords = (project.notes || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return {
    totalTasks,
    completedTasks,
    totalSubtasks,
    completedSubtasks,
    totalActionableItems,
    completedActionableItems,
    taskProgressPct,
    totalFolders: linkedCols.length,
    totalReferences: allPages.length,
    directPagesCount: directCount,
    folderPagesCount: folderCount,
    notesWordCount: notesWords,
    uniqueDomainsCount: domainSet.size
  };
}

/**
 * Generates a comprehensive, clean Markdown document representing the entire project.
 */
export function generateProjectMarkdown(
  project: ResearchProject,
  linkedCols: SearchCollection[]
): string {
  const stats = calculateProjectExportStats(project, linkedCols);
  const allPages = getAllProjectPages(project, linkedCols);
  const now = new Date();
  const createdFormatted = project.created_at
    ? new Date(project.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Not recorded';
  const targetFormatted = project.target_date
    ? new Date(project.target_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'None specified';

  const statusLabel = project.status.replace('_', ' ').toUpperCase();

  let md = `# 🎯 ${project.name}\n\n`;
  md += `> **Workspace ID:** \`${project.id}\`  \n`;
  md += `> **Status:** \`${statusLabel}\`  \n`;
  md += `> **Created Date:** ${createdFormatted}  \n`;
  md += `> **Target Deadline:** ${targetFormatted}  \n`;
  md += `> **Objectives Completion:** ${stats.completedTasks}/${stats.totalTasks} objectives  \n`;
  if ((stats.totalSubtasks || 0) > 0) {
    md += `> **Granular Subtasks:** ${stats.completedSubtasks}/${stats.totalSubtasks} subtasks  \n`;
    md += `> **Overall Progress:** ${stats.completedActionableItems}/${stats.totalActionableItems} items (${stats.taskProgressPct}%)  \n`;
  } else {
    md += `> **Tasks Completion:** ${stats.completedTasks}/${stats.totalTasks} (${stats.taskProgressPct}%)  \n`;
  }
  md += `> **Linked Resources:** ${stats.totalFolders} folders · ${stats.totalReferences} references\n\n`;

  md += `## 📋 Overview\n\n`;
  md += `${project.description || '_No project overview provided._'}\n\n`;

  // Synthesis Notebook / Notes
  md += `## 📝 Research Synthesis & Notes\n\n`;
  if (project.notes && project.notes.trim().length > 0) {
    md += `${project.notes.trim()}\n\n`;
  } else {
    md += `_No notebook notes recorded for this workspace._\n\n`;
  }

  // Tasks Checklist
  md += `## ✅ Research Tasks & Nested Subtasks\n\n`;
  if (project.tasks && project.tasks.length > 0) {
    md += `| Status | Level | Item Description | Item ID |\n`;
    md += `| :---: | :---: | :--- | :--- |\n`;
    project.tasks.forEach((task, idx) => {
      const mark = task.completed ? '✅ Done' : '⏳ Pending';
      const cleanText = task.text.replace(/\|/g, '\\|');
      md += `| ${mark} | Objective | **${cleanText}** | \`${task.id || `task_${idx + 1}`}\` |\n`;
      (task.subtasks || []).forEach((st, sIdx) => {
        const subMark = st.completed ? '✅ Done' : '⏳ Pending';
        const cleanSubText = st.text.replace(/\|/g, '\\|');
        md += `| ${subMark} | Subtask | &nbsp;&nbsp;↳ _${cleanSubText}_ | \`${st.id || `subtask_${idx + 1}_${sIdx + 1}`}\` |\n`;
      });
    });
    md += `\n**Interactive Markdown Checkbox Hierarchy:**\n\n`;
    project.tasks.forEach(task => {
      md += `- [${task.completed ? 'x' : ' '}] **${task.text}**\n`;
      (task.subtasks || []).forEach(st => {
        md += `  - [${st.completed ? 'x' : ' '}] ${st.text}\n`;
      });
    });
    md += `\n`;
  } else {
    md += `_No action tasks defined for this workspace._\n\n`;
  }

  // Linked Folders
  md += `## 📁 Linked Collections & Folders\n\n`;
  if (linkedCols.length > 0) {
    linkedCols.forEach((col, idx) => {
      md += `### ${idx + 1}. ${col.name}\n`;
      md += `- **Folder ID:** \`${col.id}\`\n`;
      md += `- **Bookmarks Stored:** ${col.pages ? col.pages.length : 0} items\n`;
      if (col.description) {
        md += `- **Description:** ${col.description}\n`;
      }
      if (col.notes) {
        md += `- **Folder Notes:** ${col.notes.trim()}\n`;
      }
      md += `\n`;
    });
  } else {
    md += `_No bookmark collections currently linked to this project._\n\n`;
  }

  // Reference Catalog
  md += `## 📚 Reference Catalog (${allPages.length} sources)\n\n`;
  if (allPages.length > 0) {
    md += `| # | Title | URL | Canonical URL | Source / Folder | Tags | Metrics |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    allPages.forEach((page, idx) => {
      const cleanTitle = (page.title || 'Untitled Page').replace(/\|/g, '\\|');
      const cleanTags = Array.isArray(page.tags) ? page.tags.join(', ') : '-';
      const canonicalDisplay = page.canonical_url ? `[\`${page.canonical_url}\`](${page.canonical_url})` : '-';
      const sourceTag = page.isDirect ? 'Direct Link' : page.folderName;
      const metrics = `👍 ${page.likes || 0} · 🔗 ${page.backlinks || 0}`;

      md += `| ${idx + 1} | [${cleanTitle}](${page.url}) | [Link](${page.url}) | ${canonicalDisplay} | ${sourceTag} | ${cleanTags} | ${metrics} |\n`;
    });
    md += `\n`;

    md += `### Detailed Source Summaries\n\n`;
    allPages.forEach((page, idx) => {
      md += `#### ${idx + 1}. ${page.title || 'Untitled Page'}\n`;
      md += `- **URL:** <${page.url}>\n`;
      if (page.canonical_url) {
        md += `- **Canonical URL:** <${page.canonical_url}>\n`;
      }
      md += `- **Folder:** ${page.isDirect ? 'Direct Link' : page.folderName}\n`;
      if (page.author) {
        md += `- **Author:** ${page.author}\n`;
      }
      if (page.language) {
        md += `- **Language:** ${page.language}\n`;
      }
      if (page.tags && page.tags.length > 0) {
        md += `- **Tags:** \`${page.tags.join('`, `')}\`\n`;
      }
      if (page.snippet) {
        md += `- **Snippet:** ${page.snippet}\n`;
      }
      md += `\n`;
    });
  } else {
    md += `_No reference pages or bookmark links attached yet._\n\n`;
  }

  md += `---\n`;
  md += `*Generated by Isaac Search Engine Research Workspace on ${now.toUTCString()}*\n`;

  return md;
}

/**
 * Generates an RFC 4180 CSV string for all Project Reference Catalog pages.
 */
export function generateProjectReferencesCsv(
  project: ResearchProject,
  linkedCols: SearchCollection[]
): string {
  const allPages = getAllProjectPages(project, linkedCols);
  const headers = [
    'Index',
    'Project ID',
    'Project Name',
    'Page Title',
    'Page URL',
    'Canonical URL',
    'Domain',
    'Source / Folder',
    'Is Direct Link',
    'Snippet',
    'Author',
    'Language',
    'Tags',
    'Upvotes',
    'Backlinks',
    'Indexed Date'
  ];

  const rows: string[][] = [headers];

  allPages.forEach((page, idx) => {
    rows.push([
      String(idx + 1),
      project.id,
      project.name,
      page.title || '',
      page.url || '',
      page.canonical_url || '',
      extractDomain(page.url),
      page.folderName,
      page.isDirect ? 'Yes' : 'No',
      page.snippet || '',
      page.author || '',
      page.language || '',
      Array.isArray(page.tags) ? page.tags.join('; ') : '',
      String(page.likes || 0),
      String(page.backlinks || 0),
      page.indexed_at || ''
    ]);
  });

  return rows.map(r => r.map(escapeCsvCell).join(',')).join('\r\n');
}

/**
 * Generates an RFC 4180 CSV string for Project Tasks.
 */
export function generateProjectTasksCsv(project: ResearchProject): string {
  const headers = [
    'Task Number',
    'Task ID',
    'Hierarchy Level',
    'Parent Task ID',
    'Task / Subtask Description',
    'Status',
    'Completed (Boolean)',
    'Subtask Count',
    'Completed Subtasks',
    'Project ID',
    'Project Name',
    'Project Target Date'
  ];

  const rows: string[][] = [headers];

  (project.tasks || []).forEach((task, idx) => {
    const subtasks = task.subtasks || [];
    const completedSubs = subtasks.filter(st => st.completed).length;

    // Main task row
    rows.push([
      String(idx + 1),
      task.id,
      'Objective',
      '',
      task.text,
      task.completed ? 'Completed' : 'Pending',
      task.completed ? 'TRUE' : 'FALSE',
      String(subtasks.length),
      String(completedSubs),
      project.id,
      project.name,
      project.target_date || ''
    ]);

    // Subtask rows
    subtasks.forEach((st, sIdx) => {
      rows.push([
        `${idx + 1}.${sIdx + 1}`,
        st.id,
        'Subtask',
        task.id,
        `  ↳ ${st.text}`,
        st.completed ? 'Completed' : 'Pending',
        st.completed ? 'TRUE' : 'FALSE',
        '0',
        '0',
        project.id,
        project.name,
        project.target_date || ''
      ]);
    });
  });

  return rows.map(r => r.map(escapeCsvCell).join(',')).join('\r\n');
}

/**
 * Generates a unified full project data CSV archive containing overview, tasks, folders, and reference pages.
 */
export function generateFullProjectCsv(
  project: ResearchProject,
  linkedCols: SearchCollection[]
): string {
  const allPages = getAllProjectPages(project, linkedCols);
  const headers = [
    'Record Type',
    'Item ID',
    'Title / Name / Text',
    'Status / Category',
    'URL',
    'Canonical URL',
    'Folder / Section',
    'Description / Snippet / Notes',
    'Tags / Metadata',
    'Author / Source',
    'Likes',
    'Backlinks',
    'Date / Target Date'
  ];

  const rows: string[][] = [headers];

  // 1. Overview Row
  rows.push([
    'Project Overview',
    project.id,
    project.name,
    project.status,
    '',
    '',
    'Root Workspace',
    project.description,
    `Total Tasks: ${project.tasks?.length || 0}; Folders: ${linkedCols.length}; Sources: ${allPages.length}`,
    'Isaac Search Workspace',
    '',
    '',
    `Created: ${project.created_at}${project.target_date ? ` | Target: ${project.target_date}` : ''}`
  ]);

  // 2. Project Notes / Synthesis Notebook
  if (project.notes && project.notes.trim()) {
    rows.push([
      'Project Notebook',
      `${project.id}_notes`,
      'Synthesis Notes',
      'Active Note',
      '',
      '',
      'Notebook',
      project.notes,
      '',
      '',
      '',
      '',
      project.created_at
    ]);
  }

  // 3. Tasks & Subtasks Rows
  (project.tasks || []).forEach((task, idx) => {
    const subtasks = task.subtasks || [];
    const completedSubs = subtasks.filter(s => s.completed).length;

    rows.push([
      'Task Objective',
      task.id || `task_${idx + 1}`,
      task.text,
      task.completed ? 'Completed' : 'Pending',
      '',
      '',
      'Checklist',
      `Subtasks: ${completedSubs}/${subtasks.length}`,
      `Objective #${idx + 1}`,
      '',
      '',
      '',
      project.target_date || ''
    ]);

    subtasks.forEach((st, sIdx) => {
      rows.push([
        'Subtask Item',
        st.id || `subtask_${idx + 1}_${sIdx + 1}`,
        `↳ ${st.text}`,
        st.completed ? 'Completed' : 'Pending',
        '',
        '',
        `Parent: ${task.text}`,
        `Belongs to: ${task.id}`,
        `Subtask #${idx + 1}.${sIdx + 1}`,
        '',
        '',
        '',
        project.target_date || ''
      ]);
    });
  });

  // 4. Linked Folders
  linkedCols.forEach((col, idx) => {
    rows.push([
      'Linked Collection',
      col.id,
      col.name,
      'Folder Link',
      '',
      '',
      'Collections',
      col.description || col.notes || '',
      `Bookmark Count: ${col.pages?.length || 0}`,
      'Search Collection',
      '',
      '',
      col.created_at || ''
    ]);
  });

  // 5. Reference Catalog Pages
  allPages.forEach((page, idx) => {
    rows.push([
      'Reference Source',
      page.id,
      page.title || 'Untitled',
      page.isDirect ? 'Direct Link' : 'Folder Bookmark',
      page.url || '',
      page.canonical_url || '',
      page.folderName,
      page.snippet || '',
      Array.isArray(page.tags) ? page.tags.join('; ') : '',
      page.author || '',
      String(page.likes || 0),
      String(page.backlinks || 0),
      page.indexed_at || ''
    ]);
  });

  return rows.map(r => r.map(escapeCsvCell).join(',')).join('\r\n');
}

/**
 * Creates a sanitized file name slug based on the project name.
 */
export function getSanitizedProjectSlug(projectName: string): string {
  return projectName
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'research_project';
}

/**
 * Triggers a browser file download using a Blob.
 */
export function triggerFileDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads the Project Markdown document.
 */
export function downloadProjectMarkdown(
  project: ResearchProject,
  linkedCols: SearchCollection[]
): string {
  const markdown = generateProjectMarkdown(project, linkedCols);
  const slug = getSanitizedProjectSlug(project.name);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${slug}_research_brief_${dateStr}.md`;
  triggerFileDownload(markdown, filename, 'text/markdown;charset=utf-8');
  return filename;
}

/**
 * Downloads the Reference Catalog CSV (with UTF-8 BOM for Excel compatibility).
 */
export function downloadProjectReferencesCsv(
  project: ResearchProject,
  linkedCols: SearchCollection[]
): string {
  const csv = generateProjectReferencesCsv(project, linkedCols);
  const slug = getSanitizedProjectSlug(project.name);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${slug}_references_${dateStr}.csv`;
  triggerFileDownload('\uFEFF' + csv, filename, 'text/csv;charset=utf-8');
  return filename;
}

/**
 * Downloads the Tasks Checklist CSV.
 */
export function downloadProjectTasksCsv(project: ResearchProject): string {
  const csv = generateProjectTasksCsv(project);
  const slug = getSanitizedProjectSlug(project.name);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${slug}_tasks_${dateStr}.csv`;
  triggerFileDownload('\uFEFF' + csv, filename, 'text/csv;charset=utf-8');
  return filename;
}

/**
 * Downloads the Complete Full Project Data CSV.
 */
export function downloadFullProjectCsv(
  project: ResearchProject,
  linkedCols: SearchCollection[]
): string {
  const csv = generateFullProjectCsv(project, linkedCols);
  const slug = getSanitizedProjectSlug(project.name);
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `${slug}_full_project_archive_${dateStr}.csv`;
  triggerFileDownload('\uFEFF' + csv, filename, 'text/csv;charset=utf-8');
  return filename;
}

/**
 * Copies the Markdown representation of the project to the system clipboard.
 */
export async function copyProjectMarkdown(
  project: ResearchProject,
  linkedCols: SearchCollection[]
): Promise<boolean> {
  const markdown = generateProjectMarkdown(project, linkedCols);
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(markdown);
      return true;
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = markdown;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    }
  } catch (err) {
    console.error('Failed to copy project markdown to clipboard:', err);
    return false;
  }
}
