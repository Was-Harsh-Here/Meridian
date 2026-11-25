export type HabitCategory =
  | 'Academics'
  | 'Hackathons & Code'
  | 'Public Speaking'
  | 'Health & Vitality'
  | 'Mindset';

export type HabitDifficulty = 'Standard' | 'Focused' | 'Keystone';

export type HabitFrequency = 'daily' | 'weekdays' | 'weekends';

export type EventCategory =
  | 'Academics'
  | 'Deep Work'
  | 'Habit Ritual'
  | 'Public Speaking'
  | 'Hackathon'
  | 'Health'
  | 'Recovery';

export interface Habit {
  id: string;
  title: string;
  category: HabitCategory;
  frequency: HabitFrequency;
  preferredTime: string; // HH:MM (24h)
  durationMinutes: number;
  difficulty: HabitDifficulty;
  xpReward: number;
  streak: number;
  bestStreak: number;
  completedDates: string[]; // YYYY-MM-DD
  notes?: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  category: EventCategory;
  linkedHabitId?: string;
  completed: boolean;
  failed?: boolean;
  priority: 'high' | 'medium' | 'low';
  notes?: string;
  source: 'user' | 'assistant' | 'google';
  alarmMinutesBefore?: number;
  googleEventId?: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'milestone';
  targetCount: number;
  currentCount: number;
  xpBonus: number;
  coinBonus?: number;
  completed: boolean;
  claimed: boolean;
  category?: HabitCategory | 'All';
}

export interface AISuggestion {
  id: string;
  title: string;
  rationale: string;
  category: 'schedule' | 'habit_stack' | 'optimization' | 'recovery' | 'academics';
  impactXp: number;
  actionLabel: string;
  actionType: 'add_habit' | 'schedule_block' | 'reschedule_event' | 'create_quest';
  payload: {
    title?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    durationMinutes?: number;
    habitCategory?: HabitCategory;
    eventCategory?: EventCategory;
    difficulty?: HabitDifficulty;
    eventId?: string;
    description?: string;
    targetCount?: number;
    xpBonus?: number;
    linkedHabitId?: string;
  };
  applied?: boolean;
  dismissed?: boolean;
}

export interface WebOpportunity {
  id: string;
  title: string;
  type: 'hackathon' | 'public_speaking';
  organizer: string;
  dateLabel: string;
  suggestedDateISO: string;
  locationOrMode: string;
  summary: string;
  url?: string;
  prepTip: string;
  addedToCalendar?: boolean;
}

export interface GroundingLink {
  title: string;
  uri: string;
  kind?: 'web' | 'maps';
  snippet?: string;
}

export type AssistantRole =
  | 'balanced'
  | 'therapist'
  | 'manager'
  | 'teacher'
  | 'scout';

export type AssistantComplexity = 'fast' | 'general' | 'complex' | 'deep';

export interface AcademicCourse {
  id: string;
  code: string;
  name: string;
  credits: number;
  progressPercent: number;
  nextMilestone: string;
  dueDate: string;
}

export interface AlarmItem {
  id: string;
  label: string;
  time: string; // HH:MM
  enabled: boolean;
  repeat: 'daily' | 'weekdays' | 'once';
  soundType: 'chime' | 'bell' | 'pulse';
  linkedTitle?: string;
}

export type AnimeSfxId =
  | 'system_arise'
  | 'gate_clear'
  | 'monarch_chime'
  | 'shonen_levelup'
  | 'silent';

export interface UserPreferences {
  name: string;
  role: string;
  college: string;
  email: string;
  wakeTime: string; // HH:MM
  sleepTime: string; // HH:MM
  focusPeakWindow: 'morning' | 'midday' | 'afternoon' | 'evening';
  dailyXpTarget: number;
  assistantBriefingStyle: 'concise' | 'strategic';
  notificationSfx?: AnimeSfxId;
}

export interface AgentActionLog {
  id: string;
  toolName: string;
  summary: string;
  timestamp: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actions?: AgentActionLog[];
  sources?: GroundingLink[];
  modelUsed?: string;
  roleBadge?: AssistantRole;
}

export interface ExecutiveBriefing {
  headline: string;
  summary: string;
  focusWindowNote: string;
  generatedAt: string;
}

export interface DailyAnalyticsPoint {
  date: string;
  label: string;
  completionRate: number;
  completedCount: number;
  xpEarned: number;
  cumulativeXp: number;
}

export type JournalMood =
  | 'Focused'
  | 'Resilient'
  | 'Stressed'
  | 'Inspired'
  | 'Exhausted';

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  createdAt: string; // HH:MM
  title: string;
  content: string;
  mood: JournalMood;
  focusScore: number; // 1-10
  tags: string[];
  gratitudeOrWin?: string;
  cbtReframe?: string;
}

export type SystemLogType =
  | 'habit_completed'
  | 'habit_unchecked'
  | 'habit_failed'
  | 'task_completed'
  | 'task_failed'
  | 'focus_completed'
  | 'quest_claimed'
  | 'xp_penalty'
  | 'journal_logged'
  | 'alarm_triggered'
  | 'calendar_sync'
  | 'system_info';

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  date: string; // YYYY-MM-DD
  timeLabel: string; // HH:MM:SS
  type: SystemLogType;
  title: string;
  details: string;
  xpDelta: number;
  coinDelta?: number;
}

export interface AppState {
  habits: Habit[];
  calendarEvents: CalendarEvent[];
  quests: Quest[];
  suggestions: AISuggestion[];
  courses: AcademicCourse[];
  alarms: AlarmItem[];
  opportunities: WebOpportunity[];
  opportunitySources: GroundingLink[];
  journalEntries?: JournalEntry[];
  systemLogs?: SystemLogEntry[];
  preferences: UserPreferences;
  bonusXp: number;
  penaltyXp?: number;
  penalizedTaskIds?: string[];
  lastPenaltyAuditDate?: string;
  focusCoins: number;
  doubleXpActiveUntil: number | null;
  claimedQuestIds: string[];
  unlockedAchievements: string[];
  streakShields: number;
  focusSessionsCompleted: number;
  theme: 'light' | 'dark';
}
