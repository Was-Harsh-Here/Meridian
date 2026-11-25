import { AlarmItem, CalendarEvent } from '../types';

function toICSDateTime(dateISO: string, timeHHMM: string): string {
  const cleanDate = dateISO.replace(/-/g, '');
  const cleanTime = timeHHMM.replace(/:/g, '');
  return `${cleanDate}T${cleanTime}00`;
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function triggerDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports one or more CalendarEvents to an RFC 5545 .ics file
 * compatible with Apple Calendar (macOS / iOS) including native VALARM reminders.
 */
export function exportEventsToAppleCalendarICS(
  events: CalendarEvent[],
  filename = 'meridian-apple-calendar.ics'
) {
  const nowStamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Meridian//Routine & Habit OS//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Meridian Routine',
  ];

  for (const ev of events) {
    const alarmMins = ev.alarmMinutesBefore ?? 10;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.id}@meridian.local`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART:${toICSDateTime(ev.date, ev.startTime)}`,
      `DTEND:${toICSDateTime(ev.date, ev.endTime)}`,
      `SUMMARY:${escapeICS(ev.title)}`,
      `CATEGORIES:${escapeICS(ev.category)}`,
      `DESCRIPTION:${escapeICS(ev.notes || `Category: ${ev.category} | Priority: ${ev.priority}`)}`,
      'BEGIN:VALARM',
      `TRIGGER:-PT${alarmMins}M`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeICS(`Upcoming: ${ev.title}`)}`,
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  triggerDownload(filename, lines.join('\r\n'));
}

/**
 * Exports active alarms & uncompleted blocks as VTODO tasks with VALARM
 * for Apple Reminders import.
 */
export function exportToAppleRemindersICS(
  events: CalendarEvent[],
  alarms: AlarmItem[],
  todayISO: string
) {
  const nowStamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Meridian//Reminders Export//EN',
  ];

  for (const ev of events.filter((e) => !e.completed)) {
    lines.push(
      'BEGIN:VTODO',
      `UID:todo-${ev.id}@meridian.local`,
      `DTSTAMP:${nowStamp}`,
      `DUE:${toICSDateTime(ev.date, ev.startTime)}`,
      `SUMMARY:${escapeICS(ev.title)}`,
      `PRIORITY:${ev.priority === 'high' ? 1 : ev.priority === 'medium' ? 5 : 9}`,
      'STATUS:NEEDS-ACTION',
      'BEGIN:VALARM',
      `TRIGGER;VALUE=DATE-TIME:${toICSDateTime(ev.date, ev.startTime)}`,
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeICS(ev.title)}`,
      'END:VALARM',
      'END:VTODO'
    );
  }

  for (const alm of alarms.filter((a) => a.enabled)) {
    lines.push(
      'BEGIN:VTODO',
      `UID:alarm-${alm.id}@meridian.local`,
      `DTSTAMP:${nowStamp}`,
      `DUE:${toICSDateTime(todayISO, alm.time)}`,
      `SUMMARY:${escapeICS(`Alarm: ${alm.label}`)}`,
      'STATUS:NEEDS-ACTION',
      'BEGIN:VALARM',
      `TRIGGER;VALUE=DATE-TIME:${toICSDateTime(todayISO, alm.time)}`,
      'ACTION:AUDIO',
      `DESCRIPTION:${escapeICS(alm.label)}`,
      'END:VALARM',
      'END:VTODO'
    );
  }

  lines.push('END:VCALENDAR');
  triggerDownload('meridian-apple-reminders.ics', lines.join('\r\n'));
}
