import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  CalendarEvent,
  EventCategory,
  Habit,
  HabitCategory,
  HabitDifficulty,
  HabitFrequency,
} from '../types';
import { getXpForDifficulty } from '../data/initialData';

interface EventModalProps {
  initialEvent?: CalendarEvent | null;
  defaultDate: string;
  defaultStartTime?: string;
  habits: Habit[];
  onClose: () => void;
  onSave: (event: Omit<CalendarEvent, 'id'>, existingId?: string) => void;
  onDelete?: (id: string) => void;
}

export const EventModal: React.FC<EventModalProps> = ({
  initialEvent,
  defaultDate,
  defaultStartTime = '09:00',
  habits,
  onClose,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState(initialEvent?.title || '');
  const [date, setDate] = useState(initialEvent?.date || defaultDate);
  const [startTime, setStartTime] = useState(
    initialEvent?.startTime || defaultStartTime
  );
  const [endTime, setEndTime] = useState(() => {
    if (initialEvent?.endTime) return initialEvent.endTime;
    const [h, m] = defaultStartTime.split(':').map(Number);
    const total = Math.min(23 * 60 + 45, h * 60 + m + 45);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(
      total % 60
    ).padStart(2, '0')}`;
  });
  const [category, setCategory] = useState<EventCategory>(
    initialEvent?.category || 'Academics'
  );
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(
    initialEvent?.priority || 'medium'
  );
  const [linkedHabitId, setLinkedHabitId] = useState(
    initialEvent?.linkedHabitId || ''
  );
  const [alarmMinutesBefore, setAlarmMinutesBefore] = useState(
    initialEvent?.alarmMinutesBefore ?? 10
  );
  const [notes, setNotes] = useState(initialEvent?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(
      {
        title: title.trim(),
        date,
        startTime,
        endTime,
        category,
        priority,
        linkedHabitId: linkedHabitId || undefined,
        completed: initialEvent?.completed || false,
        alarmMinutesBefore,
        notes: notes.trim() || undefined,
        source: initialEvent?.source || 'user',
        googleEventId: initialEvent?.googleEventId,
      },
      initialEvent?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={initialEvent ? 'Edit calendar event' : 'New calendar event'}
    >
      <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-sky-500/30 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {initialEvent ? 'Edit Calendar Block' : 'Schedule Calendar Block'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Block Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. C Pointers Lab Prep or Debate Practice"
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Start
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                End
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as EventCategory)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="Academics">Academics</option>
                <option value="Deep Work">Deep Work</option>
                <option value="Habit Ritual">Habit Ritual</option>
                <option value="Public Speaking">Public Speaking</option>
                <option value="Hackathon">Hackathon</option>
                <option value="Health">Health</option>
                <option value="Recovery">Recovery</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as 'high' | 'medium' | 'low')
                }
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Reminder Cue
              </label>
              <select
                value={alarmMinutesBefore}
                onChange={(e) => setAlarmMinutesBefore(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value={5}>5 min before</option>
                <option value={10}>10 min before</option>
                <option value={15}>15 min before</option>
                <option value={30}>30 min before</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Link to Tracked Habit (optional)
            </label>
            <select
              value={linkedHabitId}
              onChange={(e) => {
                setLinkedHabitId(e.target.value);
                const found = habits.find((h) => h.id === e.target.value);
                if (found && !title.trim()) {
                  setTitle(found.title);
                  setCategory('Habit Ritual');
                }
              }}
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">None (standalone calendar block)</option>
              {habits.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.title} ({h.durationMinutes}m · +{h.xpReward} XP)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Lab topics, pitch outline, or prep goals..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            {initialEvent && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(initialEvent.id);
                  onClose();
                }}
                className="px-4 py-2 min-h-[40px] text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
              >
                Delete Block
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 min-h-[40px] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
              >
                {initialEvent ? 'Save Changes' : 'Add to Calendar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

interface HabitModalProps {
  initialHabit?: Habit | null;
  onClose: () => void;
  onSave: (
    data: {
      title: string;
      category: HabitCategory;
      frequency: HabitFrequency;
      preferredTime: string;
      durationMinutes: number;
      difficulty: HabitDifficulty;
      notes?: string;
      scheduleToday: boolean;
    },
    existingId?: string
  ) => void;
  onDelete?: (id: string) => void;
}

export const HabitModal: React.FC<HabitModalProps> = ({
  initialHabit,
  onClose,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState(initialHabit?.title || '');
  const [category, setCategory] = useState<HabitCategory>(
    initialHabit?.category || 'Academics'
  );
  const [frequency, setFrequency] = useState<HabitFrequency>(
    initialHabit?.frequency || 'daily'
  );
  const [preferredTime, setPreferredTime] = useState(
    initialHabit?.preferredTime || '08:00'
  );
  const [durationMinutes, setDurationMinutes] = useState(
    initialHabit?.durationMinutes || 30
  );
  const [difficulty, setDifficulty] = useState<HabitDifficulty>(
    initialHabit?.difficulty || 'Focused'
  );
  const [notes, setNotes] = useState(initialHabit?.notes || '');
  const [scheduleToday, setScheduleToday] = useState(!initialHabit);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(
      {
        title: title.trim(),
        category,
        frequency,
        preferredTime,
        durationMinutes: Math.max(5, Number(durationMinutes) || 15),
        difficulty,
        notes: notes.trim() || undefined,
        scheduleToday,
      },
      initialHabit?.id
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={initialHabit ? 'Edit habit' : 'Create new habit'}
    >
      <div className="bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-sky-500/30 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            {initialHabit ? 'Edit Quest Protocol' : 'New Quest Protocol'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Protocol Name
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. DSA Array Drills or Impromptu Speech"
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Hunter Attribute Pillar
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as HabitCategory)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="Academics">Academics (INT)</option>
                <option value="Hackathons & Code">Hackathons & Code (AGI)</option>
                <option value="Public Speaking">Public Speaking (CHA)</option>
                <option value="Health & Vitality">Health & Vitality (VIT)</option>
                <option value="Mindset">Mindset (SEN)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Difficulty Tier & XP
              </label>
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as HabitDifficulty)
                }
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="Standard">Standard (+25 XP)</option>
                <option value="Focused">Focused (+40 XP)</option>
                <option value="Keystone">Keystone (+60 XP)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Cadence
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as HabitFrequency)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekends">Weekends</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Time
              </label>
              <input
                type="time"
                required
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Duration (min)
              </label>
              <input
                type="number"
                min={5}
                max={240}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Protocol Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cue, syllabus topic, or speaking rubric..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            />
          </div>

          {!initialHabit && (
            <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={scheduleToday}
                onChange={(e) => setScheduleToday(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-sky-500"
              />
              <span>
                Also block this protocol on today’s calendar ({preferredTime},{' '}
                {durationMinutes} min · +{getXpForDifficulty(difficulty)} XP)
              </span>
            </label>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            {initialHabit && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(initialHabit.id);
                  onClose();
                }}
                className="px-4 py-2 min-h-[40px] text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors cursor-pointer"
              >
                Delete Habit
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 min-h-[40px] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
              >
                {initialHabit ? 'Save Changes' : 'Create Habit'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
