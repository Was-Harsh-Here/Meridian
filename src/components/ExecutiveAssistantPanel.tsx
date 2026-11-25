import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  ExternalLink,
  MapPin,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import {
  AISuggestion,
  AssistantComplexity,
  AssistantMessage,
  AssistantRole,
  ExecutiveBriefing,
} from '../types';

interface ExecutiveAssistantPanelProps {
  briefing: ExecutiveBriefing | null;
  suggestions: AISuggestion[];
  messages: AssistantMessage[];
  roleMode: AssistantRole;
  complexity: AssistantComplexity;
  isThinking: boolean;
  isRefreshingBriefing: boolean;
  canUndo: boolean;
  isOnline: boolean;
  ollamaEnabled: boolean;
  onChangeRoleMode: (role: AssistantRole) => void;
  onChangeComplexity: (complexity: AssistantComplexity) => void;
  onSendMessage: (text: string) => void;
  onRefreshBriefing: () => void;
  onApplySuggestion: (suggestion: AISuggestion) => void;
  onDismissSuggestion: (suggestionId: string) => void;
  onUndoLastAgentBatch: () => void;
}

const ROLE_OPTIONS: Array<{ id: AssistantRole; label: string }> = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'therapist', label: 'Therapist' },
  { id: 'manager', label: 'Manager' },
  { id: 'teacher', label: 'IT Tutor' },
  { id: 'scout', label: 'Search/Maps' },
];

const COMPLEXITY_OPTIONS: Array<{
  id: AssistantComplexity;
  label: string;
  title: string;
}> = [
  { id: 'fast', label: 'Fast', title: 'gemini-3.1-flash-lite' },
  { id: 'general', label: 'Standard', title: 'gemini-4-hydrogen' },
  { id: 'deep', label: 'Deep', title: 'gemini-4-hydrogen (High Thinking)' },
];

const QUICK_COMMANDS = [
  'Auto-plan my unscheduled habits today',
  'Search web for upcoming India hackathons & speaking events',
  'Find quiet study cafes & libraries near campus on Google Maps',
  'I feel anxious about public speaking—coach me',
  'Explain C pointers simply + set a 06:30 alarm',
];

export const ExecutiveAssistantPanel: React.FC<ExecutiveAssistantPanelProps> = ({
  briefing,
  suggestions,
  messages,
  roleMode,
  complexity,
  isThinking,
  isRefreshingBriefing,
  canUndo,
  isOnline,
  ollamaEnabled,
  onChangeRoleMode,
  onChangeComplexity,
  onSendMessage,
  onRefreshBriefing,
  onApplySuggestion,
  onDismissSuggestion,
  onUndoLastAgentBatch,
}) => {
  const [input, setInput] = useState('');
  const [imgError, setImgError] = useState(false);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const activeSuggestions = suggestions.filter(
    (s) => !s.dismissed && !s.applied
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;
    setInput('');
    onSendMessage(trimmed);
  };

  return (
    <aside
      aria-label="Meridian Executive Mentor and System Agent"
      className="sl-panel sl-reticle flex flex-col h-full min-h-[540px] lg:max-h-[calc(100vh-116px)] overflow-hidden"
    >
      {/* Assistant Header */}
      <div className="p-4 border-b border-slate-200 dark:border-sky-500/20 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {!imgError ? (
              <img
                src="/src/assets/images/assistant_emblem_1795583236238.jpg"
                alt="Meridian System Emblem"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-10 h-10 sl-chamfer object-cover border border-slate-300 dark:border-sky-400/50 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 sl-chamfer bg-slate-900 dark:bg-sky-950 text-white dark:text-sky-400 flex items-center justify-center shrink-0">
                <Compass className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-blue-700 dark:text-sky-400 font-semibold block">
                [ SYSTEM ARCHITECT ]
              </span>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 truncate tracking-wide">
                Meridian Mentor
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {!isOnline
                  ? 'Offline AI Mentor Active'
                  : ollamaEnabled
                  ? 'Gemini + Ollama + Offline Fallback'
                  : 'Gemini · Search & Maps Grounded'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {canUndo && (
              <button
                type="button"
                onClick={onUndoLastAgentBatch}
                title="Undo last assistant change"
                className="min-h-[38px] px-2.5 inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Undo
              </button>
            )}
            <button
              type="button"
              disabled={isRefreshingBriefing}
              onClick={onRefreshBriefing}
              title="Refresh AI briefing and suggestions"
              className="min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
              aria-label="Refresh AI briefing"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshingBriefing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Role Persona & Speed/Reasoning Tier Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {ROLE_OPTIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onChangeRoleMode(r.id)}
                className={`px-2 py-1 text-[11px] font-medium rounded border transition-colors whitespace-nowrap cursor-pointer ${
                  roleMode === r.id
                    ? 'bg-slate-900 dark:bg-sky-600 text-white border-slate-900 dark:border-sky-400'
                    : 'bg-slate-50 dark:bg-[#050811] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-sky-500/20 hover:border-sky-400'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            {COMPLEXITY_OPTIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.title}
                onClick={() => onChangeComplexity(c.id)}
                className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors whitespace-nowrap cursor-pointer ${
                  complexity === c.id
                    ? 'bg-blue-50 dark:bg-sky-950 text-blue-700 dark:text-sky-300 border-blue-400 dark:border-sky-500/60 font-bold'
                    : 'bg-white dark:bg-[#050811] text-slate-500 dark:text-slate-500 border-slate-200 dark:border-slate-800'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
        {/* Briefing */}
        <div className="p-4 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-semibold text-blue-700 dark:text-sky-400 inline-flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              System Briefing
            </span>
            {briefing?.generatedAt && (
              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 tabular-nums">
                {briefing.generatedAt}
              </span>
            )}
          </div>

          {isRefreshingBriefing ? (
            <p className="text-xs font-mono text-blue-700 dark:text-sky-400 py-2">
              Synthesizing daily habits, deadlines, and CBT briefing...
            </p>
          ) : briefing ? (
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {briefing.headline}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {briefing.summary}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                {briefing.focusWindowNote}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Your V.V.P. IT schedule, habits, and focus timers are synchronized. Switch roles above for targeted CBT therapy, schedule management, IT tutoring, or Search &amp; Google Maps scouting (with automatic offline AI mentor fallback).
            </p>
          )}
        </div>

        {/* Proactive Suggestions */}
        {activeSuggestions.length > 0 && (
          <div className="p-4 space-y-2.5">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">
              Proactive Recommendations ({activeSuggestions.length})
            </span>

            {activeSuggestions.map((sug) => (
              <div
                key={sug.id}
                className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-white dark:bg-[#070B14] space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="capitalize font-medium text-slate-700 dark:text-sky-400">
                        {sug.category.replace('_', ' ')}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        +{sug.impactXp} XP
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                      {sug.title}
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDismissSuggestion(sug.id)}
                    aria-label="Dismiss suggestion"
                    className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {sug.rationale}
                </p>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => onApplySuggestion(sug)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-white bg-slate-900 dark:bg-sky-600 hover:bg-blue-600 dark:hover:bg-sky-500 rounded-md transition-colors cursor-pointer"
                  >
                    {sug.actionLabel}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="p-4 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[92%] rounded px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-700 dark:bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-[#060B18] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-sky-500/20'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>

                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-sky-400">
                      System actions executed:
                    </div>
                    {msg.actions.map((act) => (
                      <div
                        key={act.id}
                        className="flex items-start gap-1.5 text-[11px] text-slate-700 dark:text-slate-300"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{act.summary}</span>
                      </div>
                    ))}
                  </div>
                )}

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-1.5">
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Grounded Places &amp; Web Sources:
                    </div>
                    {msg.sources.map((src) => (
                      <div key={src.uri} className="space-y-0.5">
                        <a
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-sky-400 hover:underline truncate"
                        >
                          {src.kind === 'maps' ? (
                            <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          ) : (
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          )}
                          <span className="truncate font-medium">
                            {src.title}
                          </span>
                        </a>
                        {src.snippet && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-4 line-clamp-2">
                            {src.snippet}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-1 px-1 tabular-nums">
                {msg.role === 'user'
                  ? 'Harsh'
                  : `Meridian${msg.modelUsed ? ` · ${msg.modelUsed}` : ''}`}{' '}
                · {msg.timestamp}
              </span>
            </div>
          ))}

          {isThinking && (
            <div className="flex items-start">
              <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-600 dark:text-slate-300">
                Processing routine, coaching, search &amp; Maps grounding...
              </div>
            </div>
          )}

          <div ref={feedEndRef} />
        </div>
      </div>

      {/* Quick Commands + Input */}
      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0C1222] space-y-2.5 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {QUICK_COMMANDS.map((cmd) => (
            <button
              key={cmd}
              type="button"
              disabled={isThinking}
              onClick={() => onSendMessage(cmd)}
              className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer disabled:opacity-50"
            >
              {cmd}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask therapist, manager, CS tutor, or Maps scout..."
            disabled={isThinking}
            className="flex-1 px-3 py-2.5 min-h-[44px] text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="submit"
            disabled={isThinking || !input.trim()}
            aria-label="Send instruction to Meridian"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center bg-blue-600 dark:bg-sky-600 hover:bg-blue-700 dark:hover:bg-sky-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </aside>
  );
};

