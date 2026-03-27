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

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{isEn ? 'Today for doctor' : 'Сегодня для врача'}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
          >
            <CalendarCheck2 size={16} />
            {isEn ? 'Open planner' : 'Открыть планер'}
          </Link>
          <Link
            to="/analyze"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 hover:border-blue-500 text-slate-700 hover:text-blue-600 text-sm font-medium"
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

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">{isEn ? 'Critical for today' : 'Критичное на сегодня'}</h2>
          <Link to="/history" className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1">
            <History size={14} /> {isEn ? 'Open full history' : 'Открыть полную историю'} <ArrowRight size={13} />
          </Link>
        </div>

        {loading ? (
          <div className="text-sm text-slate-500">{isEn ? 'Loading cases...' : 'Загрузка случаев...'}</div>
        ) : todayCases.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500 text-sm">
            {isEn ? 'No critical tasks for today. Open planner to schedule upcoming cases.' : 'На сегодня критичных задач нет. Откройте планер для расписания ближайших случаев.'}
          </div>
        ) : (
          <div className="space-y-2">
            {todayCases.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 px-3 py-2.5 flex items-center gap-3">
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

function MetricCard({ icon, title, value }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">{icon}</div>
        <div className="text-sm text-slate-600">{title}</div>
      </div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
