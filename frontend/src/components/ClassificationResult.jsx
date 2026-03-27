import { CheckCircle2, Trophy } from 'lucide-react';
import ConfidenceBar from './ConfidenceBar';
import { useLanguage } from '../context/LanguageContext';

export default function ClassificationResult({ result }) {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  if (!result) return null;

  return (
    <div className="space-y-4">
      {/* Main result */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 size={22} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-xs text-blue-500 font-medium uppercase tracking-wide">
              {isEn ? 'Predicted class' : 'Определённый класс'}
            </div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {isEn ? result.class_name : (result.class_name_ru || result.class_name)}
            </div>
            <div className="text-sm text-slate-500">{result.class_name}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-blue-600">{result.confidence?.toFixed(1)}%</div>
            <div className="text-xs text-slate-400">{isEn ? 'confidence' : 'уверенность'}</div>
          </div>
        </div>
        <div className="mt-3">
          <ConfidenceBar value={result.confidence} color="auto" />
        </div>
      </div>

      {/* Top 3 */}
      {result.top3?.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
            <Trophy size={14} />
            {isEn ? 'Top-3 predictions' : 'Топ-3 предсказания'}
          </div>
          <div className="space-y-2">
            {result.top3.map((item, idx) => (
              <div key={idx} className="bg-white border border-slate-100 rounded-lg p-3">
                <ConfidenceBar
                  label={`${idx + 1}. ${isEn ? item.name : (item.name_ru || item.name)}`}
                  value={item.confidence}
                  color="auto"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
