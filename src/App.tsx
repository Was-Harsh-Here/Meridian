import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlarmClock,
  BookOpen,
  Bot,
  Box,
  Calendar,
  Compass,
  LayoutDashboard,
  Moon,
  Plus,
  Sparkles,
  Sun,
  Trophy,
  X,
} from 'lucide-react';
import {
  AISuggestion,
  AlarmItem,
  AnimeSfxId,
  AppState,
  AssistantComplexity,
  AssistantMessage,
  AssistantRole,
  CalendarEvent,
  EventCategory,
  ExecutiveBriefing,
  Habit,
  HabitCategory,
  HabitDifficulty,
  HabitFrequency,
  JournalEntry,
  Quest,
  SystemLogEntry,
  UserPreferences,
  WebOpportunity,
} from './types';
import {
  ACHIEVEMENTS,
  addDaysISO,
  computeDailyXp,
  computeLevelFromXp,
  computeTotalXp,
  createInitialState,
  createSystemLogEntry,
  formatDateISO,
  getComboMultiplier,
  getEventFailurePenaltyXp,
  getHabitFailurePenaltyXp,
  getXpForDifficulty,
  scanUpcomingExamAssignmentDeadlines,
} from './data/initialData';
import {
  DailyMomentumMeter,
  QuestProgressCard,
  RankMasteryBar,
} from './components/GamifiedBars';
import { DeadlineCountdownSection } from './components/DeadlineCountdownSection';
import { HabitTrackerSection } from './components/HabitTrackerSection';
import { CalendarWorkspace } from './components/CalendarWorkspace';
import { ExecutiveAssistantPanel } from './components/ExecutiveAssistantPanel';
import { InsightsAndQuestsView } from './components/InsightsAndQuestsView';
import { JournalWorkspace } from './components/JournalWorkspace';
import { OpportunitiesHub } from './components/OpportunitiesHub';
import { ClockAlarmCenter } from './components/ClockAlarmCenter';
import { SystemSanctum3D } from './components/SystemSanctum3D';
import { EventModal, HabitModal } from './components/Modals';
import {
  OfflineIndicator,
  PWAInstallButton,
  useOnlineStatus,
} from './hooks/usePWAInstall';
import {
  fetchGoogleCalendarEvents,
  getCachedGoogleToken,
  initGoogleAuth,
  pushEventToGoogleCalendar,
  signInWithGoogleCalendar,
  signOutGoogleCalendar,
} from './services/googleCalendar';
import {
  OllamaConfig,
  runOfflineAssistantChat,
  runOfflineAutoPlan,
  runOfflineBriefing,
  tryOllamaChat,
} from './services/offlineAiEngine';
import {
  playAnimeNotificationSfx,
  playPenaltySfx,
} from './services/soundscapeEngine';

const STORAGE_KEY = 'meridian_vvp_it_os_v2';
const OLLAMA_STORAGE_KEY = 'meridian_ollama_cfg_v1';

type NavTab =
  | 'overview'
  | 'calendar'
  | 'journal'
  | 'opportunities'
  | 'clock'
  | 'quests';

function addMinutesToTime(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(23 * 60 + 55, Math.max(0, h * 60 + m + mins));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(
    total % 60
  ).padStart(2, '0')}`;
}

export default function App() {
  const todayDate = useMemo(() => formatDateISO(new Date()), []);
  const isOnline = useOnlineStatus();

  const [state, setState] = useState<AppState>(() => {
    const baseline = createInitialState(todayDate);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<AppState>;
        return {
          ...baseline,
          ...parsed,
          journalEntries: parsed.journalEntries || baseline.journalEntries || [],
          systemLogs: parsed.systemLogs || baseline.systemLogs || [],
          penaltyXp: parsed.penaltyXp ?? 0,
          penalizedTaskIds: parsed.penalizedTaskIds || [],
          lastPenaltyAuditDate: parsed.lastPenaltyAuditDate || todayDate,
          preferences: {
            ...baseline.preferences,
            ...(parsed.preferences || {}),
            notificationSfx: parsed.preferences?.notificationSfx || 'system_arise',
          },
        };
      }
    } catch {
      // Ignore corrupt storage
    }
    return baseline;
  });

  const [ollamaConfig, setOllamaConfig] = useState<OllamaConfig>(() => {
    try {
      const saved = localStorage.getItem(OLLAMA_STORAGE_KEY);
      if (saved) return JSON.parse(saved) as OllamaConfig;
    } catch {
      // Ignore
    }
    return {
      enabled: false,
      endpoint: 'http://localhost:11434',
      model: 'llama3.2',
    };
  });

  // Sync Tailwind .dark class with state.theme
  useEffect(() => {
    const root = document.documentElement;
    if (state.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute(
        'content',
        state.theme === 'dark' ? '#070B14' : '#f8fafc'
      );
    }
  }, [state.theme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota
    }
  }, [state]);

  useEffect(() => {
    try {
      localStorage.setItem(OLLAMA_STORAGE_KEY, JSON.stringify(ollamaConfig));
    } catch {
      // Ignore
    }
  }, [ollamaConfig]);

  const [undoStack, setUndoStack] = useState<AppState[]>([]);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [selectedDate, setSelectedDate] = useState<string>(todayDate);
  const [mobileAssistantOpen, setMobileAssistantOpen] = useState(false);
  const [sanctumOpen, setSanctumOpen] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // Google Calendar OAuth state (token strictly in-memory via googleCalendar.ts)
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleUserEmail, setGoogleUserEmail] = useState<string | null>(null);
  const [isGoogleSyncing, setIsGoogleSyncing] = useState(false);
  const [pendingGooglePush, setPendingGooglePush] = useState<
    CalendarEvent[] | null
  >(null);

  // Modals
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [modalDefaultTime, setModalDefaultTime] = useState('09:00');

  const [habitModalOpen, setHabitModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  // AI Assistant state
  const [assistantRole, setAssistantRole] = useState<AssistantRole>('balanced');
  const [assistantComplexity, setAssistantComplexity] =
    useState<AssistantComplexity>('general');
  const [briefing, setBriefing] = useState<ExecutiveBriefing | null>(null);
  const [isRefreshingBriefing, setIsRefreshingBriefing] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isAutoPlanning, setIsAutoPlanning] = useState(false);
  const [isSearchingEvents, setIsSearchingEvents] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      text: `System initialized for ${state.preferences.name} (${state.preferences.college}). I am your CBT performance therapist, routine manager, and IT study/speaking mentor. Ask me to balance your V.V.P. study blocks, scout live hackathons & debate stages, or manage alarms.`,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  ]);

  // Initialize Firebase Google Auth listener
  useEffect(() => {
    const unsub = initGoogleAuth(
      (user) => {
        setGoogleConnected(true);
        setGoogleUserEmail(user.email);
      },
      () => {
        setGoogleConnected(false);
        setGoogleUserEmail(null);
      }
    );
    return () => unsub();
  }, []);

  const toastTimeoutRef = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3400);
  }, []);

  const appendLog = useCallback(
    (
      existing: SystemLogEntry[] | undefined,
      entry: SystemLogEntry | SystemLogEntry[]
    ): SystemLogEntry[] => {
      const additions = Array.isArray(entry) ? entry : [entry];
      return [...additions, ...(existing || [])].slice(0, 140);
    },
    []
  );

  // Synchronize dynamic quest progress
  const computedQuests = useMemo(() => {
    const morningDone = state.calendarEvents.filter(
      (e) =>
        e.date === todayDate &&
        e.completed &&
        Number(e.startTime.split(':')[0]) < 12
    ).length;

    const keystoneDone = state.habits.filter(
      (h) => h.difficulty === 'Keystone' && h.completedDates.includes(todayDate)
    ).length;

    const last7Set = new Set(
      Array.from({ length: 7 }, (_, i) => addDaysISO(todayDate, -i))
    );
    const weeklyCompletions = state.habits.reduce(
      (sum, h) => sum + h.completedDates.filter((d) => last7Set.has(d)).length,
      0
    );

    return state.quests.map((q) => {
      let currentCount = q.currentCount;
      if (q.id === 'qst-morning-protocol') {
        currentCount = morningDone;
      } else if (q.id === 'qst-keystone-lock') {
        currentCount = keystoneDone;
      } else if (q.id === 'qst-weekly-iron') {
        currentCount = weeklyCompletions;
      } else if (q.type === 'daily') {
        currentCount = state.habits.filter((h) =>
          h.completedDates.includes(todayDate)
        ).length;
      }

      const claimed = state.claimedQuestIds.includes(q.id) || q.claimed;
      return {
        ...q,
        currentCount: Math.min(q.targetCount, currentCount),
        completed: currentCount >= q.targetCount,
        claimed,
      };
    });
  }, [
    state.calendarEvents,
    state.habits,
    state.quests,
    state.claimedQuestIds,
    todayDate,
  ]);

  // Evaluate automatic achievements
  useEffect(() => {
    const oratorLogs = state.habits
      .filter((h) => h.category === 'Public Speaking')
      .reduce((s, h) => s + h.completedDates.length, 0);
    const hackLogs = state.habits
      .filter((h) => h.category === 'Hackathons & Code')
      .reduce((s, h) => s + h.completedDates.length, 0);
    const maxStreak = Math.max(0, ...state.habits.map((h) => h.streak));
    const scholarReady = state.courses.some((c) => c.progressPercent >= 60);

    const earnedIds: string[] = [];
    if (state.habits.some((h) => h.completedDates.length > 0)) {
      earnedIds.push('ach-first-blood');
    }
    if (oratorLogs >= 10) earnedIds.push('ach-orator');
    if (hackLogs >= 10) earnedIds.push('ach-hackathon');
    if (scholarReady) earnedIds.push('ach-scholar');
    if (maxStreak >= 7) earnedIds.push('ach-iron-streak');
    if (state.focusSessionsCompleted >= 1) earnedIds.push('ach-pomodoro');

    const newOnes = earnedIds.filter(
      (id) => !state.unlockedAchievements.includes(id)
    );
    if (newOnes.length > 0) {
      const rewardSum = newOnes.reduce((sum, id) => {
        const def = ACHIEVEMENTS.find((a) => a.id === id);
        return sum + (def?.xpReward || 0);
      }, 0);
      const achievementLogs = newOnes.map((id) => {
        const def = ACHIEVEMENTS.find((a) => a.id === id);
        return createSystemLogEntry(
          'quest_claimed',
          `Achievement Unlocked: ${def?.title || id}`,
          def?.description || 'Milestone reward granted.',
          def?.xpReward || 0,
          0,
          todayDate
        );
      });
      setState((prev) => ({
        ...prev,
        unlockedAchievements: [...prev.unlockedAchievements, ...newOnes],
        bonusXp: prev.bonusXp + rewardSum,
        systemLogs: appendLog(prev.systemLogs, achievementLogs),
      }));
      const firstDef = ACHIEVEMENTS.find((a) => a.id === newOnes[0]);
      if (firstDef) {
        playAnimeNotificationSfx(
          state.preferences.notificationSfx || 'system_arise',
          0.7
        );
        showToast(`Achievement Unlocked: ${firstDef.title} (+${firstDef.xpReward} XP)`);
      }
    }
  }, [
    state.habits,
    state.courses,
    state.focusSessionsCompleted,
    state.unlockedAchievements,
    state.preferences.notificationSfx,
    todayDate,
    appendLog,
    showToast,
  ]);

  const totalXp = useMemo(() => computeTotalXp(state), [state]);
  const rankInfo = useMemo(() => computeLevelFromXp(totalXp), [totalXp]);
  const dailyXp = useMemo(
    () => computeDailyXp(state, selectedDate),
    [state, selectedDate]
  );
  const completedTodayCount = useMemo(
    () =>
      state.habits.filter((h) => h.completedDates.includes(selectedDate)).length,
    [state.habits, selectedDate]
  );
  const comboMultiplier = useMemo(
    () => getComboMultiplier(completedTodayCount),
    [completedTodayCount]
  );
  const doubleXpActive = Boolean(
    state.doubleXpActiveUntil && Date.now() < state.doubleXpActiveUntil
  );

  const notificationSfx = state.preferences.notificationSfx || 'system_arise';

  // Automatic & Manual Penalty Audit for Overdue Tasks & Yesterday's Missed Habits
  const runOverduePenaltyAudit = useCallback(
    (manual = false) => {
      const penalizedSet = new Set(state.penalizedTaskIds || []);
      const overdueEvents = state.calendarEvents.filter(
        (ev) =>
          ev.date < todayDate &&
          !ev.completed &&
          !ev.failed &&
          !penalizedSet.has(ev.id)
      );

      const yesterday = addDaysISO(todayDate, -1);
      const shouldCheckYesterdayHabits = state.lastPenaltyAuditDate !== todayDate;
      const yesterdayDay = (() => {
        const [y, m, d] = yesterday.split('-').map(Number);
        return new Date(y, m - 1, d).getDay();
      })();
      const isYesterdayWeekday = yesterdayDay >= 1 && yesterdayDay <= 5;

      const missedHabitsYesterday = shouldCheckYesterdayHabits
        ? state.habits.filter((h) => {
            if (h.createdAt > yesterday) return false;
            if (h.completedDates.includes(yesterday)) return false;
            if (h.frequency === 'weekdays' && !isYesterdayWeekday) return false;
            if (h.frequency === 'weekends' && isYesterdayWeekday) return false;
            const auditKey = `hab-miss-${h.id}-${yesterday}`;
            return !penalizedSet.has(auditKey);
          })
        : [];

      if (overdueEvents.length === 0 && missedHabitsYesterday.length === 0) {
        if (shouldCheckYesterdayHabits) {
          setState((prev) => ({ ...prev, lastPenaltyAuditDate: todayDate }));
        }
        if (manual) {
          showToast('Audit clear · Zero overdue tasks or missed protocols');
        }
        return;
      }

      let addedPenalty = 0;
      const newIds: string[] = [];
      const newLogs: SystemLogEntry[] = [];

      overdueEvents.forEach((ev) => {
        const p = getEventFailurePenaltyXp(ev);
        addedPenalty += p;
        newIds.push(ev.id);
        newLogs.push(
          createSystemLogEntry(
            'task_failed',
            `Overdue Penalty: ${ev.title}`,
            `Task scheduled for ${ev.date} (${ev.startTime}–${ev.endTime}) was left unfinished.`,
            -p,
            0,
            todayDate
          )
        );
      });

      missedHabitsYesterday.forEach((h) => {
        const p = getHabitFailurePenaltyXp(h);
        addedPenalty += p;
        newIds.push(`hab-miss-${h.id}-${yesterday}`);
        newLogs.push(
          createSystemLogEntry(
            'habit_failed',
            `Missed Protocol: ${h.title}`,
            `Unchecked on ${yesterday} · Streak reset and XP penalty applied.`,
            -p,
            0,
            todayDate
          )
        );
      });

      const failedEventIds = new Set(overdueEvents.map((e) => e.id));
      const missedHabitIds = new Set(missedHabitsYesterday.map((h) => h.id));

      setState((prev) => ({
        ...prev,
        habits: prev.habits.map((h) =>
          missedHabitIds.has(h.id) ? { ...h, streak: 0 } : h
        ),
        calendarEvents: prev.calendarEvents.map((ev) =>
          failedEventIds.has(ev.id) ? { ...ev, failed: true } : ev
        ),
        penaltyXp: (prev.penaltyXp || 0) + addedPenalty,
        penalizedTaskIds: [...(prev.penalizedTaskIds || []), ...newIds],
        lastPenaltyAuditDate: todayDate,
        systemLogs: appendLog(prev.systemLogs, newLogs),
      }));

      playPenaltySfx(notificationSfx, 0.55);
      showToast(
        `-${addedPenalty} XP Penalty · ${newLogs.length} overdue/missed item${
          newLogs.length === 1 ? '' : 's'
        } logged`
      );
    },
    [
      state.penalizedTaskIds,
      state.calendarEvents,
      state.lastPenaltyAuditDate,
      state.habits,
      todayDate,
      notificationSfx,
      appendLog,
      showToast,
    ]
  );

  useEffect(() => {
    runOverduePenaltyAudit(false);
    // Run once on initial boot / date rollover
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayDate]);

  // Toggle Theme
  const handleToggleTheme = useCallback(() => {
    setState((prev) => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  }, []);

  // Toggle Habit Completion (with Anime SFX + System Log)
  const handleToggleHabit = useCallback(
    (habitId: string, dateISO: string) => {
      const target = state.habits.find((h) => h.id === habitId);
      if (!target) return;
      const alreadyDone = target.completedDates.includes(dateISO);
      const booster =
        state.doubleXpActiveUntil && Date.now() < state.doubleXpActiveUntil
          ? 2
          : 1;
      const gainedXp = target.xpReward * booster;
      const nextStreak = alreadyDone
        ? Math.max(0, target.streak - 1)
        : target.streak + 1;

      const logEntry = createSystemLogEntry(
        alreadyDone ? 'habit_unchecked' : 'habit_completed',
        `${alreadyDone ? 'Unchecked' : 'Completed'}: ${target.title}`,
        `${target.category} · ${
          alreadyDone ? 'Completion reverted' : `Streak ${nextStreak}d`
        }`,
        alreadyDone ? -gainedXp : gainedXp,
        alreadyDone ? -10 : 10,
        dateISO
      );

      setState((prev) => ({
        ...prev,
        habits: prev.habits.map((h) => {
          if (h.id !== habitId) return h;
          const nextDates = alreadyDone
            ? h.completedDates.filter((d) => d !== dateISO)
            : [...h.completedDates, dateISO];
          return {
            ...h,
            completedDates: nextDates,
            streak: nextStreak,
            bestStreak: Math.max(h.bestStreak, nextStreak),
          };
        }),
        calendarEvents: prev.calendarEvents.map((ev) => {
          if (ev.linkedHabitId === habitId && ev.date === dateISO) {
            return { ...ev, completed: !alreadyDone, failed: false };
          }
          return ev;
        }),
        focusCoins: alreadyDone
          ? Math.max(0, prev.focusCoins - 10)
          : prev.focusCoins + 10,
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));

      if (!alreadyDone) {
        playAnimeNotificationSfx(notificationSfx, 0.72);
        showToast(`+${gainedXp} XP · +10 Coins · ${target.title}`);
      } else {
        showToast(`Reverted: ${target.title}`);
      }
    },
    [
      state.habits,
      state.doubleXpActiveUntil,
      notificationSfx,
      appendLog,
      showToast,
    ]
  );

  const handleFailHabit = useCallback(
    (habit: Habit, dateISO: string) => {
      const penalty = getHabitFailurePenaltyXp(habit);
      const logEntry = createSystemLogEntry(
        'habit_failed',
        `Failed Protocol: ${habit.title}`,
        `Marked missed on ${dateISO} · Streak reset to 0d`,
        -penalty,
        0,
        dateISO
      );

      setState((prev) => ({
        ...prev,
        habits: prev.habits.map((h) =>
          h.id === habit.id ? { ...h, streak: 0 } : h
        ),
        calendarEvents: prev.calendarEvents.map((ev) =>
          ev.linkedHabitId === habit.id && ev.date === dateISO
            ? { ...ev, completed: false, failed: true }
            : ev
        ),
        penaltyXp: (prev.penaltyXp || 0) + penalty,
        penalizedTaskIds: [
          ...(prev.penalizedTaskIds || []),
          `hab-miss-${habit.id}-${dateISO}`,
        ],
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));

      playPenaltySfx(notificationSfx, 0.55);
      showToast(`-${penalty} XP Penalty · Missed: ${habit.title}`);
    },
    [notificationSfx, appendLog, showToast]
  );

  const handleToggleEventComplete = useCallback(
    (eventId: string) => {
      const targetEvent = state.calendarEvents.find((e) => e.id === eventId);
      if (!targetEvent) return;

      if (targetEvent.linkedHabitId) {
        handleToggleHabit(targetEvent.linkedHabitId, targetEvent.date);
        return;
      }

      const completing = !targetEvent.completed;
      const logEntry = createSystemLogEntry(
        completing ? 'task_completed' : 'habit_unchecked',
        `${completing ? 'Completed Task' : 'Reopened Task'}: ${targetEvent.title}`,
        `${targetEvent.category} · ${targetEvent.startTime}–${targetEvent.endTime}`,
        completing ? 20 : -20,
        completing ? 5 : 0,
        targetEvent.date
      );

      setState((prev) => ({
        ...prev,
        calendarEvents: prev.calendarEvents.map((ev) =>
          ev.id === eventId
            ? { ...ev, completed: completing, failed: false }
            : ev
        ),
        focusCoins: completing ? prev.focusCoins + 5 : prev.focusCoins,
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));

      if (completing) {
        playAnimeNotificationSfx(notificationSfx, 0.65);
        showToast(`+20 XP · +5 Coins · ${targetEvent.title}`);
      } else {
        showToast(`Reopened: ${targetEvent.title}`);
      }
    },
    [
      state.calendarEvents,
      handleToggleHabit,
      notificationSfx,
      appendLog,
      showToast,
    ]
  );

  const handleFailEvent = useCallback(
    (eventId: string) => {
      const targetEvent = state.calendarEvents.find((e) => e.id === eventId);
      if (!targetEvent || targetEvent.failed) return;

      if (targetEvent.linkedHabitId) {
        const linked = state.habits.find(
          (h) => h.id === targetEvent.linkedHabitId
        );
        if (linked) {
          handleFailHabit(linked, targetEvent.date);
          return;
        }
      }

      const penalty = getEventFailurePenaltyXp(targetEvent);
      const logEntry = createSystemLogEntry(
        'task_failed',
        `Failed Task: ${targetEvent.title}`,
        `${targetEvent.category} (${targetEvent.date} ${targetEvent.startTime}) marked missed.`,
        -penalty,
        0,
        targetEvent.date
      );

      setState((prev) => ({
        ...prev,
        calendarEvents: prev.calendarEvents.map((ev) =>
          ev.id === eventId ? { ...ev, completed: false, failed: true } : ev
        ),
        penaltyXp: (prev.penaltyXp || 0) + penalty,
        penalizedTaskIds: [...(prev.penalizedTaskIds || []), eventId],
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));

      playPenaltySfx(notificationSfx, 0.55);
      showToast(`-${penalty} XP Penalty · Missed: ${targetEvent.title}`);
    },
    [
      state.calendarEvents,
      state.habits,
      handleFailHabit,
      notificationSfx,
      appendLog,
      showToast,
    ]
  );

  const handleSaveEvent = useCallback(
    (eventData: Omit<CalendarEvent, 'id'>, existingId?: string) => {
      const logEntry = createSystemLogEntry(
        'calendar_sync',
        existingId
          ? `Updated Block: ${eventData.title}`
          : `Scheduled Block: ${eventData.title}`,
        `${eventData.date} · ${eventData.startTime}–${eventData.endTime} (${eventData.category})`,
        0,
        0,
        eventData.date
      );
      setState((prev) => {
        if (existingId) {
          return {
            ...prev,
            calendarEvents: prev.calendarEvents.map((ev) =>
              ev.id === existingId ? { ...eventData, id: existingId } : ev
            ),
            systemLogs: appendLog(prev.systemLogs, logEntry),
          };
        }
        const created: CalendarEvent = {
          ...eventData,
          id: `evt-${Date.now().toString(36)}`,
        };
        return {
          ...prev,
          calendarEvents: [...prev.calendarEvents, created],
          systemLogs: appendLog(prev.systemLogs, logEntry),
        };
      });
      showToast(existingId ? 'Calendar block updated' : 'Calendar block added');
    },
    [appendLog, showToast]
  );

  const handleDeleteEvent = useCallback(
    (eventId: string) => {
      const target = state.calendarEvents.find((e) => e.id === eventId);
      const logEntry = createSystemLogEntry(
        'calendar_sync',
        `Removed Block: ${target?.title || eventId}`,
        target ? `${target.date} · ${target.startTime}–${target.endTime}` : 'Deleted from calendar'
      );
      setState((prev) => ({
        ...prev,
        calendarEvents: prev.calendarEvents.filter((e) => e.id !== eventId),
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));
      showToast('Calendar block removed');
    },
    [state.calendarEvents, appendLog, showToast]
  );

  const handleSaveHabit = useCallback(
    (
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
    ) => {
      const xpReward = getXpForDifficulty(data.difficulty);
      const logEntry = createSystemLogEntry(
        'system_info',
        existingId ? `Updated Protocol: ${data.title}` : `Created Protocol: ${data.title}`,
        `${data.category} · ${data.difficulty} (${xpReward} XP) · ${data.preferredTime}`,
        0,
        0,
        selectedDate
      );
      setState((prev) => {
        if (existingId) {
          return {
            ...prev,
            habits: prev.habits.map((h) =>
              h.id === existingId
                ? {
                    ...h,
                    title: data.title,
                    category: data.category,
                    frequency: data.frequency,
                    preferredTime: data.preferredTime,
                    durationMinutes: data.durationMinutes,
                    difficulty: data.difficulty,
                    xpReward,
                    notes: data.notes,
                  }
                : h
            ),
            systemLogs: appendLog(prev.systemLogs, logEntry),
          };
        }

        const newId = `hab-${Date.now().toString(36)}`;
        const newHabit: Habit = {
          id: newId,
          title: data.title,
          category: data.category,
          frequency: data.frequency,
          preferredTime: data.preferredTime,
          durationMinutes: data.durationMinutes,
          difficulty: data.difficulty,
          xpReward,
          streak: 0,
          bestStreak: 0,
          completedDates: [],
          notes: data.notes,
          createdAt: todayDate,
        };

        const nextEvents = [...prev.calendarEvents];
        if (data.scheduleToday) {
          nextEvents.push({
            id: `evt-${Date.now().toString(36)}-s`,
            title: newHabit.title,
            date: selectedDate,
            startTime: newHabit.preferredTime,
            endTime: addMinutesToTime(
              newHabit.preferredTime,
              newHabit.durationMinutes
            ),
            category: 'Habit Ritual',
            linkedHabitId: newId,
            completed: false,
            priority: data.difficulty === 'Keystone' ? 'high' : 'medium',
            notes: newHabit.notes,
            source: 'user',
            alarmMinutesBefore: 10,
          });
        }

        return {
          ...prev,
          habits: [...prev.habits, newHabit],
          calendarEvents: nextEvents,
          systemLogs: appendLog(prev.systemLogs, logEntry),
        };
      });
      showToast(existingId ? 'Protocol updated' : 'New protocol created');
    },
    [selectedDate, todayDate, appendLog, showToast]
  );

  const handleDeleteHabit = useCallback(
    (habitId: string) => {
      const target = state.habits.find((h) => h.id === habitId);
      const logEntry = createSystemLogEntry(
        'system_info',
        `Deleted Protocol: ${target?.title || habitId}`,
        'Removed habit protocol and linked calendar blocks'
      );
      setState((prev) => ({
        ...prev,
        habits: prev.habits.filter((h) => h.id !== habitId),
        calendarEvents: prev.calendarEvents.filter(
          (e) => e.linkedHabitId !== habitId
        ),
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));
      showToast('Protocol deleted');
    },
    [state.habits, appendLog, showToast]
  );

  const handleScheduleHabit = useCallback(
    (habit: Habit, dateISO: string) => {
      const logEntry = createSystemLogEntry(
        'calendar_sync',
        `Scheduled Protocol: ${habit.title}`,
        `${dateISO} · ${habit.preferredTime} (${habit.durationMinutes}m)`,
        0,
        0,
        dateISO
      );
      setState((prev) => ({
        ...prev,
        calendarEvents: [
          ...prev.calendarEvents,
          {
            id: `evt-${Date.now().toString(36)}`,
            title: habit.title,
            date: dateISO,
            startTime: habit.preferredTime,
            endTime: addMinutesToTime(habit.preferredTime, habit.durationMinutes),
            category: 'Habit Ritual',
            linkedHabitId: habit.id,
            completed: habit.completedDates.includes(dateISO),
            priority: habit.difficulty === 'Keystone' ? 'high' : 'medium',
            notes: habit.notes,
            source: 'user',
            alarmMinutesBefore: 10,
          },
        ],
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));
      showToast(`Scheduled "${habit.title}" at ${habit.preferredTime}`);
    },
    [appendLog, showToast]
  );

  const handleClaimQuest = useCallback(
    (questId: string) => {
      const quest = computedQuests.find((q) => q.id === questId);
      if (!quest || !quest.completed || quest.claimed) return;

      const coinGain = quest.coinBonus || 25;
      const logEntry = createSystemLogEntry(
        'quest_claimed',
        `Gate Cleared: ${quest.title}`,
        `Claimed ${quest.type} quest milestone reward`,
        quest.xpBonus,
        coinGain
      );

      setState((prev) => ({
        ...prev,
        bonusXp: prev.bonusXp + quest.xpBonus,
        focusCoins: prev.focusCoins + coinGain,
        claimedQuestIds: [...prev.claimedQuestIds, questId],
        quests: prev.quests.map((q) =>
          q.id === questId ? { ...q, claimed: true } : q
        ),
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));
      playAnimeNotificationSfx(notificationSfx, 0.72);
      showToast(`Gate Cleared! +${quest.xpBonus} XP · +${coinGain} Coins`);
    },
    [computedQuests, notificationSfx, appendLog, showToast]
  );

  const handleBuyStreakShield = useCallback(() => {
    if (state.focusCoins < 50) return;
    const logEntry = createSystemLogEntry(
      'system_info',
      'Armory Purchase: Streak Shield',
      'Equipped +1 Streak Shield from Hunter Armory',
      0,
      -50
    );
    setState((prev) => ({
      ...prev,
      focusCoins: prev.focusCoins - 50,
      streakShields: prev.streakShields + 1,
      systemLogs: appendLog(prev.systemLogs, logEntry),
    }));
    showToast('Purchased +1 Streak Shield');
  }, [state.focusCoins, appendLog, showToast]);

  const handleActivateDoubleXp = useCallback(() => {
    if (state.focusCoins < 75) return;
    const logEntry = createSystemLogEntry(
      'system_info',
      'Armory Purchase: 2x Mana XP Elixir',
      'Doubled habit XP active for 2 hours',
      0,
      -75
    );
    setState((prev) => ({
      ...prev,
      focusCoins: prev.focusCoins - 75,
      doubleXpActiveUntil: Date.now() + 2 * 60 * 60 * 1000,
      systemLogs: appendLog(prev.systemLogs, logEntry),
    }));
    showToast('2x Mana XP Elixir active for 2 hours!');
  }, [state.focusCoins, appendLog, showToast]);

  // Alarms & Focus Pomodoro
  const handleAddAlarm = useCallback(
    (alarm: Omit<AlarmItem, 'id'>) => {
      const logEntry = createSystemLogEntry(
        'system_info',
        `Alarm Armed: ${alarm.label}`,
        `${alarm.time} (${alarm.repeat})`
      );
      setState((prev) => ({
        ...prev,
        alarms: [
          ...prev.alarms,
          { ...alarm, id: `alm-${Date.now().toString(36)}` },
        ],
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));
      showToast(`Alarm set for ${alarm.time}`);
    },
    [appendLog, showToast]
  );

  const handleToggleAlarm = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      alarms: prev.alarms.map((a) =>
        a.id === id ? { ...a, enabled: !a.enabled } : a
      ),
    }));
  }, []);

  const handleDeleteAlarm = useCallback(
    (id: string) => {
      const target = state.alarms.find((a) => a.id === id);
      const logEntry = createSystemLogEntry(
        'system_info',
        `Alarm Removed: ${target?.label || id}`,
        target ? `Cleared ${target.time} (${target.repeat})` : 'Alarm deleted'
      );
      setState((prev) => ({
        ...prev,
        alarms: prev.alarms.filter((a) => a.id !== id),
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));
    },
    [state.alarms, appendLog]
  );

  const handleAlarmTriggered = useCallback(
    (alarm: AlarmItem) => {
      const logEntry = createSystemLogEntry(
        'alarm_triggered',
        `Alarm Triggered: ${alarm.label}`,
        `Scheduled cue fired at ${alarm.time} (${alarm.soundType} tone)`
      );
      setState((prev) => ({
        ...prev,
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));
    },
    [appendLog]
  );

  const handleChangeNotificationSfx = useCallback(
    (sfx: AnimeSfxId) => {
      const logEntry = createSystemLogEntry(
        'system_info',
        `Audio Trigger Updated: ${sfx.replace(/_/g, ' ')}`,
        'Updated completion notification sound effect'
      );
      setState((prev) => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          notificationSfx: sfx,
        },
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));
      showToast('Notification sound updated');
    },
    [appendLog, showToast]
  );

  const handleCompleteFocusSession = useCallback(
    (minutes: number) => {
      const logEntry = createSystemLogEntry(
        'focus_completed',
        `Focus Sprint Completed (${minutes}m)`,
        'Deep academic focus timer finished with audio completion trigger.',
        35,
        15
      );
      setState((prev) => ({
        ...prev,
        bonusXp: prev.bonusXp + 35,
        focusCoins: prev.focusCoins + 15,
        focusSessionsCompleted: prev.focusSessionsCompleted + 1,
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));
      showToast(`${minutes}m Focus Sprint done! +35 XP · +15 Coins`);
    },
    [appendLog, showToast]
  );

  const handleAdvanceCourseProgress = useCallback(
    (courseId: string, delta: number) => {
      const target = state.courses.find((c) => c.id === courseId);
      const nextProgress = target
        ? Math.min(100, target.progressPercent + delta)
        : delta;
      const logEntry = createSystemLogEntry(
        'task_completed',
        `Syllabus Advanced: ${target?.code || courseId}`,
        `${target?.name || 'Course'} reached ${nextProgress}% (+${delta}%)`,
        20,
        5
      );
      setState((prev) => ({
        ...prev,
        courses: prev.courses.map((c) =>
          c.id === courseId
            ? { ...c, progressPercent: Math.min(100, c.progressPercent + delta) }
            : c
        ),
        bonusXp: prev.bonusXp + 20,
        focusCoins: prev.focusCoins + 5,
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));
      playAnimeNotificationSfx(notificationSfx, 0.65);
      showToast('+20 Academic XP · Syllabus updated');
    },
    [state.courses, notificationSfx, appendLog, showToast]
  );

  // Google Calendar Sign-In / Import / Confirmed Push
  const handleGoogleSignIn = useCallback(async () => {
    setApiError(null);
    try {
      const res = await signInWithGoogleCalendar();
      setGoogleConnected(true);
      setGoogleUserEmail(res.user.email);
      showToast('Connected to Google Calendar');
    } catch (err: any) {
      setApiError(err.message || 'Google Calendar sign-in failed.');
    }
  }, [showToast]);

  const handleGoogleSignOut = useCallback(async () => {
    await signOutGoogleCalendar();
    setGoogleConnected(false);
    setGoogleUserEmail(null);
    showToast('Disconnected from Google Calendar');
  }, [showToast]);

  const handleImportGoogleEvents = useCallback(async () => {
    const token = getCachedGoogleToken();
    if (!token) {
      await handleGoogleSignIn();
      return;
    }
    setIsGoogleSyncing(true);
    setApiError(null);
    try {
      const gEvents = await fetchGoogleCalendarEvents(
        token,
        todayDate,
        addDaysISO(todayDate, 7)
      );
      setState((prev) => {
        const existingGIds = new Set(
          prev.calendarEvents.map((e) => e.googleEventId).filter(Boolean)
        );
        const fresh = gEvents.filter((g) => !existingGIds.has(g.googleEventId));
        const logEntry = createSystemLogEntry(
          'calendar_sync',
          `Google Calendar Pulled (${fresh.length} new)`,
          `Synced ${gEvents.length} total event(s) for ${todayDate} → ${addDaysISO(todayDate, 7)}`
        );
        return {
          ...prev,
          calendarEvents: [...prev.calendarEvents, ...fresh],
          systemLogs: appendLog(prev.systemLogs, logEntry),
        };
      });
      showToast(`Imported ${gEvents.length} Google Calendar event(s)`);
    } catch (err: any) {
      setApiError(err.message || 'Failed to pull Google Calendar events.');
    } finally {
      setIsGoogleSyncing(false);
    }
  }, [todayDate, handleGoogleSignIn, appendLog, showToast]);

  const handleConfirmPushToGoogle = useCallback(async () => {
    if (!pendingGooglePush || pendingGooglePush.length === 0) return;
    const token = getCachedGoogleToken();
    if (!token) {
      setPendingGooglePush(null);
      await handleGoogleSignIn();
      return;
    }
    setIsGoogleSyncing(true);
    setApiError(null);
    try {
      let pushed = 0;
      const updates: Record<string, string> = {};
      for (const ev of pendingGooglePush) {
        const gId = await pushEventToGoogleCalendar(token, ev);
        updates[ev.id] = gId;
        pushed += 1;
      }
      const logEntry = createSystemLogEntry(
        'calendar_sync',
        `Pushed ${pushed} Block(s) to Google Calendar`,
        'Two-way calendar sync completed'
      );
      setState((prev) => ({
        ...prev,
        calendarEvents: prev.calendarEvents.map((ev) =>
          updates[ev.id]
            ? { ...ev, googleEventId: updates[ev.id], source: 'google' }
            : ev
        ),
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));
      showToast(`Synced ${pushed} block(s) to Google Calendar`);
    } catch (err: any) {
      setApiError(err.message || 'Failed to push events to Google Calendar.');
    } finally {
      setIsGoogleSyncing(false);
      setPendingGooglePush(null);
    }
  }, [pendingGooglePush, handleGoogleSignIn, appendLog, showToast]);

  // Live Web Search for Hackathons & Public Speaking
  const handleDiscoverEvents = useCallback(
    async (focus: 'all' | 'hackathon' | 'public_speaking', query?: string) => {
      if (!isOnline) {
        setApiError(
          'Live web search requires internet access. Offline mode is managing your local schedule.'
        );
        return;
      }
      setIsSearchingEvents(true);
      setApiError(null);
      try {
        const res = await fetch('/api/assistant/discover-events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            focus,
            query: query?.trim() || undefined,
            todayDate,
            college: state.preferences.college,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Web search failed.');
        }
        const foundOpps = data.opportunities || [];
        const searchLog = createSystemLogEntry(
          'system_info',
          `Live Radar Scan (${foundOpps.length} results)`,
          `Focus: ${focus}${query?.trim() ? ` · Query: "${query.trim()}"` : ''}`
        );
        setState((prev) => ({
          ...prev,
          opportunities: foundOpps,
          opportunitySources: data.sources || [],
          systemLogs: appendLog(prev.systemLogs, searchLog),
        }));
        showToast(
          `Found ${foundOpps.length} live web opportunities`
        );
      } catch (err: any) {
        setApiError(err.message || 'Unable to search web events.');
      } finally {
        setIsSearchingEvents(false);
      }
    },
    [isOnline, todayDate, state.preferences.college, appendLog, showToast]
  );

  const handleAddOpportunityToRoutine = useCallback(
    (opp: WebOpportunity) => {
      const targetDate = opp.suggestedDateISO || selectedDate;
      const logEntry = createSystemLogEntry(
        'calendar_sync',
        `Added Event Prep: ${opp.title}`,
        `${opp.organizer} · Scheduled ${targetDate} 19:00–20:00`,
        0,
        0,
        targetDate
      );
      setState((prev) => ({
        ...prev,
        opportunities: prev.opportunities.map((o) =>
          o.id === opp.id ? { ...o, addedToCalendar: true } : o
        ),
        calendarEvents: [
          ...prev.calendarEvents,
          {
            id: `evt-opp-${Date.now().toString(36)}`,
            title: `Prep: ${opp.title}`,
            date: targetDate,
            startTime: '19:00',
            endTime: '20:00',
            category:
              opp.type === 'public_speaking' ? 'Public Speaking' : 'Hackathon',
            completed: false,
            priority: 'high',
            notes: `${opp.organizer} · ${opp.prepTip}${
              opp.url ? ` (${opp.url})` : ''
            }`,
            source: 'assistant',
            alarmMinutesBefore: 15,
          },
        ],
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));
      showToast(`Added "${opp.title}" prep block to calendar`);
    },
    [selectedDate, appendLog, showToast]
  );

  // Refresh AI Briefing (Online Gemini -> Offline fallback)
  const handleRefreshBriefing = useCallback(async () => {
    setIsRefreshingBriefing(true);
    setApiError(null);

    if (!isOnline) {
      setBriefing(runOfflineBriefing(state, todayDate));
      setIsRefreshingBriefing(false);
      showToast('Offline briefing generated locally');
      return;
    }

    try {
      const currentTime = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const res = await fetch('/api/assistant/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, todayDate, currentTime }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to refresh briefing.');
      }

      setBriefing({
        headline: data.headline,
        summary: data.summary,
        focusWindowNote: data.focusWindowNote,
        generatedAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      });

      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        const mapped: AISuggestion[] = data.suggestions.map(
          (s: any, idx: number) => ({
            id: `sug-${Date.now()}-${idx}`,
            title: s.title,
            rationale: s.rationale,
            category: s.category || 'optimization',
            impactXp: Number(s.impactXp) || 30,
            actionLabel: s.actionLabel || 'Apply',
            actionType: s.actionType || 'schedule_block',
            payload: s.payload || {},
          })
        );
        setState((prev) => ({ ...prev, suggestions: mapped }));
      }
      showToast('System briefing updated');
    } catch {
      setBriefing(runOfflineBriefing(state, todayDate));
      showToast('Cloud Gemini unavailable · Generated local AI briefing');
    } finally {
      setIsRefreshingBriefing(false);
    }
  }, [isOnline, state, todayDate, showToast]);

  const handleApplySuggestion = useCallback(
    (sug: AISuggestion) => {
      setUndoStack((prev) => [...prev.slice(-4), state]);

      setState((prev) => {
        const next = { ...prev };
        const p = sug.payload || {};

        if (sug.actionType === 'schedule_block') {
          const newEvent: CalendarEvent = {
            id: `evt-${Date.now().toString(36)}`,
            title: p.title || sug.title,
            date: p.date || selectedDate,
            startTime: p.startTime || '15:45',
            endTime:
              p.endTime ||
              addMinutesToTime(p.startTime || '15:45', p.durationMinutes || 30),
            category: (p.eventCategory as EventCategory) || 'Recovery',
            linkedHabitId: p.linkedHabitId,
            completed: false,
            priority: 'medium',
            source: 'assistant',
            alarmMinutesBefore: 10,
          };
          next.calendarEvents = [...prev.calendarEvents, newEvent];
        } else if (sug.actionType === 'add_habit') {
          const diff = (p.difficulty as HabitDifficulty) || 'Focused';
          const newHabitId = `hab-${Date.now().toString(36)}`;
          const newHabit: Habit = {
            id: newHabitId,
            title: p.title || sug.title,
            category: (p.habitCategory as HabitCategory) || 'Public Speaking',
            frequency: 'daily',
            preferredTime: p.startTime || '19:45',
            durationMinutes: p.durationMinutes || 15,
            difficulty: diff,
            xpReward: getXpForDifficulty(diff),
            streak: 0,
            bestStreak: 0,
            completedDates: [],
            notes: sug.rationale,
            createdAt: todayDate,
          };
          next.habits = [...prev.habits, newHabit];
          next.calendarEvents = [
            ...prev.calendarEvents,
            {
              id: `evt-${Date.now().toString(36)}-h`,
              title: newHabit.title,
              date: selectedDate,
              startTime: newHabit.preferredTime,
              endTime: addMinutesToTime(
                newHabit.preferredTime,
                newHabit.durationMinutes
              ),
              category: 'Habit Ritual',
              linkedHabitId: newHabitId,
              completed: false,
              priority: 'medium',
              source: 'assistant',
              alarmMinutesBefore: 10,
            },
          ];
        } else if (sug.actionType === 'create_quest') {
          const newQuest: Quest = {
            id: `qst-${Date.now().toString(36)}`,
            title: p.title || sug.title,
            description: p.description || sug.rationale,
            type: 'daily',
            targetCount: p.targetCount || 3,
            currentCount: 0,
            xpBonus: p.xpBonus || sug.impactXp || 100,
            coinBonus: 30,
            completed: false,
            claimed: false,
          };
          next.quests = [...prev.quests, newQuest];
        }

        next.suggestions = prev.suggestions.map((item) =>
          item.id === sug.id ? { ...item, applied: true } : item
        );
        next.systemLogs = appendLog(
          prev.systemLogs,
          createSystemLogEntry(
            'system_info',
            `Applied AI Suggestion: ${sug.title}`,
            sug.rationale
          )
        );
        return next;
      });

      showToast(`Applied: ${sug.title}`);
    },
    [state, selectedDate, todayDate, appendLog, showToast]
  );

  const handleDismissSuggestion = useCallback((suggestionId: string) => {
    setState((prev) => ({
      ...prev,
      suggestions: prev.suggestions.map((s) =>
        s.id === suggestionId ? { ...s, dismissed: true } : s
      ),
    }));
  }, []);

  // Auto-Plan Day (Online Gemini -> Offline deterministic scheduler)
  const handleAutoPlanDay = useCallback(
    async (dateISO: string) => {
      setIsAutoPlanning(true);
      setApiError(null);

      if (!isOnline) {
        const offlinePlan = runOfflineAutoPlan(state, dateISO);
        if (offlinePlan.newBlocks.length > 0) {
          const planLog = createSystemLogEntry(
            'calendar_sync',
            `Offline Auto-Planned ${offlinePlan.newBlocks.length} Block(s)`,
            `Scheduled open slots on ${dateISO}`,
            0,
            0,
            dateISO
          );
          setUndoStack((prev) => [...prev.slice(-4), state]);
          setState((prev) => ({
            ...prev,
            calendarEvents: [...prev.calendarEvents, ...offlinePlan.newBlocks],
            systemLogs: appendLog(prev.systemLogs, planLog),
          }));
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            text: offlinePlan.rationale,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            actions: offlinePlan.newBlocks.map((b) => ({
              id: b.id,
              toolName: 'offline_scheduler',
              summary: `Scheduled "${b.title}" (${b.startTime}–${b.endTime})`,
              timestamp: '',
            })),
          },
        ]);
        showToast(
          offlinePlan.newBlocks.length > 0
            ? `Offline scheduled ${offlinePlan.newBlocks.length} block(s)`
            : 'All habits already scheduled'
        );
        setIsAutoPlanning(false);
        return;
      }

      try {
        const currentTime = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const res = await fetch('/api/assistant/auto-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state, targetDate: dateISO, currentTime }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Auto-plan failed.');
        }

        const newBlocks: CalendarEvent[] = Array.isArray(data.newBlocks)
          ? data.newBlocks.map((b: any, i: number) => ({
              id: `evt-${Date.now().toString(36)}-${i}`,
              title: b.title,
              date: dateISO,
              startTime: b.startTime,
              endTime: b.endTime,
              category: (b.category as EventCategory) || 'Habit Ritual',
              linkedHabitId: b.linkedHabitId,
              completed: false,
              priority: b.priority === 'high' ? 'high' : 'medium',
              notes: b.notes,
              source: 'assistant',
              alarmMinutesBefore: 10,
            }))
          : [];

        if (newBlocks.length > 0) {
          const planLog = createSystemLogEntry(
            'calendar_sync',
            `Auto-Planned ${newBlocks.length} Block(s)`,
            `Scheduled ${newBlocks.map((b) => b.title).join(', ')} on ${dateISO}`,
            0,
            0,
            dateISO
          );
          setUndoStack((prev) => [...prev.slice(-4), state]);
          setState((prev) => ({
            ...prev,
            calendarEvents: [...prev.calendarEvents, ...newBlocks],
            systemLogs: appendLog(prev.systemLogs, planLog),
          }));
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            text:
              data.rationale ||
              `Planned ${newBlocks.length} block(s) into open slots for ${dateISO}.`,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            actions: newBlocks.map((b) => ({
              id: b.id,
              toolName: 'auto_plan',
              summary: `Scheduled "${b.title}" (${b.startTime}–${b.endTime})`,
              timestamp: '',
            })),
          },
        ]);

        showToast(
          newBlocks.length > 0
            ? `Scheduled ${newBlocks.length} block(s)`
            : 'All protocols already scheduled'
        );
      } catch {
        const offlinePlan = runOfflineAutoPlan(state, dateISO);
        if (offlinePlan.newBlocks.length > 0) {
          const planLog = createSystemLogEntry(
            'calendar_sync',
            `Offline Auto-Planned ${offlinePlan.newBlocks.length} Block(s)`,
            `Scheduled open slots on ${dateISO}`,
            0,
            0,
            dateISO
          );
          setUndoStack((prev) => [...prev.slice(-4), state]);
          setState((prev) => ({
            ...prev,
            calendarEvents: [...prev.calendarEvents, ...offlinePlan.newBlocks],
            systemLogs: appendLog(prev.systemLogs, planLog),
          }));
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            role: 'assistant',
            text: offlinePlan.rationale,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            actions: offlinePlan.newBlocks.map((b) => ({
              id: b.id,
              toolName: 'offline_scheduler',
              summary: `Scheduled "${b.title}" (${b.startTime}–${b.endTime})`,
              timestamp: '',
            })),
            modelUsed: 'Offline AI Scheduler (Auto-Fallback)',
          },
        ]);
        showToast(
          offlinePlan.newBlocks.length > 0
            ? `Offline scheduled ${offlinePlan.newBlocks.length} block(s)`
            : 'All protocols already scheduled'
        );
      } finally {
        setIsAutoPlanning(false);
      }
    },
    [isOnline, state, appendLog, showToast]
  );

  // Send Instruction to Mentor/Manager/Teacher AI (Online Gemini -> Ollama -> Offline Engine)
  const handleSendMessage = useCallback(
    async (text: string) => {
      const userMsg: AssistantMessage = {
        id: `msg-u-${Date.now()}`,
        role: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);
      setApiError(null);

      // Try local Ollama if configured OR if offline
      if (!isOnline || ollamaConfig.enabled) {
        const ollamaReply = await tryOllamaChat(
          ollamaConfig,
          text,
          state,
          selectedDate,
          assistantRole
        );
        if (ollamaReply) {
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-ol-${Date.now()}`,
              role: 'assistant',
              text: ollamaReply,
              timestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
              modelUsed: `Ollama (${ollamaConfig.model})`,
              roleBadge: assistantRole,
            },
          ]);
          setIsThinking(false);
          return;
        }

        if (!isOnline) {
          const offlineResult = runOfflineAssistantChat(
            text,
            state,
            selectedDate,
            assistantRole
          );
          if (offlineResult.actions.length > 0) {
            const aiLog = createSystemLogEntry(
              'system_info',
              `Offline AI Executed ${offlineResult.actions.length} Action(s)`,
              offlineResult.actions.map((a) => a.summary).join(' · ')
            );
            setUndoStack((prev) => [...prev.slice(-4), state]);
            setState({
              ...offlineResult.mutatedState,
              systemLogs: appendLog(offlineResult.mutatedState.systemLogs, aiLog),
            });
          }
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-off-${Date.now()}`,
              role: 'assistant',
              text: offlineResult.reply,
              timestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
              actions: offlineResult.actions,
              sources: offlineResult.sources || [],
              modelUsed: 'Offline AI Mentor',
              roleBadge: assistantRole,
            },
          ]);
          setIsThinking(false);
          return;
        }
      }

      try {
        const currentTime = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        const historyPayload = messages.slice(-8).map((m) => ({
          role: m.role,
          text: m.text,
        }));

        // Optional geolocation hint for Maps grounding queries if already allowed or explicitly requested
        let coords: { latitude: number; longitude: number } | undefined;
        const wantsLocation =
          assistantRole === 'scout' ||
          /\b(maps?|near me|nearby|cafes?|library|libraries|directions?|rajkot|campus|study spot)\b/i.test(
            text
          );
        if (wantsLocation && typeof navigator !== 'undefined' && navigator.geolocation) {
          coords = await new Promise<{ latitude: number; longitude: number } | undefined>(
            (resolve) => {
              let settled = false;
              const finish = (val?: { latitude: number; longitude: number }) => {
                if (!settled) {
                  settled = true;
                  resolve(val);
                }
              };
              const timer = window.setTimeout(() => finish(undefined), 2200);
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  window.clearTimeout(timer);
                  finish({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                  });
                },
                () => {
                  window.clearTimeout(timer);
                  finish(undefined);
                },
                { timeout: 2000, maximumAge: 180000 }
              );
            }
          );
        }

        const res = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: historyPayload,
            state,
            todayDate: selectedDate,
            currentTime,
            roleMode: assistantRole,
            complexity: assistantComplexity,
            coords,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Assistant request failed.');
        }

        if (
          data.mutatedState &&
          Array.isArray(data.actions) &&
          data.actions.length > 0
        ) {
          const aiLog = createSystemLogEntry(
            'system_info',
            `AI Mentor Executed ${data.actions.length} Action(s)`,
            data.actions.map((a: { summary: string }) => a.summary).join(' · ')
          );
          setUndoStack((prev) => [...prev.slice(-4), state]);
          setState({
            ...data.mutatedState,
            systemLogs: appendLog(
              data.mutatedState.systemLogs || state.systemLogs,
              aiLog
            ),
          });
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-a-${Date.now()}`,
            role: 'assistant',
            text: data.reply,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            actions: data.actions || [],
            sources: data.sources || [],
            modelUsed: data.modelUsed || 'gemini-4-hydrogen',
            roleBadge: assistantRole,
          },
        ]);
      } catch {
        const offlineFallback = runOfflineAssistantChat(
          text,
          state,
          selectedDate,
          assistantRole
        );
        if (offlineFallback.actions.length > 0) {
          const aiLog = createSystemLogEntry(
            'system_info',
            `Fallback AI Executed ${offlineFallback.actions.length} Action(s)`,
            offlineFallback.actions.map((a) => a.summary).join(' · ')
          );
          setUndoStack((prev) => [...prev.slice(-4), state]);
          setState({
            ...offlineFallback.mutatedState,
            systemLogs: appendLog(offlineFallback.mutatedState.systemLogs, aiLog),
          });
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-err-${Date.now()}`,
            role: 'assistant',
            text: offlineFallback.reply,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            actions: offlineFallback.actions,
            sources: offlineFallback.sources || [],
            modelUsed: 'Offline AI Mentor (Auto-Fallback)',
            roleBadge: assistantRole,
          },
        ]);
        showToast('Cloud Gemini unavailable · Replied via Offline AI Mentor');
      } finally {
        setIsThinking(false);
      }
    },
    [
      isOnline,
      ollamaConfig,
      messages,
      state,
      selectedDate,
      assistantRole,
      assistantComplexity,
      appendLog,
      showToast,
    ]
  );

  const handleUndoLastAgentBatch = useCallback(() => {
    if (undoStack.length === 0) return;
    const previousState = undoStack[undoStack.length - 1];
    const logEntry = createSystemLogEntry(
      'system_info',
      'Reverted AI Action Batch',
      'Restored prior schedule and protocol snapshot'
    );
    setUndoStack((prev) => prev.slice(0, -1));
    setState({
      ...previousState,
      systemLogs: appendLog(previousState.systemLogs, logEntry),
    });
    showToast('Reverted last assistant action');
  }, [undoStack, appendLog, showToast]);

  const handleUpdatePreferences = useCallback(
    (prefs: UserPreferences) => {
      const logEntry = createSystemLogEntry(
        'system_info',
        'Routine & SFX Config Saved',
        `Wake ${prefs.wakeTime} · Sleep ${prefs.sleepTime} · Goal ${prefs.dailyXpTarget} XP · SFX ${prefs.notificationSfx || 'system_arise'}`
      );
      setState((prev) => ({
        ...prev,
        preferences: prefs,
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));
      showToast('Student profile & routine saved');
    },
    [appendLog, showToast]
  );

  const handleResetDemo = useCallback(() => {
    const fresh = createInitialState(todayDate);
    setState(fresh);
    setUndoStack([]);
    setSelectedDate(todayDate);
    setBriefing(null);
    showToast('Workspace reset to V.V.P. IT baseline');
  }, [todayDate, showToast]);

  const handleSaveJournalEntry = useCallback(
    (entry: Omit<JournalEntry, 'id' | 'createdAt'>) => {
      const created: JournalEntry = {
        ...entry,
        id: `jrn-${Date.now().toString(36)}`,
        createdAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }),
      };
      const logEntry = createSystemLogEntry(
        'journal_logged',
        `Shadow Journal: ${entry.title}`,
        `Mood: ${entry.mood} · Clarity ${entry.focusScore}/10`,
        20,
        5,
        entry.date
      );
      setState((prev) => ({
        ...prev,
        journalEntries: [created, ...(prev.journalEntries || [])],
        bonusXp: prev.bonusXp + 20,
        focusCoins: prev.focusCoins + 5,
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));
      playAnimeNotificationSfx(notificationSfx, 0.65);
      showToast('Shadow Journal logged (+20 XP, +5 Coins)');
    },
    [notificationSfx, appendLog, showToast]
  );

  const handleClearSystemLogs = useCallback(() => {
    setState((prev) => ({
      ...prev,
      systemLogs: [
        createSystemLogEntry(
          'system_info',
          'Audit Log Cleared',
          'Previous history cleared by user.'
        ),
      ],
    }));
    showToast('System log cleared');
  }, [showToast]);

  const handleDeleteJournalEntry = useCallback(
    (id: string) => {
      const target = (state.journalEntries || []).find((j) => j.id === id);
      const logEntry = createSystemLogEntry(
        'system_info',
        `Deleted Journal: ${target?.title || id}`,
        'Removed entry from Shadow Journal'
      );
      setState((prev) => ({
        ...prev,
        journalEntries: (prev.journalEntries || []).filter((j) => j.id !== id),
        systemLogs: appendLog(prev.systemLogs, logEntry),
      }));
      showToast('Journal entry deleted');
    },
    [state.journalEntries, appendLog, showToast]
  );

  const handleSendJournalToMentor = useCallback(
    (entry: JournalEntry) => {
      const prompt = `Please review my Shadow Journal entry as my CBT therapist and academic mentor:
Title: "${entry.title}" (${entry.date}, Mood: ${entry.mood}, Clarity: ${entry.focusScore}/10)
Notes: ${entry.content}${
        entry.cbtReframe ? `\nMy CBT Reframe: ${entry.cbtReframe}` : ''
      }
Give me a brief psychological reflection and 1 concrete routine adjustment if helpful.`;
      if (typeof window !== 'undefined' && window.innerWidth < 1280) {
        setMobileAssistantOpen(true);
      }
      void handleSendMessage(prompt);
    },
    [handleSendMessage]
  );

  const navItems: Array<{
    id: NavTab;
    label: string;
    mobileLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'overview',
      label: 'System Hub',
      mobileLabel: 'Hub',
      icon: LayoutDashboard,
    },
    {
      id: 'calendar',
      label: 'Calendar',
      mobileLabel: 'Calendar',
      icon: Calendar,
    },
    {
      id: 'journal',
      label: 'Shadow Journal',
      mobileLabel: 'Journal',
      icon: BookOpen,
    },
    {
      id: 'opportunities',
      label: 'Events & Academics',
      mobileLabel: 'Events',
      icon: Compass,
    },
    {
      id: 'clock',
      label: 'Clock & Alarms',
      mobileLabel: 'Clock',
      icon: AlarmClock,
    },
    {
      id: 'quests',
      label: 'Quests & Insights',
      mobileLabel: 'Insights',
      icon: Trophy,
    },
  ];

  const mobileDockItems = navItems.filter((n) => n.id !== 'opportunities');

  const [nowTick, setNowTick] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const upcomingDeadlines = useMemo(
    () => scanUpcomingExamAssignmentDeadlines(state.calendarEvents, todayDate, nowTick),
    [state.calendarEvents, todayDate, nowTick]
  );

  const todaysEvents = useMemo(
    () => state.calendarEvents.filter((e) => e.date === todayDate),
    [state.calendarEvents, todayDate]
  );

  return (
    <div className="min-h-screen sl-grid-canvas bg-[#F4F6FA] dark:bg-[#050811] text-slate-900 dark:text-slate-100 flex flex-col lg:flex-row overflow-x-hidden relative">
      {/* Non-blocking Solo Leveling Viewport Frame Overlay */}
      <div
        aria-hidden="true"
        className="sl-viewport-overlay pointer-events-none fixed inset-0 z-20"
      />
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 xl:w-64 shrink-0 sl-chrome-side bg-white/95 dark:bg-[#070B16]/95 backdrop-blur-md border-r border-slate-200 dark:border-sky-500/25 sticky top-0 h-screen justify-between p-4 z-30">
        <div className="space-y-6">
          <div className="px-2 pt-1 flex items-center justify-between">
            <div>
              <span className="font-display text-xl font-bold tracking-wider uppercase text-slate-900 dark:text-sky-400 whitespace-nowrap block leading-none">
                Meridian
              </span>
              <span className="text-[10px] font-mono tracking-[0.18em] text-slate-400 dark:text-sky-500/70 uppercase">
                System OS
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label="Toggle light or dark mode"
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded border border-slate-200 dark:border-sky-500/25 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {state.theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>

          <nav className="space-y-1" aria-label="Primary navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[42px] rounded text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-slate-900 dark:bg-sky-600 text-white border border-slate-900 dark:border-sky-400/50'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-sky-950/40'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="font-display tracking-wide font-semibold text-[15px]">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setSanctumOpen(true)}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 min-h-[42px] rounded border border-sky-500/40 bg-sky-50 dark:bg-sky-950/45 text-sky-900 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-900/50 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2.5 font-display tracking-wide font-semibold text-[14px]">
              <Box className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              3D System Sanctum
            </span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-sky-600 dark:text-sky-400">
              WebGL
            </span>
          </button>
        </div>

        {/* Bottom Hunter Student Profile */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
          <div className="flex items-center gap-3 px-1">
            {!avatarError ? (
              <img
                src="/src/assets/images/avatar_user_profile_1795583235691.jpg"
                alt={state.preferences.name}
                referrerPolicy="no-referrer"
                onError={() => setAvatarError(true)}
                className="w-9 h-9 rounded-lg object-cover border border-slate-200 dark:border-sky-500/40 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                HL
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {state.preferences.name}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-sky-400 truncate tabular-nums">
                Lv.{rankInfo.level} · V.V.P. IT
              </div>
            </div>
          </div>

          <div className="px-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1 tabular-nums">
              <span>{rankInfo.progressPercent}% XP</span>
              <span>{totalXp.toLocaleString()}</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 rounded-sm overflow-hidden">
              <div
                className="h-full bg-blue-600 dark:bg-sky-400 transition-all duration-300"
                style={{ width: `${Math.max(5, rankInfo.progressPercent)}%` }}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content + Right Assistant Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Workspace Header with iOS Safe-Area Top Support */}
        <header
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
          className="sticky top-0 z-30 sl-chrome-top bg-white/95 dark:bg-[#070B16]/95 backdrop-blur-md border-b border-slate-200 dark:border-sky-500/25 px-4 sm:px-6 pb-3 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="lg:hidden font-display text-lg font-bold tracking-wider uppercase text-slate-900 dark:text-sky-400 whitespace-nowrap">
              Meridian
            </span>
            <span
              className="lg:hidden text-slate-300 dark:text-slate-700"
              aria-hidden="true"
            >
              /
            </span>
            <h1 className="font-display text-base sm:text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100 truncate">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h1>
            <span
              className="hidden sm:inline text-slate-300 dark:text-slate-700"
              aria-hidden="true"
            >
              ·
            </span>
            <span className="hidden sm:inline text-xs font-mono text-slate-500 dark:text-sky-400/80 tabular-nums whitespace-nowrap">
              {selectedDate}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />

            <button
              type="button"
              onClick={() => setSanctumOpen(true)}
              aria-label="Open 3D System Sanctum"
              title="Enter Interactive 3D Shadow Gate Sanctum"
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 min-h-[40px] text-xs font-semibold text-sky-900 dark:text-sky-200 bg-sky-50 dark:bg-sky-950/50 border border-sky-300 dark:border-sky-500/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 rounded whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Box className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span className="hidden sm:inline">3D Sanctum</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('opportunities')}
              aria-label="Open Events and Academics"
              title="Hackathons, Public Speaking, Google Maps & Academics"
              className={`lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded border cursor-pointer ${
                activeTab === 'opportunities'
                  ? 'border-blue-600 dark:border-sky-400 bg-blue-50 dark:bg-sky-950/60 text-blue-700 dark:text-sky-300'
                  : 'border-slate-200 dark:border-sky-500/25 text-slate-600 dark:text-slate-200'
              }`}
            >
              <Compass className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label="Toggle dark or light theme"
              className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded border border-slate-200 dark:border-sky-500/25 text-slate-600 dark:text-slate-200 cursor-pointer"
            >
              {state.theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              disabled={isAutoPlanning}
              onClick={() => handleAutoPlanDay(selectedDate)}
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-sky-500/25 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
              {isAutoPlanning ? 'Planning...' : 'Auto-Plan Day'}
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingEvent(null);
                setModalDefaultTime('09:00');
                setEventModalOpen(true);
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-bold uppercase tracking-wider font-display text-white bg-blue-700 dark:bg-sky-600 hover:bg-blue-800 dark:hover:bg-sky-500 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Block
            </button>

            <button
              type="button"
              onClick={() => setMobileAssistantOpen(true)}
              aria-label="Open Meridian AI Mentor"
              className="xl:hidden inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-semibold text-slate-900 dark:text-sky-300 border border-slate-200 dark:border-sky-500/35 hover:bg-slate-100 dark:hover:bg-slate-800 rounded whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Bot className="w-4 h-4 text-blue-600 dark:text-sky-400" />
              <span>AI Mentor</span>
            </button>
          </div>
        </header>

        {apiError && (
          <div className="mx-4 sm:mx-6 mt-4 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 flex items-center justify-between gap-3 text-xs text-red-800 dark:text-red-200">
            <span>{apiError}</span>
            <button
              type="button"
              onClick={() => setApiError(null)}
              aria-label="Dismiss error"
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 pb-24 lg:pb-6 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            {activeTab === 'overview' && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <RankMasteryBar
                    rankInfo={rankInfo}
                    totalXp={totalXp}
                    streakShields={state.streakShields}
                    comboMultiplier={comboMultiplier}
                    focusCoins={state.focusCoins}
                    doubleXpActive={doubleXpActive}
                  />
                  <DailyMomentumMeter
                    dailyXp={dailyXp}
                    dailyTarget={state.preferences.dailyXpTarget}
                    completedCount={completedTodayCount}
                    totalCount={state.habits.length}
                    comboMultiplier={comboMultiplier}
                  />
                </div>

                {/* Interactive Three.js 3D Shadow Gate Sanctum Banner */}
                <section className="sl-panel sl-reticle p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-blue-700 dark:text-sky-400 font-semibold block">
                      [ INTERACTIVE 3D SANCTUM · THREE.JS ]
                    </span>
                    <h2 className="font-display text-base sm:text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100 mt-0.5">
                      Shadow Gate Monolith & Habit Rune Pedestals
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Inspect your {state.habits.length} daily protocols as interactive 3D mana crystals, toggle gates directly in WebGL, and shift sanctum lighting presets.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSanctumOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 text-white text-xs font-bold uppercase tracking-wider font-display shrink-0 cursor-pointer"
                  >
                    <Box className="w-4 h-4" />
                    Enter 3D Sanctum
                  </button>
                </section>

                <DeadlineCountdownSection
                  deadlines={upcomingDeadlines}
                  onOpenInCalendar={(dateISO) => {
                    setSelectedDate(dateISO);
                    setActiveTab('calendar');
                  }}
                  onMarkComplete={handleToggleEventComplete}
                  onAddDeadline={() => {
                    setEditingEvent(null);
                    setModalDefaultTime('17:00');
                    setEventModalOpen(true);
                  }}
                />

                <HabitTrackerSection
                  habits={state.habits}
                  calendarEvents={state.calendarEvents}
                  selectedDate={selectedDate}
                  onToggleHabit={handleToggleHabit}
                  onFailHabit={handleFailHabit}
                  onAddHabit={() => {
                    setEditingHabit(null);
                    setHabitModalOpen(true);
                  }}
                  onEditHabit={(habit) => {
                    setEditingHabit(habit);
                    setHabitModalOpen(true);
                  }}
                  onScheduleHabit={handleScheduleHabit}
                />

                <CalendarWorkspace
                  events={state.calendarEvents}
                  alarms={state.alarms}
                  selectedDate={selectedDate}
                  todayDate={todayDate}
                  isAutoPlanning={isAutoPlanning}
                  googleConnected={googleConnected}
                  googleUserEmail={googleUserEmail}
                  isGoogleSyncing={isGoogleSyncing}
                  onSelectDate={setSelectedDate}
                  onToggleEventComplete={handleToggleEventComplete}
                  onFailEvent={handleFailEvent}
                  onEditEvent={(ev) => {
                    setEditingEvent(ev);
                    setEventModalOpen(true);
                  }}
                  onCreateEventAt={(dateISO, startTime) => {
                    setSelectedDate(dateISO);
                    setEditingEvent(null);
                    setModalDefaultTime(startTime || '09:00');
                    setEventModalOpen(true);
                  }}
                  onAutoPlanDay={handleAutoPlanDay}
                  onGoogleSignIn={handleGoogleSignIn}
                  onGoogleSignOut={handleGoogleSignOut}
                  onImportGoogleEvents={handleImportGoogleEvents}
                  onRequestPushDayToGoogle={(evs) => setPendingGooglePush(evs)}
                />

                <section className="sl-panel sl-reticle p-5">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-blue-700 dark:text-sky-400 font-semibold block">
                        [ QUEST BOARD ]
                      </span>
                      <h3 className="font-display text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100">
                        Active Gates & Quests
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Clear daily & weekly milestones for bonus XP and Focus Coins
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('quests')}
                      className="text-xs font-semibold text-blue-700 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      Open Analytics & Shop
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {computedQuests.slice(0, 3).map((q) => (
                      <QuestProgressCard
                        key={q.id}
                        quest={q}
                        onClaim={handleClaimQuest}
                      />
                    ))}
                  </div>
                </section>
              </>
            )}

            {activeTab === 'calendar' && (
              <CalendarWorkspace
                events={state.calendarEvents}
                alarms={state.alarms}
                selectedDate={selectedDate}
                todayDate={todayDate}
                isAutoPlanning={isAutoPlanning}
                googleConnected={googleConnected}
                googleUserEmail={googleUserEmail}
                isGoogleSyncing={isGoogleSyncing}
                onSelectDate={setSelectedDate}
                onToggleEventComplete={handleToggleEventComplete}
                onFailEvent={handleFailEvent}
                onEditEvent={(ev) => {
                  setEditingEvent(ev);
                  setEventModalOpen(true);
                }}
                onCreateEventAt={(dateISO, startTime) => {
                  setSelectedDate(dateISO);
                  setEditingEvent(null);
                  setModalDefaultTime(startTime || '09:00');
                  setEventModalOpen(true);
                }}
                onAutoPlanDay={handleAutoPlanDay}
                onGoogleSignIn={handleGoogleSignIn}
                onGoogleSignOut={handleGoogleSignOut}
                onImportGoogleEvents={handleImportGoogleEvents}
                onRequestPushDayToGoogle={(evs) => setPendingGooglePush(evs)}
              />
            )}

            {activeTab === 'journal' && (
              <JournalWorkspace
                entries={state.journalEntries || []}
                todayDate={todayDate}
                onSaveEntry={handleSaveJournalEntry}
                onDeleteEntry={handleDeleteJournalEntry}
                onSendToMentor={handleSendJournalToMentor}
              />
            )}

            {activeTab === 'opportunities' && (
              <OpportunitiesHub
                opportunities={state.opportunities}
                sources={state.opportunitySources}
                courses={state.courses}
                college={state.preferences.college}
                isOnline={isOnline}
                isSearching={isSearchingEvents}
                onSearchEvents={handleDiscoverEvents}
                onAddOpportunityToRoutine={handleAddOpportunityToRoutine}
                onAdvanceCourseProgress={handleAdvanceCourseProgress}
              />
            )}

            {activeTab === 'clock' && (
              <ClockAlarmCenter
                alarms={state.alarms}
                todaysEvents={todaysEvents}
                notificationSfx={notificationSfx}
                onChangeNotificationSfx={handleChangeNotificationSfx}
                onAddAlarm={handleAddAlarm}
                onToggleAlarm={handleToggleAlarm}
                onDeleteAlarm={handleDeleteAlarm}
                onCompleteFocusSession={handleCompleteFocusSession}
                onAlarmTriggered={handleAlarmTriggered}
              />
            )}

            {activeTab === 'quests' && (
              <InsightsAndQuestsView
                state={state}
                quests={computedQuests}
                todayDate={todayDate}
                ollamaConfig={ollamaConfig}
                onClaimQuest={handleClaimQuest}
                onBuyStreakShield={handleBuyStreakShield}
                onActivateDoubleXp={handleActivateDoubleXp}
                onUpdatePreferences={handleUpdatePreferences}
                onUpdateOllamaConfig={setOllamaConfig}
                onClearSystemLogs={handleClearSystemLogs}
                onRunOverduePenaltyAudit={() => runOverduePenaltyAudit(true)}
                onResetDemo={handleResetDemo}
              />
            )}
          </div>

          {/* Persistent Desktop Assistant Rail */}
          <div className="hidden xl:block sticky top-[76px]">
            <ExecutiveAssistantPanel
              briefing={briefing}
              suggestions={state.suggestions}
              messages={messages}
              roleMode={assistantRole}
              complexity={assistantComplexity}
              isThinking={isThinking}
              isRefreshingBriefing={isRefreshingBriefing}
              canUndo={undoStack.length > 0}
              isOnline={isOnline}
              ollamaEnabled={ollamaConfig.enabled}
              onChangeRoleMode={setAssistantRole}
              onChangeComplexity={setAssistantComplexity}
              onSendMessage={handleSendMessage}
              onRefreshBriefing={handleRefreshBriefing}
              onApplySuggestion={handleApplySuggestion}
              onDismissSuggestion={handleDismissSuggestion}
              onUndoLastAgentBatch={handleUndoLastAgentBatch}
            />
          </div>
        </main>
      </div>

      {/* Mobile / Tablet Assistant Drawer */}
      {mobileAssistantOpen && (
        <div className="fixed inset-0 z-50 xl:hidden bg-slate-950/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-slate-50 dark:bg-[#070B14] h-full p-3 flex flex-col">
            <div className="flex items-center justify-end pb-2">
              <button
                type="button"
                onClick={() => setMobileAssistantOpen(false)}
                className="min-h-[40px] px-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
                Close
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ExecutiveAssistantPanel
                briefing={briefing}
                suggestions={state.suggestions}
                messages={messages}
                roleMode={assistantRole}
                complexity={assistantComplexity}
                isThinking={isThinking}
                isRefreshingBriefing={isRefreshingBriefing}
                canUndo={undoStack.length > 0}
                isOnline={isOnline}
                ollamaEnabled={ollamaConfig.enabled}
                onChangeRoleMode={setAssistantRole}
                onChangeComplexity={setAssistantComplexity}
                onSendMessage={handleSendMessage}
                onRefreshBriefing={handleRefreshBriefing}
                onApplySuggestion={handleApplySuggestion}
                onDismissSuggestion={handleDismissSuggestion}
                onUndoLastAgentBatch={handleUndoLastAgentBatch}
              />
            </div>
          </div>
        </div>
      )}

      {/* iPhone Thumb-Zone Bottom Tab Bar (5 evenly distributed destinations, <= 64px + safe-area) */}
      <nav
        aria-label="Mobile navigation"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 sl-chrome-bottom bg-white/95 dark:bg-[#070B16]/95 backdrop-blur-md border-t border-slate-200 dark:border-sky-500/25 grid grid-cols-5 items-center min-h-[60px]"
      >
        {mobileDockItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-2 text-[10px] font-medium transition-colors cursor-pointer ${
                active
                  ? 'text-blue-600 dark:text-sky-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="mt-1 truncate max-w-[64px]">
                {item.mobileLabel}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Mandatory Google Calendar Write Confirmation Dialog */}
      {pendingGooglePush && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Google Calendar sync"
        >
          <div className="sl-panel sl-reticle max-w-md w-full p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Sync {pendingGooglePush.length} Event(s) to Google Calendar?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This will create the following scheduled blocks on your primary Google Calendar ({googleUserEmail || 'connected account'}) with popup reminders:
            </p>
            <ul className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
              {pendingGooglePush.map((ev) => (
                <li
                  key={ev.id}
                  className="px-3 py-2 text-xs flex items-center justify-between gap-2"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {ev.title}
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
                    {ev.startTime}–{ev.endTime}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingGooglePush(null)}
                className="px-4 py-2 min-h-[40px] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isGoogleSyncing}
                onClick={handleConfirmPushToGoogle}
                className="px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {isGoogleSyncing ? 'Syncing...' : 'Confirm Sync'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {eventModalOpen && (
        <EventModal
          initialEvent={editingEvent}
          defaultDate={selectedDate}
          defaultStartTime={modalDefaultTime}
          habits={state.habits}
          onClose={() => {
            setEventModalOpen(false);
            setEditingEvent(null);
          }}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
      )}

      {habitModalOpen && (
        <HabitModal
          initialHabit={editingHabit}
          onClose={() => {
            setHabitModalOpen(false);
            setEditingHabit(null);
          }}
          onSave={handleSaveHabit}
          onDelete={handleDeleteHabit}
        />
      )}

      <OfflineIndicator />

      {sanctumOpen && (
        <SystemSanctum3D
          habits={state.habits}
          todayDate={todayDate}
          level={rankInfo.level}
          rankTitle={rankInfo.rankTitle}
          totalXp={totalXp}
          onToggleHabit={handleToggleHabit}
          onClose={() => setSanctumOpen(false)}
        />
      )}

      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-[#081022] border border-slate-700 dark:border-sky-400/50 text-white dark:text-sky-100 px-4 py-2.5 rounded shadow-lg dark:shadow-[0_0_24px_-4px_rgba(56,189,248,0.45)] text-xs font-semibold whitespace-nowrap"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
