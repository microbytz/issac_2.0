import { useState, useEffect, useRef } from 'react';

export function useNotebookAutosave(
  projectId: string | null,
  initialNotes: string,
  onSave: (notesText: string) => void
) {
  const [localNotes, setLocalNotes] = useState(initialNotes);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Sync with initialNotes when projectId changes
  useEffect(() => {
    setLocalNotes(initialNotes);
  }, [projectId, initialNotes]);

  // Keep a ref to localNotes to avoid re-triggering the save interval on every keystroke
  const localNotesRef = useRef(localNotes);
  useEffect(() => {
    localNotesRef.current = localNotes;
  }, [localNotes]);

  // Handle periodic auto-saving every 5 seconds
  useEffect(() => {
    if (!projectId) return;

    const interval = setInterval(() => {
      const currentNotes = localNotesRef.current;

      // Only save if notes have actually changed from the last committed/initial notes
      if (currentNotes !== initialNotes) {
        setIsSaving(true);

        // Save to specific draft key in localStorage as a redundant safety measure
        localStorage.setItem(`isaac_notebook_draft_${projectId}`, currentNotes);

        // Commit notes update back to the main projects list
        onSaveRef.current(currentNotes);

        setLastSaved(new Date());
        setTimeout(() => setIsSaving(false), 1000);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [projectId, initialNotes]);

  // Handle sudden window navigation, page hide, or tab closure
  useEffect(() => {
    const handleSaveOnExit = () => {
      if (projectId && localNotesRef.current !== initialNotes) {
        localStorage.setItem(`isaac_notebook_draft_${projectId}`, localNotesRef.current);
        onSaveRef.current(localNotesRef.current);
      }
    };

    window.addEventListener('beforeunload', handleSaveOnExit);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        handleSaveOnExit();
      }
    });

    return () => {
      window.removeEventListener('beforeunload', handleSaveOnExit);
      // Save on unmount (e.g., tab changes or switching projects)
      handleSaveOnExit();
    };
  }, [projectId, initialNotes]);

  return {
    localNotes,
    setLocalNotes,
    lastSaved,
    isSaving,
  };
}
