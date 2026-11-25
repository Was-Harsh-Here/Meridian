import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Brain,
  Check,
  MessageSquareHeart,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { JournalEntry, JournalMood } from '../types';

interface JournalWorkspaceProps {
  entries: JournalEntry[];
  todayDate: string;
  onSaveEntry: (entry: Omit<JournalEntry, 'id' | 'createdAt'>) => void;
  onDeleteEntry: (id: string) => void;
  onSendToMentor: (entry: JournalEntry) => void;
}

const MOODS: JournalMood[] = [
  'Focused',
  'Resilient',
  'Inspired',
  'Stressed',
  'Exhausted',
];

const QUICK_PROMPTS: Array<{
  label: string;
  title: string;
  tags: string[];
  placeholder: string;
}> = [
  {
    label: 'Lab Breakthrough',
    title: 'V.V.P. Lab & Concept Debrief',
    tags: ['C Programming', 'V.V.P. Lab'],
    placeholder: 'What bug or concept clicked today, and what still needs a 15-min review?',
  },
  {
    label: 'CBT Stress Reframe',
    title: 'Evening Cognitive Reset',
    tags: ['CBT Reframe', 'Mindset'],
    placeholder: 'What triggered pressure today? Write the automatic thought, then test the objective evidence.',
  },
  {
    label: 'Stage / Speech Drill',
    title: 'Public Speaking Reflection',
    tags: ['Public Speaking', 'Stage Presence'],
    placeholder: 'How was your pacing, eye contact, and rebuttal clarity during today’s practice?',
  },
  {
    label: 'Hackathon Sprint',
    title: 'Build Log & Architecture Note',
    tags: ['Hackathon', 'Engineering'],
    placeholder: 'What core feature shipped today, and what scope trap did you avoid?',
  },
];

function getMoodStyle(mood: JournalMood): string {
  switch (mood) {
    case 'Focused':
      return 'text-blue-700 dark:text-sky-300 border-blue-200 dark:border-sky-500/40 bg-blue-50/70 dark:bg-sky-950/50';
    case 'Resilient':
      return 'text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/40 bg-emerald-50/70 dark:bg-emerald-950/50';
    case 'Inspired':
      return 'text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/40 bg-indigo-50/70 dark:bg-indigo-950/50';
    case 'Stressed':
      return 'text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/40 bg-amber-50/70 dark:bg-amber-950/50';
    case 'Exhausted':
      return 'text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/40 bg-rose-50/70 dark:bg-rose-950/50';
  }
}

export const JournalWorkspace: React.FC<JournalWorkspaceProps> = ({
  entries,
  todayDate,
  onSaveEntry,
  onDeleteEntry,
  onSendToMentor,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayDate);
  const [mood, setMood] = useState<JournalMood>('Focused');
  const [focusScore, setFocusScore] = useState(8);
  const [content, setContent] = useState('');
  const [gratitudeOrWin, setGratitudeOrWin] = useState('');
  const [cbtReframe, setCbtReframe] = useState('');
  const [tagInput, setTagInput] = useState('Academics, Mindset');

  const [query, setQuery] = useState('');
  const [moodFilter, setMoodFilter] = useState<'All' | JournalMood>('All');
  const [justLogged, setJustLogged] = useState(false);

  const filteredEntries = useMemo(() => {
    return [...entries]
      .filter((entry) => {
        if (moodFilter !== 'All' && entry.mood !== moodFilter) return false;
        if (query.trim()) {
          const q = query.trim().toLowerCase();
          const match =
            entry.title.toLowerCase().includes(q) ||
            entry.content.toLowerCase().includes(q) ||
            entry.tags.some((t) => t.toLowerCase().includes(q)) ||
            (entry.cbtReframe || '').toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [entries, moodFilter, query]);

  const avgFocus = useMemo(() => {
    if (entries.length === 0) return 0;
    const sum = entries.reduce((s, e) => s + e.focusScore, 0);
    return (sum / entries.length).toFixed(1);
  }, [entries]);

  const handleApplyPrompt = (p: (typeof QUICK_PROMPTS)[number]) => {
    setTitle(p.title);
    setTagInput(p.tags.join(', '));
    if (!content.trim()) {
      setContent('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 5);

    onSaveEntry({
      date,
      title: title.trim(),
      content: content.trim(),
      mood,
      focusScore,
      tags: tags.length > 0 ? tags : ['Daily Log'],
      gratitudeOrWin: gratitudeOrWin.trim() || undefined,
      cbtReframe: cbtReframe.trim() || undefined,
    });

    setTitle('');
    setContent('');
    setGratitudeOrWin('');
    setCbtReframe('');
    setJustLogged(true);
    window.setTimeout(() => setJustLogged(false), 2600);
  };

  return (
    <div className="space-y-6">
      {/* System Header Strip */}
      <div className="sl-panel sl-reticle p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 sl-chamfer bg-slate-900 dark:bg-sky-500/15 border border-slate-800 dark:border-sky-400/50 text-white dark:text-sky-300 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-blue-700 dark:text-sky-400 font-semibold">
                [ SHADOW LOG · CBT ARCHIVE ]
              </span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-wide text-slate-900 dark:text-slate-100 leading-tight">
              Hunter Reflection &amp; Study Journal
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-5 text-xs font-mono tabular-nums">
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase tracking-wider">
              Total Logs
            </span>
            <span className="text-base font-bold text-slate-900 dark:text-slate-100">
              {entries.length}
            </span>
          </div>
          <div className="h-7 w-px bg-slate-200 dark:bg-sky-500/25" />
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase tracking-wider">
              Avg Clarity
            </span>
            <span className="text-base font-bold text-blue-700 dark:text-sky-400">
              {avgFocus}/10
            </span>
          </div>
          <div className="h-7 w-px bg-slate-200 dark:bg-sky-500/25" />
          <div>
            <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase tracking-wider">
              Log Bonus
            </span>
            <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">
              +20 XP
            </span>
          </div>
        </div>
      </div>

      {/* Asymmetric 12-Col Layout: 5 Col Compose / 7 Col Archive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Compose Console */}
        <section className="lg:col-span-5 sl-panel sl-reticle p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-sky-500/20">
            <div>
              <h3 className="font-display text-base font-bold uppercase tracking-wider text-slate-900 dark:text-sky-300">
                Record New Entry
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Log wins, technical insights, or CBT thought reframes
              </p>
            </div>
            <Brain className="w-4 h-4 text-blue-600 dark:text-sky-400 shrink-0" />
          </div>

          {/* Template Shortcuts */}
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
              Quick Templates
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleApplyPrompt(p)}
                  className="px-2.5 py-1.5 min-h-[34px] text-[11px] font-medium border border-slate-200 dark:border-sky-500/25 bg-slate-50 dark:bg-slate-900/70 hover:border-blue-500 dark:hover:border-sky-400 text-slate-700 dark:text-slate-200 rounded transition-colors cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_132px] gap-2.5">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Dynamic Memory Allocation Breakthrough"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/25 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/25 rounded text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            {/* Mood Selector */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Mental State
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m)}
                    className={`py-2 px-1.5 min-h-[36px] text-[11px] font-semibold border rounded transition-colors cursor-pointer ${
                      mood === m
                        ? getMoodStyle(m)
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#050811] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Clarity Score */}
            <div>
              <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider mb-1">
                <span className="text-slate-500 dark:text-slate-400">
                  Mental Clarity Score
                </span>
                <span className="font-bold text-blue-700 dark:text-sky-400 tabular-nums">
                  {focusScore} / 10
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={focusScore}
                onChange={(e) => setFocusScore(Number(e.target.value))}
                className="w-full accent-blue-600 dark:accent-sky-400 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Reflection / Study Log
              </label>
              <textarea
                required
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write honestly about what you studied, how you felt under pressure, or what tomorrow's top priority is..."
                className="w-full px-3 py-2 text-xs leading-relaxed bg-slate-50 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/25 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y"
              />
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Key Win Today (Optional)
                </label>
                <input
                  type="text"
                  value={gratitudeOrWin}
                  onChange={(e) => setGratitudeOrWin(e.target.value)}
                  placeholder="e.g. Finished 2 DSA problems before morning lectures"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/25 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  CBT Reframe (Optional)
                </label>
                <input
                  type="text"
                  value={cbtReframe}
                  onChange={(e) => setCbtReframe(e.target.value)}
                  placeholder="Challenge a harsh thought with evidence..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/25 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="C Programming, Public Speaking, Mindset"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/25 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-xs font-bold uppercase tracking-wider font-display text-white bg-blue-700 dark:bg-sky-600 hover:bg-blue-800 dark:hover:bg-sky-500 rounded transition-colors cursor-pointer"
            >
              {justLogged ? (
                <>
                  <Check className="w-4 h-4" />
                  Shadow Entry Recorded (+20 XP)
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Save Journal Entry (+20 XP)
                </>
              )}
            </button>
          </form>
        </section>

        {/* Archive Feed */}
        <section className="lg:col-span-7 sl-panel sl-reticle overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-sky-500/20 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold uppercase tracking-wider text-slate-900 dark:text-sky-300">
                Recorded Logs ({filteredEntries.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Search past reflections or send any log to Meridian for CBT therapist feedback
              </p>
            </div>

            <div className="relative min-w-[190px] flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search logs or tags..."
                className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/25 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="px-4 sm:px-5 py-2.5 bg-slate-50/70 dark:bg-[#060A16] border-b border-slate-200 dark:border-sky-500/15 flex items-center gap-1.5 overflow-x-auto">
            {(['All', ...MOODS] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMoodFilter(m)}
                className={`px-2.5 py-1.5 min-h-[34px] text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  moodFilter === m
                    ? 'bg-slate-900 dark:bg-sky-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {filteredEntries.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Sparkles className="w-6 h-6 text-slate-400 dark:text-sky-500/60 mx-auto" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No journal logs match this filter
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Write your first reflection on the left to earn +20 XP and sharpen mental clarity.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/80 dark:divide-sky-500/15">
              {filteredEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="p-4 sm:p-5 space-y-3 hover:bg-slate-50/70 dark:hover:bg-sky-950/15 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        <span className="font-semibold text-slate-800 dark:text-sky-400">
                          {entry.date}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{entry.createdAt}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wide ${getMoodStyle(
                            entry.mood
                          )}`}
                        >
                          {entry.mood}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Clarity {entry.focusScore}/10</span>
                      </div>

                      <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 mt-1">
                        {entry.title}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onSendToMentor(entry)}
                        title="Send entry to Meridian AI Therapist"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] text-xs font-semibold text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-sky-500/35 bg-blue-50/70 dark:bg-sky-950/40 hover:bg-blue-100 dark:hover:bg-sky-900/50 rounded transition-colors cursor-pointer"
                      >
                        <MessageSquareHeart className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">AI Reflect</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteEntry(entry.id)}
                        aria-label={`Delete journal entry ${entry.title}`}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {entry.content}
                  </p>

                  {(entry.gratitudeOrWin || entry.cbtReframe) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {entry.gratitudeOrWin && (
                        <div className="p-2.5 rounded border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/25">
                          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400 block">
                            Win Logged
                          </span>
                          <p className="text-xs text-slate-700 dark:text-slate-200 mt-0.5">
                            {entry.gratitudeOrWin}
                          </p>
                        </div>
                      )}
                      {entry.cbtReframe && (
                        <div className="p-2.5 rounded border border-sky-200 dark:border-sky-500/30 bg-sky-50/50 dark:bg-sky-950/25">
                          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-blue-700 dark:text-sky-400 block">
                            CBT Reframe
                          </span>
                          <p className="text-xs text-slate-700 dark:text-slate-200 mt-0.5">
                            {entry.cbtReframe}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {entry.tags.length > 0 && (
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {entry.tags.map((t) => `#${t}`).join('  ·  ')}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
