/**
 * Top-bar navigation model (UX spec §2). Pure — no DOM, no Svelte — so the
 * active-route rule is unit-testable.
 */

export interface NavItem {
  /** Route path, without the deploy `base` prefix. */
  href: string;
  label: string;
}

/** Destinations in the top bar, in order. Labels are final (UX spec §2.1). */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Practice' },
  { href: '/progress', label: 'Progress' },
  { href: '/play', label: 'Free play' },
  { href: '/settings', label: 'Settings' },
];

/** Routes that keep the "Practice" item highlighted. */
const PRACTICE_ROUTES = ['/practice', '/session'];

/** Strip the deploy base prefix and any trailing slash. `''` becomes `'/'`. */
export function normalizePath(pathname: string, base = ''): string {
  let path = pathname;
  if (base && (path === base || path.startsWith(`${base}/`))) {
    path = path.slice(base.length);
  }
  path = path.replace(/\/+$/, '');
  return path === '' ? '/' : path;
}

/** Is `href` the nav item that should be marked current for `pathname`? */
export function isActive(pathname: string, href: string, base = ''): boolean {
  const path = normalizePath(pathname, base);
  if (href === '/') {
    return (
      path === '/' ||
      PRACTICE_ROUTES.some(
        (route) => path === route || path.startsWith(`${route}/`),
      )
    );
  }
  return path === href || path.startsWith(`${href}/`);
}
