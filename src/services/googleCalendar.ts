import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { CalendarEvent } from '../types';

export const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

let isSigningIn = false;
// Access token strictly cached in memory only (never localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: (user: User | null) => void
) => {
  return onAuthStateChanged(auth, (user) => {
    if (user && cachedAccessToken) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      if (!user) {
        cachedAccessToken = null;
      }
      onAuthFailure?.(user);
    }
  });
};

export const signInWithGoogleCalendar = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain Google Calendar access token.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
};

export const signOutGoogleCalendar = async () => {
  cachedAccessToken = null;
  await auth.signOut();
};

export const getCachedGoogleToken = (): string | null => cachedAccessToken;

export async function fetchGoogleCalendarEvents(
  accessToken: string,
  startDateISO: string,
  endDateISO: string
): Promise<CalendarEvent[]> {
  const timeMin = new Date(`${startDateISO}T00:00:00`).toISOString();
  const timeMax = new Date(`${endDateISO}T23:59:59`).toISOString();

  const url = new URL(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events'
  );
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message || `Google Calendar API error (${res.status})`
    );
  }

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];

  return items
    .filter((item: any) => item.start?.dateTime && item.end?.dateTime)
    .map((item: any) => {
      const startDt = new Date(item.start.dateTime);
      const endDt = new Date(item.end.dateTime);
      const pad = (n: number) => String(n).padStart(2, '0');
      const date = `${startDt.getFullYear()}-${pad(
        startDt.getMonth() + 1
      )}-${pad(startDt.getDate())}`;
      const startTime = `${pad(startDt.getHours())}:${pad(
        startDt.getMinutes()
      )}`;
      const endTime = `${pad(endDt.getHours())}:${pad(endDt.getMinutes())}`;

      return {
        id: `gcal-${item.id}`,
        googleEventId: item.id,
        title: item.summary || 'Google Calendar Event',
        date,
        startTime,
        endTime,
        category: 'Academics',
        completed: false,
        priority: 'medium',
        notes: item.description || undefined,
        source: 'google' as const,
      };
    });
}

export async function pushEventToGoogleCalendar(
  accessToken: string,
  event: CalendarEvent
): Promise<string> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  const startDateTime = new Date(`${event.date}T${event.startTime}:00`).toISOString();
  const endDateTime = new Date(`${event.date}T${event.endTime}:00`).toISOString();

  const body = {
    summary: event.title,
    description: event.notes
      ? `${event.notes}\n\n[Managed by Meridian]`
      : `[${event.category} · Managed by Meridian]`,
    start: {
      dateTime: startDateTime,
      timeZone,
    },
    end: {
      dateTime: endDateTime,
      timeZone,
    },
    reminders: {
      useDefault: false,
      overrides: [
        {
          method: 'popup',
          minutes: event.alarmMinutesBefore ?? 10,
        },
      ],
    },
  };

  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message || `Failed to push event (${res.status})`
    );
  }

  const created = await res.json();
  return created.id;
}
