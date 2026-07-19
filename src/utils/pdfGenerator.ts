import { jsPDF } from 'jspdf';

export function exportProjectToPDF(project: any, linkedCols: any[]) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let y = 20;
  const marginX = 20;
  const contentWidth = 170; // 210 - 40
  const maxSafeY = 270;

  // Add a helper to write text with overflow control
  function addPageIfNeeded(neededHeight: number) {
    if (y + neededHeight > maxSafeY) {
      doc.addPage();
      y = 20;
      drawRunningHeader();
    }
  }

  function drawRunningHeader() {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Project Summary: ${project.name}`, marginX, 10);
    doc.line(marginX, 12, 190, 12);
    y = 20;
  }
  
  // Draw footer helper
  function drawFooter() {
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Page ${i} of ${pageCount}`, 190, 287, { align: 'right' });
      doc.text(`Generated via Isaac Search Workspace`, marginX, 287);
    }
  }

  // Cover / Header block
  // Theme styling: elegant deep slate and indigo
  // Draw top colored band
  doc.setFillColor(79, 70, 229); // Indigo-600
  doc.rect(0, 0, 210, 8, 'F');

  y = 22;
  // Category / Type tag
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(79, 70, 229); // Indigo-600
  doc.text("RESEARCH WORKSPACE REPORT", marginX, y);
  y += 6;

  // Project Name
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42); // slate-900
  const nameLines = doc.splitTextToSize(project.name, contentWidth);
  doc.text(nameLines, marginX, y);
  y += nameLines.length * 8;

  // Project description
  if (project.description) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105); // slate-600
    const descLines = doc.splitTextToSize(project.description, contentWidth);
    addPageIfNeeded(descLines.length * 5 + 4);
    doc.text(descLines, marginX, y);
    y += descLines.length * 5 + 6;
  }

  // Divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(marginX, y, 190, y);
  y += 8;

  // Metadata Grid (Status, Target Date, Created At)
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("STATUS", marginX, y);
  doc.text("TARGET DATE", marginX + 60, y);
  doc.text("CREATED ON", marginX + 110, y);
  y += 5;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42); // slate-900
  const statusLabels: Record<string, string> = {
    planning: 'Planning',
    in_progress: 'In Progress',
    review: 'Under Review',
    completed: 'Completed'
  };
  doc.text(statusLabels[project.status] || project.status || 'N/A', marginX, y);
  doc.text(project.target_date ? new Date(project.target_date).toLocaleDateString() : 'None Scheduled', marginX + 60, y);
  doc.text(new Date(project.created_at).toLocaleDateString(), marginX + 110, y);
  y += 10;

  // Divider
  doc.line(marginX, y, 190, y);
  y += 10;

  // SECTION 1: PROJECT NOTES / SYNTHESIS
  addPageIfNeeded(20);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(79, 70, 229); // Indigo-600
  doc.text("1. Project Synthesis Notes", marginX, y);
  y += 6;

  if (project.notes && project.notes.trim()) {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42); // slate-900
    
    // Clean up markdown syntax for basic readable PDF output
    const cleanNotes = project.notes
      .replace(/###/g, '')
      .replace(/##/g, '')
      .replace(/#/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '');

    const noteLines = doc.splitTextToSize(cleanNotes, contentWidth);
    
    // Write note lines handling page wrap line-by-line or chunk-by-chunk
    for (let i = 0; i < noteLines.length; i++) {
      addPageIfNeeded(5);
      doc.text(noteLines[i], marginX, y);
      y += 5;
    }
  } else {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("No synthesis notes drafted in this workspace.", marginX, y);
    y += 6;
  }
  y += 6;

  // SECTION 2: RESEARCH TASKS
  addPageIfNeeded(20);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(79, 70, 229); // Indigo-600
  doc.text("2. Research Checklist Tasks", marginX, y);
  y += 8;

  if (project.tasks && project.tasks.length > 0) {
    project.tasks.forEach((task: any) => {
      addPageIfNeeded(8);
      
      // Draw a neat checkbox box
      doc.setDrawColor(79, 70, 229); // Indigo-600
      doc.setFillColor(243, 244, 246); // light gray
      doc.rect(marginX, y - 3.5, 4, 4, task.completed ? 'FD' : 'D');
      
      if (task.completed) {
        // Draw checked X inside box
        doc.setDrawColor(79, 70, 229);
        doc.line(marginX + 0.8, y - 2.7, marginX + 3.2, y - 0.3);
        doc.line(marginX + 3.2, y - 2.7, marginX + 0.8, y - 0.3);
      }
      
      // Print task text
      doc.setFont('Helvetica', task.completed ? 'normal' : 'bold');
      doc.setFontSize(10);
      doc.setTextColor(task.completed ? '#64748b' : '#0f172a');
      
      const taskTextLines = doc.splitTextToSize(task.text, contentWidth - 8);
      doc.text(taskTextLines[0], marginX + 8, y);
      y += 6;

      // Handle multiline task text wrap if any
      for (let j = 1; j < taskTextLines.length; j++) {
        addPageIfNeeded(6);
        doc.text(taskTextLines[j], marginX + 8, y);
        y += 6;
      }
      y += 1;
    });
  } else {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("No tasks scheduled for this project yet.", marginX, y);
    y += 6;
  }
  y += 6;

  // SECTION 3: REFERENCED COLLECTION CONTENTS
  addPageIfNeeded(20);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(79, 70, 229); // Indigo-600
  doc.text("3. Linked References & Bookmark Folders", marginX, y);
  y += 8;

  if (linkedCols && linkedCols.length > 0) {
    linkedCols.forEach((col: any) => {
      addPageIfNeeded(12);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(`Folder: ${col.name} (${col.pages.length} pages)`, marginX, y);
      y += 5;
      
      if (col.pages && col.pages.length > 0) {
        col.pages.forEach((page: any) => {
          addPageIfNeeded(25);
          
          // Small dot indicator
          doc.setFillColor(129, 140, 248); // Indigo-400
          doc.circle(marginX + 2, y - 1, 1, 'F');
          
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(79, 70, 229); // Indigo-600
          const titleLines = doc.splitTextToSize(page.title || "Untitled Reference", contentWidth - 6);
          doc.text(titleLines, marginX + 5, y);
          y += titleLines.length * 4.5;

          // URL
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139); // slate-500
          const urlLines = doc.splitTextToSize(page.url || "", contentWidth - 6);
          doc.text(urlLines, marginX + 5, y);
          y += urlLines.length * 3.5 + 1;

          // Snippet
          if (page.snippet) {
            doc.setFont('Helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(71, 85, 105); // slate-600
            const snippetLines = doc.splitTextToSize(page.snippet, contentWidth - 6);
            for (let s = 0; s < snippetLines.length; s++) {
              addPageIfNeeded(4.5);
              doc.text(snippetLines[s], marginX + 5, y);
              y += 4.5;
            }
          }
          y += 3; // Space between pages
        });
      } else {
        addPageIfNeeded(8);
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text("This folder contains no bookmarked references.", marginX + 5, y);
        y += 6;
      }
      y += 4; // Space between folders
    });
  } else {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("No bookmark folders linked to this project.", marginX, y);
    y += 6;
  }

  // Draw footer on all pages
  drawFooter();

  // Save the PDF
  const filename = `${project.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_workspace_summary.pdf`;
  doc.save(filename);
}

export function exportSearchResultsToPDF(query: string, results: any[]) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  let y = 20;
  const marginX = 20;
  const contentWidth = 170; // 210 - 40
  const maxSafeY = 270;

  function addPageIfNeeded(neededHeight: number) {
    if (y + neededHeight > maxSafeY) {
      doc.addPage();
      y = 20;
      drawRunningHeader();
    }
  }

  function drawRunningHeader() {
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Search Query: "${query || 'All Pages'}"`, marginX, 10);
    doc.line(marginX, 12, 190, 12);
    y = 20;
  }

  function drawFooter() {
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(`Page ${i} of ${pageCount}`, 190, 287, { align: 'right' });
      doc.text(`Generated via Isaac Search Workspace`, marginX, 287);
    }
  }

  // Cover / Header block
  doc.setFillColor(79, 70, 229); // Indigo-600
  doc.rect(0, 0, 210, 8, 'F');

  y = 22;
  // Category / Type tag
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(79, 70, 229); // Indigo-600
  doc.text("SEARCH RESULTS EXPORT REPORT", marginX, y);
  y += 6;

  // Title
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42); // slate-900
  const displayTitle = query ? `Results for "${query}"` : "Search Catalog Export";
  const nameLines = doc.splitTextToSize(displayTitle, contentWidth);
  doc.text(nameLines, marginX, y);
  y += nameLines.length * 8;

  // Metadata block
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("TOTAL RESULTS", marginX, y);
  doc.text("EXPORT DATE", marginX + 60, y);
  y += 5;

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(`${results.length} Pages`, marginX, y);
  doc.text(new Date().toLocaleDateString(), marginX + 60, y);
  y += 10;

  // Divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.line(marginX, y, 190, y);
  y += 10;

  // Results rendering
  if (results && results.length > 0) {
    results.forEach((page, idx) => {
      addPageIfNeeded(25);

      // Node count badge/number
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(79, 70, 229); // Indigo-600
      doc.text(`${idx + 1}.`, marginX, y);

      // Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // Slate 900
      const titleText = page.title || "Untitled Reference";
      const titleLines = doc.splitTextToSize(titleText, contentWidth - 10);
      doc.text(titleLines, marginX + 8, y);
      y += titleLines.length * 5;

      // URL
      addPageIfNeeded(10);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(14, 116, 144); // Cyan 700 / Slate 500
      const urlText = page.url || "";
      const urlLines = doc.splitTextToSize(urlText, contentWidth - 10);
      doc.text(urlLines, marginX + 8, y);
      y += urlLines.length * 4 + 1;

      // Snippet
      if (page.snippet) {
        addPageIfNeeded(12);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(71, 85, 105); // Slate 600
        const snippetLines = doc.splitTextToSize(page.snippet, contentWidth - 10);
        for (let s = 0; s < snippetLines.length; s++) {
          addPageIfNeeded(4.5);
          doc.text(snippetLines[s], marginX + 8, y);
          y += 4.5;
        }
      }

      // Likes, Backlinks and other stats if available
      addPageIfNeeded(6);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      const stats = [];
      if (page.likes !== undefined) stats.push(`Likes: ${page.likes}`);
      if (page.backlinks !== undefined) stats.push(`Backlinks: ${page.backlinks}`);
      if (page.size !== undefined) stats.push(`Size: ${page.size}px`);
      if (stats.length > 0) {
        doc.text(stats.join(' | '), marginX + 8, y);
        y += 4;
      }

      y += 5; // Space between pages
    });
  } else {
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("No search results to display.", marginX, y);
    y += 6;
  }

  drawFooter();

  const querySlug = query ? query.toLowerCase().replace(/[^a-z0-9]+/g, '_') : 'export';
  const filename = `search_results_${querySlug}_${Date.now()}.pdf`;
  doc.save(filename);
}

