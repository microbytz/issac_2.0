import { useState, useEffect, useRef } from 'react';

export function useNotebookAutosave(
  projectId: string | null,
  initialNotes: string,
  onSave: (notesText: string, projectId: string) => void
) {
  const [localNotes, setLocalNotes] = useState(initialNotes);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Keep a ref to localNotes to avoid re-triggering the save interval on every keystroke
  const localNotesRef = useRef(localNotes);

  // Refs tracking which project the current localNotes belong to and the last
  // saved/loaded baseline, so exit handlers and the project-switch flush always
  // attribute edits to the right project.
  const projectIdRef = useRef(projectId);
  const baselineRef = useRef(initialNotes);

  const flush = (id: string | null) => {
    if (id && localNotesRef.current !== baselineRef.current) {
      localStorage.setItem(`isaac_notebook_draft_${id}`, localNotesRef.current);
      onSaveRef.current(localNotesRef.current, id);
      baselineRef.current = localNotesRef.current;
    }
  };

  // When the project changes, save the outgoing project's pending edits BEFORE
  // resetting the notes state. Without this flush, edits made since the last
  // 5s autosave were silently dropped on project switches.
  useEffect(() => {
    if (projectIdRef.current !== projectId) {
      flush(projectIdRef.current);
      projectIdRef.current = projectId;
      localNotesRef.current = initialNotes;
      setLocalNotes(initialNotes);
    }
    baselineRef.current = initialNotes;
  }, [projectId, initialNotes]);

  useEffect(() => {
    localNotesRef.current = localNotes;
  }, [localNotes]);

  // Handle periodic auto-saving every 5 seconds
  useEffect(() => {
    if (!projectId) return;

    const interval = setInterval(() => {
      if (localNotesRef.current !== baselineRef.current) {
        setIsSaving(true);
        flush(projectId);
        setLastSaved(new Date());
        setTimeout(() => setIsSaving(false), 1000);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [projectId, initialNotes]);

  // Handle sudden window navigation, page hide, tab closure, or unmount
  useEffect(() => {
    const handleSaveOnExit = () => {
      flush(projectIdRef.current);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleSaveOnExit();
      }
    };

    window.addEventListener('beforeunload', handleSaveOnExit);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleSaveOnExit);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      handleSaveOnExit();
    };
  }, []);

  return {
    localNotes,
    setLocalNotes,
    lastSaved,
    isSaving,
  };
}
