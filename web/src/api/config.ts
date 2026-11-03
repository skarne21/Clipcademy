/** Browser/dev API origin (MSW and tests use the same absolute URLs). */
export const API_ORIGIN = "http://localhost";

/** Path prefix for JSON API routes (default `/api`). */
export const API_BASE_PATH = "/api";

/** @deprecated Use apiUrl() for fetch and MSW handler paths. */
export const API_BASE_URL = `${API_ORIGIN}${API_BASE_PATH}`;

/** Build an absolute request URL, e.g. apiUrl("/topics") → http://localhost/api/topics */
export function apiUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return new URL(`${API_BASE_PATH}${suffix}`, API_ORIGIN).toString();
}
