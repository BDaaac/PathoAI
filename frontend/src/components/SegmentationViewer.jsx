import { useState } from 'react';
import { Eye, Layers, ImageIcon, Activity } from 'lucide-react';
import MediaImage from './MediaImage';
import { useLanguage } from '../context/LanguageContext';

export default function SegmentationViewer({ imageUrl, maskUrl, overlayUrl, result }) {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  // Default to overlay if available, else original
  const [mode, setMode] = useState(overlayUrl ? 'overlay' : imageUrl ? 'original' : 'mask');
  const [alpha, setAlpha] = useState(80);

  const srcs = { original: imageUrl, overlay: overlayUrl, mask: maskUrl };

  const modes = [
    { id: 'original', label: isEn ? 'Original' : 'Оригинал', icon: ImageIcon, disabled: !imageUrl },
    { id: 'overlay',  label: 'Overlay',  icon: Layers,    disabled: !overlayUrl },
    { id: 'mask',     label: isEn ? 'Mask' : 'Маска',    icon: Eye,       disabled: !maskUrl },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {modes.map(({ id, label, icon: Icon, disabled }) => (
          <button
            key={id}
            onClick={() => !disabled && setMode(id)}
            disabled={disabled}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md transition-colors font-medium
              ${mode === id ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}
              ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 rounded-xl overflow-hidden min-h-[18rem] flex items-center justify-center">
        {srcs[mode] ? (
          <MediaImage
            src={srcs[mode]}
            alt={mode}
            className="w-full h-72 object-contain"
            style={mode === 'overlay' ? { opacity: 0.4 + alpha / 200 } : {}}
          />
        ) : (
          <span className="text-slate-500 text-sm">{isEn ? 'Image unavailable' : 'Изображение недоступно'}</span>
        )}
      </div>

      {mode === 'overlay' && overlayUrl && (
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="w-20 shrink-0 text-xs">{isEn ? 'Intensity' : 'Интенсивность'}</span>
          <input
            type="range" min="0" max="100" value={alpha}
            onChange={(e) => setAlpha(Number(e.target.value))}
            className="flex-1 accent-blue-600"
          />
          <span className="w-8 text-right font-medium text-xs">{alpha}%</span>
        </div>
      )}

      {result && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-emerald-700">{result.area_percent?.toFixed(2)}%</div>
            <div className="text-xs text-emerald-600 mt-0.5 flex items-center justify-center gap-1">
              <Activity size={11} /> {isEn ? 'Lesion area' : 'Площадь поражения'}
            </div>
          </div>
          <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-violet-700">{result.contour_count ?? '—'}</div>
            <div className="text-xs text-violet-600 mt-0.5">{isEn ? 'Contours' : 'Контуров'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
