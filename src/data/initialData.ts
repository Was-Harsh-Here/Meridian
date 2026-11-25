import {
  AppState,
  CalendarEvent,
  DailyAnalyticsPoint,
  Habit,
  HabitDifficulty,
  SystemLogEntry,
  SystemLogType,
} from '../types';

export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysISO(baseISO: string, offsetDays: number): string {
  const [y, m, d] = baseISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + offsetDays);
  return formatDateISO(dt);
}

export interface UpcomingDeadlineItem {
  event: CalendarEvent;
  matchedType: 'exam' | 'assignment';
  daysRemaining: number;
  countdownLabel: string;
  urgency: 'critical' | 'high' | 'upcoming';
}

export function scanUpcomingExamAssignmentDeadlines(
  events: CalendarEvent[],
  todayISO: string,
  now: Date = new Date()
): UpcomingDeadlineItem[] {
  const [ty, tm, td] = todayISO.split('-').map(Number);
  const todayMidnight = new Date(ty, tm - 1, td).getTime();
  const keywordRegex = /(assignment|exam)/i;
  const examRegex = /exam/i;

  const matches: UpcomingDeadlineItem[] = [];

  for (const ev of events) {
    if (ev.completed) continue;
    const searchable = `${ev.title} ${ev.notes || ''}`;
    if (!keywordRegex.test(searchable)) continue;

    const parts = ev.date.split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) continue;

    const eventMidnight = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
    const daysRemaining = Math.round(
      (eventMidnight - todayMidnight) / (1000 * 60 * 60 * 24)
    );

    if (daysRemaining < 0 || daysRemaining > 3) continue;

    const matchedType: 'exam' | 'assignment' = examRegex.test(searchable)
      ? 'exam'
      : 'assignment';

    let countdownLabel = `${daysRemaining}d left`;
    if (daysRemaining === 0) {
      const [sh, sm] = (ev.startTime || '23:59').split(':').map(Number);
      const targetTime = new Date(parts[0], parts[1] - 1, parts[2], sh || 0, sm || 0);
      const diffMs = targetTime.getTime() - now.getTime();
      if (diffMs > 0) {
        const totalMins = Math.ceil(diffMs / 60000);
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        countdownLabel = hrs > 0 ? `Today · ${hrs}h ${mins}m` : `Today · ${mins}m`;
      } else {
        countdownLabel = 'Due Today';
      }
    } else if (daysRemaining === 1) {
      countdownLabel = '1d left · Tomorrow';
    }

    const urgency: UpcomingDeadlineItem['urgency'] =
      daysRemaining === 0 ? 'critical' : daysRemaining === 1 ? 'high' : 'upcoming';

    matches.push({
      event: ev,
      matchedType,
      daysRemaining,
      countdownLabel,
      urgency,
    });
  }

  return matches.sort((a, b) => {
    if (a.daysRemaining !== b.daysRemaining) {
      return a.daysRemaining - b.daysRemaining;
    }
    return a.event.startTime.localeCompare(b.event.startTime);
  });
}

export function getXpForDifficulty(difficulty: HabitDifficulty): number {
  switch (difficulty) {
    case 'Keystone':
      return 60;
    case 'Focused':
      return 40;
    case 'Standard':
    default:
      return 25;
  }
}

export interface RankInfo {
  level: number;
  rankTitle: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progressPercent: number;
  xpToNext: number;
}

const RANKS = [
  'Freshman Initiate',
  'Syntax Apprentice',
  'Lab Tactician',
  'Orator Strategist',
  'System Architect',
  'Hackathon Vanguard',
  'Campus Sovereign',
  'Grandmaster Scholar',
];

export function computeLevelFromXp(totalXp: number): RankInfo {
  let level = 1;
  let threshold = 0;
  let step = 250;

  while (totalXp >= threshold + step) {
    threshold += step;
    level += 1;
    step = Math.round((step * 1.22) / 10) * 10;
  }

  const currentLevelXp = totalXp - threshold;
  const nextLevelXp = step;
  const progressPercent = Math.min(
    100,
    Math.round((currentLevelXp / nextLevelXp) * 100)
  );
  const rankTitle = RANKS[Math.min(level - 1, RANKS.length - 1)];

  return {
    level,
    rankTitle,
    currentLevelXp,
    nextLevelXp,
    progressPercent,
    xpToNext: Math.max(0, nextLevelXp - currentLevelXp),
  };
}

export function getHabitFailurePenaltyXp(habit: Habit): number {
  return Math.max(15, Math.round(habit.xpReward * 0.6));
}

export function getEventFailurePenaltyXp(ev: CalendarEvent): number {
  return ev.priority === 'high' ? 25 : 15;
}

export function createSystemLogEntry(
  type: SystemLogType,
  title: string,
  details: string,
  xpDelta = 0,
  coinDelta = 0,
  dateOverride?: string
): SystemLogEntry {
  const now = new Date();
  const date = dateOverride || formatDateISO(now);
  const timeLabel = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return {
    id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now.toISOString(),
    date,
    timeLabel,
    type,
    title,
    details,
    xpDelta,
    coinDelta: coinDelta || undefined,
  };
}

export function computeTotalXp(state: AppState): number {
  const habitXp = state.habits.reduce(
    (sum, h) => sum + h.completedDates.length * h.xpReward,
    0
  );
  const completedEventXp = state.calendarEvents.reduce(
    (sum, ev) => sum + (ev.completed && !ev.linkedHabitId ? 20 : 0),
    0
  );
  const rawTotal = habitXp + completedEventXp + state.bonusXp - (state.penaltyXp || 0);
  return Math.max(0, rawTotal);
}

export function computeDailyXp(state: AppState, dateISO: string): number {
  const completedHabitsToday = state.habits.filter((h) =>
    h.completedDates.includes(dateISO)
  );
  const baseHabitXp = completedHabitsToday.reduce(
    (sum, h) => sum + h.xpReward,
    0
  );
  const completedStandaloneEvents = state.calendarEvents.filter(
    (ev) => ev.date === dateISO && ev.completed && !ev.linkedHabitId
  ).length;
  const multiplier = getComboMultiplier(completedHabitsToday.length);
  const booster =
    state.doubleXpActiveUntil && Date.now() < state.doubleXpActiveUntil
      ? 2
      : 1;
  return (
    Math.round(baseHabitXp * multiplier * booster) +
    completedStandaloneEvents * 20
  );
}

export function getComboMultiplier(completedCountToday: number): number {
  if (completedCountToday >= 5) return 2.0;
  if (completedCountToday >= 3) return 1.5;
  if (completedCountToday >= 2) return 1.25;
  return 1.0;
}

export function computeCategoryMastery(habits: Habit[]): Array<{
  category: Habit['category'];
  xp: number;
  level: number;
  progressPercent: number;
  completions: number;
}> {
  const categories: Habit['category'][] = [
    'Academics',
    'Hackathons & Code',
    'Public Speaking',
    'Health & Vitality',
    'Mindset',
  ];

  return categories.map((category) => {
    const matching = habits.filter((h) => h.category === category);
    const completions = matching.reduce(
      (s, h) => s + h.completedDates.length,
      0
    );
    const xp = matching.reduce(
      (s, h) => s + h.completedDates.length * h.xpReward,
      0
    );
    const perLevel = 220;
    const level = Math.floor(xp / perLevel) + 1;
    const remainder = xp % perLevel;
    return {
      category,
      xp,
      level,
      progressPercent: Math.round((remainder / perLevel) * 100),
      completions,
    };
  });
}

export function build30DayAnalytics(
  state: AppState,
  todayISO: string
): DailyAnalyticsPoint[] {
  const points: DailyAnalyticsPoint[] = [];
  let runningXp = 0;
  const totalHabits = Math.max(1, state.habits.length);

  for (let offset = -29; offset <= 0; offset++) {
    const dateISO = addDaysISO(todayISO, offset);
    const completedHabits = state.habits.filter((h) =>
      h.completedDates.includes(dateISO)
    );
    const completedCount = completedHabits.length;
    const completionRate = Math.round((completedCount / totalHabits) * 100);
    const habitXp = completedHabits.reduce((sum, h) => sum + h.xpReward, 0);
    const eventXp = state.calendarEvents.filter(
      (e) => e.date === dateISO && e.completed && !e.linkedHabitId
    ).length * 20;
    const penaltyForDay = (state.systemLogs || [])
      .filter((l) => l.date === dateISO && l.xpDelta < 0)
      .reduce((sum, l) => sum + Math.abs(l.xpDelta), 0);
    const xpEarned = Math.max(
      0,
      Math.round(habitXp * getComboMultiplier(completedCount)) + eventXp - penaltyForDay
    );
    runningXp += xpEarned;

    const [, m, d] = dateISO.split('-');
    points.push({
      date: dateISO,
      label: `${m}/${d}`,
      completionRate,
      completedCount,
      xpEarned,
      cumulativeXp: runningXp,
    });
  }

  return points;
}

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  xpReward: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'ach-first-blood',
    title: 'First Commit',
    description: 'Complete your first daily habit protocol.',
    xpReward: 50,
  },
  {
    id: 'ach-orator',
    title: 'Stage Orator',
    description: 'Log 10 Public Speaking & Rhetoric drills.',
    xpReward: 120,
  },
  {
    id: 'ach-hackathon',
    title: 'Hackathon Builder',
    description: 'Log 10 Hackathons & Code build sprints.',
    xpReward: 150,
  },
  {
    id: 'ach-scholar',
    title: 'V.V.P. Dean’s Pace',
    description: 'Reach 60%+ syllabus progress in an IT subject.',
    xpReward: 140,
  },
  {
    id: 'ach-iron-streak',
    title: '7-Day Iron Streak',
    description: 'Maintain at least a 7-day active streak on any habit.',
    xpReward: 180,
  },
  {
    id: 'ach-pomodoro',
    title: 'Deep Focus Cadet',
    description: 'Finish at least 1 timed Focus Pomodoro session.',
    xpReward: 75,
  },
];

function generate30DayHistory(
  todayISO: string,
  patternFn: (daysAgo: number) => boolean
): string[] {
  const dates: string[] = [];
  for (let i = 29; i >= 1; i--) {
    if (patternFn(i)) {
      dates.push(addDaysISO(todayISO, -i));
    }
  }
  return dates;
}

export function createInitialState(
  todayISO = formatDateISO(new Date())
): AppState {
  const tomorrow = addDaysISO(todayISO, 1);
  const in2Days = addDaysISO(todayISO, 2);
  const in3Days = addDaysISO(todayISO, 3);
  const in5Days = addDaysISO(todayISO, 5);
  const in9Days = addDaysISO(todayISO, 9);

  return {
    habits: [
      {
        id: 'hab-c-dsa',
        title: 'C Programming & DSA Problem Sprint',
        category: 'Academics',
        frequency: 'daily',
        preferredTime: '07:15',
        durationMinutes: 60,
        difficulty: 'Keystone',
        xpReward: 60,
        streak: 9,
        bestStreak: 14,
        completedDates: generate30DayHistory(
          todayISO,
          (ago) => ago <= 9 || (ago % 3 !== 0 && ago !== 17 && ago !== 24)
        ),
        notes: 'Solve 3 pointer/array problems & revise GTU lab manual.',
        createdAt: addDaysISO(todayISO, -29),
      },
      {
        id: 'hab-speaking',
        title: 'Public Speaking & Stage Rhetoric Drill',
        category: 'Public Speaking',
        frequency: 'daily',
        preferredTime: '18:15',
        durationMinutes: 25,
        difficulty: 'Focused',
        xpReward: 40,
        streak: 6,
        bestStreak: 11,
        completedDates: generate30DayHistory(
          todayISO,
          (ago) => ago <= 6 || (ago % 2 === 0 && ago !== 14 && ago !== 22)
        ),
        notes: '2-min impromptu speech + vocal pacing & stage presence.',
        createdAt: addDaysISO(todayISO, -29),
      },
      {
        id: 'hab-hack-build',
        title: 'Hackathon Prototype & GitHub Commit',
        category: 'Hackathons & Code',
        frequency: 'daily',
        preferredTime: '20:30',
        durationMinutes: 50,
        difficulty: 'Keystone',
        xpReward: 60,
        streak: 5,
        bestStreak: 12,
        completedDates: generate30DayHistory(
          todayISO,
          (ago) => ago <= 5 || (ago % 4 !== 1 && ago > 8)
        ),
        notes: 'Ship 1 meaningful component or pitch deck slide.',
        createdAt: addDaysISO(todayISO, -29),
      },
      {
        id: 'hab-maths',
        title: 'Engineering Mathematics Practice Set',
        category: 'Academics',
        frequency: 'weekdays',
        preferredTime: '16:30',
        durationMinutes: 40,
        difficulty: 'Focused',
        xpReward: 40,
        streak: 4,
        bestStreak: 9,
        completedDates: generate30DayHistory(
          todayISO,
          (ago) => ago <= 4 || (ago % 3 === 1 && ago > 7)
        ),
        notes: 'Matrices, calculus derivations, and past GTU question papers.',
        createdAt: addDaysISO(todayISO, -29),
      },
      {
        id: 'hab-vitality',
        title: 'Morning Hydration & Campus Mobility',
        category: 'Health & Vitality',
        frequency: 'daily',
        preferredTime: '06:30',
        durationMinutes: 20,
        difficulty: 'Standard',
        xpReward: 25,
        streak: 11,
        bestStreak: 21,
        completedDates: [
          ...generate30DayHistory(todayISO, (ago) => ago !== 12 && ago !== 25),
          todayISO,
        ],
        notes: '500ml water + 15 min sunlight stretch before V.V.P. bus/commute.',
        createdAt: addDaysISO(todayISO, -29),
      },
      {
        id: 'hab-mindset',
        title: 'CBT Reflection & Sleep Shutdown',
        category: 'Mindset',
        frequency: 'daily',
        preferredTime: '22:00',
        durationMinutes: 15,
        difficulty: 'Standard',
        xpReward: 25,
        streak: 7,
        bestStreak: 15,
        completedDates: generate30DayHistory(
          todayISO,
          (ago) => ago <= 7 || ago % 2 === 1
        ),
        notes: 'Reframe 1 stressor, log 2 wins, set tomorrow top 3 priorities.',
        createdAt: addDaysISO(todayISO, -29),
      },
    ],
    calendarEvents: [
      {
        id: 'evt-1',
        title: 'Morning Hydration & Campus Mobility',
        date: todayISO,
        startTime: '06:30',
        endTime: '06:50',
        category: 'Habit Ritual',
        linkedHabitId: 'hab-vitality',
        completed: true,
        priority: 'medium',
        source: 'assistant',
        alarmMinutesBefore: 5,
      },
      {
        id: 'evt-2',
        title: 'C Programming & DSA Problem Sprint',
        date: todayISO,
        startTime: '07:15',
        endTime: '08:15',
        category: 'Academics',
        linkedHabitId: 'hab-c-dsa',
        completed: false,
        priority: 'high',
        notes: 'Focus on recursion & dynamic memory allocation.',
        source: 'assistant',
        alarmMinutesBefore: 10,
      },
      {
        id: 'evt-3',
        title: 'V.V.P. Engineering College — IT Lectures & Labs',
        date: todayISO,
        startTime: '09:00',
        endTime: '15:30',
        category: 'Academics',
        completed: false,
        priority: 'high',
        notes: 'PPS Lab + Engineering Maths + Computer Fundamentals.',
        source: 'user',
        alarmMinutesBefore: 15,
      },
      {
        id: 'evt-4',
        title: 'Engineering Mathematics Practice Set',
        date: todayISO,
        startTime: '16:30',
        endTime: '17:10',
        category: 'Academics',
        linkedHabitId: 'hab-maths',
        completed: false,
        priority: 'medium',
        source: 'assistant',
      },
      {
        id: 'evt-5',
        title: 'Public Speaking & Stage Rhetoric Drill',
        date: todayISO,
        startTime: '18:15',
        endTime: '18:40',
        category: 'Public Speaking',
        linkedHabitId: 'hab-speaking',
        completed: false,
        priority: 'high',
        notes: 'Practice 3-minute hackathon pitch & rebuttal framing.',
        source: 'assistant',
      },
      {
        id: 'evt-6',
        title: 'Hackathon Prototype & GitHub Commit',
        date: todayISO,
        startTime: '20:30',
        endTime: '21:20',
        category: 'Hackathon',
        linkedHabitId: 'hab-hack-build',
        completed: false,
        priority: 'high',
        source: 'assistant',
      },
      {
        id: 'evt-7',
        title: 'Tomorrow Morning DSA Revision',
        date: tomorrow,
        startTime: '07:15',
        endTime: '08:15',
        category: 'Academics',
        linkedHabitId: 'hab-c-dsa',
        completed: false,
        priority: 'high',
        source: 'assistant',
      },
      {
        id: 'evt-8',
        title: 'PPS Pointers & Arrays Lab Assignment Submission',
        date: tomorrow,
        startTime: '17:00',
        endTime: '17:45',
        category: 'Academics',
        completed: false,
        priority: 'high',
        notes: 'Submit completed C programming lab assignment to V.V.P. IT faculty.',
        source: 'user',
        alarmMinutesBefore: 30,
      },
      {
        id: 'evt-9',
        title: 'Engineering Mathematics-I Unit Exam',
        date: in2Days,
        startTime: '10:00',
        endTime: '12:00',
        category: 'Academics',
        completed: false,
        priority: 'high',
        notes: 'Mid-sem unit exam covering Matrices, Eigenvalues & Cayley-Hamilton.',
        source: 'user',
        alarmMinutesBefore: 60,
      },
    ],
    quests: [
      {
        id: 'qst-morning-protocol',
        title: 'V.V.P. Morning Vanguard',
        description:
          'Complete 2 academic or vitality blocks before college hours (12:00).',
        type: 'daily',
        targetCount: 2,
        currentCount: 1,
        xpBonus: 120,
        coinBonus: 30,
        completed: false,
        claimed: false,
        category: 'All',
      },
      {
        id: 'qst-keystone-lock',
        title: 'Dual Keystone Mastery',
        description:
          'Finish both your C/DSA Sprint and Hackathon Prototype today.',
        type: 'daily',
        targetCount: 2,
        currentCount: 0,
        xpBonus: 160,
        coinBonus: 45,
        completed: false,
        claimed: false,
        category: 'All',
      },
      {
        id: 'qst-weekly-iron',
        title: 'Orator & Builder Week',
        description:
          'Log 28 total habit completions across academics, speaking, and code this week.',
        type: 'weekly',
        targetCount: 28,
        currentCount: 22,
        xpBonus: 350,
        coinBonus: 90,
        completed: false,
        claimed: false,
        category: 'All',
      },
    ],
    suggestions: [
      {
        id: 'sug-1',
        title: 'Lock 15:45–16:15 Post-College Decompression',
        rationale:
          'Transitioning straight from V.V.P. labs into Calculus causes cognitive fatigue. A 20-minute offline reset boosts afternoon retention by ~25%.',
        category: 'recovery',
        impactXp: 30,
        actionLabel: 'Schedule at 15:45',
        actionType: 'schedule_block',
        payload: {
          title: 'Post-Campus Reset & Tea',
          date: todayISO,
          startTime: '15:45',
          endTime: '16:15',
          eventCategory: 'Recovery',
        },
      },
      {
        id: 'sug-2',
        title: 'Add Mock Pitch Q&A Before Evening Code',
        rationale:
          'Strong hackathon teams win on story as much as code. Pair a 15-min Q&A defense drill to stay sharp for upcoming speaking events.',
        category: 'habit_stack',
        impactXp: 40,
        actionLabel: 'Adopt Habit',
        actionType: 'add_habit',
        payload: {
          title: '3-Min Hackathon Pitch Defense',
          habitCategory: 'Public Speaking',
          startTime: '19:45',
          durationMinutes: 15,
          difficulty: 'Focused',
        },
      },
    ],
    courses: [
      {
        id: 'crs-pps',
        code: '3110003',
        name: 'Programming for Problem Solving (C)',
        credits: 4,
        progressPercent: 68,
        nextMilestone: 'Pointers & File Handling Lab File',
        dueDate: in3Days,
      },
      {
        id: 'crs-math',
        code: '3110014',
        name: 'Engineering Mathematics — I',
        credits: 4,
        progressPercent: 54,
        nextMilestone: 'Eigenvalues & Cayley-Hamilton Quiz',
        dueDate: in5Days,
      },
      {
        id: 'crs-eng',
        code: '3110002',
        name: 'English & Technical Communication',
        credits: 2,
        progressPercent: 76,
        nextMilestone: 'Persuasive Seminar Presentation',
        dueDate: in3Days,
      },
      {
        id: 'crs-bme',
        code: '3110011',
        name: 'Basic Electronics & Digital Logic',
        credits: 4,
        progressPercent: 48,
        nextMilestone: 'K-Map & Logic Gate Practical Viva',
        dueDate: in9Days,
      },
    ],
    alarms: [
      {
        id: 'alm-wake',
        label: 'Wake Up & Hydration Protocol',
        time: '06:30',
        enabled: true,
        repeat: 'daily',
        soundType: 'chime',
        linkedTitle: 'Morning Hydration & Campus Mobility',
      },
      {
        id: 'alm-college',
        label: 'V.V.P. Campus Departure Check',
        time: '08:25',
        enabled: true,
        repeat: 'weekdays',
        soundType: 'bell',
        linkedTitle: 'V.V.P. Engineering College — IT Lectures & Labs',
      },
      {
        id: 'alm-speaking',
        label: 'Stage Rhetoric Drill Cue',
        time: '18:15',
        enabled: true,
        repeat: 'daily',
        soundType: 'pulse',
        linkedTitle: 'Public Speaking & Stage Rhetoric Drill',
      },
    ],
    opportunities: [],
    opportunitySources: [],
    journalEntries: [
      {
        id: 'jrn-1',
        date: addDaysISO(todayISO, -1),
        createdAt: '22:15',
        title: 'Conquered Double Pointers & Stage Anxiety Before Lab',
        mood: 'Focused',
        focusScore: 8,
        tags: ['C Programming', 'CBT Reframe', 'V.V.P. Lab'],
        content:
          'Started the morning doubting my recursion logic for the PPS lab manual, but broke the call stack down on paper before touching GCC. Also rehearsed a 90-second opening hook out loud twice—voice stayed steady without rushing.',
        gratitudeOrWin: 'Solved all 3 pointer swap test cases without compiler warnings.',
        cbtReframe:
          'Feeling nervous before presenting code is adrenaline preparing focus, not proof of unpreparedness.',
      },
      {
        id: 'jrn-2',
        date: addDaysISO(todayISO, -2),
        createdAt: '21:50',
        title: 'Hackathon Team Scope Check & Calculus Matrix Drill',
        mood: 'Resilient',
        focusScore: 7,
        tags: ['Hackathon', 'Maths-I', 'Energy Hygiene'],
        content:
          'Almost burned out trying to add five features to our weekend prototype. Pulled back to a single clean user flow, then closed out 6 Cayley-Hamilton derivations using 40Hz focus audio.',
        gratitudeOrWin: 'Cut scope early and protected 7.5 hours of sleep.',
        cbtReframe:
          'Shipping one working core demo beats chasing an unfinished feature checklist.',
      },
    ],
    systemLogs: [
      {
        id: 'log-seed-1',
        timestamp: new Date().toISOString(),
        date: todayISO,
        timeLabel: '06:48:12',
        type: 'habit_completed',
        title: 'Completed: Morning Hydration & Campus Mobility',
        details: 'Streak 11d · Morning vitality protocol cleared before campus bus.',
        xpDelta: 25,
        coinDelta: 10,
      },
      {
        id: 'log-seed-2',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        date: addDaysISO(todayISO, -1),
        timeLabel: '22:15:04',
        type: 'journal_logged',
        title: 'Shadow Journal: Conquered Double Pointers & Stage Anxiety',
        details: 'CBT Reframe logged · Clarity score 8/10.',
        xpDelta: 20,
        coinDelta: 5,
      },
      {
        id: 'log-seed-3',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        date: addDaysISO(todayISO, -1),
        timeLabel: '08:12:40',
        type: 'habit_completed',
        title: 'Completed: C Programming & DSA Problem Sprint',
        details: 'Keystone protocol cleared · Recursion & pointer drills.',
        xpDelta: 60,
        coinDelta: 10,
      },
    ],
    preferences: {
      name: 'Harsh Laheri',
      role: '1st Year B.E. IT Student',
      college: 'V.V.P. Engineering College, Rajkot',
      email: 'be26it052.harsh.laheri@vvpedulink.ac.in',
      wakeTime: '06:30',
      sleepTime: '22:45',
      focusPeakWindow: 'morning',
      dailyXpTarget: 260,
      assistantBriefingStyle: 'strategic',
      notificationSfx: 'system_arise',
    },
    bonusXp: 150,
    penaltyXp: 0,
    penalizedTaskIds: [],
    lastPenaltyAuditDate: todayISO,
    focusCoins: 140,
    doubleXpActiveUntil: null,
    claimedQuestIds: [],
    unlockedAchievements: ['ach-first-blood', 'ach-scholar', 'ach-iron-streak'],
    streakShields: 2,
    focusSessionsCompleted: 0,
    theme: 'light',
  };
}
