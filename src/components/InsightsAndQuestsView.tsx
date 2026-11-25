import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  Check,
  Coins,
  Cpu,
  RotateCcw,
  Search,
  Shield,
  Sliders,
  Trash2,
  Volume2,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AnimeSfxId, AppState, Quest, UserPreferences } from '../types';
import {
  ACHIEVEMENTS,
  addDaysISO,
  build30DayAnalytics,
  computeCategoryMastery,
} from '../data/initialData';
import { CategorySkillBar, QuestProgressCard } from './GamifiedBars';
import { OllamaConfig } from '../services/offlineAiEngine';
import {
  ANIME_SFX_OPTIONS,
  playAnimeNotificationSfx,
} from '../services/soundscapeEngine';

interface InsightsAndQuestsViewProps {
  state: AppState;
  quests: Quest[];
  todayDate: string;
  ollamaConfig: OllamaConfig;
  onClaimQuest: (questId: string) => void;
  onBuyStreakShield: () => void;
  onActivateDoubleXp: () => void;
  onUpdatePreferences: (prefs: UserPreferences) => void;
  onUpdateOllamaConfig: (cfg: OllamaConfig) => void;
  onClearSystemLogs: () => void;
  onRunOverduePenaltyAudit: () => void;
  onResetDemo: () => void;
}

export const InsightsAndQuestsView: React.FC<InsightsAndQuestsViewProps> = ({
  state,
  quests,
  todayDate,
  ollamaConfig,
  onClaimQuest,
  onBuyStreakShield,
  onActivateDoubleXp,
  onUpdatePreferences,
  onUpdateOllamaConfig,
  onClearSystemLogs,
  onRunOverduePenaltyAudit,
  onResetDemo,
}) => {
  const [formPrefs, setFormPrefs] = useState<UserPreferences>(state.preferences);
  const [ollamaForm, setOllamaForm] = useState<OllamaConfig>(ollamaConfig);
  const [savedNotice, setSavedNotice] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'gains' | 'penalties' | 'focus'>('all');
  const [logSearch, setLogSearch] = useState('');

  useEffect(() => {
    setFormPrefs(state.preferences);
  }, [state.preferences]);

  useEffect(() => {
    setOllamaForm(ollamaConfig);
  }, [ollamaConfig]);

  const mastery = computeCategoryMastery(state.habits);
  const last7Days = Array.from({ length: 7 }, (_, i) =>
    addDaysISO(todayDate, i - 6)
  );
  const analyticsData = useMemo(
    () => build30DayAnalytics(state, todayDate),
    [state, todayDate]
  );

  const avg30Completion = Math.round(
    analyticsData.reduce((s, p) => s + p.completionRate, 0) /
      Math.max(1, analyticsData.length)
  );
  const total30Xp = analyticsData.reduce((s, p) => s + p.xpEarned, 0);

  const isDark = state.theme === 'dark';
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const tickColor = isDark ? '#94a3b8' : '#64748b';

  const handleSavePrefs = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePreferences(formPrefs);
    onUpdateOllamaConfig(ollamaForm);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const doubleXpActive = Boolean(
    state.doubleXpActiveUntil && Date.now() < state.doubleXpActiveUntil
  );

  return (
    <div className="space-y-6">
      {/* Recharts 30-Day Analytics Section */}
      <section
        aria-label="Analytics"
        className="sl-panel sl-reticle p-5 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-4 h-4 text-blue-700 dark:text-sky-400" />
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-blue-700 dark:text-sky-400 font-semibold block">
                [ TELEMETRY · 30-DAY ANALYTICS ]
              </span>
              <h3 className="font-display text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100">
                Analytics — 30-Day Performance
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Daily habit completion trend and XP accumulation across the last 30 days
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
            <span className="text-slate-600 dark:text-slate-300">
              30d Avg:{' '}
              <strong className="text-sky-600 dark:text-sky-400">
                {avg30Completion}%
              </strong>
            </span>
            <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
              |
            </span>
            <span className="text-slate-600 dark:text-slate-300">
              30d XP:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400">
                {total30Xp.toLocaleString()}
              </strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Habit Completion Rate LineChart */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/40 dark:bg-[#070B14]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Habit Completion Trend (%)
              </h4>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Last 30 Days
              </span>
            </div>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: tickColor, fontSize: 10 }}
                    interval={4}
                    stroke={gridStroke}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: tickColor, fontSize: 10 }}
                    stroke={gridStroke}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0C1222' : '#ffffff',
                      borderColor: isDark ? '#38bdf8' : '#cbd5e1',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                    }}
                    formatter={(value) => [`${value ?? 0}%`, 'Completion']}
                  />
                  <Line
                    type="monotone"
                    dataKey="completionRate"
                    stroke={isDark ? '#38bdf8' : '#2563eb'}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 30-Day XP Accumulation BarChart */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/40 dark:bg-[#070B14]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Daily XP Accumulation
              </h4>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                Last 30 Days
              </span>
            </div>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: tickColor, fontSize: 10 }}
                    interval={4}
                    stroke={gridStroke}
                  />
                  <YAxis
                    tick={{ fill: tickColor, fontSize: 10 }}
                    stroke={gridStroke}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0C1222' : '#ffffff',
                      borderColor: isDark ? '#34d399' : '#cbd5e1',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: isDark ? '#f1f5f9' : '#0f172a',
                    }}
                    formatter={(value) => [`${value ?? 0} XP`, 'Earned']}
                  />
                  <Bar
                    dataKey="xpEarned"
                    fill={isDark ? '#10b981' : '#059669'}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Active Gates / Quests + Hunter Armory Shop */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <section className="xl:col-span-2 bg-white dark:bg-[#0C1222] border border-slate-200 dark:border-sky-500/25 rounded-xl p-5">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Active Gates & Quests
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Clear milestones to earn bonus XP and Focus Coins
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {quests.filter((q) => q.claimed).length}/{quests.length} claimed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quests.map((quest) => (
              <QuestProgressCard
                key={quest.id}
                quest={quest}
                onClaim={onClaimQuest}
              />
            ))}
          </div>
        </section>

        {/* Gamified Hunter Armory / Focus Coin Shop */}
        <section className="sl-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100">
                Hunter Armory
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Spend earned Focus Coins on boosters
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-sm font-mono font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              <Coins className="w-4 h-4" />
              {state.focusCoins}
            </span>
          </div>

          <div className="space-y-3">
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <Shield className="w-3.5 h-3.5 text-sky-500" />
                  Streak Shield
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Protects your streak during exam weeks ({state.streakShields} owned)
                </p>
              </div>
              <button
                type="button"
                disabled={state.focusCoins < 50}
                onClick={onBuyStreakShield}
                className="px-3 py-2 min-h-[38px] text-xs font-semibold text-white bg-slate-900 dark:bg-sky-600 hover:bg-blue-600 disabled:opacity-40 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                50 Coins
              </button>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  2x Mana XP Elixir (2h)
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {doubleXpActive
                    ? 'Active right now on daily XP'
                    : 'Doubles habit XP for 2 hours'}
                </p>
              </div>
              <button
                type="button"
                disabled={doubleXpActive || state.focusCoins < 75}
                onClick={onActivateDoubleXp}
                className="px-3 py-2 min-h-[38px] text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-40 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                {doubleXpActive ? 'Active' : '75 Coins'}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Hunter Status Window (Attributes) + 7-Day Matrix */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
        <section className="sl-panel p-5">
          <h3 className="font-display text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100">
            Hunter Status Attributes
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
            Cumulative attribute levels earned across IT academics, hackathons, and rhetoric
          </p>

          <div>
            {mastery.map((item) => (
              <CategorySkillBar key={item.category} {...item} />
            ))}
          </div>
        </section>

        <section className="sl-panel p-5">
          <h3 className="font-display text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100">
            7-Day Consistency Ledger
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-4">
            Daily execution density across your active protocols
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-medium">Protocol</th>
                  {last7Days.map((d) => (
                    <th key={d} className="py-2 px-1.5 text-center font-medium">
                      {d.slice(8)}
                    </th>
                  ))}
                  <th className="py-2 pl-3 text-right font-medium">Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {state.habits.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2.5 pr-3 font-medium text-slate-800 dark:text-slate-200 max-w-[160px] truncate">
                      {h.title}
                    </td>
                    {last7Days.map((d) => {
                      const done = h.completedDates.includes(d);
                      return (
                        <td key={d} className="py-2.5 px-1.5 text-center">
                          <span
                            className={`inline-block w-4 h-4 rounded-sm ${
                              done
                                ? 'bg-emerald-500 dark:bg-sky-400'
                                : 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                            }`}
                            title={`${h.title} on ${d}: ${
                              done ? 'Done' : 'Missed'
                            }`}
                          />
                        </td>
                      );
                    })}
                    <td className="py-2.5 pl-3 text-right font-mono font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                      {h.streak}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Achievements / Trophies */}
      <section className="sl-panel p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            <h3 className="font-display text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100">
              Unlocked Titles & Achievements
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            {state.unlockedAchievements.length}/{ACHIEVEMENTS.length} unlocked
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ACHIEVEMENTS.map((ach) => {
            const unlocked = state.unlockedAchievements.includes(ach.id);
            return (
              <div
                key={ach.id}
                className={`border rounded p-3.5 transition-colors ${
                  unlocked
                    ? 'border-amber-300/70 dark:border-sky-500/40 bg-amber-50/40 dark:bg-sky-950/30'
                    : 'border-slate-200 dark:border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {ach.title}
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    +{ach.xpReward} XP
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {ach.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* System Activity, XP & Penalty Audit Log */}
      <section className="sl-panel sl-reticle p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-sky-500/20">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-blue-700 dark:text-sky-400" />
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-blue-700 dark:text-sky-400 font-semibold block">
                [ SYSTEM AUDIT · COMPLETE LEDGER ]
              </span>
              <h3 className="font-display text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100">
                Execution &amp; Penalty Log ({(state.systemLogs || []).length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tracks all completed protocols, focus sprints, alarms, XP gains, and missed-task XP deductions
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-mono font-semibold text-rose-700 dark:text-rose-400 tabular-nums">
              Total Penalties: -{state.penaltyXp || 0} XP
            </span>
            <button
              type="button"
              onClick={onRunOverduePenaltyAudit}
              className="px-3 py-1.5 min-h-[36px] text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-500/35 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded transition-colors cursor-pointer"
            >
              Scan Overdue Tasks
            </button>
            {(state.systemLogs || []).length > 0 && (
              <button
                type="button"
                onClick={onClearSystemLogs}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 rounded cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/20 rounded">
            {(
              [
                { id: 'all', label: 'All Events' },
                { id: 'gains', label: 'XP Gains' },
                { id: 'penalties', label: 'Penalties' },
                { id: 'focus', label: 'Focus & Alarms' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setLogFilter(tab.id)}
                className={`px-3 py-1.5 min-h-[34px] text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                  logFilter === tab.id
                    ? 'bg-white dark:bg-sky-600 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[180px] flex-1 sm:flex-initial max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Search system logs..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/25 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-sky-500/15 border border-slate-200 dark:border-sky-500/20 rounded">
          {(() => {
            const q = logSearch.trim().toLowerCase();
            const entries = (state.systemLogs || []).filter((entry) => {
              if (logFilter === 'gains' && entry.xpDelta <= 0) return false;
              if (logFilter === 'penalties' && entry.xpDelta >= 0) return false;
              if (
                logFilter === 'focus' &&
                entry.type !== 'focus_completed' &&
                entry.type !== 'alarm_triggered'
              ) {
                return false;
              }
              if (
                q &&
                !entry.title.toLowerCase().includes(q) &&
                !entry.details.toLowerCase().includes(q)
              ) {
                return false;
              }
              return true;
            });

            if (entries.length === 0) {
              return (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  No log entries match this filter yet.
                </div>
              );
            }

            return entries.map((entry) => (
              <div
                key={entry.id}
                className="px-3.5 py-2.5 flex items-start justify-between gap-3 bg-white/60 dark:bg-[#060B18]/70"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>
                      {entry.date} · {entry.timeLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="uppercase tracking-wider text-blue-700 dark:text-sky-400 font-semibold">
                      {entry.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {entry.title}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {entry.details}
                  </p>
                </div>

                <div className="text-right shrink-0 font-mono text-xs font-bold tabular-nums">
                  {entry.xpDelta !== 0 && (
                    <span
                      className={
                        entry.xpDelta > 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-700 dark:text-rose-400'
                      }
                    >
                      {entry.xpDelta > 0 ? `+${entry.xpDelta}` : entry.xpDelta} XP
                    </span>
                  )}
                  {entry.coinDelta ? (
                    <div className="text-[11px] text-amber-600 dark:text-amber-400">
                      {entry.coinDelta > 0 ? `+${entry.coinDelta}` : entry.coinDelta}c
                    </div>
                  ) : null}
                </div>
              </div>
            ));
          })()}
        </div>
      </section>

      {/* Routine & Local Ollama AI Calibration */}
      <section className="sl-panel p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-slate-700 dark:text-sky-400" />
            <div>
              <h3 className="font-display text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100">
                Routine & Local Ollama AI Configuration
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Calibrate campus sleep/wake hours and optional local Ollama endpoint for offline iPhone/LAN inference
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onResetDemo}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Student Data
          </button>
        </div>

        <form onSubmit={handleSavePrefs} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Student Name
              </label>
              <input
                type="text"
                value={formPrefs.name}
                onChange={(e) =>
                  setFormPrefs({ ...formPrefs, name: e.target.value })
                }
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Wake Time
              </label>
              <input
                type="time"
                value={formPrefs.wakeTime}
                onChange={(e) =>
                  setFormPrefs({ ...formPrefs, wakeTime: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Sleep Time
              </label>
              <input
                type="time"
                value={formPrefs.sleepTime}
                onChange={(e) =>
                  setFormPrefs({ ...formPrefs, sleepTime: e.target.value })
                }
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Peak Focus
              </label>
              <select
                value={formPrefs.focusPeakWindow}
                onChange={(e) =>
                  setFormPrefs({
                    ...formPrefs,
                    focusPeakWindow: e.target.value as UserPreferences['focusPeakWindow'],
                  })
                }
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-lg"
              >
                <option value="morning">Morning (06:30–11:30)</option>
                <option value="midday">Midday (11:30–14:30)</option>
                <option value="afternoon">Afternoon (15:30–18:30)</option>
                <option value="evening">Evening (19:00–22:30)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Daily XP Goal
              </label>
              <input
                type="number"
                min={50}
                max={1000}
                step={10}
                value={formPrefs.dailyXpTarget}
                onChange={(e) =>
                  setFormPrefs({
                    ...formPrefs,
                    dailyXpTarget: Number(e.target.value) || 260,
                  })
                }
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-lg"
              />
            </div>
          </div>

          {/* Anime SFX + Local Ollama Bridge */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <Volume2 className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                <span>Anime Notification SFX</span>
              </label>
              <select
                value={formPrefs.notificationSfx || 'system_arise'}
                onChange={(e) => {
                  const next = e.target.value as AnimeSfxId;
                  setFormPrefs({ ...formPrefs, notificationSfx: next });
                  playAnimeNotificationSfx(next, 0.72);
                }}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-lg"
              >
                {ANIME_SFX_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name} ({opt.vibe})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={ollamaForm.enabled}
                  onChange={(e) =>
                    setOllamaForm({ ...ollamaForm, enabled: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-300 text-sky-600"
                />
                <Cpu className="w-3.5 h-3.5 text-sky-500" />
                <span>Use Local Ollama Model</span>
              </label>
              <input
                type="text"
                value={ollamaForm.endpoint}
                onChange={(e) =>
                  setOllamaForm({ ...ollamaForm, endpoint: e.target.value })
                }
                placeholder="http://localhost:11434"
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Ollama Model Name
              </label>
              <input
                type="text"
                value={ollamaForm.model}
                onChange={(e) =>
                  setOllamaForm({ ...ollamaForm, model: e.target.value })
                }
                placeholder="llama3.2"
                className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-lg"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 min-h-[40px] text-xs font-semibold text-white bg-slate-900 dark:bg-sky-600 hover:bg-blue-600 dark:hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap cursor-pointer inline-flex items-center gap-1.5"
              >
                {savedNotice ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Saved
                  </>
                ) : (
                  'Save Configuration'
                )}
              </button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
};
