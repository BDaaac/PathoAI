import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CalendarCheck2,
  FlaskConical,
  History,
  ArrowRight,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import { getStats } from '../api/client';
import MediaImage from '../components/MediaImage';
import { useLanguage } from '../context/LanguageContext';

function scoreRisk(item) {
  const confidence = Number(item.confidence || 0);
  const className = (item.class_name || '').toLowerCase();
  const keywordBoost = /(adenocarcinoma|carcinoma|tumou?r)/i.test(className) ? 15 : 0;
  return Math.min(99, Math.round((item.is_urgent ? 60 : 5) + Math.max(0, 100 - confidence) * 0.45 + keywordBoost));
}

function Sparkline({ points = [] }) {
  if (!points.length) return null;
  const maxVal = Math.max(...points, 1);
  const minVal = Math.min(...points, 0);
  const range = Math.max(1, maxVal - minVal);
  const width = 120;
  const height = 36;

  const path = points
    .map((v, i) => {
      const x = (i / Math.max(1, points.length - 1)) * width;
      const y = height - ((v - minVal) / range) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-28 h-9">
      <defs>
        <linearGradient id="sparkStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke="url(#sparkStroke)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function EmptyCriticalVisual() {
  return (
    <div className="relative h-24 w-36 shrink-0">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-500/20 via-cyan-400/10 to-transparent blur-xl" />
      <svg viewBox="0 0 220 140" className="relative z-10 h-full w-full">
        <defs>
          <linearGradient id="nodeStroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#5eead4" />
          </linearGradient>
        </defs>
        <g stroke="url(#nodeStroke)" strokeWidth="2" fill="none" opacity="0.9">
          <circle cx="36" cy="30" r="10" />
          <circle cx="110" cy="24" r="8" />
          <circle cx="182" cy="38" r="11" />
          <circle cx="62" cy="98" r="9" />
          <circle cx="148" cy="96" r="10" />
          <path d="M46 34 L102 26 L172 38 M42 36 L58 90 L140 90 L176 47" opacity="0.55" />
        </g>
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getStats()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const todayCases = useMemo(() => {
    const src = stats?.needs_validation || [];
    const today = new Date();
    const todayDate = today.toISOString().slice(0, 10);

    return src
      .filter((item) => {
        const d = new Date(item.created_at).toISOString().slice(0, 10);
        return d === todayDate;
      })
      .map((item) => ({ ...item, risk: scoreRisk(item) }))
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 8);
  }, [stats]);

  const weekSparkline = useMemo(() => {
    const timeline = stats?.timeline || [];
    if (!timeline.length) {
      return [0, 0, 0, 0, 0, 0, 0];
    }
    const last = timeline.slice(-7);
    return last.map((x) => Number(x.count || 0));
  }, [stats]);

  return (
    <div className="relative max-w-7xl mx-auto space-y-6 overflow-hidden rounded-3xl p-2">
      <div className="pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-fuchsia-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute -right-24 -top-10 h-96 w-96 rounded-full bg-sky-500/15 blur-[130px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-cyan-400/10 blur-[120px]" />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{isEn ? 'Today for doctor' : 'Сегодня для врача'}</h1>
          <p className="text-slate-400 text-xs mt-1 tracking-wide uppercase">
            {new Date().toLocaleDateString(isEn ? 'en-US' : 'ru-RU', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/planner"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-sm font-semibold shadow-[0_8px_28px_rgba(34,211,238,0.25)]"
          >
            <CalendarCheck2 size={16} />
            {isEn ? 'Open planner' : 'Открыть планер'}
          </Link>
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:border-cyan-300/30 text-slate-300 hover:text-cyan-200 text-sm font-medium backdrop-blur-md"
          >
            <FlaskConical size={16} />
            {isEn ? 'New analysis' : 'Новый анализ'}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          icon={<Activity size={16} className="text-blue-600" />}
          title={isEn ? 'Cases this week' : 'Случаев за неделю'}
          value={loading ? '...' : (stats?.this_week ?? 0)}
          sparkline={<Sparkline points={weekSparkline} />}
        />
        <MetricCard
          icon={<AlertTriangle size={16} className="text-red-600" />}
          title={isEn ? 'Urgent in history' : 'Срочных в истории'}
          value={loading ? '...' : (stats?.urgent_count ?? 0)}
        />
        <MetricCard
          icon={<ShieldAlert size={16} className="text-amber-600" />}
          title={isEn ? 'Low confidence cases' : 'Низкая уверенность'}
          value={loading ? '...' : (stats?.critical_count ?? 0)}
        />
      </div>

      <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">{isEn ? 'Critical for today' : 'Критичное на сегодня'}</h2>
          <Link to="/history" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
            <History size={14} /> {isEn ? 'Open full history' : 'Открыть полную историю'} <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">{isEn ? 'Loading cases...' : 'Загрузка случаев...'}</div>
        ) : todayCases.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-slate-400 text-sm flex items-center justify-between gap-6">
            <div className="max-w-lg">
              <div className="font-medium text-slate-200 mb-1">
                {isEn ? 'No critical tasks detected for today' : 'Критичные задачи на сегодня не обнаружены'}
              </div>
              <div>
                {isEn ? 'Open planner to schedule upcoming cases and keep the review queue under control.' : 'Откройте планер, чтобы распределить ближайшие кейсы и держать очередь под контролем.'}
              </div>
            </div>
            <EmptyCriticalVisual />
          </div>
        ) : (
          <div className="space-y-2">
            {todayCases.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 flex items-center gap-3">
                {item.image_url ? (
                  <MediaImage
                    src={item.image_url}
                    alt=""
                    className="w-11 h-11 rounded-lg object-cover border border-slate-100 shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-slate-100 shrink-0" />
                )}

                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-800 font-medium truncate">
                    #{item.id} · {isEn ? (item.class_name || `Class ${item.class_id}`) : (item.class_name_ru || item.class_name || `Класс ${item.class_id}`)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {isEn ? 'confidence' : 'уверенность'}: {Number(item.confidence || 0).toFixed(1)}%
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className={`text-xs font-semibold ${item.risk >= 80 ? 'text-red-600' : item.risk >= 60 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {isEn ? 'Risk' : 'Риск'}: {item.risk}
                  </div>
                  {item.is_urgent && (
                    <div className="text-[11px] font-semibold text-red-600 mt-0.5">URGENT</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, title, value, sparkline = null }) {
  return (
    <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">{icon}</div>
        <div className="text-sm text-slate-600">{title}</div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        {sparkline}
      </div>
    </div>
  );
}
