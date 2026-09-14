import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, isActive, normalizePath, isRunnerRoute } from './nav';

describe('normalizePath', () => {
  it('strips the deploy base prefix', () => {
    expect(normalizePath('/piano-trainer/progress', '/piano-trainer')).toBe(
      '/progress',
    );
    expect(normalizePath('/piano-trainer', '/piano-trainer')).toBe('/');
  });

  it('does not strip a base that only looks like a prefix', () => {
    expect(normalizePath('/piano-trainer-2/progress', '/piano-trainer')).toBe(
      '/piano-trainer-2/progress',
    );
  });

  it('drops trailing slashes', () => {
    expect(normalizePath('/settings/')).toBe('/settings');
    expect(normalizePath('/')).toBe('/');
  });
});

describe('isActive', () => {
  it('marks the exact route', () => {
    expect(isActive('/progress/', '/progress')).toBe(true);
    expect(isActive('/settings/', '/progress')).toBe(false);
  });

  it('keeps Practice current inside the runner and a session', () => {
    expect(isActive('/practice/find-the-note/', '/')).toBe(true);
    expect(isActive('/session/', '/')).toBe(true);
  });

  it('does not mark Practice on the other screens', () => {
    for (const path of ['/progress/', '/settings/', '/play/']) {
      expect(isActive(path, '/')).toBe(false);
    }
  });

  it('works under the GitHub Pages base path', () => {
    expect(isActive('/piano-trainer/play/', '/play', '/piano-trainer')).toBe(
      true,
    );
    expect(isActive('/piano-trainer/', '/', '/piano-trainer')).toBe(true);
  });

  it('marks exactly one nav item per screen', () => {
    for (const path of ['/', '/progress', '/play', '/settings', '/session']) {
      const active = NAV_ITEMS.filter((item) => isActive(path, item.href));
      expect(active, path).toHaveLength(1);
    }
  });
});

describe('isRunnerRoute', () => {
  it('is true for the runner and the mixed session, and nowhere else', () => {
    expect(isRunnerRoute('/practice/find-the-note/')).toBe(true);
    expect(isRunnerRoute('/session')).toBe(true);
    for (const path of ['/', '/progress/', '/settings/', '/play/']) {
      expect(isRunnerRoute(path), path).toBe(false);
    }
  });

  it('works under the GitHub Pages base path', () => {
    expect(
      isRunnerRoute('/piano-trainer/practice/find-the-note/', '/piano-trainer'),
    ).toBe(true);
    expect(isRunnerRoute('/piano-trainer/', '/piano-trainer')).toBe(false);
  });
});
