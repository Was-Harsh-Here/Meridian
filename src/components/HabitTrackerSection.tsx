import React, { useMemo, useState } from 'react';
import { CalendarPlus, Check, Edit3, Plus, Search, XCircle } from 'lucide-react';
import { CalendarEvent, Habit, HabitCategory } from '../types';
import { SevenDayPipBar, StreakBadgeText } from './GamifiedBars';

interface HabitTrackerSectionProps {
  habits: Habit[];
  calendarEvents: CalendarEvent[];
  selectedDate: string;
  onToggleHabit: (habitId: string, dateISO: string) => void;
  onFailHabit?: (habit: Habit, dateISO: string) => void;
  onAddHabit: () => void;
  onEditHabit: (habit: Habit) => void;
  onScheduleHabit: (habit: Habit, dateISO: string) => void;
}

export const HabitTrackerSection: React.FC<HabitTrackerSectionProps> = ({
  habits,
  calendarEvents,
  selectedDate,
  onToggleHabit,
  onFailHabit,
  onAddHabit,
  onEditHabit,
  onScheduleHabit,
}) => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'All' | HabitCategory>('All');
  const [query, setQuery] = useState('');

  const scheduledHabitIds = useMemo(() => {
    return new Set(
      calendarEvents
        .filter((e) => e.date === selectedDate && e.linkedHabitId)
        .map((e) => e.linkedHabitId as string)
    );
  }, [calendarEvents, selectedDate]);

  const filteredHabits = useMemo(() => {
    return habits
      .filter((h) => {
        const done = h.completedDates.includes(selectedDate);
        if (statusFilter === 'pending' && done) return false;
        if (statusFilter === 'done' && !done) return false;
        if (categoryFilter !== 'All' && h.category !== categoryFilter) return false;
        if (
          query.trim() &&
          !h.title.toLowerCase().includes(query.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.preferredTime.localeCompare(b.preferredTime));
  }, [habits, selectedDate, statusFilter, categoryFilter, query]);

  const completedTodayCount = habits.filter((h) =>
    h.completedDates.includes(selectedDate)
  ).length;

  return (
    <section
      aria-label="Daily Quest Protocols"
      className="sl-panel sl-reticle overflow-hidden"
    >
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-sky-500/20 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-blue-700 dark:text-sky-400 font-semibold block">
            [ DAILY HABIT PROTOCOLS ]
          </span>
          <h3 className="font-display text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100">
            Daily Quest Protocols
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
            {completedTodayCount} / {habits.length} CLEARED · {selectedDate}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/20 rounded">
            {(['all', 'pending', 'done'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-white dark:bg-sky-600 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab === 'all' ? 'All' : tab === 'pending' ? 'Remaining' : 'Done'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onAddHabit}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[42px] text-xs font-bold uppercase tracking-wider font-display text-white bg-blue-700 dark:bg-sky-600 hover:bg-blue-800 dark:hover:bg-sky-500 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Protocol
          </button>
        </div>
      </div>

      {/* Filter & search toolbar */}
      <div className="px-4 sm:px-5 py-3 bg-slate-50/70 dark:bg-[#050811]/70 border-b border-slate-200 dark:border-sky-500/15 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search protocols..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-[#060B18] border border-slate-200 dark:border-sky-500/25 text-slate-900 dark:text-slate-100 rounded focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
          {(
            [
              'All',
              'Academics',
              'Hackathons & Code',
              'Public Speaking',
              'Health & Vitality',
              'Mindset',
            ] as const
          ).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1.5 min-h-[36px] text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-slate-900 dark:bg-sky-500 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filteredHabits.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            No matching protocols for this filter
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Adjust your filter or ask Meridian to design a new protocol.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setCategoryFilter('All');
              setQuery('');
            }}
            className="mt-4 px-4 py-2 min-h-[40px] text-xs font-semibold text-blue-600 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-sky-950/50 rounded-lg transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {filteredHabits.map((habit) => {
            const isCompleted = habit.completedDates.includes(selectedDate);
            const isScheduled = scheduledHabitIds.has(habit.id);

            return (
              <div
                key={habit.id}
                className={`px-4 sm:px-5 py-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 transition-colors ${
                  isCompleted
                    ? 'bg-slate-50/50 dark:bg-slate-900/30'
                    : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/50'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onToggleHabit(habit.id, selectedDate)}
                    aria-label={
                      isCompleted
                        ? `Mark ${habit.title} incomplete`
                        : `Complete ${habit.title}`
                    }
                    className={`min-h-[42px] min-w-[42px] flex items-center justify-center rounded transition-all shrink-0 cursor-pointer ${
                      isCompleted
                        ? 'bg-emerald-600 dark:bg-sky-500 text-white hover:bg-emerald-700 dark:hover:bg-sky-400'
                        : 'bg-white dark:bg-[#050811] border border-slate-300 dark:border-sky-500/40 text-transparent hover:border-blue-600 dark:hover:border-sky-400'
                    }`}
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold truncate ${
                          isCompleted
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {habit.title}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      <span className="font-medium text-slate-700 dark:text-sky-400">
                        {habit.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{habit.preferredTime}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{habit.durationMinutes}m</span>
                      <span aria-hidden="true">·</span>
                      <span>{habit.difficulty}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                        +{habit.xpReward} XP
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0">
                  <div className="hidden md:flex flex-col items-end gap-1">
                    <SevenDayPipBar
                      completedDates={habit.completedDates}
                      todayISO={selectedDate}
                    />
                    <StreakBadgeText streak={habit.streak} />
                  </div>

                  <div className="flex items-center gap-1">
                    {!isCompleted && onFailHabit && (
                      <button
                        type="button"
                        onClick={() => onFailHabit(habit, selectedDate)}
                        title={`Mark missed (-${Math.max(15, Math.round(habit.xpReward * 0.6))} XP penalty)`}
                        aria-label={`Mark ${habit.title} missed`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}

                    {!isScheduled && (
                      <button
                        type="button"
                        onClick={() => onScheduleHabit(habit, selectedDate)}
                        title="Add to selected day's calendar"
                        className="px-2.5 py-2 min-h-[44px] inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-sky-400 hover:bg-blue-50 dark:hover:bg-sky-950/60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Schedule</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onEditHabit(habit)}
                      aria-label={`Edit ${habit.title}`}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
