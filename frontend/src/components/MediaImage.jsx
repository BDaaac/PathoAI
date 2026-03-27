import { useEffect, useMemo, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { mediaUrl } from '../config';

/**
 * Drop-in <img> replacement that:
 * - Prepends BASE_URL automatically
 * - Shows a placeholder on error (no broken-image icons)
 * - Forces eager loading (no lazy loading surprises in modals)
 * - Retries once after a short delay (handles race conditions)
 */
export default function MediaImage({ src, alt = '', className = '', style = {}, width, height }) {
  const [errored, setErrored] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const baseSrc = mediaUrl(src);
  const fullSrc = useMemo(() => {
    if (!baseSrc) return '';
    const nonce = Date.now() + attempt;
    return `${baseSrc}${baseSrc.includes('?') ? '&' : '?'}v=${nonce}`;
  }, [baseSrc, attempt]);

  useEffect(() => {
    setErrored(false);
    setAttempt(0);
  }, [baseSrc]);

  const handleError = () => {
    if (attempt < 2) {
      // Retry quickly to handle short backend write races.
      setTimeout(() => {
        setAttempt((prev) => prev + 1);
        setErrored(false);
      }, 180);
    } else {
      setErrored(true);
    }
  };

  if (!fullSrc || errored) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 rounded-lg text-slate-300 ${className}`}
        style={{ width, height, minHeight: height || 80, ...style }}
      >
        <ImageOff size={24} />
      </div>
    );
  }

  return (
    <img
      src={fullSrc}
      alt={alt}
      className={className}
      style={style}
      width={width}
      height={height}
      loading="eager"        // never lazy — critical for modals
      decoding="async"
      onError={handleError}
    />
  );
}
