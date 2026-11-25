import React, { useState } from 'react';
import {
  BookOpen,
  CalendarPlus,
  ExternalLink,
  Globe,
  LocateFixed,
  MapPin,
  Mic,
  RefreshCw,
  Search,
  Terminal,
} from 'lucide-react';
import {
  AcademicCourse,
  GroundingLink,
  WebOpportunity,
} from '../types';
import { OFFLINE_RAJKOT_PLACES } from '../services/offlineAiEngine';

interface OpportunitiesHubProps {
  opportunities: WebOpportunity[];
  sources: GroundingLink[];
  courses: AcademicCourse[];
  college: string;
  isOnline: boolean;
  isSearching: boolean;
  onSearchEvents: (
    focus: 'all' | 'hackathon' | 'public_speaking',
    query?: string
  ) => void;
  onAddOpportunityToRoutine: (opp: WebOpportunity) => void;
  onAdvanceCourseProgress: (courseId: string, delta: number) => void;
}

const QUICK_MAP_QUERIES = [
  'Quiet study libraries near Kalawad Road, Rajkot',
  'Coding & hackathon cafes with Wi-Fi in Rajkot',
  'Public speaking & Toastmasters clubs in Rajkot',
  'V.V.P. Engineering College Vajdi-Virda campus facilities',
];

export const OpportunitiesHub: React.FC<OpportunitiesHubProps> = ({
  opportunities,
  sources,
  courses,
  college,
  isOnline,
  isSearching,
  onSearchEvents,
  onAddOpportunityToRoutine,
  onAdvanceCourseProgress,
}) => {
  const [focus, setFocus] = useState<'all' | 'hackathon' | 'public_speaking'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Google Maps Data / Grounding Scout state
  const [mapsQuery, setMapsQuery] = useState(
    'Quiet study libraries & coding cafes near V.V.P. Engineering College, Rajkot'
  );
  const [isScoutingMaps, setIsScoutingMaps] = useState(false);
  const [useGps, setUseGps] = useState(false);
  const [mapsResult, setMapsResult] = useState<{
    summary: string;
    places: GroundingLink[];
    engine: string;
  } | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchEvents(focus, searchQuery);
  };

  const handleMapsScout = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? mapsQuery).trim();
    if (!q || isScoutingMaps) return;
    if (overrideQuery) setMapsQuery(overrideQuery);
    setIsScoutingMaps(true);

    const runOfflineAtlas = () => {
      setMapsResult({
        summary: `Offline Campus Atlas for ${college} (Rajkot): Direct Google Maps directions for campus study spots, libraries, and speaking clubs.`,
        places: OFFLINE_RAJKOT_PLACES.map((p) => ({
          title: p.title,
          uri: p.uri,
          kind: 'maps',
          snippet: `${p.distanceHint} — ${p.summary}`,
        })),
        engine: 'Offline Campus Atlas',
      });
    };

    if (!isOnline) {
      runOfflineAtlas();
      setIsScoutingMaps(false);
      return;
    }

    try {
      let coords: { latitude: number; longitude: number } | null = null;
      if (useGps && typeof navigator !== 'undefined' && navigator.geolocation) {
        coords = await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              resolve({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              }),
            () => resolve(null),
            { timeout: 4500 }
          );
        });
      }

      const res = await fetch('/api/assistant/maps-scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, coords, college }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Maps grounding failed');

      setMapsResult({
        summary: data.summary,
        places: Array.isArray(data.places) ? data.places : [],
        engine: data.engine || 'Gemini 4 Hydrogen · Google Maps Grounding',
      });
    } catch {
      runOfflineAtlas();
    } finally {
      setIsScoutingMaps(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Live Web Search: Hackathons & Public Speaking Radar */}
      <section className="sl-panel sl-reticle p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-sky-500/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sl-chamfer bg-slate-900 dark:bg-sky-500/15 border border-slate-800 dark:border-sky-400/50 text-white dark:text-sky-300 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-blue-700 dark:text-sky-400 font-semibold block">
                [ GOOGLE SEARCH GROUNDING · LIVE WEB FEEDS ]
              </span>
              <h3 className="font-display text-lg sm:text-xl font-bold tracking-wide text-slate-900 dark:text-slate-100 leading-tight">
                Hackathon &amp; Public Speaking Radar
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/20 rounded">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'hackathon', label: 'Hackathons' },
                  { id: 'public_speaking', label: 'Speaking' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFocus(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap cursor-pointer ${
                    focus === tab.id
                      ? 'bg-white dark:bg-sky-600 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Web Search Query Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Optional keywords (e.g. AI, Gujarat, Model UN, Toastmasters, FinTech)..."
              className="w-full pl-8 pr-3 py-2.5 min-h-[42px] text-xs bg-slate-50 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/25 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[42px] text-xs font-bold uppercase tracking-wider font-display text-white bg-blue-700 dark:bg-sky-600 hover:bg-blue-800 dark:hover:bg-sky-500 disabled:opacity-60 rounded transition-colors whitespace-nowrap cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`}
            />
            {isSearching ? 'Surfing Web...' : 'Search Web Now'}
          </button>
        </form>

        {opportunities.length === 0 ? (
          <div className="border border-dashed border-slate-300 dark:border-sky-500/30 rounded p-8 text-center bg-slate-50/50 dark:bg-[#050811]/70">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Ready to scout live hackathons &amp; speaking competitions
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
              Tap &ldquo;Search Web Now&rdquo; to query Gemini Search Grounding + live open hackathon &amp; speaking listings with official registration links.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {opportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="border border-slate-200 dark:border-sky-500/25 rounded p-4 bg-slate-50/70 dark:bg-[#060B18] flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-sky-300">
                        {opp.type === 'hackathon' ? (
                          <Terminal className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400" />
                        ) : (
                          <Mic className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                        {opp.type === 'hackathon' ? 'Hackathon' : 'Public Speaking'}
                      </span>
                      <span className="font-mono text-[11px] tabular-nums">
                        {opp.dateLabel}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1.5 leading-snug">
                      {opp.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {opp.organizer} · {opp.locationOrMode}
                    </p>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
                      {opp.summary}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-sky-400 mt-2 leading-relaxed">
                      Mentor tip: {opp.prepTip}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-200/80 dark:border-sky-500/15">
                    {opp.url ? (
                      <a
                        href={opp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-sky-400 hover:underline"
                      >
                        Official Link
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span />
                    )}

                    <button
                      type="button"
                      disabled={opp.addedToCalendar}
                      onClick={() => onAddOpportunityToRoutine(opp)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-bold uppercase tracking-wider font-display text-white bg-slate-900 dark:bg-sky-600 hover:bg-blue-700 dark:hover:bg-sky-500 disabled:bg-emerald-600 rounded transition-colors cursor-pointer"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      {opp.addedToCalendar ? 'Scheduled' : 'Schedule Prep'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {sources.length > 0 && (
              <div className="pt-3 border-t border-slate-200 dark:border-sky-500/20">
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
                  Verified Web Sources
                </span>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {sources.map((src) => (
                    <a
                      key={src.uri}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-700 dark:text-sky-400 hover:underline max-w-[280px] truncate"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{src.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Google Maps Grounding: Campus & Study Spot Scout */}
      <section className="sl-panel sl-reticle p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-sky-500/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sl-chamfer bg-emerald-700 dark:bg-emerald-500/15 border border-emerald-600 dark:border-emerald-400/40 text-white dark:text-emerald-300 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400 font-semibold block">
                [ GOOGLE MAPS DATA · PLACE GROUNDING ]
              </span>
              <h3 className="font-display text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100 leading-tight">
                Campus &amp; Study Spot Scout
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setUseGps((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-medium rounded border transition-colors cursor-pointer ${
              useGps
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-800 dark:text-emerald-300'
                : 'bg-slate-50 dark:bg-[#050811] border-slate-200 dark:border-sky-500/25 text-slate-600 dark:text-slate-400'
            }`}
          >
            <LocateFixed className="w-3.5 h-3.5" />
            {useGps ? 'GPS Location On' : 'Use Rajkot / GPS'}
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleMapsScout();
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <input
            type="text"
            value={mapsQuery}
            onChange={(e) => setMapsQuery(e.target.value)}
            placeholder="Search study spots, libraries, coding cafes, or venues..."
            className="flex-1 px-3 py-2.5 min-h-[42px] text-xs bg-slate-50 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/25 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <button
            type="submit"
            disabled={isScoutingMaps}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[42px] text-xs font-bold uppercase tracking-wider font-display text-white bg-emerald-700 dark:bg-emerald-600 hover:bg-emerald-800 dark:hover:bg-emerald-500 disabled:opacity-60 rounded transition-colors whitespace-nowrap cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5" />
            {isScoutingMaps ? 'Scouting Maps...' : 'Scout Maps Data'}
          </button>
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {QUICK_MAP_QUERIES.map((q) => (
            <button
              key={q}
              type="button"
              disabled={isScoutingMaps}
              onClick={() => void handleMapsScout(q)}
              className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#060B18] border border-slate-200 dark:border-sky-500/20 hover:border-emerald-400 rounded whitespace-nowrap shrink-0 cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>

        {mapsResult ? (
          <div className="border border-slate-200 dark:border-sky-500/25 rounded p-4 bg-slate-50/70 dark:bg-[#060B18] space-y-3">
            <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-emerald-700 dark:text-emerald-400">
              <span>{mapsResult.engine}</span>
              <span>{mapsResult.places.length} Maps Links</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {mapsResult.summary}
            </p>
            {mapsResult.places.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200 dark:border-sky-500/15">
                {mapsResult.places.map((p) => (
                  <a
                    key={p.uri}
                    href={p.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-slate-200 dark:border-sky-500/20 rounded p-3 bg-white dark:bg-[#070B14] hover:border-emerald-400 transition-colors flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="truncate">{p.title}</span>
                      </div>
                      {p.snippet && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {p.snippet}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 shrink-0 mt-0.5" />
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Uses Gemini Google Maps Grounding (plus instant Offline Rajkot Campus Atlas when offline) to surface real study spots, libraries, and Google Maps directions links.
          </p>
        )}
      </section>

      {/* V.V.P. Engineering College — Semester IT Syllabus Tracker */}
      <section className="sl-panel p-5">
        <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-200 dark:border-sky-500/20">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-emerald-600 dark:text-sky-400" />
            <div>
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-blue-700 dark:text-sky-400 font-semibold block">
                [ GTU SYLLABUS MASTERY ]
              </span>
              <h3 className="font-display text-lg font-bold tracking-wide text-slate-900 dark:text-slate-100">
                V.V.P. Engineering College — 1st Year I.T. Academics
              </h3>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {courses.map((course) => (
            <div
              key={course.id}
              className="border border-slate-200 dark:border-sky-500/25 rounded p-4 bg-slate-50/60 dark:bg-[#060B18] space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    {course.code} · {course.credits} Credits · Due {course.dueDate}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                    {course.name}
                  </h4>
                </div>
                <span className="text-sm font-mono font-bold text-blue-700 dark:text-sky-400 tabular-nums shrink-0">
                  {course.progressPercent}%
                </span>
              </div>

              <div className="h-2 w-full bg-slate-200 dark:bg-[#050811] border border-slate-200 dark:border-sky-500/20 rounded-xs overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-300"
                  style={{ width: `${course.progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
                  Next: {course.nextMilestone}
                </span>
                <button
                  type="button"
                  disabled={course.progressPercent >= 100}
                  onClick={() => onAdvanceCourseProgress(course.id, 5)}
                  className="px-2.5 py-1.5 min-h-[34px] text-xs font-mono font-semibold text-slate-800 dark:text-sky-200 bg-white dark:bg-sky-950/60 border border-slate-200 dark:border-sky-500/35 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 disabled:opacity-40 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  +5% (+20 XP)
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

