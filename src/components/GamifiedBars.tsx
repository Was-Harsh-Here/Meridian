import React from 'react';
import { Award, Check, Coins, Flame, Shield, Sparkles, Trophy, Zap } from 'lucide-react';
import { Habit, Quest } from '../types';
import { RankInfo, addDaysISO } from '../data/initialData';

function getHunterGrade(level: number): string {
  if (level >= 8) return 'S-RANK';
  if (level >= 6) return 'A-RANK';
  if (level >= 4) return 'B-RANK';
  if (level >= 3) return 'C-RANK';
  if (level >= 2) return 'D-RANK';
  return 'E-RANK';
}

interface RankMasteryBarProps {
  rankInfo: RankInfo;
  totalXp: number;
  streakShields: number;
  comboMultiplier: number;
  focusCoins: number;
  doubleXpActive: boolean;
}

export const RankMasteryBar: React.FC<RankMasteryBarProps> = ({
  rankInfo,
  totalXp,
  streakShields,
  comboMultiplier,
  focusCoins,
  doubleXpActive,
}) => {
  const hunterGrade = getHunterGrade(rankInfo.level);

  return (
    <div className="sl-panel sl-reticle p-5 flex flex-col justify-between gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-13 h-13 sl-chamfer bg-slate-900 dark:bg-sky-500/15 border border-slate-800 dark:border-sky-400/60 text-white dark:text-sky-300 flex flex-col items-center justify-center font-mono font-bold tabular-nums shrink-0">
            <span className="text-[9px] leading-none tracking-widest text-slate-400 dark:text-sky-400">
              {hunterGrade}
            </span>
            <span className="text-base leading-tight mt-0.5">
              LV.{rankInfo.level}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-blue-700 dark:text-sky-400 font-semibold block">
              [ PLAYER STATUS · AWAKENED ]
            </span>
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 tracking-wide uppercase">
                {rankInfo.rankTitle}
              </h2>
              <span
                className="text-xs text-slate-400 dark:text-slate-600"
                aria-hidden="true"
              >
                ·
              </span>
              <span className="text-xs font-mono font-bold text-blue-700 dark:text-sky-400 tabular-nums">
                {totalXp.toLocaleString()} XP
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {rankInfo.xpToNext.toLocaleString()} XP to Level {rankInfo.level + 1}
              {doubleXpActive ? ' · 2x Mana Surge Active' : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {comboMultiplier.toFixed(2).replace(/\.00$/, '')}x
            </span>
            <span className="text-slate-500 dark:text-slate-400">Combo</span>
          </div>
          <span className="text-slate-300 dark:text-sky-500/30" aria-hidden="true">
            |
          </span>
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-blue-700 dark:text-sky-400" />
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {streakShields}
            </span>
            <span className="text-slate-500 dark:text-slate-400">Shields</span>
          </div>
          <span className="text-slate-300 dark:text-sky-500/30" aria-hidden="true">
            |
          </span>
          <div className="flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {focusCoins}
            </span>
          </div>
        </div>
      </div>

      {/* Hunter System Mana / XP Track */}
      <div>
        <div
          className="h-3 w-full bg-slate-100 dark:bg-[#050811] rounded-xs overflow-hidden border border-slate-200 dark:border-sky-500/35 relative"
          role="progressbar"
          aria-valuenow={rankInfo.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Hunter Level XP progression"
        >
          <div
            className="h-full bg-gradient-to-r from-blue-700 via-sky-500 to-cyan-300 transition-transform duration-500 ease-out origin-left relative overflow-hidden"
            style={{
              width: `${Math.max(4, rankInfo.progressPercent)}%`,
            }}
          >
            <div className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-xp-shimmer" />
          </div>

          <div className="absolute inset-y-0 left-1/4 w-px bg-white/70 dark:bg-[#050811]/70 pointer-events-none" />
          <div className="absolute inset-y-0 left-2/4 w-px bg-white/70 dark:bg-[#050811]/70 pointer-events-none" />
          <div className="absolute inset-y-0 left-3/4 w-px bg-white/70 dark:bg-[#050811]/70 pointer-events-none" />
        </div>

        <div className="flex items-center justify-between mt-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
          <span>
            {rankInfo.currentLevelXp.toLocaleString()} /{' '}
            {rankInfo.nextLevelXp.toLocaleString()} XP
          </span>
          <span className="text-blue-700 dark:text-sky-400 font-semibold">
            {rankInfo.progressPercent}% TO RANK UP
          </span>
        </div>
      </div>
    </div>
  );
};

interface DailyMomentumMeterProps {
  dailyXp: number;
  dailyTarget: number;
  completedCount: number;
  totalCount: number;
  comboMultiplier: number;
}

export const DailyMomentumMeter: React.FC<DailyMomentumMeterProps> = ({
  dailyXp,
  dailyTarget,
  completedCount,
  totalCount,
  comboMultiplier,
}) => {
  const pct = Math.min(100, Math.round((dailyXp / Math.max(1, dailyTarget)) * 100));
  const totalSegments = 10;
  const filledSegments = Math.round((pct / 100) * totalSegments);
  const goalReached = pct >= 100;

  return (
    <div className="sl-panel sl-reticle p-5 flex flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-blue-700 dark:text-sky-400 font-semibold block">
            [ DAILY QUEST · MANA CHARGE ]
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold font-mono text-slate-900 dark:text-slate-100 tabular-nums">
              {dailyXp}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              / {dailyTarget} XP GOAL
            </span>
          </div>
        </div>

        <div className="text-right">
          <span
            className={`text-xs font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
              goalReached
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-blue-700 dark:text-sky-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {goalReached ? 'Gate Cleared' : `${pct}% Charged`}
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
            {completedCount}/{totalCount} cleared · {comboMultiplier}x
          </p>
        </div>
      </div>

      {/* 10-Segment Hunter Crystal Charge */}
      <div
        className="grid grid-cols-10 gap-1.5"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Daily XP momentum"
      >
        {Array.from({ length: totalSegments }).map((_, idx) => {
          const isFilled = idx < filledSegments;
          const isPeak = idx >= 8;
          return (
            <div
              key={idx}
              className={`h-3.5 rounded-xs transition-colors duration-200 ${
                isFilled
                  ? goalReached
                    ? 'bg-emerald-500 dark:bg-emerald-400'
                    : isPeak
                    ? 'bg-amber-500 dark:bg-amber-400'
                    : 'bg-blue-700 dark:bg-sky-500'
                  : 'bg-slate-100 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/20'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};

interface QuestProgressCardProps {
  quest: Quest;
  onClaim: (questId: string) => void;
}

export const QuestProgressCard: React.FC<QuestProgressCardProps> = ({
  quest,
  onClaim,
}) => {
  const pct = Math.min(
    100,
    Math.round((quest.currentCount / Math.max(1, quest.targetCount)) * 100)
  );
  const readyToClaim = quest.currentCount >= quest.targetCount && !quest.claimed;

  return (
    <div className="border border-slate-200 dark:border-sky-500/25 bg-slate-50/70 dark:bg-[#060B18] rounded p-4 flex flex-col justify-between gap-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400">
              <span className="font-bold uppercase tracking-wider text-blue-700 dark:text-sky-400">
                {quest.type} Gate
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
                +{quest.xpBonus} XP{quest.coinBonus ? ` · +${quest.coinBonus}c` : ''}
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
              {quest.title}
            </h4>
          </div>

          {quest.claimed ? (
            <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
              <Check className="w-3.5 h-3.5" />
              CLAIMED
            </span>
          ) : readyToClaim ? (
            <button
              type="button"
              onClick={() => onClaim(quest.id)}
              className="px-3 py-1.5 min-h-[36px] text-xs font-bold uppercase tracking-wider font-display text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Claim +{quest.xpBonus} XP
            </button>
          ) : (
            <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
              {quest.currentCount}/{quest.targetCount}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
          {quest.description}
        </p>
      </div>

      <div>
        <div className="h-2 w-full bg-slate-200 dark:bg-[#050811] rounded-xs overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              quest.claimed || readyToClaim
                ? 'bg-emerald-500 dark:bg-emerald-400'
                : 'bg-amber-500 dark:bg-sky-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
};

interface CategorySkillBarProps {
  category: Habit['category'];
  xp: number;
  level: number;
  progressPercent: number;
  completions: number;
}

const STAT_LABELS: Record<Habit['category'], { stat: string; color: string }> = {
  Academics: { stat: 'INT · Intelligence', color: 'bg-blue-700 dark:bg-sky-500' },
  'Hackathons & Code': {
    stat: 'AGI · Engineering',
    color: 'bg-indigo-600 dark:bg-indigo-400',
  },
  'Public Speaking': {
    stat: 'CHA · Presence',
    color: 'bg-amber-600 dark:bg-amber-400',
  },
  'Health & Vitality': {
    stat: 'VIT · Stamina',
    color: 'bg-emerald-600 dark:bg-emerald-400',
  },
  Mindset: { stat: 'SEN · Perception', color: 'bg-teal-600 dark:bg-cyan-400' },
};

export const CategorySkillBar: React.FC<CategorySkillBarProps> = ({
  category,
  xp,
  level,
  progressPercent,
  completions,
}) => {
  const meta = STAT_LABELS[category];

  return (
    <div className="py-3 border-b border-slate-100 dark:border-sky-500/15 last:border-b-0">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="w-3.5 h-3.5 text-slate-400 dark:text-sky-400 shrink-0" />
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {category}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-600" aria-hidden="true">
            ·
          </span>
          <span className="text-xs font-mono font-semibold text-blue-700 dark:text-sky-400 tabular-nums whitespace-nowrap">
            {meta.stat.split(' · ')[0]} LV.{level}
          </span>
        </div>
        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
          {completions} logs · {xp} XP
        </div>
      </div>
      <div className="h-2 w-full bg-slate-100 dark:bg-[#050811] rounded-xs overflow-hidden">
        <div
          className={`h-full ${meta.color} transition-all duration-300`}
          style={{ width: `${Math.max(4, progressPercent)}%` }}
        />
      </div>
    </div>
  );
};

interface SevenDayPipBarProps {
  completedDates: string[];
  todayISO: string;
}

export const SevenDayPipBar: React.FC<SevenDayPipBarProps> = ({
  completedDates,
  todayISO,
}) => {
  const days = Array.from({ length: 7 }).map((_, i) => addDaysISO(todayISO, i - 6));

  return (
    <div className="flex items-center gap-1" aria-label="7-day consistency">
      {days.map((d) => {
        const done = completedDates.includes(d);
        const isToday = d === todayISO;
        return (
          <div
            key={d}
            title={`${d}: ${done ? 'Completed' : 'Pending'}`}
            className={`w-3.5 h-3.5 rounded-[2px] transition-colors ${
              done
                ? 'bg-emerald-500 dark:bg-sky-400'
                : isToday
                ? 'bg-slate-200 dark:bg-slate-700 border border-slate-400 dark:border-sky-400/50'
                : 'bg-slate-100 dark:bg-[#050811] border border-slate-200 dark:border-slate-800'
            }`}
          />
        );
      })}
    </div>
  );
};

export const StreakBadgeText: React.FC<{ streak: number }> = ({ streak }) => (
  <span className="inline-flex items-center gap-1 text-xs font-mono font-medium text-amber-700 dark:text-amber-400 tabular-nums">
    <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
    {streak}d streak
  </span>
);

export const RankAwardBadge: React.FC<{ label: string }> = ({ label }) => (
  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
    <Award className="w-3.5 h-3.5 text-blue-700 dark:text-sky-400" />
    {label}
  </span>
);
