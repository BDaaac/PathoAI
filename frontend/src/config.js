// Central API config — change once, updates everywhere.
// If VITE_API_URL is not set, reuse current hostname and backend port 8000.
const envApiUrl = import.meta.env.VITE_API_URL;
const defaultApiUrl = `${window.location.protocol}//${window.location.hostname}:8000`;
export const BASE_URL = envApiUrl || defaultApiUrl;

/**
 * Convert a relative media path like "/media/uploads/foo.jpg"
 * to a full absolute URL "http://localhost:8000/media/uploads/foo.jpg".
 * Returns null/empty string as-is so components can guard with a simple check.
 */
export function mediaUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;   // already absolute
  if (path.startsWith('blob:')) return path;  // blob URL — return as-is
  return BASE_URL + (path.startsWith('/') ? path : '/' + path);
}
