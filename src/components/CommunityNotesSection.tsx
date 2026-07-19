import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, ThumbsUp, ThumbsDown, Plus, Send, Loader2, 
  AlertCircle, ChevronDown, ChevronUp, Sparkles, Check
} from 'lucide-react';

const API_BASE = '/api';

export interface CommunityNote {
  id: string;
  url: string;
  content: string;
  helpful_count: number;
  not_helpful_count: number;
  score: number;
  created_at: number;
}

const DEFAULT_NOTES: Record<string, Omit<CommunityNote, 'id' | 'url'>[]> = {
  'https://en.wikipedia.org/wiki/Search_engine': [
    {
      content: 'Comprehensive historical overview of Web crawler search systems.',
      helpful_count: 15,
      not_helpful_count: 2,
      score: 13,
      created_at: 1719912000
    },
    {
      content: 'Great for learning PageRank and basic information retrieval concepts.',
      helpful_count: 8,
      not_helpful_count: 1,
      score: 7,
      created_at: 1720084800
    }
  ],
  'https://fastapi.tiangolo.com': [
    {
      content: 'Check out the auto-generated interactive OpenAPI / Swagger docs at /docs!',
      helpful_count: 30,
      not_helpful_count: 2,
      score: 28,
      created_at: 1720027200
    },
    {
      content: 'Useful for beginners looking to build backend APIs quickly.',
      helpful_count: 25,
      not_helpful_count: 1,
      score: 24,
      created_at: 1719854400
    },
    {
      content: 'Always run behind an ASGI server like Uvicorn for local production.',
      helpful_count: 18,
      not_helpful_count: 0,
      score: 18,
      created_at: 1719940800
    }
  ],
  'https://firebase.google.com/docs/firestore': [
    {
      content: 'NoSQL document database with real-time listeners support.',
      helpful_count: 22,
      not_helpful_count: 3,
      score: 19,
      created_at: 1719890400
    },
    {
      content: 'Watch out for deep collection nesting; keep documents flat when querying.',
      helpful_count: 19,
      not_helpful_count: 1,
      score: 18,
      created_at: 1719976800
    }
  ],
  'https://whoosh.readthedocs.io': [
    {
      content: 'Note that Whoosh is no longer actively maintained but still excellent for small local projects.',
      helpful_count: 26,
      not_helpful_count: 0,
      score: 26,
      created_at: 1720113600
    },
    {
      content: 'Great pure-Python indexing and search engine library.',
      helpful_count: 14,
      not_helpful_count: 2,
      score: 12,
      created_at: 1720027200
    }
  ]
};

function getLocalStorageNotes(url: string): CommunityNote[] {
  const key = `community_notes_v1_${encodeURIComponent(url)}`;
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse stored notes:', e);
    }
  }

  // Fallback to pre-populated default notes if they exist for this URL
  const matchKey = Object.keys(DEFAULT_NOTES).find(k => 
    url.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(url.toLowerCase())
  );
  if (matchKey) {
    const defaults = DEFAULT_NOTES[matchKey];
    const initialized: CommunityNote[] = defaults.map((n, idx) => ({
      id: `local-note-${idx}-${Date.now()}`,
      url: url,
      content: n.content,
      helpful_count: n.helpful_count,
      not_helpful_count: n.not_helpful_count,
      score: n.score,
      created_at: n.created_at
    }));
    localStorage.setItem(key, JSON.stringify(initialized));
    return initialized;
  }

  return [];
}

function saveLocalStorageNotes(url: string, notes: CommunityNote[]): void {
  const key = `community_notes_v1_${encodeURIComponent(url)}`;
  localStorage.setItem(key, JSON.stringify(notes));
}

interface CommunityNotesSectionProps {
  url: string;
  theme?: 'dark' | 'light';
}

export default function CommunityNotesSection({ url, theme = 'dark' }: CommunityNotesSectionProps) {
  const [notes, setNotes] = useState<CommunityNote[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userVotes, setUserVotes] = useState<Record<string, 'helpful' | 'not_helpful'>>({});

  useEffect(() => {
    // Reset state when URL changes
    setNotes([]);
    setError(null);
    setIsAddingNote(false);
    setNewNoteContent('');
    
    if (!url) return;

    // Load user persistent votes
    const userVotesKey = `community_notes_user_votes`;
    const currentVotes = localStorage.getItem(userVotesKey);
    if (currentVotes) {
      try {
        setUserVotes(JSON.parse(currentVotes));
      } catch (e) {}
    }
    
    const fetchNotes = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/pages/notes?url=${encodeURIComponent(url)}`);
        const contentType = res.headers.get('content-type');
        if (res.ok && contentType && contentType.includes('application/json')) {
          const data = await res.json();
          setNotes(data || []);
        } else {
          throw new Error('Backend unreached or did not return valid JSON');
        }
      } catch (err: any) {
        console.warn('Error loading community notes from backend, falling back to local:', err);
        const stored = getLocalStorageNotes(url);
        setNotes(stored);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotes();
  }, [url]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/pages/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          content: newNoteContent.trim()
        })
      });

      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const newNote = await res.json();
        setNotes(prev => {
          const updated = [newNote, ...prev];
          return updated.sort((a, b) => b.score - a.score);
        });
        setNewNoteContent('');
        setIsAddingNote(false);
        setIsExpanded(true);
      } else {
        throw new Error('Could not submit note to server');
      }
    } catch (err) {
      console.warn('Backend note save failed, storing note in local fallback:', err);
      const newNote: CommunityNote = {
        id: `local-note-${Math.random().toString(36).substring(2, 11)}`,
        url: url,
        content: newNoteContent.trim(),
        helpful_count: 0,
        not_helpful_count: 0,
        score: 0,
        created_at: Math.floor(Date.now() / 1000)
      };

      const currentNotes = getLocalStorageNotes(url);
      const updated = [newNote, ...currentNotes].sort((a, b) => b.score - a.score);
      saveLocalStorageNotes(url, updated);
      setNotes(updated);
      
      setNewNoteContent('');
      setIsAddingNote(false);
      setIsExpanded(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (noteId: string, type: 'helpful' | 'not_helpful') => {
    if (userVotes[noteId] === type) return;

    // Optimistically update local state for maximum UI responsiveness
    setNotes(prev => {
      const updated = prev.map(note => {
        if (note.id === noteId) {
          let helpfulDelta = 0;
          let notHelpfulDelta = 0;

          if (type === 'helpful') {
            helpfulDelta = 1;
            if (userVotes[noteId] === 'not_helpful') {
              notHelpfulDelta = -1;
            }
          } else {
            notHelpfulDelta = 1;
            if (userVotes[noteId] === 'helpful') {
              helpfulDelta = -1;
            }
          }

          const hCount = Math.max(0, note.helpful_count + helpfulDelta);
          const nhCount = Math.max(0, note.not_helpful_count + notHelpfulDelta);
          return {
            ...note,
            helpful_count: hCount,
            not_helpful_count: nhCount,
            score: hCount - nhCount
          };
        }
        return note;
      });
      return [...updated].sort((a, b) => b.score - a.score);
    });

    setUserVotes(prev => ({
      ...prev,
      [noteId]: type
    }));

    try {
      const res = await fetch(`${API_BASE}/pages/notes/${noteId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vote_type: type
        })
      });

      const contentType = res.headers.get('content-type');
      if (res.ok && contentType && contentType.includes('application/json')) {
        const updatedNote = await res.json();
        setNotes(prev => {
          const updated = prev.map(note => {
            if (note.id === noteId) {
              return {
                ...note,
                helpful_count: updatedNote.helpful_count,
                not_helpful_count: updatedNote.not_helpful_count,
                score: updatedNote.score
              };
            }
            return note;
          });
          return [...updated].sort((a, b) => b.score - a.score);
        });
      } else {
        throw new Error('Not valid JSON response on vote');
      }
    } catch (err) {
      console.warn('Backend vote failed, persisting vote locally:', err);
      
      // Save current modified state to local storage
      setNotes(prev => {
        saveLocalStorageNotes(url, prev);
        return prev;
      });

      // Save user persistent vote record
      const userVotesKey = `community_notes_user_votes`;
      const currentVotes = localStorage.getItem(userVotesKey);
      let votesObj = {};
      if (currentVotes) {
        try {
          votesObj = JSON.parse(currentVotes);
        } catch (e) {}
      }
      (votesObj as any)[noteId] = type;
      localStorage.setItem(userVotesKey, JSON.stringify(votesObj));
    }
  };

  return (
    <div id={`notes-section-${url.replace(/[^a-zA-Z0-9]/g, '-')}`} className="mt-3 bg-slate-900/40 border border-slate-800/80 rounded-xl p-3 sm:p-4 transition-all">
      {/* Header section toggle */}
      <div className="flex items-center justify-between gap-3 select-none">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-indigo-300 transition-colors cursor-pointer outline-none"
        >
          <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-sans">Community Notes</span>
          {notes.length > 0 && (
            <span className="bg-indigo-950 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.2 rounded-full font-mono text-[9px] font-bold">
              {notes.length}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>

        {/* Quick add trigger button */}
        {!isAddingNote && (
          <button
            type="button"
            onClick={() => {
              setIsAddingNote(true);
              setIsExpanded(true);
            }}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold font-sans text-indigo-300 hover:text-white bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/30 rounded-lg transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3 h-3" />
            <span>Add Note</span>
          </button>
        )}
      </div>

      {/* Main expanded panel */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* Divider */}
            <div className="h-px bg-slate-800/60 my-2.5" />

            {/* Note creation box */}
            {isAddingNote && (
              <motion.form
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleAddNote}
                className="mb-3 bg-[#03030d] border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">Write Helpful Community Note</span>
                  <button
                    type="button"
                    onClick={() => setIsAddingNote(false)}
                    className="text-[10px] text-slate-500 hover:text-slate-300 font-sans cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <textarea
                  placeholder="e.g. Useful for beginners, watch out for indentation, great libraries..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  maxLength={250}
                  required
                  rows={2}
                  className="bg-[#070719] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500/50 resize-none font-sans leading-relaxed"
                />

                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>{newNoteContent.length}/250 chars</span>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newNoteContent.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 font-bold font-sans rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-all disabled:opacity-40 disabled:hover:bg-indigo-600 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    <span>Submit</span>
                  </button>
                </div>
              </motion.form>
            )}

            {/* Note Listing */}
            {isLoading ? (
              <div className="flex items-center justify-center py-4 gap-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Loading notes...</span>
              </div>
            ) : error ? (
              <div className="flex items-center gap-1.5 py-3 text-xs text-rose-400">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            ) : notes.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic py-2 text-center font-sans">
                No community notes yet. Share tips or caveats to help others search better!
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto no-scrollbar py-1">
                {notes.map((note) => {
                  const hasVotedHelpful = userVotes[note.id] === 'helpful';
                  const hasVotedNotHelpful = userVotes[note.id] === 'not_helpful';
                  const isHighQuality = note.score >= 10;

                  return (
                    <div 
                      key={note.id}
                      className={`group border rounded-xl p-2.5 flex flex-col gap-2 transition-all ${
                        isHighQuality 
                          ? 'bg-[#0a0f29]/40 border-indigo-500/20 shadow-[0_2px_12px_rgba(99,102,241,0.04)]' 
                          : 'bg-slate-950/30 border-slate-800/80 hover:border-slate-800'
                      }`}
                    >
                      {/* Quality Tag or info */}
                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                        <div className="flex items-center gap-1">
                          {isHighQuality && (
                            <span className="flex items-center gap-0.5 text-indigo-400 font-bold px-1 py-0.2 rounded bg-indigo-500/10 border border-indigo-500/20">
                              <Sparkles className="w-2.5 h-2.5 fill-indigo-400/20" />
                              Top Rated
                            </span>
                          )}
                          <span className="text-slate-400 font-bold">Community Contributor</span>
                        </div>
                        <span className="text-slate-600">
                          {new Date(note.created_at * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      {/* Content */}
                      <p className="text-[12px] text-slate-300 font-sans leading-relaxed break-words whitespace-pre-line">
                        {note.content}
                      </p>

                      {/* Vote Buttons row */}
                      <div className="flex items-center justify-between border-t border-slate-900/60 pt-2 text-[10px]">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-mono">Was this note helpful?</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Helpful button */}
                          <button
                            type="button"
                            onClick={() => handleVote(note.id, 'helpful')}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold font-sans cursor-pointer transition-all active:scale-95 ${
                              hasVotedHelpful
                                ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400'
                                : 'bg-[#02020a] border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30'
                            }`}
                            title="Helpful"
                          >
                            <ThumbsUp className={`w-3 h-3 ${hasVotedHelpful ? 'fill-emerald-400/10' : ''}`} />
                            <span>Helpful ({note.helpful_count})</span>
                          </button>

                          {/* Not Helpful button */}
                          <button
                            type="button"
                            onClick={() => handleVote(note.id, 'not_helpful')}
                            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold font-sans cursor-pointer transition-all active:scale-95 ${
                              hasVotedNotHelpful
                                ? 'bg-rose-950/40 border-rose-500 text-rose-400'
                                : 'bg-[#02020a] border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/30'
                            }`}
                            title="Not Helpful"
                          >
                            <ThumbsDown className={`w-3 h-3 ${hasVotedNotHelpful ? 'fill-rose-400/10' : ''}`} />
                            <span>Not Helpful ({note.not_helpful_count})</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
