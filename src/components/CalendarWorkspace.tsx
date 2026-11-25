import React, { useMemo, useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  Plus,
  RefreshCw,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react';
import { AlarmItem, CalendarEvent, EventCategory } from '../types';
import { addDaysISO } from '../data/initialData';
import {
  exportEventsToAppleCalendarICS,
  exportToAppleRemindersICS,
} from '../services/calendarExport';

interface CalendarWorkspaceProps {
  events: CalendarEvent[];
  alarms: AlarmItem[];
  selectedDate: string;
  todayDate: string;
  isAutoPlanning: boolean;
  googleConnected: boolean;
  googleUserEmail?: string | null;
  isGoogleSyncing: boolean;
  onSelectDate: (dateISO: string) => void;
  onToggleEventComplete: (eventId: string) => void;
  onFailEvent?: (eventId: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onCreateEventAt: (dateISO: string, startTime?: string) => void;
  onAutoPlanDay: (dateISO: string) => void;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  onImportGoogleEvents: () => void;
  onRequestPushDayToGoogle: (eventsToPush: CalendarEvent[]) => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 to 22:00

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function formatReadableDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getCategorySurface(cat: EventCategory, completed: boolean): string {
  if (completed) {
    return 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-500';
  }
  switch (cat) {
    case 'Academics':
    case 'Deep Work':
      return 'bg-blue-50/70 dark:bg-sky-950/40 border-blue-200 dark:border-sky-500/35 text-slate-900 dark:text-slate-100';
    case 'Habit Ritual':
      return 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/30 text-slate-900 dark:text-slate-100';
    case 'Public Speaking':
      return 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-500/30 text-slate-900 dark:text-slate-100';
    case 'Hackathon':
      return 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-500/35 text-slate-900 dark:text-slate-100';
    case 'Health':
      return 'bg-teal-50/70 dark:bg-teal-950/30 border-teal-200 dark:border-teal-500/30 text-slate-900 dark:text-slate-100';
    default:
      return 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100';
  }
}

export const CalendarWorkspace: React.FC<CalendarWorkspaceProps> = ({
  events,
  alarms,
  selectedDate,
  todayDate,
  isAutoPlanning,
  googleConnected,
  googleUserEmail,
  isGoogleSyncing,
  onSelectDate,
  onToggleEventComplete,
  onFailEvent,
  onEditEvent,
  onCreateEventAt,
  onAutoPlanDay,
  onGoogleSignIn,
  onGoogleSignOut,
  onImportGoogleEvents,
  onRequestPushDayToGoogle,
}) => {
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  const dayEvents = useMemo(() => {
    return events
      .filter((e) => e.date === selectedDate)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [events, selectedDate]);

  const weekDates = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const dayOfWeek = dt.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayISO = addDaysISO(selectedDate, mondayOffset);
    return Array.from({ length: 7 }, (_, i) => addDaysISO(mondayISO, i));
  }, [selectedDate]);

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const showNowLine =
    selectedDate === todayDate &&
    currentMinutes >= 360 &&
    currentMinutes <= 22 * 60 + 59;
  const nowTopPercent = ((currentMinutes - 360) / (17 * 60)) * 100;

  const totalScheduledMinutes = dayEvents.reduce(
    (sum, ev) =>
      sum + Math.max(0, timeToMinutes(ev.endTime) - timeToMinutes(ev.startTime)),
    0
  );
  const completedBlocks = dayEvents.filter((e) => e.completed).length;

  const pushableEvents = dayEvents.filter((e) => e.source !== 'google');

  return (
    <section
      aria-label="Daily Routine and Calendar"
      className="sl-panel sl-reticle overflow-hidden"
    >
      {/* Calendar Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-sky-500/20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                onSelectDate(
                  addDaysISO(selectedDate, viewMode === 'week' ? -7 : -1)
                )
              }
              aria-label="Previous day or week"
              className="min-h-[42px] min-w-[42px] flex items-center justify-center border border-slate-200 dark:border-sky-500/25 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onSelectDate(todayDate)}
              className="px-3 min-h-[42px] text-xs font-mono font-semibold border border-slate-200 dark:border-sky-500/25 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-sky-300 whitespace-nowrap cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() =>
                onSelectDate(
                  addDaysISO(selectedDate, viewMode === 'week' ? 7 : 1)
                )
              }
              aria-label="Next day or week"
              className="min-h-[42px] min-w-[42px] flex items-center justify-center border border-slate-200 dark:border-sky-500/25 rounded hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-blue-700 dark:text-sky-400 font-semibold block">
              [ TIME-BLOCK SCHEDULE ]
            </span>
            <h3 className="font-display text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100">
              {formatReadableDate(selectedDate)}
              {selectedDate === todayDate ? ' · Today' : ''}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
              {dayEvents.length} blocks · {(totalScheduledMinutes / 60).toFixed(1)}h ·{' '}
              {completedBlocks}/{dayEvents.length} done
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
            {(['day', 'week'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === mode
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {mode === 'day' ? 'Day' : 'Week'}
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={isAutoPlanning}
            onClick={() => onAutoPlanDay(selectedDate)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] text-xs font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
            {isAutoPlanning ? 'Planning...' : 'Auto-Plan Day'}
          </button>

          <button
            type="button"
            onClick={() => onCreateEventAt(selectedDate, '09:00')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Block
          </button>
        </div>
      </div>

      {/* Google Calendar, Apple Calendar & Apple Reminders Sync Bar */}
      <div className="px-4 sm:px-5 py-3 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {!googleConnected ? (
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    ></path>
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    ></path>
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    ></path>
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    ></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  Sign in with Google
                </span>
              </div>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Google Calendar Connected{googleUserEmail ? ` (${googleUserEmail})` : ''}
              </span>
              <button
                type="button"
                disabled={isGoogleSyncing}
                onClick={onImportGoogleEvents}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isGoogleSyncing ? 'animate-spin' : ''}`}
                />
                Pull Google Events
              </button>
              <button
                type="button"
                disabled={isGoogleSyncing || pushableEvents.length === 0}
                onClick={() => onRequestPushDayToGoogle(pushableEvents)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                Push Day ({pushableEvents.length})
              </button>
              <button
                type="button"
                onClick={onGoogleSignOut}
                className="px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* Apple Calendar & Apple Reminders native .ics export */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={dayEvents.length === 0}
            onClick={() =>
              exportEventsToAppleCalendarICS(
                dayEvents,
                `meridian-${selectedDate}.ics`
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 rounded-lg cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-sky-500" />
            Apple Calendar (.ics)
          </button>

          <button
            type="button"
            onClick={() => exportToAppleRemindersICS(dayEvents, alarms, selectedDate)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 text-amber-500" />
            Apple Reminders
          </button>
        </div>
      </div>

      {viewMode === 'day' ? (
        <div className="p-4 sm:p-5">
          <div className="relative border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-[#070B14] overflow-hidden">
            {showNowLine && (
              <div
                className="absolute left-14 sm:left-16 right-0 z-20 pointer-events-none flex items-center"
                style={{ top: `${nowTopPercent}%` }}
              >
                <span className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                <div className="h-[1.5px] flex-1 bg-red-500/80" />
              </div>
            )}

            <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {HOURS.map((hour) => {
                const hourStr = `${String(hour).padStart(2, '0')}:00`;
                const slotEvents = dayEvents.filter((ev) => {
                  const startHour = Number(ev.startTime.split(':')[0]);
                  return startHour === hour;
                });

                return (
                  <div key={hour} className="flex min-h-[56px] group">
                    <button
                      type="button"
                      onClick={() => onCreateEventAt(selectedDate, hourStr)}
                      title={`Click to add block at ${hourStr}`}
                      className="w-14 sm:w-20 shrink-0 py-3 px-2 sm:px-3 text-right font-mono text-xs text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-sky-400 border-r border-slate-100 dark:border-slate-800/70 tabular-nums cursor-pointer transition-colors"
                    >
                      {hourStr}
                    </button>

                    <div className="flex-1 p-2 space-y-2 relative">
                      {slotEvents.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => onCreateEventAt(selectedDate, hourStr)}
                          className="w-full h-full min-h-[38px] text-left px-3 rounded-lg text-xs text-transparent group-hover:text-slate-400 dark:group-hover:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors flex items-center cursor-pointer"
                        >
                          + Add block at {hourStr}
                        </button>
                      ) : (
                        slotEvents.map((ev) => (
                          <div
                            key={ev.id}
                            className={`border rounded-lg px-3 py-2.5 flex items-center justify-between gap-2.5 transition-colors ${getCategorySurface(
                              ev.category,
                              ev.completed
                            )}`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => onToggleEventComplete(ev.id)}
                                aria-label={
                                  ev.completed
                                    ? `Mark ${ev.title} incomplete`
                                    : `Complete ${ev.title}`
                                }
                                className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg transition-colors shrink-0 cursor-pointer ${
                                  ev.completed
                                    ? 'bg-emerald-600 dark:bg-sky-500 text-white'
                                    : 'bg-white dark:bg-slate-950 border border-slate-300 dark:border-sky-500/40 text-transparent hover:border-blue-600'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-semibold truncate ${
                                      ev.completed
                                        ? 'line-through text-slate-400 dark:text-slate-500'
                                        : ''
                                    }`}
                                  >
                                    {ev.title}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300 inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {ev.startTime}–{ev.endTime}
                                  </span>
                                  <span aria-hidden="true">·</span>
                                  <span>{ev.category}</span>
                                  {ev.source === 'google' && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                        Google Calendar
                                      </span>
                                    </>
                                  )}
                                  {ev.source === 'assistant' && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-blue-700 dark:text-sky-400 font-medium">
                                        Meridian AI
                                      </span>
                                    </>
                                  )}
                                  {ev.failed && !ev.completed && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-mono font-semibold text-rose-700 dark:text-rose-400">
                                        Failed (-XP)
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {!ev.completed && !ev.failed && onFailEvent && (
                                <button
                                  type="button"
                                  onClick={() => onFailEvent(ev.id)}
                                  title="Mark task missed / failed (-XP penalty)"
                                  aria-label={`Mark ${ev.title} failed`}
                                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => onEditEvent(ev)}
                                aria-label={`Edit ${ev.title}`}
                                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/80 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-5 overflow-x-auto">
          <div className="grid grid-cols-7 gap-3 min-w-[820px]">
            {weekDates.map((dateISO) => {
              const items = events
                .filter((e) => e.date === dateISO)
                .sort((a, b) => a.startTime.localeCompare(b.startTime));
              const isSelected = dateISO === selectedDate;
              const isToday = dateISO === todayDate;

              return (
                <div
                  key={dateISO}
                  className={`border rounded-xl p-3 flex flex-col min-h-[260px] ${
                    isSelected
                      ? 'border-blue-600 dark:border-sky-400 bg-blue-50/20 dark:bg-sky-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070B14]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDate(dateISO);
                      setViewMode('day');
                    }}
                    className="text-left pb-2.5 mb-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {formatReadableDate(dateISO)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {items.length} blocks
                      </div>
                    </div>
                    {isToday && (
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-sky-400">
                        Today
                      </span>
                    )}
                  </button>

                  <div className="space-y-2 flex-1">
                    {items.length === 0 ? (
                      <div className="text-xs text-slate-400 dark:text-slate-600 py-4 text-center">
                        Open day
                      </div>
                    ) : (
                      items.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => onEditEvent(ev)}
                          className={`w-full text-left p-2 rounded-lg border text-xs transition-colors cursor-pointer ${getCategorySurface(
                            ev.category,
                            ev.completed
                          )}`}
                        >
                          <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            {ev.startTime}–{ev.endTime}
                          </div>
                          <div
                            className={`font-semibold truncate mt-0.5 ${
                              ev.completed ? 'line-through text-slate-400' : ''
                            }`}
                          >
                            {ev.title}
                          </div>
                        </button>
                      ))
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onCreateEventAt(dateISO, '09:00')}
                    className="mt-3 w-full py-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-md transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CalendarIcon className="w-3 h-3" />
                    Add
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
