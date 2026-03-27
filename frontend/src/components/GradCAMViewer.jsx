import { useState } from 'react';
import { Flame, ImageIcon } from 'lucide-react';
import MediaImage from './MediaImage';
import { useLanguage } from '../context/LanguageContext';

export default function GradCAMViewer({ originalUrl, gradcamUrl }) {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const [show, setShow] = useState(gradcamUrl ? 'gradcam' : 'original');

  const activeSrc = show === 'gradcam' ? gradcamUrl : originalUrl;

  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {[
          { id: 'original', label: isEn ? 'Original' : 'Оригинал', icon: ImageIcon },
          { id: 'gradcam',  label: 'Grad-CAM',  icon: Flame, disabled: !gradcamUrl },
        ].map(({ id, label, icon: Icon, disabled }) => (
          <button
            key={id}
            onClick={() => !disabled && setShow(id)}
            disabled={disabled}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md font-medium transition-colors
              ${show === id ? 'bg-white shadow text-orange-500' : 'text-slate-500 hover:text-slate-700'}
              ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 rounded-xl overflow-hidden min-h-[16rem] flex items-center justify-center">
        {activeSrc ? (
          <MediaImage
            src={activeSrc}
            alt={show === 'gradcam' ? 'Grad-CAM' : 'Original'}
            className="w-full h-64 object-contain"
          />
        ) : (
          <span className="text-slate-500 text-sm">{isEn ? 'No image' : 'Нет изображения'}</span>
        )}
      </div>

      {gradcamUrl && (
        <p className="text-xs text-slate-500 text-center">
          {isEn
            ? 'Red zones show image regions that influenced model classification.'
            : 'Красные зоны — области, на которые ориентировалась модель при классификации'}
        </p>
      )}
    </div>
  );
}
