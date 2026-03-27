import { useState } from 'react';
import { Microscope, Loader2 } from 'lucide-react';
import { segment } from '../api/client';
import ImageUploader from '../components/ImageUploader';
import SegmentationViewer from '../components/SegmentationViewer';
import { useLanguage } from '../context/LanguageContext';

export default function SegmentationPage() {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  // savedUrl — path returned by API (e.g. /media/uploads/xxx.jpg)
  // Never use blob URL for the viewer since it may expire on history revisit
  const [savedImageUrl, setSavedImageUrl] = useState(null);
  const [error, setError] = useState('');

  const handleSegment = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);

    const fd = new FormData();
    fd.append('image', file);

    try {
      const res = await segment(fd);
      setResult(res.data);
      // API doesn't return original image URL for segment endpoint,
      // so we fall back to blob URL only as a local preview (same session)
      setSavedImageUrl(URL.createObjectURL(file));
    } catch (e) {
      setError(e.response?.data?.error || 'Ошибка сегментации');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Microscope size={24} className="text-emerald-600" />
          {isEn ? 'Segmentation' : 'Сегментация'}
        </h1>
        <p className="text-slate-500 text-sm mt-1">UNet++ EfficientNet-B5 · TTA · threshold 0.78</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <ImageUploader onFile={setFile} disabled={loading} />
        {error && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </div>
        )}
        <button
          onClick={handleSegment}
          disabled={!file || loading}
          className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading
            ? <><Loader2 size={18} className="animate-spin" /> {isEn ? 'Segmenting...' : 'Сегментация...'}</>
            : (isEn ? 'Segment' : 'Сегментировать')}
        </button>
      </div>

      {result && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4">{isEn ? 'Segmentation result' : 'Результат сегментации'}</h3>
          <SegmentationViewer
            imageUrl={savedImageUrl}      // blob URL for "Original" tab (same session only)
            maskUrl={result.mask_url}     // /media/masks/... — served with CORS
            overlayUrl={result.overlay_url}
            result={result}
          />
        </div>
      )}
    </div>
  );
}
