import {
  AgentActionLog,
  AlarmItem,
  AppState,
  CalendarEvent,
  ExecutiveBriefing,
  Habit,
  Quest,
} from '../types';

export interface OllamaConfig {
  enabled: boolean;
  endpoint: string; // e.g. http://localhost:11434
  model: string;    // e.g. llama3.2 or qwen2.5
}

function addMinutesToTime(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(23 * 60 + 55, Math.max(0, h * 60 + m + mins));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(
    total % 60
  ).padStart(2, '0')}`;
}

function toMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Optional local Ollama bridge for users running a local LLM (e.g. llama3.2 / qwen2.5)
 * on their Mac/PC or local LAN while on iPhone.
 */
export interface OfflineMapPlace {
  title: string;
  uri: string;
  category: string;
  distanceHint: string;
  summary: string;
}

export const OFFLINE_RAJKOT_PLACES: OfflineMapPlace[] = [
  {
    title: 'V.V.P. Engineering College — Central Library & IT Block',
    uri: 'https://www.google.com/maps/search/?api=1&query=VVP+Engineering+College+Vajdi+Virda+Rajkot',
    category: 'Campus Study & Labs',
    distanceHint: 'On Campus · Kalawad Road, Vajdi-Virda',
    summary:
      'Quiet academic reading hall, GTU reference books, and C/DSA lab workstations between college lectures.',
  },
  {
    title: 'Saurashtra University / Kalawad Road Study Zone',
    uri: 'https://www.google.com/maps/search/?api=1&query=Saurashtra+University+Road+Libraries+Rajkot',
    category: 'Library & Exam Prep',
    distanceHint: '~6 km East along Kalawad Road',
    summary:
      'Student-friendly reading rooms and quiet evening prep zones for Calculus, Physics, and IT mid-sems.',
  },
  {
    title: '150 Feet Ring Road & Crystal Mall Tech Cafes',
    uri: 'https://www.google.com/maps/search/?api=1&query=Quiet+study+cafes+150+Feet+Ring+Road+Rajkot',
    category: 'Hackathon Sprint & Wi-Fi',
    distanceHint: '~8 km · Rajkot West',
    summary:
      'Power-outlet friendly cafes suited for weekend 4-hour hackathon prototyping and team pitch rehearsals.',
  },
  {
    title: 'Rajkot Public Speaking & Toastmasters Meetup Hubs',
    uri: 'https://www.google.com/maps/search/?api=1&query=Toastmasters+OR+auditorium+Kalawad+Road+Rajkot',
    category: 'Public Speaking & Debate',
    distanceHint: '~7–9 km · Race Course / Kalawad Rd',
    summary:
      'Regional debate, impromptu speech practice circles, and youth leadership seminar venues.',
  },
];

export async function tryOllamaChat(
  config: OllamaConfig,
  message: string,
  state: AppState,
  todayDate: string,
  roleMode: 'balanced' | 'therapist' | 'manager' | 'teacher' | 'scout' = 'balanced'
): Promise<string | null> {
  if (!config.enabled || !config.endpoint) return null;
  const roleInstruction =
    roleMode === 'therapist'
      ? 'Focus primarily as an empathetic CBT therapist helping with stress, focus, and stage anxiety.'
      : roleMode === 'manager'
      ? 'Focus as a high-precision executive routine manager balancing time blocks and priorities.'
      : roleMode === 'teacher'
      ? 'Focus as a Socratic B.E. IT & Public Speaking instructor using crisp mental models.'
      : roleMode === 'scout'
      ? 'Focus as a campus & event scout recommending competitions, study venues, and Rajkot resources.'
      : 'Integrate CBT therapy, routine management, and Socratic B.E. IT teaching seamlessly.';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`${config.endpoint.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model || 'llama3.2',
        stream: false,
        messages: [
          {
            role: 'system',
            content: `You are Meridian, personal mentor for ${state.preferences.name} (1st Year IT at ${state.preferences.college}). Date: ${todayDate}. Role focus: ${roleInstruction} Be crisp, empathetic, and practical. Current habits: ${state.habits
              .map((h) => `${h.title} (${h.streak}d streak)`)
              .join(', ')}.`,
          },
          { role: 'user', content: message },
        ],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.message?.content || data?.response || null;
  } catch {
    return null;
  }
}

/**
 * Deterministic On-Device Offline AI Engine:
 * Works 100% offline on iPhone when no internet / cloud Gemini / Ollama is reachable.
 * Handles auto-planning, schedule shifting, alarm creation, habit creation, CBT therapy reframing,
 * campus place lookup, and V.V.P. IT study & public speaking coaching.
 */
export function runOfflineAutoPlan(
  state: AppState,
  targetDate: string
): { rationale: string; newBlocks: CalendarEvent[] } {
  const existing = state.calendarEvents
    .filter((e) => e.date === targetDate)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const scheduledHabitIds = new Set(
    existing.map((e) => e.linkedHabitId).filter(Boolean)
  );
  const unscheduled = state.habits.filter((h) => !scheduledHabitIds.has(h.id));

  if (unscheduled.length === 0) {
    return {
      rationale:
        'Offline Scheduler: All active habits are already allocated on this date without conflicts.',
      newBlocks: [],
    };
  }

  const wakeM = toMins(state.preferences.wakeTime || '06:30');
  const sleepM = toMins(state.preferences.sleepTime || '22:45');
  const occupied = existing.map((e) => ({
    start: toMins(e.startTime),
    end: toMins(e.endTime),
  }));

  const newBlocks: CalendarEvent[] = [];

  for (const habit of unscheduled) {
    const dur = habit.durationMinutes || 30;
    const prefM = toMins(habit.preferredTime || '09:00');
    let placedStart: number | null = null;

    // Try preferred time first, then scan 15-min slots from wake to sleep
    const candidates = [prefM];
    for (let t = wakeM; t + dur <= sleepM; t += 15) {
      candidates.push(t);
    }

    for (const start of candidates) {
      if (start < wakeM || start + dur > sleepM) continue;
      const end = start + dur;
      const conflict = occupied.some(
        (o) => !(end + 5 <= o.start || start >= o.end + 5)
      );
      if (!conflict) {
        placedStart = start;
        occupied.push({ start, end });
        break;
      }
    }

    if (placedStart !== null) {
      const startTime = `${String(Math.floor(placedStart / 60)).padStart(
        2,
        '0'
      )}:${String(placedStart % 60).padStart(2, '0')}`;
      const endTime = addMinutesToTime(startTime, dur);
      newBlocks.push({
        id: `evt-off-${Date.now().toString(36)}-${newBlocks.length}`,
        title: habit.title,
        date: targetDate,
        startTime,
        endTime,
        category: 'Habit Ritual',
        linkedHabitId: habit.id,
        completed: false,
        priority: habit.difficulty === 'Keystone' ? 'high' : 'medium',
        notes: 'Scheduled by Offline System Engine',
        source: 'assistant',
        alarmMinutesBefore: 10,
      });
    }
  }

  return {
    rationale: `Offline System Scheduler slotted ${newBlocks.length} unscheduled protocol(s) into conflict-free windows between ${state.preferences.wakeTime} and ${state.preferences.sleepTime}.`,
    newBlocks,
  };
}

export function runOfflineBriefing(
  state: AppState,
  todayDate: string
): ExecutiveBriefing {
  const remaining = state.habits.filter(
    (h) => !h.completedDates.includes(todayDate)
  );
  const topHabit = remaining[0];
  const longestStreak = Math.max(0, ...state.habits.map((h) => h.streak));

  return {
    headline:
      remaining.length === 0
        ? 'Daily Quest Cleared — Recovery Mode Active'
        : `Offline System Brief · ${remaining.length} Protocols Remaining`,
    summary: topHabit
      ? `You are maintaining a ${longestStreak}-day peak streak. Prioritize "${topHabit.title}" next, and remember: consistency beats intensity during your first year at V.V.P. Engineering College.`
      : `All daily protocols are cleared. Protect your sleep window at ${state.preferences.sleepTime} so tomorrow’s cognitive stamina starts at 100%.`,
    focusWindowNote:
      'Offline CBT Note: If a lab or speech prep feels overwhelming, shrink the next step to a 10-minute timer—momentum dissolves resistance.',
    generatedAt: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

export function runOfflineAssistantChat(
  message: string,
  state: AppState,
  todayDate: string,
  roleMode: 'balanced' | 'therapist' | 'manager' | 'teacher' | 'scout' = 'balanced'
): {
  reply: string;
  actions: AgentActionLog[];
  mutatedState: AppState;
  sources?: Array<{ title: string; uri: string; kind?: 'web' | 'maps'; snippet?: string }>;
} {
  const nextState: AppState = JSON.parse(JSON.stringify(state));
  const actions: AgentActionLog[] = [];
  const lower = message.toLowerCase();
  const stamp = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // 1. Auto-plan intent
  if (lower.includes('auto-plan') || lower.includes('plan my')) {
    const plan = runOfflineAutoPlan(nextState, todayDate);
    if (plan.newBlocks.length > 0) {
      nextState.calendarEvents.push(...plan.newBlocks);
      plan.newBlocks.forEach((b, idx) =>
        actions.push({
          id: `off-act-${Date.now()}-${idx}`,
          toolName: 'offline_scheduler',
          summary: `Scheduled "${b.title}" (${b.startTime}–${b.endTime})`,
          timestamp: stamp,
        })
      );
    }
    return {
      reply: `[Offline Mentor · Manager] ${plan.rationale}`,
      actions,
      mutatedState: nextState,
    };
  }

  // 2. Shift afternoon back 1 hour
  if (lower.includes('push') && (lower.includes('hour') || lower.includes('back'))) {
    let shifted = 0;
    nextState.calendarEvents = nextState.calendarEvents.map((ev) => {
      if (ev.date === todayDate && !ev.completed && ev.startTime >= '13:00') {
        shifted += 1;
        return {
          ...ev,
          startTime: addMinutesToTime(ev.startTime, 60),
          endTime: addMinutesToTime(ev.endTime, 60),
        };
      }
      return ev;
    });
    actions.push({
      id: `off-shift-${Date.now()}`,
      toolName: 'offline_reschedule',
      summary: `Shifted ${shifted} afternoon block(s) forward by 60 minutes`,
      timestamp: stamp,
    });
    return {
      reply: `[Offline Mentor · Manager] Done — shifted ${shifted} remaining afternoon block(s) forward by +60 minutes so your evening habits stay intact.`,
      actions,
      mutatedState: nextState,
    };
  }

  // 3. Alarm creation
  if (lower.includes('alarm') || lower.includes('wake')) {
    const timeMatch = message.match(/\b(\d{1,2}):(\d{2})\b/);
    const time = timeMatch
      ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
      : '06:30';
    const alarm: AlarmItem = {
      id: `alm-off-${Date.now()}`,
      label: message.length > 42 ? 'Offline Routine Alarm' : message,
      time,
      enabled: true,
      repeat: 'daily',
      soundType: 'chime',
    };
    nextState.alarms.push(alarm);
    actions.push({
      id: `off-alm-${Date.now()}`,
      toolName: 'create_alarm',
      summary: `Set daily alarm "${alarm.label}" for ${time}`,
      timestamp: stamp,
    });
    return {
      reply: `[Offline Mentor · Manager] Alarm set for ${time} inside Clock & Alarms. Keep your device volume active or export to Apple Reminders for lock-screen chimes.`,
      actions,
      mutatedState: nextState,
    };
  }

  // 4. Create habit
  if (lower.includes('habit') || lower.includes('reflection') || lower.includes('drill')) {
    const timeMatch = message.match(/\b(\d{1,2}):(\d{2})\b/);
    const preferredTime = timeMatch
      ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
      : '21:00';
    const title = lower.includes('reflection')
      ? 'Evening CBT Reflection & Plan'
      : lower.includes('speak') || lower.includes('speech')
      ? 'Stage Confidence & Speech Drill'
      : 'Focused IT Study Sprint';
    const newHabit: Habit = {
      id: `hab-off-${Date.now()}`,
      title,
      category: lower.includes('speak') ? 'Public Speaking' : 'Mindset',
      frequency: 'daily',
      preferredTime,
      durationMinutes: 25,
      difficulty: 'Focused',
      xpReward: 40,
      streak: 0,
      bestStreak: 0,
      completedDates: [],
      createdAt: todayDate,
    };
    nextState.habits.push(newHabit);
    nextState.calendarEvents.push({
      id: `evt-off-${Date.now()}`,
      title,
      date: todayDate,
      startTime: preferredTime,
      endTime: addMinutesToTime(preferredTime, 25),
      category: 'Habit Ritual',
      linkedHabitId: newHabit.id,
      completed: false,
      priority: 'medium',
      source: 'assistant',
    });
    actions.push({
      id: `off-hab-${Date.now()}`,
      toolName: 'create_habit',
      summary: `Created "${title}" (+40 XP) and scheduled at ${preferredTime}`,
      timestamp: stamp,
    });
    return {
      reply: `[Offline Mentor · Manager] Added "${title}" to your active protocols and slotted it at ${preferredTime}.`,
      actions,
      mutatedState: nextState,
    };
  }

  // 5. Quest creation
  if (lower.includes('quest') || lower.includes('challenge')) {
    const q: Quest = {
      id: `qst-off-${Date.now()}`,
      title: 'Offline Shadow Sprint',
      description: 'Complete 3 protocols today even without network access.',
      type: 'daily',
      targetCount: 3,
      currentCount: 0,
      xpBonus: 150,
      coinBonus: 40,
      completed: false,
      claimed: false,
    };
    nextState.quests.push(q);
    actions.push({
      id: `off-qst-${Date.now()}`,
      toolName: 'create_quest',
      summary: `Launched quest "${q.title}" (+150 XP)`,
      timestamp: stamp,
    });
    return {
      reply: `[Offline Mentor · Manager] Quest "${q.title}" is active (+150 XP reward). Execute your next block and claim it.`,
      actions,
      mutatedState: nextState,
    };
  }

  // 6. Location / Campus Place / Maps offline directory fallback
  if (
    roleMode === 'scout' ||
    /(near|nearby|map|place|cafe|library|directions|rajkot|campus|study spot|venue)/i.test(
      lower
    )
  ) {
    return {
      reply: `[Offline Campus Atlas · ${state.preferences.college}] Cloud Gemini Maps Grounding is currently offline or unavailable, so here are verified Rajkot study, library, and speaking meetup hubs near Kalawad Road:\n\n${OFFLINE_RAJKOT_PLACES.map(
        (p, i) => `${i + 1}. **${p.title}** (${p.distanceHint}) — ${p.summary}`
      ).join('\n')}`,
      actions,
      mutatedState: nextState,
      sources: OFFLINE_RAJKOT_PLACES.map((p) => ({
        title: p.title,
        uri: p.uri,
        kind: 'maps' as const,
        snippet: p.distanceHint,
      })),
    };
  }

  // 7. CBT Therapist / Stage Fright / Academic Stress support
  if (
    roleMode === 'therapist' ||
    lower.includes('stress') ||
    lower.includes('anxious') ||
    lower.includes('nervous') ||
    lower.includes('scared') ||
    lower.includes('overwhelm') ||
    lower.includes('tired') ||
    lower.includes('burnout')
  ) {
    return {
      reply: `[Offline CBT Therapist] Take one slow breath (4s in, 4s hold, 6s out). Separate *preparation* from *perfection*: you do not have to solve your entire semester tonight—you only need to win the next 15-minute Focus Sprint. Write one objective thought in your Shadow Journal and launch a 40 Hz Binaural sprint in Clock & Alarms.`,
      actions,
      mutatedState: nextState,
    };
  }

  // 8. Public Speaking & C/DSA Teacher fallback
  if (
    roleMode === 'teacher' ||
    lower.includes('pointer') ||
    lower.includes('dsa') ||
    lower.includes('c language') ||
    lower.includes('code') ||
    lower.includes('math') ||
    lower.includes('exam')
  ) {
    return {
      reply: `[Offline CS Mentor] Quick mental model for C Pointers & DSA: every variable sits inside a numbered locker in RAM. \`int x = 10;\` stores 10 inside the locker; \`int *p = &x;\` stores the locker *address* itself; \`*p\` dereferences that address to read or mutate 10. Trace 3 swap-by-reference examples and solve 2 dry-run loops in your next Focus Sprint.`,
      actions,
      mutatedState: nextState,
    };
  }

  if (lower.includes('speak') || lower.includes('hackathon') || lower.includes('pitch')) {
    return {
      reply: `[Offline Orator Coach] Structure your opening 30 seconds in 3 beats: (1) One concrete pain point the audience recognizes, (2) Your one-sentence solution mechanism, (3) Live proof or crisp story. Hold eye contact for 1.5 seconds before speaking your first word.`,
      actions,
      mutatedState: nextState,
    };
  }

  const remainingHabits = nextState.habits.filter(
    (h) => !h.completedDates.includes(todayDate)
  ).length;
  return {
    reply: `[Offline AI Mentor] Running locally with zero network dependency. You have ${remainingHabits} protocol(s) remaining today. Ask me to "auto-plan my day", "push afternoon blocks back 1 hour", "set an alarm at 06:30", coach CBT stress, explain C pointers, or list Rajkot study spots.`,
    actions,
    mutatedState: nextState,
  };
}
