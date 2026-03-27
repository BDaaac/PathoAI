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
  Clock3,
  PieChart,
  Server,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { getStats, getHistory } from '../api/client';
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

function TinyLineChart({ points = [] }) {
  if (!points.length) return null;
  const maxVal = Math.max(...points, 1);
  const width = 220;
  const height = 90;
  const stepX = width / Math.max(1, points.length - 1);
  const path = points
    .map((v, i) => {
      const x = i * stepX;
      const y = height - (v / maxVal) * (height - 16) - 8;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24">
      <defs>
        <linearGradient id="lineGlow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <path d={path} fill="none" stroke="url(#lineGlow)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function TinyDonut({ items = [] }) {
  if (!items.length) return null;
  const total = items.reduce((sum, x) => sum + Number(x.count || 0), 0) || 1;
  let current = 0;
  const colors = ['#22d3ee', '#3b82f6', '#a78bfa', '#34d399'];

  function polar(cx, cy, r, angle) {
    const rad = (angle - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const arcs = items.slice(0, 4).map((item, idx) => {
    const val = Number(item.count || 0);
    const start = (current / total) * 360;
    const end = ((current + val) / total) * 360;
    current += val;

    const r = 38;
    const c = 50;
    const p1 = polar(c, c, r, start);
    const p2 = polar(c, c, r, end);
    const largeArc = end - start > 180 ? 1 : 0;
    const d = `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y}`;

    return <path key={`${item.class_id}-${idx}`} d={d} stroke={colors[idx % colors.length]} strokeWidth="16" fill="none" strokeLinecap="round" />;
  });

  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28">
      <circle cx="50" cy="50" r="38" stroke="#334155" strokeWidth="16" fill="none" opacity="0.35" />
      {arcs}
    </svg>
  );
}

function queueTag(item, idx, isEn) {
  if (item.is_urgent || idx % 5 === 0) return isEn ? 'Second opinion' : 'Второе мнение';
  if (Number(item.confidence || 0) < 75 || idx % 3 === 0) return isEn ? 'Follow-up' : 'Follow-up';
  return isEn ? 'Routine' : 'Routine';
}

function resultLabel(item, isEn) {
  const cls = String(item.class_name || '').toLowerCase();
  const positive = /(adenocarcinoma|carcinoma|tumou?r|cancer|опухол|карцином)/i.test(cls);
  if (positive) return isEn ? 'Positive' : 'Положительный';
  return isEn ? 'Negative' : 'Отрицательный';
}

function reviewStatus(idx, isEn) {
  if (idx === 0) return isEn ? 'In review' : 'На проверке';
  if (idx === 1) return isEn ? 'Pending review' : 'Ожидает проверки';
  return isEn ? 'Awaiting doctor review' : 'Ожидает врача';
}

function MiniPlanner({ queue = [], isEn }) {
  const days = queue.slice(0, 6).map((item, idx) => {
    const d = new Date(item.created_at);
    d.setDate(d.getDate() + idx);
    return {
      id: item.id,
      label: d.toLocaleDateString(isEn ? 'en-US' : 'ru-RU', { day: 'numeric', month: 'short' }),
      tag: queueTag(item, idx, isEn),
    };
  });

  return (
    <div className="space-y-2">
      {days.length === 0 ? (
        <div className="text-xs text-slate-500">{isEn ? 'No upcoming records' : 'Нет предстоящих записей'}</div>
      ) : (
        days.map((d) => (
          <div key={d.id} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs flex items-center justify-between">
            <span className="text-slate-300">{d.label}</span>
            <span className="text-cyan-300">{d.tag}</span>
          </div>
        ))
      )}
    </div>
  );
}

export default function Dashboard() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';

  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [apiLatency, setApiLatency] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const t0 = performance.now();
      try {
        const [statsRes, historyRes] = await Promise.all([
          getStats(),
          getHistory({ page: 1, per_page: 12 }),
        ]);
        if (!active) return;
        setStats(statsRes.data);
        setRecent(historyRes.data?.results || []);
        setApiLatency(Math.round(performance.now() - t0));
      } catch {
        if (!active) return;
        setApiLatency(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const todayCases = useMemo(() => {
    const src = recent || [];
    const today = new Date();
    const todayDate = today.toISOString().slice(0, 10);

    return src
      .filter((item) => {
        const d = new Date(item.created_at).toISOString().slice(0, 10);
        return d === todayDate && (item.is_urgent || Number(item.confidence || 0) < 75);
      })
      .map((item) => ({ ...item, risk: scoreRisk(item) }))
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 5);
  }, [recent]);

  const recentActivity = useMemo(() => (recent || []).slice(0, 5), [recent]);

  const dailyQueue = useMemo(() => {
    const source = (recent || []).slice(0, 10);
    return source
      .map((item) => ({ ...item, risk: scoreRisk(item) }))
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 6);
  }, [recent]);

  const weekSparkline = useMemo(() => {
    const timeline = stats?.timeline || [];
    if (!timeline.length) {
      return [0, 0, 0, 0, 0, 0, 0];
    }
    const last = timeline.slice(-7);
    return last.map((x) => Number(x.count || 0));
  }, [stats]);

  const pathologyMix = useMemo(() => (stats?.class_distribution || []).slice(0, 4), [stats]);

  const modelHealth = stats?.model_status || {};
  const modelOnline = Boolean(modelHealth.classification && modelHealth.segmentation && modelHealth.rag_collection);

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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
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
                    {isEn ? 'Routine queue is available below. Open planner to rebalance priorities.' : 'Ниже доступна плановая очередь. Откройте планер, чтобы перераспределить приоритеты.'}
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

          <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-800">{isEn ? 'Recent activity' : 'Последние анализы'}</h2>
              <span className="text-xs text-slate-500">{isEn ? 'last 5 cases' : 'последние 5 кейсов'}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 text-xs uppercase tracking-wide border-b border-white/10">
                    <th className="py-2 pr-3">{isEn ? 'Patient ID' : 'ID пациента'}</th>
                    <th className="py-2 pr-3">{isEn ? 'Study type' : 'Тип исследования'}</th>
                    <th className="py-2 pr-3">{isEn ? 'AI result' : 'Результат ИИ'}</th>
                    <th className="py-2">{isEn ? 'Doctor review' : 'Статус проверки'}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="py-4 text-slate-500">{isEn ? 'Loading...' : 'Загрузка...'}</td></tr>
                  ) : recentActivity.length === 0 ? (
                    <tr><td colSpan={4} className="py-4 text-slate-500">{isEn ? 'No recent cases' : 'Нет недавних случаев'}</td></tr>
                  ) : recentActivity.map((item, idx) => (
                    <tr key={item.id} className="border-b border-white/5">
                      <td className="py-2 pr-3 text-slate-200">PT-{item.id}</td>
                      <td className="py-2 pr-3 text-slate-300">{isEn ? 'Histopathology biopsy' : 'Гистология биопсии'}</td>
                      <td className="py-2 pr-3 text-slate-200">{resultLabel(item, isEn)}</td>
                      <td className="py-2 text-slate-400">{reviewStatus(idx, isEn)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 mb-3">{isEn ? 'Daily queue' : 'Очередь на сегодня'}</h2>
            <div className="space-y-2">
              {loading ? (
                <div className="text-sm text-slate-500">{isEn ? 'Loading queue...' : 'Загрузка очереди...'}</div>
              ) : dailyQueue.length === 0 ? (
                <div className="text-sm text-slate-500">{isEn ? 'No queue data yet' : 'Данных очереди пока нет'}</div>
              ) : dailyQueue.map((item, idx) => {
                const tag = queueTag(item, idx, isEn);
                const tagClass = tag.includes('Second') || tag.includes('Втор')
                  ? 'text-violet-300 border-violet-300/30 bg-violet-400/10'
                  : tag.includes('Follow')
                    ? 'text-amber-300 border-amber-300/30 bg-amber-400/10'
                    : 'text-emerald-300 border-emerald-300/30 bg-emerald-400/10';
                return (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-200 truncate">#{item.id} · {isEn ? (item.class_name || `Class ${item.class_id}`) : (item.class_name_ru || item.class_name || `Класс ${item.class_id}`)}</div>
                      <div className="text-xs text-slate-500">{isEn ? 'confidence' : 'уверенность'}: {Number(item.confidence || 0).toFixed(1)}%</div>
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded-md border ${tagClass}`}>{tag}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 mb-3 inline-flex items-center gap-2">
              <Server size={15} className="text-cyan-300" />
              {isEn ? 'System health' : 'Статус системы'}
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-slate-400">Model v2.4</span><span className={modelOnline ? 'text-emerald-300' : 'text-red-300'}>{modelOnline ? (isEn ? 'Online' : 'Онлайн') : (isEn ? 'Offline' : 'Оффлайн')}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-400">RAG docs</span><span className="text-slate-200">{stats?.model_status?.rag_docs ?? 0}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-400">{isEn ? 'Latency' : 'Задержка'}</span><span className="text-slate-200">{apiLatency != null ? `${apiLatency} ms` : '—'}</span></div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 mb-3 inline-flex items-center gap-2">
              <Activity size={15} className="text-cyan-300" />
              {isEn ? 'AI performance (week)' : 'Статистика ИИ за неделю'}
            </h2>
            <TinyLineChart points={weekSparkline} />
            <div className="mt-2 text-xs text-slate-500">{isEn ? 'Cases per day' : 'Кейсов по дням'}</div>

            <div className="mt-4 flex items-center gap-3">
              <TinyDonut items={pathologyMix} />
              <div className="text-xs space-y-1">
                {pathologyMix.map((x, idx) => (
                  <div key={`${x.class_id}-${idx}`} className="text-slate-400">
                    {isEn ? (x.class_name || `Class ${x.class_id}`) : (x.class_name_ru || x.class_name || `Класс ${x.class_id}`)}: <span className="text-slate-200">{x.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 mb-3 inline-flex items-center gap-2">
              <CalendarCheck2 size={15} className="text-cyan-300" />
              {isEn ? 'Mini planner' : 'Мини-планер'}
            </h2>
            <MiniPlanner queue={dailyQueue} isEn={isEn} />
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-slate-800 mb-3">{isEn ? 'AI updates' : 'Новости ИИ'}</h2>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="inline-flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-300" /> {isEn ? 'Multilingual RAG filtering enabled' : 'Включена фильтрация многоязычного RAG'}</div>
              <div className="inline-flex items-center gap-2"><Circle size={8} className="text-cyan-300" /> {isEn ? 'PDF report generation optimized' : 'Оптимизирована генерация PDF-отчетов'}</div>
              <div className="inline-flex items-center gap-2"><Clock3 size={12} className="text-amber-300" /> {isEn ? 'Model latency tracked on dashboard' : 'Задержка модели отслеживается на дашборде'}</div>
            </div>
          </div>
        </div>
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
