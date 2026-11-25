import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  type Content,
  type FunctionDeclaration,
  GoogleGenAI,
  type Part,
  ThinkingLevel,
  Type,
} from '@google/genai';
import type {
  AlarmItem,
  AppState,
  AssistantComplexity,
  AssistantRole,
  CalendarEvent,
  EventCategory,
  GroundingLink,
  Habit,
  HabitCategory,
  HabitDifficulty,
  Quest,
} from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const assistantTools: FunctionDeclaration[] = [
  {
    name: 'create_calendar_event',
    description:
      'Schedule a new time block, study session, competition, or meeting on the user calendar for a specific date and time.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: 'Clear title of the block or event.' },
        date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format.' },
        startTime: { type: Type.STRING, description: 'Start time in 24h HH:MM format.' },
        endTime: { type: Type.STRING, description: 'End time in 24h HH:MM format.' },
        category: {
          type: Type.STRING,
          description:
            'One of: Academics, Deep Work, Habit Ritual, Public Speaking, Hackathon, Health, Recovery.',
        },
        priority: {
          type: Type.STRING,
          description: 'One of: high, medium, low.',
        },
        linkedHabitId: {
          type: Type.STRING,
          description: 'Optional existing habit ID if this event represents a habit.',
        },
        alarmMinutesBefore: {
          type: Type.NUMBER,
          description: 'Optional reminder minutes before event (e.g. 10 or 15).',
        },
        notes: { type: Type.STRING, description: 'Optional brief note or context.' },
      },
      required: ['title', 'date', 'startTime', 'endTime', 'category'],
    },
  },
  {
    name: 'update_calendar_event',
    description:
      'Update, reschedule, rename, or mark complete an existing calendar event.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        eventId: { type: Type.STRING, description: 'ID of the existing event.' },
        title: { type: Type.STRING },
        date: { type: Type.STRING, description: 'YYYY-MM-DD' },
        startTime: { type: Type.STRING, description: '24h HH:MM' },
        endTime: { type: Type.STRING, description: '24h HH:MM' },
        category: { type: Type.STRING },
        completed: { type: Type.BOOLEAN },
        priority: { type: Type.STRING },
        notes: { type: Type.STRING },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'delete_calendar_event',
    description: 'Delete a calendar event by its ID.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        eventId: { type: Type.STRING, description: 'ID of the event to delete.' },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'reschedule_day_routine',
    description:
      'Batch-reschedule multiple calendar events on a day (e.g. shifting afternoon blocks when college lab runs late).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        updates: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              eventId: { type: Type.STRING },
              newDate: { type: Type.STRING, description: 'Optional YYYY-MM-DD' },
              newStartTime: { type: Type.STRING, description: '24h HH:MM' },
              newEndTime: { type: Type.STRING, description: '24h HH:MM' },
            },
            required: ['eventId', 'newStartTime', 'newEndTime'],
          },
        },
      },
      required: ['updates'],
    },
  },
  {
    name: 'create_habit',
    description:
      'Create a new tracked habit in the user habit system and optionally schedule it on the calendar.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        category: {
          type: Type.STRING,
          description:
            'One of: Academics, Hackathons & Code, Public Speaking, Health & Vitality, Mindset.',
        },
        preferredTime: { type: Type.STRING, description: '24h HH:MM' },
        durationMinutes: { type: Type.NUMBER },
        difficulty: {
          type: Type.STRING,
          description: 'One of: Standard, Focused, Keystone.',
        },
        frequency: {
          type: Type.STRING,
          description: 'One of: daily, weekdays, weekends.',
        },
        notes: { type: Type.STRING },
        scheduleOnDate: {
          type: Type.STRING,
          description: 'Optional YYYY-MM-DD to immediately add a calendar block for this habit.',
        },
      },
      required: ['title', 'category', 'preferredTime', 'durationMinutes', 'difficulty'],
    },
  },
  {
    name: 'toggle_habit_completion',
    description: 'Mark a habit completed or uncompleted for a specific date.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        habitId: { type: Type.STRING },
        date: { type: Type.STRING, description: 'YYYY-MM-DD' },
        completed: { type: Type.BOOLEAN },
      },
      required: ['habitId', 'date', 'completed'],
    },
  },
  {
    name: 'create_quest',
    description: 'Create a gamified quest or challenge for the user.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        type: { type: Type.STRING, description: 'daily or weekly' },
        targetCount: { type: Type.NUMBER },
        xpBonus: { type: Type.NUMBER },
        category: { type: Type.STRING },
      },
      required: ['title', 'description', 'type', 'targetCount', 'xpBonus'],
    },
  },
  {
    name: 'create_alarm',
    description:
      'Set a new wake-up, study, lecture, or habit alarm in the built-in Clock & Alarm engine.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        label: { type: Type.STRING, description: 'Descriptive alarm label.' },
        time: { type: Type.STRING, description: '24h HH:MM format.' },
        repeat: { type: Type.STRING, description: 'daily | weekdays | once' },
        soundType: { type: Type.STRING, description: 'chime | bell | pulse' },
      },
      required: ['label', 'time'],
    },
  },
  {
    name: 'update_course_progress',
    description:
      'Update progress percentage or next milestone for one of the user’s V.V.P. Engineering College IT courses.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        courseId: { type: Type.STRING },
        progressPercent: { type: Type.NUMBER },
        nextMilestone: { type: Type.STRING },
      },
      required: ['courseId'],
    },
  },
];

function addMinutesToTime(timeHHMM: string, mins: number): string {
  const [h, m] = timeHHMM.split(':').map(Number);
  const total = Math.min(23 * 60 + 55, Math.max(0, h * 60 + m + mins));
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

function getXpReward(difficulty: HabitDifficulty): number {
  if (difficulty === 'Keystone') return 60;
  if (difficulty === 'Focused') return 40;
  return 25;
}

function extractGroundingLinks(response: any): GroundingLink[] {
  const chunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const links: GroundingLink[] = [];
  for (const chunk of chunks) {
    if (chunk?.web?.uri && !seen.has(chunk.web.uri)) {
      seen.add(chunk.web.uri);
      links.push({
        title: chunk.web.title || chunk.web.uri,
        uri: chunk.web.uri,
        kind: 'web',
      });
    }
    if (chunk?.maps?.uri && !seen.has(chunk.maps.uri)) {
      seen.add(chunk.maps.uri);
      const reviewText =
        chunk.maps.placeAnswerSources?.reviewSnippets?.[0]?.reviewText ||
        chunk.maps.placeAnswerSources?.reviewSnippets?.[0]?.text;
      links.push({
        title: chunk.maps.title || 'Google Maps Place',
        uri: chunk.maps.uri,
        kind: 'maps',
        snippet: reviewText ? String(reviewText).slice(0, 140) : undefined,
      });
    }
  }
  return links.slice(0, 10);
}

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .trim();
}

function addDaysToISOString(baseISO: string, days: number): string {
  const [y, m, d] = baseISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

async function fetchLiveGoogleNewsEvents(
  searchQuery: string,
  type: 'hackathon' | 'public_speaking',
  todayDate: string,
  limit = 4
): Promise<{ items: any[]; links: GroundingLink[] }> {
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
    searchQuery
  )}&hl=en-IN&gl=IN&ceid=IN:en`;
  const resp = await fetch(rssUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MeridianOS/1.0)' },
  });
  if (!resp.ok) return { items: [], links: [] };
  const xml = await resp.text();
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const items: any[] = [];
  const links: GroundingLink[] = [];

  for (let i = 0; i < Math.min(limit, itemMatches.length); i++) {
    const block = itemMatches[i];
    const titleRaw = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
    const linkRaw = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
    const pubDateRaw = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
    const sourceRaw =
      block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || 'Web Announcement';

    const fullTitle = decodeXmlEntities(titleRaw);
    const cleanUrl = decodeXmlEntities(linkRaw);
    const cleanSource = decodeXmlEntities(sourceRaw);
    const cleanTitle = fullTitle.replace(/\s+-\s+[^-]+$/, '').trim() || fullTitle;

    if (!cleanTitle || !cleanUrl) continue;

    let dateLabel = 'Live Web Listing';
    if (pubDateRaw) {
      const parsed = new Date(pubDateRaw);
      if (!Number.isNaN(parsed.getTime())) {
        dateLabel = `Updated ${parsed.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}`;
      }
    }

    items.push({
      id: `opp-rss-${type}-${Date.now()}-${i}`,
      title: cleanTitle,
      type,
      organizer: cleanSource,
      dateLabel,
      suggestedDateISO: addDaysToISOString(todayDate, 3 + i * 2),
      locationOrMode: 'India / Online Listing',
      summary: `Live announcement sourced from ${cleanSource}. Click the official link to review registration dates, eligibility, and rules.`,
      url: cleanUrl,
      prepTip:
        type === 'public_speaking'
          ? 'Draft a 90-second opening hook + 3 evidence points in your Journal before registering.'
          : 'Scope a single clean MVP feature with your team and practice a 3-minute live demo.',
    });
    links.push({ title: `${cleanTitle} (${cleanSource})`, uri: cleanUrl });
  }

  return { items, links };
}

async function fetchLiveDevpostHackathons(
  customQuery: string | undefined,
  todayDate: string,
  limit = 4
): Promise<{ items: any[]; links: GroundingLink[] }> {
  const params = new URLSearchParams();
  params.append('open_to[]', 'public');
  params.append('status[]', 'upcoming');
  params.append('status[]', 'open');
  if (customQuery?.trim()) {
    params.set('search', customQuery.trim());
  }

  const resp = await fetch(`https://devpost.com/api/hackathons?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; MeridianOS/1.0)',
    },
  });
  if (!resp.ok) return { items: [], links: [] };
  const data = (await resp.json()) as { hackathons?: any[] };
  const list = Array.isArray(data.hackathons) ? data.hackathons : [];
  const items: any[] = [];
  const links: GroundingLink[] = [];

  for (let i = 0; i < Math.min(limit, list.length); i++) {
    const h = list[i];
    const themes = Array.isArray(h.themes)
      ? h.themes.map((t: any) => t.name).filter(Boolean).slice(0, 3)
      : [];
    const location = h.displayed_location?.location || 'Online';
    const org = h.organization_name || 'Devpost Hackathon';
    const prizeText = h.prize_amount
      ? ` Prizes: ${String(h.prize_amount).replace(/<[^>]+>/g, '').trim()}.`
      : '';
    const regCount = h.registrations_count
      ? ` ${Number(h.registrations_count).toLocaleString()} participants registered.`
      : '';

    items.push({
      id: `opp-devpost-${h.id || i}-${Date.now()}`,
      title: String(h.title || 'Live Hackathon'),
      type: 'hackathon',
      organizer: org,
      dateLabel: `${h.submission_period_dates || 'Open Now'}${
        h.time_left_to_submission ? ` · ${h.time_left_to_submission}` : ''
      }`,
      suggestedDateISO: addDaysToISOString(todayDate, 2 + i * 2),
      locationOrMode: location,
      summary: `${
        themes.length > 0 ? `Themes: ${themes.join(', ')}. ` : ''
      }${prizeText}${regCount}`.trim() || 'Open public hackathon accepting submissions.',
      url: String(h.url || 'https://devpost.com/hackathons'),
      prepTip:
        'Pick 1 track theme, build a working prototype in 48h, and prepare a crisp 2-minute problem-solution pitch.',
    });
    if (h.url) {
      links.push({ title: `${h.title} · Devpost`, uri: String(h.url) });
    }
  }

  return { items, links };
}

async function fetchLiveWebEvents(
  focus: 'all' | 'hackathon' | 'public_speaking',
  customQuery: string | undefined,
  todayDate: string
): Promise<{ opportunities: any[]; sources: GroundingLink[]; engineLabel: string }> {
  const q = customQuery?.trim();
  const tasks: Array<Promise<{ items: any[]; links: GroundingLink[] }>> = [];

  if (focus === 'all' || focus === 'hackathon') {
    tasks.push(fetchLiveDevpostHackathons(q, todayDate, focus === 'all' ? 3 : 5));
    tasks.push(
      fetchLiveGoogleNewsEvents(
        q ? `${q} hackathon India students` : 'hackathon college engineering students India Gujarat',
        'hackathon',
        todayDate,
        focus === 'all' ? 2 : 4
      )
    );
  }

  if (focus === 'all' || focus === 'public_speaking') {
    tasks.push(
      fetchLiveGoogleNewsEvents(
        q
          ? `${q} public speaking debate competition`
          : 'public speaking OR debate OR Model UN competition college students India',
        'public_speaking',
        todayDate,
        focus === 'all' ? 3 : 6
      )
    );
  }

  const settled = await Promise.allSettled(tasks);
  const opportunities: any[] = [];
  const allLinks: GroundingLink[] = [];

  for (const res of settled) {
    if (res.status === 'fulfilled') {
      opportunities.push(...res.value.items);
      allLinks.push(...res.value.links);
    }
  }

  const uniqueSources = Array.from(
    new Map(allLinks.map((l) => [l.uri, l])).values()
  ).slice(0, 8);

  return {
    opportunities,
    sources: uniqueSources,
    engineLabel: 'Live Devpost + Google News Web Feed',
  };
}

function executeToolCall(
  name: string,
  args: Record<string, any>,
  state: AppState
): { result: Record<string, any>; summary: string } {
  const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  switch (name) {
    case 'create_calendar_event': {
      const validCats: EventCategory[] = [
        'Academics',
        'Deep Work',
        'Habit Ritual',
        'Public Speaking',
        'Hackathon',
        'Health',
        'Recovery',
      ];
      const category = validCats.includes(args.category) ? args.category : 'Academics';
      const newEvent: CalendarEvent = {
        id: `evt-${uid()}`,
        title: String(args.title || 'Scheduled Block'),
        date: String(args.date),
        startTime: String(args.startTime),
        endTime: String(args.endTime),
        category,
        linkedHabitId: args.linkedHabitId ? String(args.linkedHabitId) : undefined,
        completed: false,
        priority:
          args.priority === 'high' || args.priority === 'low' ? args.priority : 'medium',
        alarmMinutesBefore: args.alarmMinutesBefore ? Number(args.alarmMinutesBefore) : 10,
        notes: args.notes ? String(args.notes) : undefined,
        source: 'assistant',
      };
      state.calendarEvents.push(newEvent);
      return {
        result: { status: 'created', event: newEvent },
        summary: `Scheduled "${newEvent.title}" on ${newEvent.date} (${newEvent.startTime}–${newEvent.endTime})`,
      };
    }

    case 'update_calendar_event': {
      const idx = state.calendarEvents.findIndex((e) => e.id === args.eventId);
      if (idx === -1) {
        return {
          result: { status: 'error', message: `Event ${args.eventId} not found.` },
          summary: `Attempted to update missing event (${args.eventId})`,
        };
      }
      const ev = state.calendarEvents[idx];
      const updated: CalendarEvent = {
        ...ev,
        title: args.title !== undefined ? String(args.title) : ev.title,
        date: args.date !== undefined ? String(args.date) : ev.date,
        startTime: args.startTime !== undefined ? String(args.startTime) : ev.startTime,
        endTime: args.endTime !== undefined ? String(args.endTime) : ev.endTime,
        category: args.category !== undefined ? (args.category as EventCategory) : ev.category,
        completed: args.completed !== undefined ? Boolean(args.completed) : ev.completed,
        priority: args.priority !== undefined ? args.priority : ev.priority,
        notes: args.notes !== undefined ? String(args.notes) : ev.notes,
      };
      state.calendarEvents[idx] = updated;

      if (updated.linkedHabitId && args.completed !== undefined) {
        const habit = state.habits.find((h) => h.id === updated.linkedHabitId);
        if (habit) {
          const hasDate = habit.completedDates.includes(updated.date);
          if (args.completed && !hasDate) {
            habit.completedDates.push(updated.date);
            habit.streak += 1;
            habit.bestStreak = Math.max(habit.bestStreak, habit.streak);
          } else if (!args.completed && hasDate) {
            habit.completedDates = habit.completedDates.filter((d) => d !== updated.date);
            habit.streak = Math.max(0, habit.streak - 1);
          }
        }
      }

      return {
        result: { status: 'updated', event: updated },
        summary: `Updated "${updated.title}" (${updated.date}, ${updated.startTime}–${updated.endTime})`,
      };
    }

    case 'delete_calendar_event': {
      const target = state.calendarEvents.find((e) => e.id === args.eventId);
      if (!target) {
        return {
          result: { status: 'error', message: `Event ${args.eventId} not found.` },
          summary: `Event ${args.eventId} was not found`,
        };
      }
      state.calendarEvents = state.calendarEvents.filter((e) => e.id !== args.eventId);
      return {
        result: { status: 'deleted', eventId: args.eventId },
        summary: `Removed "${target.title}" from ${target.date}`,
      };
    }

    case 'reschedule_day_routine': {
      const updates = Array.isArray(args.updates) ? args.updates : [];
      let count = 0;
      for (const u of updates) {
        const ev = state.calendarEvents.find((e) => e.id === u.eventId);
        if (ev) {
          if (u.newDate) ev.date = String(u.newDate);
          ev.startTime = String(u.newStartTime);
          ev.endTime = String(u.newEndTime);
          count += 1;
        }
      }
      return {
        result: { status: 'rescheduled', updatedCount: count },
        summary: `Rebalanced ${count} calendar block${count === 1 ? '' : 's'}`,
      };
    }

    case 'create_habit': {
      const validCats: HabitCategory[] = [
        'Academics',
        'Hackathons & Code',
        'Public Speaking',
        'Health & Vitality',
        'Mindset',
      ];
      const category = validCats.includes(args.category) ? args.category : 'Academics';
      const validDiffs: HabitDifficulty[] = ['Standard', 'Focused', 'Keystone'];
      const difficulty = validDiffs.includes(args.difficulty) ? args.difficulty : 'Standard';
      const durationMinutes = Number(args.durationMinutes) || 25;
      const preferredTime = String(args.preferredTime || '09:00');
      const newHabit: Habit = {
        id: `hab-${uid()}`,
        title: String(args.title),
        category,
        frequency:
          args.frequency === 'weekdays' || args.frequency === 'weekends'
            ? args.frequency
            : 'daily',
        preferredTime,
        durationMinutes,
        difficulty,
        xpReward: getXpReward(difficulty),
        streak: 0,
        bestStreak: 0,
        completedDates: [],
        notes: args.notes ? String(args.notes) : undefined,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      state.habits.push(newHabit);

      if (args.scheduleOnDate) {
        const block: CalendarEvent = {
          id: `evt-${uid()}`,
          title: newHabit.title,
          date: String(args.scheduleOnDate),
          startTime: preferredTime,
          endTime: addMinutesToTime(preferredTime, durationMinutes),
          category: 'Habit Ritual',
          linkedHabitId: newHabit.id,
          completed: false,
          priority: difficulty === 'Keystone' ? 'high' : 'medium',
          notes: newHabit.notes,
          source: 'assistant',
          alarmMinutesBefore: 10,
        };
        state.calendarEvents.push(block);
      }

      return {
        result: { status: 'created', habit: newHabit },
        summary: `Created ${difficulty} habit "${newHabit.title}" (+${newHabit.xpReward} XP)`,
      };
    }

    case 'toggle_habit_completion': {
      const habit = state.habits.find((h) => h.id === args.habitId);
      if (!habit) {
        return {
          result: { status: 'error', message: `Habit ${args.habitId} not found.` },
          summary: `Habit ${args.habitId} not found`,
        };
      }
      const dateStr = String(args.date);
      const already = habit.completedDates.includes(dateStr);
      if (args.completed && !already) {
        habit.completedDates.push(dateStr);
        habit.streak += 1;
        habit.bestStreak = Math.max(habit.bestStreak, habit.streak);
      } else if (!args.completed && already) {
        habit.completedDates = habit.completedDates.filter((d) => d !== dateStr);
        habit.streak = Math.max(0, habit.streak - 1);
      }
      state.calendarEvents.forEach((ev) => {
        if (ev.linkedHabitId === habit.id && ev.date === dateStr) {
          ev.completed = Boolean(args.completed);
        }
      });
      return {
        result: { status: 'updated', habit },
        summary: `${args.completed ? 'Completed' : 'Unchecked'} "${habit.title}" for ${dateStr}`,
      };
    }

    case 'create_quest': {
      const newQuest: Quest = {
        id: `qst-${uid()}`,
        title: String(args.title),
        description: String(args.description),
        type: args.type === 'weekly' ? 'weekly' : 'daily',
        targetCount: Math.max(1, Number(args.targetCount) || 3),
        currentCount: 0,
        xpBonus: Math.max(25, Number(args.xpBonus) || 100),
        coinBonus: 35,
        completed: false,
        claimed: false,
        category: args.category || 'All',
      };
      state.quests.push(newQuest);
      return {
        result: { status: 'created', quest: newQuest },
        summary: `Launched quest "${newQuest.title}" (+${newQuest.xpBonus} XP bonus)`,
      };
    }

    case 'create_alarm': {
      const repeat =
        args.repeat === 'weekdays' || args.repeat === 'once' ? args.repeat : 'daily';
      const soundType =
        args.soundType === 'bell' || args.soundType === 'pulse'
          ? args.soundType
          : 'chime';
      const alarm: AlarmItem = {
        id: `alm-${uid()}`,
        label: String(args.label || 'Meridian Reminder Alarm'),
        time: String(args.time || '07:00'),
        enabled: true,
        repeat,
        soundType,
      };
      state.alarms.push(alarm);
      return {
        result: { status: 'created', alarm },
        summary: `Set ${repeat} alarm "${alarm.label}" for ${alarm.time}`,
      };
    }

    case 'update_course_progress': {
      const course = state.courses.find((c) => c.id === args.courseId);
      if (!course) {
        return {
          result: { status: 'error', message: `Course ${args.courseId} not found.` },
          summary: `Course ${args.courseId} not found`,
        };
      }
      if (args.progressPercent !== undefined) {
        course.progressPercent = Math.min(100, Math.max(0, Number(args.progressPercent)));
      }
      if (args.nextMilestone !== undefined) {
        course.nextMilestone = String(args.nextMilestone);
      }
      return {
        result: { status: 'updated', course },
        summary: `Updated ${course.name} to ${course.progressPercent}%`,
      };
    }

    default:
      return {
        result: { status: 'error', message: `Unknown tool ${name}` },
        summary: `Unknown tool ${name}`,
      };
  }
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/assistant/chat', async (req, res) => {
    try {
      const {
        message,
        history = [],
        state,
        todayDate,
        currentTime,
        roleMode = 'balanced',
        complexity = 'general',
        coords,
      } = req.body as {
        message: string;
        history: Array<{ role: 'user' | 'assistant'; text: string }>;
        state: AppState;
        todayDate: string;
        currentTime: string;
        roleMode?: AssistantRole;
        complexity?: AssistantComplexity;
        coords?: { latitude: number; longitude: number } | null;
      };

      if (!message || !state) {
        return res.status(400).json({ error: 'Message and state are required.' });
      }

      const ai = getAiClient();
      const workingState: AppState = JSON.parse(JSON.stringify(state));
      const executedActions: Array<{
        id: string;
        toolName: string;
        summary: string;
        timestamp: string;
      }> = [];
      let collectedSources: GroundingLink[] = [];

      const roleDirective =
        roleMode === 'therapist'
          ? 'ACTIVE PRIMARY ROLE — CBT THERAPIST: Lead with warmth, cognitive reframing, nervous-system grounding, and realistic load reduction.'
          : roleMode === 'manager'
          ? 'ACTIVE PRIMARY ROLE — EXECUTIVE ROUTINE MANAGER: Prioritize calendar execution, time-boxing, alarms, and calling scheduling tools directly.'
          : roleMode === 'teacher'
          ? 'ACTIVE PRIMARY ROLE — SOCRATIC IT & ORATORY TEACHER: Teach C, pointers, DSA, Engineering Maths, and public speaking structure step-by-step.'
          : roleMode === 'scout'
          ? 'ACTIVE PRIMARY ROLE — GOOGLE SEARCH & MAPS SCOUT: Surface real competitions, study venues, libraries, cafes, and local Rajkot campus spots with clickable links.'
          : 'ACTIVE ROLE — INTEGRATED SYSTEM ARCHITECT: Blend CBT therapy, executive routine scheduling, and IT/oratory coaching cleanly.';

      const systemInstruction = `You are Meridian, personal mentor for ${workingState.preferences.name}, a ${workingState.preferences.role} at ${workingState.preferences.college}.
Today's date is ${todayDate}. Current local time is ${currentTime}.
${roleDirective}

Core capabilities:
1. PSYCHOLOGICALLY TRAINED THERAPIST: Evidence-based CBT, emotional regulation, burnout prevention, and stage-fright coaching.
2. EXECUTIVE ROUTINE MANAGER: Execute create_calendar_event, update_calendar_event, delete_calendar_event, reschedule_day_routine, create_habit, create_alarm, and create_quest directly rather than telling Harsh to do it manually.
3. SOCRATIC TEACHER & COACH: Teach first-year B.E. IT subjects and public speaking / hackathon pitching.
4. GROUNDED SCOUT: Ground live web questions with Google Search and location/place questions with Google Maps.`;

      const contextSnapshot = `Student Academic Courses:
${JSON.stringify(workingState.courses, null, 2)}

Active Habits:
${JSON.stringify(
  workingState.habits.map((h) => ({
    id: h.id,
    title: h.title,
    category: h.category,
    preferredTime: h.preferredTime,
    durationMinutes: h.durationMinutes,
    difficulty: h.difficulty,
    xpReward: h.xpReward,
    streak: h.streak,
    completedToday: h.completedDates.includes(todayDate),
  })),
  null,
  2
)}

Calendar Events:
${JSON.stringify(workingState.calendarEvents, null, 2)}

Active Alarms:
${JSON.stringify(workingState.alarms, null, 2)}

Active Quests:
${JSON.stringify(workingState.quests, null, 2)}`;

      const contents: Content[] = [
        ...history.slice(-10).map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.text }],
        })),
        {
          role: 'user',
          parts: [
            {
              text: `${contextSnapshot}\n\nUser message: ${message}`,
            },
          ],
        },
      ];

      const isMapsIntent =
        /(near me|nearby|on google maps|maps|directions|study spot|cafe|library|hostel|distance|route to|venues in|rajkot|around campus)/i.test(
          message
        ) ||
        (roleMode === 'scout' &&
          /(place|spot|cafe|library|where|location|campus)/i.test(message));

      const isSearchIntent =
        !isMapsIntent &&
        (roleMode === 'scout' ||
          /(search|web|hackathon|speaking|debate|mun|competition|contest|latest|upcoming|news|scholarship)/i.test(
            message
          ));

      // Respect @google/genai model selection & Maps/Search exclusivity
      let selectedModel = 'gemini-4-hydrogen';
      let thinkingLevel: ThinkingLevel | undefined;
      if (complexity === 'fast' && !isMapsIntent && !isSearchIntent) {
        selectedModel = 'gemini-3.1-flash-lite';
        thinkingLevel = ThinkingLevel.MINIMAL;
      } else if (complexity === 'complex' || complexity === 'deep') {
        selectedModel = 'gemini-4-hydrogen';
        thinkingLevel = ThinkingLevel.HIGH;
      }

      const activeCoords =
        coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)
          ? coords
          : { latitude: 22.2683, longitude: 70.7429 }; // V.V.P. Engineering College, Rajkot

      const toolsConfig = isMapsIntent
        ? [{ googleMaps: {} }, { functionDeclarations: assistantTools }]
        : isSearchIntent || selectedModel === 'gemini-4-hydrogen'
        ? [{ googleSearch: {} }, { functionDeclarations: assistantTools }]
        : [{ functionDeclarations: assistantTools }];

      const toolConfig = isMapsIntent
        ? {
            includeServerSideToolInvocations: true,
            retrievalConfig: { latLng: activeCoords },
          }
        : isSearchIntent || selectedModel === 'gemini-4-hydrogen'
        ? { includeServerSideToolInvocations: true }
        : undefined;

      let finalReply = '';
      for (let step = 0; step < 4; step++) {
        const configObj: Record<string, any> = {
          systemInstruction,
          tools: toolsConfig,
        };
        if (toolConfig) {
          configObj.toolConfig = toolConfig;
        }
        if (thinkingLevel) {
          configObj.thinkingConfig = { thinkingLevel };
        }

        const response = await ai.models.generateContent({
          model: selectedModel,
          contents,
          config: configObj,
        });

        const links = extractGroundingLinks(response);
        if (links.length > 0) {
          collectedSources = [...collectedSources, ...links];
        }

        const candidateContent = response.candidates?.[0]?.content;
        const functionCalls = response.functionCalls;

        if (functionCalls && functionCalls.length > 0 && candidateContent) {
          contents.push(candidateContent);
          const responseParts: Part[] = [];

          for (const fc of functionCalls) {
            const exec = executeToolCall(
              fc.name || '',
              (fc.args as Record<string, any>) || {},
              workingState
            );
            executedActions.push({
              id: `act-${Date.now()}-${executedActions.length}`,
              toolName: fc.name || 'action',
              summary: exec.summary,
              timestamp: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
            });
            responseParts.push({
              functionResponse: {
                id: fc.id,
                name: fc.name || '',
                response: exec.result,
              },
            });
          }

          contents.push({
            role: 'user',
            parts: responseParts,
          });
        } else {
          finalReply = response.text || 'Done. Your routine has been updated.';
          break;
        }
      }

      if (!finalReply) {
        finalReply =
          executedActions.length > 0
            ? `Executed ${executedActions.length} update${executedActions.length === 1 ? '' : 's'} to your routine and schedule.`
            : 'I reviewed your routine—let me know how you would like me to adjust your blocks.';
      }

      const uniqueSources = Array.from(
        new Map(collectedSources.map((s) => [s.uri, s])).values()
      ).slice(0, 8);

      const engineTag = isMapsIntent
        ? `${selectedModel} · Maps`
        : isSearchIntent
        ? `${selectedModel} · Search`
        : thinkingLevel === ThinkingLevel.HIGH
        ? `${selectedModel} · Deep`
        : selectedModel;

      res.json({
        reply: finalReply,
        actions: executedActions,
        sources: uniqueSources,
        mutatedState: workingState,
        modelUsed: engineTag,
      });
    } catch (error: any) {
      console.error('Assistant chat error:', error);
      const msgText = String(req.body?.message || '');
      const todayISO = String(
        req.body?.todayDate || new Date().toISOString().slice(0, 10)
      );
      const isWebQuery =
        /(search|web|hackathon|speaking|debate|mun|competition|contest|event|find upcoming)/i.test(
          msgText
        );

      if (isWebQuery) {
        try {
          const focus = /speak|debate|mun|toastmaster/i.test(msgText)
            ? 'public_speaking'
            : /hack|coding/i.test(msgText)
            ? 'hackathon'
            : 'all';
          const live = await fetchLiveWebEvents(focus, undefined, todayISO);
          if (live.opportunities.length > 0) {
            const topLines = live.opportunities
              .slice(0, 4)
              .map(
                (o, i) =>
                  `${i + 1}. **${o.title}** (${o.organizer} · ${o.dateLabel}) — ${o.locationOrMode}`
              )
              .join('\n');
            return res.json({
              reply: `Here are live upcoming opportunities fetched directly from web feeds:\n\n${topLines}\n\nOpen **Events & Academics** to schedule prep blocks onto your calendar.`,
              actions: [],
              sources: live.sources,
              mutatedState: req.body?.state,
              modelUsed: 'Live Web Feed',
            });
          }
        } catch {
          // Fall through to standard error response
        }
      }

      res.status(error?.status || 500).json({
        error:
          error?.message || 'Unable to process assistant request right now.',
      });
    }
  });

  app.post('/api/assistant/briefing', async (req, res) => {
    try {
      const { state, todayDate, currentTime } = req.body as {
        state: AppState;
        todayDate: string;
        currentTime: string;
      };

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Analyze this 1st-year B.E. IT student's (${state.preferences.college}) habits, courses, streaks, and calendar events for ${todayDate} (current local time ${currentTime}). Generate a psychologically grounded executive briefing (therapist + manager + teacher tone) and 3 concrete actionable suggestions.

State:
${JSON.stringify({
  preferences: state.preferences,
  courses: state.courses,
  habits: state.habits.map((h) => ({
    id: h.id,
    title: h.title,
    category: h.category,
    streak: h.streak,
    completedToday: h.completedDates.includes(todayDate),
  })),
  todaysEvents: state.calendarEvents.filter((e) => e.date === todayDate),
})}`,
        config: {
          systemInstruction:
            'You are Meridian, acting as CBT-informed performance therapist, executive routine manager, and IT academic mentor. Reference actual courses, habits, and open time windows.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              summary: { type: Type.STRING },
              focusWindowNote: { type: Type.STRING },
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                    category: { type: Type.STRING },
                    impactXp: { type: Type.NUMBER },
                    actionLabel: { type: Type.STRING },
                    actionType: { type: Type.STRING },
                    payload: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        date: { type: Type.STRING },
                        startTime: { type: Type.STRING },
                        endTime: { type: Type.STRING },
                        durationMinutes: { type: Type.NUMBER },
                        habitCategory: { type: Type.STRING },
                        eventCategory: { type: Type.STRING },
                        difficulty: { type: Type.STRING },
                        description: { type: Type.STRING },
                        targetCount: { type: Type.NUMBER },
                        xpBonus: { type: Type.NUMBER },
                      },
                    },
                  },
                  required: [
                    'title',
                    'rationale',
                    'category',
                    'impactXp',
                    'actionLabel',
                    'actionType',
                    'payload',
                  ],
                },
              },
            },
            required: ['headline', 'summary', 'focusWindowNote', 'suggestions'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json(parsed);
    } catch (error: any) {
      console.error('Briefing error:', error);
      res.status(error?.status || 500).json({
        error: error?.message || 'Failed to generate AI executive briefing.',
      });
    }
  });

  app.post('/api/assistant/auto-plan', async (req, res) => {
    try {
      const { state, targetDate, currentTime } = req.body as {
        state: AppState;
        targetDate: string;
        currentTime: string;
      };

      const existingForDate = state.calendarEvents.filter(
        (e) => e.date === targetDate
      );
      const scheduledHabitIds = new Set(
        existingForDate.map((e) => e.linkedHabitId).filter(Boolean)
      );
      const unscheduledHabits = state.habits.filter(
        (h) => !scheduledHabitIds.has(h.id)
      );

      if (unscheduledHabits.length === 0) {
        return res.json({
          rationale:
            'All active study, hackathon, and speaking protocols are already scheduled on this date.',
          newBlocks: [],
        });
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Target Date: ${targetDate}. Current time: ${currentTime}.
Student wake/sleep window: ${state.preferences.wakeTime} to ${state.preferences.sleepTime}. Peak focus: ${state.preferences.focusPeakWindow}.

Existing fixed events on ${targetDate} (DO NOT OVERLAP THESE):
${JSON.stringify(existingForDate, null, 2)}

Unscheduled habits to place cleanly into open gaps:
${JSON.stringify(unscheduledHabits, null, 2)}`,
        config: {
          systemInstruction:
            'You are an executive academic & routine scheduler. Place every unscheduled habit into a conflict-free slot within wake/sleep hours, leaving small recovery buffers around college classes.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rationale: { type: Type.STRING },
              newBlocks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    linkedHabitId: { type: Type.STRING },
                    title: { type: Type.STRING },
                    startTime: { type: Type.STRING },
                    endTime: { type: Type.STRING },
                    category: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    notes: { type: Type.STRING },
                  },
                  required: ['linkedHabitId', 'title', 'startTime', 'endTime'],
                },
              },
            },
            required: ['rationale', 'newBlocks'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{"rationale":"","newBlocks":[]}');
      res.json(parsed);
    } catch (error: any) {
      console.error('Auto-plan error:', error);
      res.status(error?.status || 500).json({
        error: error?.message || 'Failed to auto-plan schedule.',
      });
    }
  });

  // Live Web Search Grounding for Hackathons & Public Speaking Competitions
  app.post('/api/assistant/discover-events', async (req, res) => {
    try {
      const { focus = 'all', query: customQuery, todayDate, college } = req.body as {
        focus?: 'all' | 'hackathon' | 'public_speaking';
        query?: string;
        todayDate?: string;
        college?: string;
      };
      const safeTodayDate =
        typeof todayDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(todayDate)
          ? todayDate
          : new Date().toISOString().slice(0, 10);

      // Try Gemini Google Search Grounding first when available
      if (process.env.GEMINI_API_KEY) {
        try {
          const ai = getAiClient();
          const focusQuery = customQuery?.trim()
            ? `${customQuery.trim()} (${focus === 'all' ? 'hackathons and public speaking competitions' : focus})`
            : focus === 'hackathon'
            ? 'upcoming student coding hackathons in India, Gujarat, Devfolio, Smart India Hackathon, Unstop, and MLH'
            : focus === 'public_speaking'
            ? 'upcoming public speaking, debate, Model UN (MUN), TEDx youth, and Toastmasters competitions in India and online for college students'
            : 'upcoming student hackathons (Devfolio, SIH, Unstop, Gujarat/India) AND public speaking, debate, or MUN competitions for first-year IT engineering students in India';

          const searchResponse = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: `Today is ${safeTodayDate}. Search the live web for ${focusQuery}.
Context: First-year B.E. Information Technology student at ${
              college || 'V.V.P. Engineering College, Rajkot, Gujarat'
            }.
Find 5 to 6 real, current or upcoming competitions/events with dates or registration windows, organizers, location/online mode, and official URLs if found.`,
            config: {
              tools: [{ googleSearch: {} }],
            },
          });

          const groundedText = searchResponse.text || '';
          const sources = extractGroundingLinks(searchResponse);

          const structuredResponse = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: `Today's date is ${safeTodayDate}. Convert the following web-search findings into structured event opportunity cards. Only include events from the search findings below, and map matching source URLs accurately. Set suggestedDateISO to a valid YYYY-MM-DD preparation/event date in the near future (between ${safeTodayDate} and 45 days ahead).

Search findings:
${groundedText}

Source URLs:
${JSON.stringify(sources)}`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  opportunities: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        type: {
                          type: Type.STRING,
                          description: 'hackathon or public_speaking',
                        },
                        organizer: { type: Type.STRING },
                        dateLabel: { type: Type.STRING },
                        suggestedDateISO: {
                          type: Type.STRING,
                          description: 'YYYY-MM-DD',
                        },
                        locationOrMode: { type: Type.STRING },
                        summary: { type: Type.STRING },
                        url: { type: Type.STRING },
                        prepTip: { type: Type.STRING },
                      },
                      required: [
                        'title',
                        'type',
                        'organizer',
                        'dateLabel',
                        'suggestedDateISO',
                        'locationOrMode',
                        'summary',
                        'prepTip',
                      ],
                    },
                  },
                },
                required: ['opportunities'],
              },
            },
          });

          const parsed = JSON.parse(
            structuredResponse.text || '{"opportunities":[]}'
          );
          const opportunities = Array.isArray(parsed.opportunities)
            ? parsed.opportunities.map((o: any, idx: number) => ({
                id: `opp-${Date.now()}-${idx}`,
                ...o,
                type:
                  o.type === 'public_speaking' ? 'public_speaking' : 'hackathon',
              }))
            : [];

          if (opportunities.length > 0) {
            return res.json({
              opportunities,
              sources,
            });
          }
        } catch (geminiErr: any) {
          console.warn(
            'Gemini web grounding unavailable, falling back to live HTTP web search:',
            geminiErr?.message || geminiErr
          );
        }
      }

      // Live HTTP Web Search (Devpost Public API + Google News India RSS)
      const liveResults = await fetchLiveWebEvents(focus, customQuery, safeTodayDate);
      if (liveResults.opportunities.length === 0) {
        return res.status(502).json({
          error:
            'No live events returned from web sources for this query. Try broadening your search keywords.',
        });
      }

      res.json({
        opportunities: liveResults.opportunities,
        sources: liveResults.sources,
      });
    } catch (error: any) {
      console.error('Discover events error:', error);
      res.status(error?.status || 500).json({
        error:
          error?.message ||
          'Failed to search the web for competitions and hackathons.',
      });
    }
  });

  // Google Maps Grounding Endpoint (gemini-4-hydrogen + googleMaps tool)
  app.post('/api/assistant/maps-scout', async (req, res) => {
    try {
      const { query, coords, college } = req.body as {
        query?: string;
        coords?: { latitude: number; longitude: number } | null;
        college?: string;
      };

      const cleanQuery =
        query?.trim() ||
        'quiet study libraries, coding cafes, and public speaking meetup venues near V.V.P. Engineering College, Rajkot';
      const activeCoords =
        coords && Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)
          ? coords
          : { latitude: 22.2683, longitude: 70.7429 };

      if (process.env.GEMINI_API_KEY) {
        try {
          const ai = getAiClient();
          const response = await ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: `Context: Student at ${
              college || 'V.V.P. Engineering College, Rajkot, Gujarat'
            }. Find real places on Google Maps for: ${cleanQuery}. Summarize practical travel notes, quietness/Wi-Fi suitability, and study hours cleanly in Markdown.`,
            config: {
              tools: [{ googleMaps: {} }],
              toolConfig: {
                retrievalConfig: {
                  latLng: activeCoords,
                },
              },
            },
          });

          const links = extractGroundingLinks(response).filter(
            (l) => l.kind === 'maps' || l.uri.includes('google.com/maps')
          );

          if ((response.text && response.text.trim()) || links.length > 0) {
            return res.json({
              summary:
                response.text ||
                'Found nearby study and competition locations grounded on Google Maps.',
              places: links,
              coords: activeCoords,
              engine: 'Gemini 4 Hydrogen · Google Maps Grounding',
            });
          }
        } catch (mapsErr: any) {
          console.warn(
            'Gemini Maps Grounding unavailable, returning offline campus atlas:',
            mapsErr?.message || mapsErr
          );
        }
      }

      // Curated Offline / Fallback Rajkot & V.V.P. Campus Maps Directory
      const fallbackPlaces: GroundingLink[] = [
        {
          title: 'V.V.P. Engineering College — Central Library & IT Block',
          uri: 'https://www.google.com/maps/search/?api=1&query=VVP+Engineering+College+Vajdi+Virda+Rajkot',
          kind: 'maps',
          snippet: 'On campus · Kalawad Rd · Quiet reading hall & engineering labs',
        },
        {
          title: 'Saurashtra University / Kalawad Road Study Reading Rooms',
          uri: 'https://www.google.com/maps/search/?api=1&query=Library+near+Kalawad+Road+Rajkot',
          kind: 'maps',
          snippet: '~6 km along Kalawad Road · Focused exam & GTU prep zones',
        },
        {
          title: '150 Feet Ring Road Coding & Hackathon Study Cafes',
          uri: 'https://www.google.com/maps/search/?api=1&query=Cafes+150+Feet+Ring+Road+Rajkot',
          kind: 'maps',
          snippet: '~8 km West · Laptop outlets & weekend sprint space',
        },
        {
          title: 'Race Course / Kalawad Road Auditorium & Toastmasters Venues',
          uri: 'https://www.google.com/maps/search/?api=1&query=Race+Course+Auditorium+Rajkot',
          kind: 'maps',
          snippet: '~8.5 km · Public speaking, MUN & youth debate venues',
        },
      ];

      res.json({
        summary: `Offline Campus Atlas results around Rajkot (${activeCoords.latitude.toFixed(
          3
        )}, ${activeCoords.longitude.toFixed(
          3
        )}) for "${cleanQuery}". Tap any link below to open Google Maps directions.`,
        places: fallbackPlaces,
        coords: activeCoords,
        engine: 'Offline Campus Atlas',
      });
    } catch (error: any) {
      console.error('Maps scout error:', error);
      res.status(500).json({
        error: error?.message || 'Unable to query nearby study locations.',
      });
    }
  });

  const httpServer = http.createServer(app);
  const distPath = path.resolve(__dirname, 'dist');
  const distIndexPath = path.join(distPath, 'index.html');
  const runningViaTsx =
    process.execArgv.some((arg) => arg.includes('tsx')) ||
    process.env.npm_lifecycle_event === 'dev';
  const useProductionStatic =
    process.env.NODE_ENV === 'production' ||
    (!runningViaTsx && fs.existsSync(distIndexPath));

  if (!useProductionStatic) {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: hmrDisabled ? false : { server: httpServer },
        hmr: hmrDisabled ? false : { server: httpServer },
        watch: hmrDisabled ? null : {},
      },
      appType: 'spa',
    });

    if (hmrDisabled) {
      app.use('/@vite/client', (req, res, next) => {
        delete req.headers['accept-encoding'];
        delete req.headers['if-none-match'];
        delete req.headers['if-modified-since'];
        const chunks: Buffer[] = [];
        const origEnd = res.end.bind(res);
        res.write = ((chunk: any) => {
          if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          return true;
        }) as any;
        res.end = ((chunk?: any, encoding?: any, cb?: any) => {
          if (chunk && typeof chunk !== 'function') {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          let body = Buffer.concat(chunks).toString('utf8');
          if (body.includes('wsTransport.connect')) {
            body = body
              .replace(/await wsTransport\.connect\(handlers\);/g, 'return;')
              .replace(/\b(ws|socket)\.send\(/g, '$1?.send(')
              .replace(
                /new WebSocket\(([^)]*)\)/g,
                '({ readyState: 3, close() {}, addEventListener() {}, removeEventListener() {}, send() {} })'
              );
            res.removeHeader('Content-Length');
            res.removeHeader('ETag');
            res.setHeader('Content-Length', Buffer.byteLength(body, 'utf8'));
            res.setHeader('Cache-Control', 'no-store');
          }
          if (typeof encoding === 'function') {
            return origEnd(body, encoding);
          }
          return origEnd(body, encoding || 'utf8', cb);
        }) as any;
        next();
      });
    }

    app.use(vite.middlewares);
  } else {
    app.use(
      express.static(distPath, {
        index: 'index.html',
        setHeaders: (res, filePath) => {
          const base = path.basename(filePath);
          if (
            base === 'index.html' ||
            base === 'sw.js' ||
            base === 'manifest.webmanifest'
          ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );

    app.get('*', (req, res) => {
      if (
        req.path.startsWith('/api/') ||
        req.path.startsWith('/assets/') ||
        Boolean(path.extname(req.path))
      ) {
        return res.status(404).end();
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.sendFile(distIndexPath);
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Meridian server listening on http://localhost:${PORT}`);
  });
}

startServer();
