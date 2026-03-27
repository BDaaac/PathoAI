import { BookOpen, ExternalLink } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function RAGResponse({ answer, sources }) {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  if (!answer) return null;

  return (
    <div className="space-y-3">
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-start gap-2 mb-2">
          <BookOpen size={16} className="text-blue-500 shrink-0 mt-0.5" />
          <span className="text-sm font-medium text-slate-700">{isEn ? 'Medical context' : 'Медицинский контекст'}</span>
        </div>
        <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
          {answer}
        </div>
      </div>

      {sources?.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{isEn ? 'Sources' : 'Источники'}</div>
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
              <span
                key={s.index}
                className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-1 rounded-md"
              >
                [{s.index}] {s.source}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
