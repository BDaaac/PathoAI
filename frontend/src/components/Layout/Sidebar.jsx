import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FlaskConical, Microscope, Layers,
  MessageSquare, History, Info, CalendarCheck2,
} from 'lucide-react';
import { getStats } from '../../api/client';
import { useLanguage } from '../../context/LanguageContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, labelKey: 'navDashboard' },
  { to: '/analyze',   icon: FlaskConical,    labelKey: 'navAnalyze' },
  { to: '/classify',  icon: Layers,          labelKey: 'navClassify' },
  { to: '/segment',   icon: Microscope,      labelKey: 'navSegment' },
  { to: '/planner',   icon: CalendarCheck2,  labelKey: 'navPlanner' },
  { to: '/chat',      icon: MessageSquare,   labelKey: 'navChat' },
  { to: '/history',   icon: History,         labelKey: 'navHistory' },
  { to: '/about',     icon: Info,            labelKey: 'navAbout' },
];

export default function Sidebar({ sidebarOpen, onNavigate }) {
  const [modelStatus, setModelStatus] = useState(null);
  const { lang, setLang, t } = useLanguage();

  useEffect(() => {
    getStats()
      .then((r) => setModelStatus(r.data.model_status))
      .catch(() => {});
  }, []);

  const allOk = modelStatus &&
    modelStatus.classification &&
    modelStatus.segmentation &&
    modelStatus.rag_collection;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-60 bg-slate-900 flex flex-col shrink-0 transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      {/* Logo */}
      <div className="px-5 py-4 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Microscope size={17} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">BioVision AI</div>
            <div className="text-slate-400 text-xs">{t('appSubtitle')}</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-slate-700/60">
        <div className="inline-flex bg-slate-800 rounded-lg p-1 w-full">
          <button
            className={`flex-1 text-xs py-1 rounded ${lang === 'ru' ? 'bg-blue-600 text-white' : 'text-slate-300'}`}
            onClick={() => setLang('ru')}
          >
            RU
          </button>
          <button
            className={`flex-1 text-xs py-1 rounded ${lang === 'en' ? 'bg-blue-600 text-white' : 'text-slate-300'}`}
            onClick={() => setLang('en')}
          >
            EN
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <Icon size={16} />
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>

      {/* System status */}
      <div className="px-4 py-3 border-t border-slate-700/60">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              modelStatus === null
                ? 'bg-slate-500 animate-pulse'
                : allOk
                ? 'bg-emerald-400'
                : 'bg-amber-400'
            }`}
          />
          <span className="text-xs text-slate-400">
            {modelStatus === null
              ? t('checking')
              : allOk
              ? `${t('ragOnline')} · ${modelStatus.rag_docs} doc.`
              : t('modelsNotReady')}
          </span>
        </div>
      </div>
    </aside>
  );
}
