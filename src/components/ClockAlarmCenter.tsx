import React, { useEffect, useRef, useState } from 'react';
import {
  AlarmClock,
  Bell,
  BellRing,
  Headphones,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  Waves,
} from 'lucide-react';
import { AlarmItem, AnimeSfxId, CalendarEvent } from '../types';
import {
  ANIME_SFX_OPTIONS,
  SOUNDSCAPE_PRESETS,
  SoundscapeEngine,
  SoundscapePresetId,
  getSharedSfxContext,
  playAnimeNotificationSfx,
} from '../services/soundscapeEngine';

interface ClockAlarmCenterProps {
  alarms: AlarmItem[];
  todaysEvents: CalendarEvent[];
  notificationSfx: AnimeSfxId;
  onChangeNotificationSfx: (sfx: AnimeSfxId) => void;
  onAddAlarm: (alarm: Omit<AlarmItem, 'id'>) => void;
  onToggleAlarm: (id: string) => void;
  onDeleteAlarm: (id: string) => void;
  onCompleteFocusSession: (minutes: number) => void;
  onAlarmTriggered?: (alarm: AlarmItem) => void;
}

export function playAlarmTone(soundType: AlarmItem['soundType'] = 'chime') {
  try {
    const ctx = getSharedSfxContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes =
      soundType === 'bell'
        ? [659.25, 880, 659.25, 880]
        : soundType === 'pulse'
        ? [523.25, 523.25, 783.99]
        : [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = soundType === 'pulse' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.22);
      gain.gain.setValueAtTime(0.001, now + idx * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.16, now + idx * 0.22 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.22 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.22);
      osc.stop(now + idx * 0.22 + 0.3);
    });
  } catch {
    // Audio playback blocked before interaction
  }
}

export const ClockAlarmCenter: React.FC<ClockAlarmCenterProps> = ({
  alarms,
  todaysEvents,
  notificationSfx,
  onChangeNotificationSfx,
  onAddAlarm,
  onToggleAlarm,
  onDeleteAlarm,
  onCompleteFocusSession,
  onAlarmTriggered,
}) => {
  const [now, setNow] = useState(() => new Date());
  const [newLabel, setNewLabel] = useState('');
  const [newTime, setNewTime] = useState('07:00');
  const [newRepeat, setNewRepeat] = useState<AlarmItem['repeat']>('daily');
  const [notifStatus, setNotifStatus] = useState<string>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  // Pomodoro Timer
  const [presetMinutes, setPresetMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);

  // Background Soundscape Player (Binaural Beats & Acoustic Noise)
  const engineRef = useRef<SoundscapeEngine | null>(null);
  const [soundPreset, setSoundPreset] =
    useState<SoundscapePresetId>('binaural_gamma');
  const [soundPlaying, setSoundPlaying] = useState(false);
  const [soundVolume, setSoundVolume] = useState(45);
  const [syncWithSprint, setSyncWithSprint] = useState(true);

  // Active Ringing Alarm
  const [ringingAlarm, setRingingAlarm] = useState<AlarmItem | null>(null);
  const triggeredMinuteRef = useRef<string>('');

  useEffect(() => {
    const engine = new SoundscapeEngine();
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const current = new Date();
      setNow(current);

      const hh = String(current.getHours()).padStart(2, '0');
      const mm = String(current.getMinutes()).padStart(2, '0');
      const hhmm = `${hh}:${mm}`;
      const stampKey = `${current.toDateString()}-${hhmm}`;

      if (triggeredMinuteRef.current !== stampKey) {
        const match = alarms.find((a) => a.enabled && a.time === hhmm);
        if (match) {
          triggeredMinuteRef.current = stampKey;
          setRingingAlarm(match);
          playAlarmTone(match.soundType);
          onAlarmTriggered?.(match);
          if (
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted'
          ) {
            new Notification('Meridian Alarm', {
              body: `${match.label} (${match.time})`,
            });
          }
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [alarms, onAlarmTriggered]);

  useEffect(() => {
    if (!timerRunning) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [timerRunning]);

  useEffect(() => {
    if (timerRunning && secondsLeft === 0) {
      setTimerRunning(false);
      setSecondsLeft(presetMinutes * 60);
      if (syncWithSprint && engineRef.current) {
        engineRef.current.stop();
        setSoundPlaying(false);
      }
      playAnimeNotificationSfx(notificationSfx, 0.72);
      onCompleteFocusSession(presetMinutes);
    }
  }, [
    timerRunning,
    secondsLeft,
    presetMinutes,
    syncWithSprint,
    notificationSfx,
    onCompleteFocusSession,
  ]);

  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;

  const nextUpcomingEvent = todaysEvents
    .filter((e) => !e.completed && e.startTime >= currentHHMM)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];

  const handleRequestNotifications = async () => {
    if (typeof Notification === 'undefined') return;
    const perm = await Notification.requestPermission();
    setNotifStatus(perm);
  };

  const handleCreateAlarm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    onAddAlarm({
      label: newLabel.trim(),
      time: newTime,
      enabled: true,
      repeat: newRepeat,
      soundType: 'chime',
    });
    setNewLabel('');
  };

  const handleToggleSoundscape = () => {
    const engine = engineRef.current;
    if (!engine) return;
    if (soundPlaying) {
      engine.stop();
      setSoundPlaying(false);
    } else {
      engine.start(soundPreset, soundVolume / 100);
      setSoundPlaying(true);
    }
  };

  const handleSelectSoundPreset = (id: SoundscapePresetId) => {
    setSoundPreset(id);
    if (soundPlaying && engineRef.current) {
      engineRef.current.start(id, soundVolume / 100);
    }
  };

  const handleVolumeChange = (val: number) => {
    setSoundVolume(val);
    engineRef.current?.setVolume(val / 100);
  };

  const handleToggleSprint = () => {
    const nextRunning = !timerRunning;
    setTimerRunning(nextRunning);
    if (syncWithSprint && engineRef.current) {
      if (nextRunning && !soundPlaying) {
        engineRef.current.start(soundPreset, soundVolume / 100);
        setSoundPlaying(true);
      } else if (!nextRunning && soundPlaying) {
        engineRef.current.stop();
        setSoundPlaying(false);
      }
    }
  };

  const handleResetSprint = () => {
    setTimerRunning(false);
    setSecondsLeft(presetMinutes * 60);
    if (syncWithSprint && soundPlaying && engineRef.current) {
      engineRef.current.stop();
      setSoundPlaying(false);
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const activePresetMeta =
    SOUNDSCAPE_PRESETS.find((p) => p.id === soundPreset) || SOUNDSCAPE_PRESETS[0];

  const sprintPct = Math.round(
    ((presetMinutes * 60 - secondsLeft) / Math.max(1, presetMinutes * 60)) * 100
  );

  return (
    <div className="space-y-6">
      {/* Live Clock + Focus Timer Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Live Clock & Next Block (5 cols) */}
        <section className="lg:col-span-5 sl-panel sl-reticle p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-blue-700 dark:text-sky-400 font-semibold">
                [ LOCAL CAMPUS CLOCK ]
              </span>
              <div className="text-4xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums mt-1.5 tracking-tight">
                {now.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
                })}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {now.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            {notifStatus !== 'granted' && notifStatus !== 'unsupported' && (
              <button
                type="button"
                onClick={handleRequestNotifications}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-semibold text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-sky-500/35 bg-blue-50/80 dark:bg-sky-950/60 hover:bg-blue-100 dark:hover:bg-sky-900/60 rounded transition-colors cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5" />
                Enable Alerts
              </button>
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-sky-500/20">
            {nextUpcomingEvent ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Next Scheduled Gate
                  </span>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {nextUpcomingEvent.title}
                  </p>
                </div>
                <span className="text-sm font-mono font-bold text-blue-700 dark:text-sky-400 tabular-nums shrink-0">
                  {nextUpcomingEvent.startTime}
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No remaining scheduled blocks for today.
              </p>
            )}
          </div>
        </section>

        {/* Gamified Focus Pomodoro Sprint (7 cols) */}
        <section className="lg:col-span-7 sl-panel sl-reticle p-5 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-blue-700 dark:text-sky-400 font-semibold">
                [ TIMED FOCUS SESSION ]
              </span>
              <div className="flex items-baseline gap-3 mt-1.5">
                <div className="text-4xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatTimer(secondsLeft)}
                </div>
                {soundPlaying && (
                  <span className="text-[11px] font-mono text-emerald-700 dark:text-sky-300 tabular-nums">
                    · Audio: {activePresetMeta.specLabel}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/20 rounded">
              {[15, 25, 50].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    setTimerRunning(false);
                    setPresetMinutes(mins);
                    setSecondsLeft(mins * 60);
                    if (syncWithSprint && soundPlaying && engineRef.current) {
                      engineRef.current.stop();
                      setSoundPlaying(false);
                    }
                  }}
                  className={`px-2.5 py-1.5 min-h-[34px] text-xs font-mono font-semibold rounded transition-colors cursor-pointer ${
                    presetMinutes === mins
                      ? 'bg-white dark:bg-sky-600 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          {/* Focus Progress Track */}
          <div className="h-2 w-full bg-slate-100 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/20 rounded-xs overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-500"
              style={{ width: `${Math.max(2, sprintPct)}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={syncWithSprint}
                onChange={(e) => setSyncWithSprint(e.target.checked)}
                className="rounded border-slate-300 dark:border-sky-500/40 accent-blue-600 dark:accent-sky-500 w-4 h-4 cursor-pointer"
              />
              <span>Auto-play soundscape during focus session</span>
            </label>

            <div className="flex items-center gap-2 ml-auto">
              <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mr-1">
                +35 XP · +15c
              </span>
              <button
                type="button"
                onClick={handleResetSprint}
                aria-label="Reset focus timer"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center border border-slate-200 dark:border-sky-500/25 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleToggleSprint}
                className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-xs font-bold uppercase tracking-wider font-display text-white bg-blue-700 dark:bg-sky-600 hover:bg-blue-800 dark:hover:bg-sky-500 rounded transition-colors cursor-pointer"
              >
                {timerRunning ? (
                  <>
                    <Pause className="w-3.5 h-3.5" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    Start Focus
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Offline Web Audio Soundscape Deck for Deep Academic Work */}
      <section
        aria-label="Deep Academic Soundscape Player"
        className="sl-panel sl-reticle p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-sky-500/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sl-chamfer bg-slate-900 dark:bg-sky-500/15 border border-slate-800 dark:border-sky-400/50 text-white dark:text-sky-300 flex items-center justify-center shrink-0">
              <Headphones className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-blue-700 dark:text-sky-400 font-semibold">
                  [ FOCUS AUDIO SYNTHESIS · OFFLINE READY ]
                </span>
              </div>
              <h3 className="font-display text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100 leading-tight">
                Deep Work Soundscape Deck
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 min-w-[150px]">
              <Volume2 className="w-4 h-4 text-slate-500 dark:text-sky-400 shrink-0" />
              <input
                type="range"
                min={5}
                max={100}
                value={soundVolume}
                aria-label="Soundscape volume"
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-24 sm:w-28 accent-blue-600 dark:accent-sky-400 cursor-pointer"
              />
              <span className="text-xs font-mono text-slate-600 dark:text-slate-300 tabular-nums w-8 text-right">
                {soundVolume}%
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleSoundscape}
              className={`inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs font-bold uppercase tracking-wider font-display rounded transition-colors cursor-pointer ${
                soundPlaying
                  ? 'bg-emerald-600 dark:bg-sky-500 text-white hover:bg-emerald-700 dark:hover:bg-sky-400'
                  : 'bg-slate-900 dark:bg-sky-950/80 border border-slate-800 dark:border-sky-400/50 text-white dark:text-sky-300 hover:bg-blue-700 dark:hover:bg-sky-900'
              }`}
            >
              {soundPlaying ? (
                <>
                  <Square className="w-3.5 h-3.5" />
                  Stop Audio
                </>
              ) : (
                <>
                  <Waves className="w-3.5 h-3.5" />
                  Play {activePresetMeta.specLabel}
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {SOUNDSCAPE_PRESETS.map((preset) => {
            const selected = soundPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectSoundPreset(preset.id)}
                className={`text-left p-3 rounded border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  selected
                    ? 'border-blue-600 dark:border-sky-400 bg-blue-50/70 dark:bg-sky-950/50 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#050811] hover:border-slate-300 dark:hover:border-sky-500/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                      selected
                        ? 'text-blue-700 dark:text-sky-300'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {preset.specLabel}
                  </span>
                  {selected && soundPlaying && (
                    <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                      Active
                    </span>
                  )}
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {preset.name}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                    {preset.subtitle}
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                  {preset.recommendedFor}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Anime Notification SFX Triggers */}
      <section
        aria-label="Anime Notification Sound Effects"
        className="sl-panel sl-reticle p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-sky-500/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sl-chamfer bg-slate-900 dark:bg-sky-500/15 border border-slate-800 dark:border-sky-400/50 text-white dark:text-sky-300 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-blue-700 dark:text-sky-400 font-semibold block">
                [ COMPLETION TRIGGERS · ANIME SFX ]
              </span>
              <h3 className="font-display text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100 leading-tight">
                Notification Sound Effects
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Plays automatically when habits are completed, quests clear, or a focus sprint finishes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => playAnimeNotificationSfx(notificationSfx, 0.72)}
            disabled={notificationSfx === 'silent'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] text-xs font-semibold text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-sky-500/35 bg-blue-50/70 dark:bg-sky-950/50 hover:bg-blue-100 dark:hover:bg-sky-900/50 disabled:opacity-45 rounded transition-colors cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            Preview Selected
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {ANIME_SFX_OPTIONS.map((opt) => {
            const active = notificationSfx === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChangeNotificationSfx(opt.id);
                  playAnimeNotificationSfx(opt.id, 0.72);
                }}
                className={`text-left p-3 rounded border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                  active
                    ? 'border-blue-600 dark:border-sky-400 bg-blue-50/70 dark:bg-sky-950/50 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-[#050811] hover:border-slate-300 dark:hover:border-sky-500/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                      active
                        ? 'text-blue-700 dark:text-sky-300'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {opt.vibe}
                  </span>
                  {active && (
                    <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                      Equipped
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {opt.name}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  {opt.description}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Alarms & Cue Reminders */}
      <section className="sl-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <AlarmClock className="w-4 h-4 text-blue-700 dark:text-sky-400" />
            <div>
              <h3 className="font-display text-base font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Routine Alarms &amp; Audio Cues
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live clock triggers sound chimes and desktop alerts—also exportable to Apple Reminders
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => playAlarmTone('chime')}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-sky-500/25 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            Test Chime
          </button>
        </div>

        <form
          onSubmit={handleCreateAlarm}
          className="grid grid-cols-1 sm:grid-cols-[1fr_130px_130px_auto] gap-3 mb-4"
        >
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Alarm label (e.g. DSA Lab Prep or Debate Warmup)..."
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/25 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <input
            type="time"
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/25 rounded text-slate-900 dark:text-slate-100"
          />
          <select
            value={newRepeat}
            onChange={(e) =>
              setNewRepeat(e.target.value as AlarmItem['repeat'])
            }
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/25 rounded text-slate-900 dark:text-slate-100"
          >
            <option value="daily">Daily</option>
            <option value="weekdays">Weekdays</option>
            <option value="once">Once</option>
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[38px] text-xs font-bold uppercase tracking-wider font-display text-white bg-slate-900 dark:bg-sky-600 hover:bg-blue-700 dark:hover:bg-sky-500 rounded transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Set Alarm
          </button>
        </form>

        <div className="divide-y divide-slate-100 dark:divide-sky-500/15">
          {alarms.map((alm) => (
            <div
              key={alm.id}
              className="py-3 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className="text-lg font-bold font-mono text-slate-900 dark:text-sky-300 tabular-nums">
                  {alm.time}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {alm.label}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                    {alm.repeat} · {alm.soundType} tone
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleAlarm(alm.id)}
                  aria-label={`Toggle alarm ${alm.label}`}
                  className={`px-3 py-1.5 min-h-[36px] text-xs font-mono font-semibold rounded transition-colors cursor-pointer ${
                    alm.enabled
                      ? 'bg-emerald-600 dark:bg-sky-600 text-white hover:bg-emerald-700 dark:hover:bg-sky-500'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {alm.enabled ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteAlarm(alm.id)}
                  aria-label={`Delete alarm ${alm.label}`}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Ringing Alarm Modal */}
      {ringingAlarm && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="sl-panel sl-reticle p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 sl-chamfer bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto">
              <BellRing className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-mono text-slate-500 dark:text-sky-400 tabular-nums">
                [ SYSTEM ALARM · {ringingAlarm.time} ]
              </p>
              <h4 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {ringingAlarm.label}
              </h4>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const [h, m] = ringingAlarm.time.split(':').map(Number);
                  const t = h * 60 + m + 5;
                  const snoozed = `${String(Math.floor(t / 60) % 24).padStart(
                    2,
                    '0'
                  )}:${String(t % 60).padStart(2, '0')}`;
                  onAddAlarm({
                    label: `${ringingAlarm.label} (Snoozed)`,
                    time: snoozed,
                    enabled: true,
                    repeat: 'once',
                    soundType: ringingAlarm.soundType,
                  });
                  setRingingAlarm(null);
                }}
                className="px-4 py-2 min-h-[40px] text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded cursor-pointer"
              >
                Snooze 5m
              </button>
              <button
                type="button"
                onClick={() => setRingingAlarm(null)}
                className="px-4 py-2 min-h-[40px] text-xs font-bold uppercase tracking-wider font-display text-white bg-blue-700 dark:bg-sky-600 hover:bg-blue-800 dark:hover:bg-sky-500 rounded cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
