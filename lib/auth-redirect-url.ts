/**
 * Use with `signOut({ callbackUrl })` from the **browser** only.
 * A relative path like `/` can be resolved against `AUTH_URL` / `NEXTAUTH_URL`
 * (often `http://localhost:3000` in `.env`), so users land on localhost after logout on production.
 */
export function getAuthRedirectUrl(path: string = "/"): string {
  if (typeof window === "undefined") return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${window.location.origin}${p}`;
}
