import React from 'react';
import { Calendar, CheckCircle2, Clock, FileWarning, Plus } from 'lucide-react';
import { UpcomingDeadlineItem } from '../data/initialData';

interface DeadlineCountdownSectionProps {
  deadlines: UpcomingDeadlineItem[];
  onOpenInCalendar: (dateISO: string) => void;
  onMarkComplete: (eventId: string) => void;
  onAddDeadline: () => void;
}

export const DeadlineCountdownSection: React.FC<DeadlineCountdownSectionProps> = ({
  deadlines,
  onOpenInCalendar,
  onMarkComplete,
  onAddDeadline,
}) => {
  if (deadlines.length === 0) {
    return (
      <section
        aria-label="Academic deadline countdown radar"
        className="sl-panel px-4 py-3 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
          <Clock className="w-4 h-4 text-emerald-600 dark:text-sky-400 shrink-0" />
          <span>
            <strong className="font-mono uppercase tracking-wider text-slate-900 dark:text-sky-300">
              [ DEADLINE RADAR CLEAR ]
            </strong>{' '}
            · Auto-scanning calendar for &ldquo;assignment&rdquo; &amp; &ldquo;exam&rdquo; events within 3 days.
          </span>
        </div>
        <button
          type="button"
          onClick={onAddDeadline}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-slate-700 dark:text-sky-300 border border-slate-200 dark:border-sky-500/30 bg-slate-100 dark:bg-sky-950/40 hover:bg-slate-200 dark:hover:bg-sky-900/50 rounded transition-colors whitespace-nowrap cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Exam / Assignment
        </button>
      </section>
    );
  }

  return (
    <section
      aria-label="Upcoming exam and assignment countdowns"
      className="sl-panel sl-panel-alert sl-reticle p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5 pb-3 border-b border-slate-200 dark:border-amber-500/20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sl-chamfer bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-500/50 flex items-center justify-center shrink-0">
            <FileWarning className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400 font-bold">
                [ URGENT QUEST · DEADLINE RADAR ]
              </span>
              <span className="text-xs font-mono font-semibold text-amber-800 dark:text-amber-300 tabular-nums">
                · {deadlines.length} within 3 days
              </span>
            </div>
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-slate-100 tracking-wide">
              Upcoming Exam &amp; Assignment Countdowns
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={onAddDeadline}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-sky-500/25 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Deadline
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {deadlines.map((item) => {
          const isUrgent = item.urgency === 'critical' || item.urgency === 'high';
          return (
            <div
              key={item.event.id}
              className="rounded border border-slate-200 dark:border-sky-500/25 bg-slate-50/80 dark:bg-[#060B18] p-3.5 flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-xs border text-[11px] font-mono font-bold uppercase tracking-wider tabular-nums shrink-0 ${
                      isUrgent
                        ? 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-300'
                        : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-500/45 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    <Clock className="w-3 h-3 shrink-0" />
                    Countdown · {item.countdownLabel}
                  </span>

                  <span className="text-[11px] font-mono text-slate-500 dark:text-sky-400 uppercase tracking-wider shrink-0 pt-0.5 font-semibold">
                    {item.matchedType}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {item.event.title}
                </h4>

                <div className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                  {item.event.date} · {item.event.startTime}–{item.event.endTime}
                </div>

                {item.event.notes && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                    {item.event.notes}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-sky-500/15">
                <button
                  type="button"
                  onClick={() => onOpenInCalendar(item.event.date)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] text-xs font-semibold text-blue-700 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-sky-950/50 rounded transition-colors cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  View Date
                </button>

                <button
                  type="button"
                  onClick={() => onMarkComplete(item.event.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-bold uppercase tracking-wider font-display text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/35 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Complete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
