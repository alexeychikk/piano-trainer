import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { appIsListening, SOUNDFONT_URLS } from './support';

/*
 * An axe smoke over every v1 route: it fails on any `serious` or `critical`
 * violation (WCAG 2.x A/AA rules plus axe's best practices). It is a floor,
 * not an audit — axe sees the DOM in one state, so the rules that need a
 * person (focus order, the copy deck, colour-not-alone) stay with the UX spec
 * and the component tests.
 *
 * In particular axe reports `color-contrast` as *incomplete* (cannot decide),
 * not as a pass, on every route: text sits on gradients, chamfered panels and
 * the body texture, which axe does not compute a background for. Contrast is
 * owned by the hand-measured tables in sci-fi-visual-language.md §9 and
 * sci-fi-screens.md, and this spec does not claim to check it.
 *
 * Each route is scanned once the client owns it (CLAUDE.md's e2e rule): the
 * runner's `Ready?` prompt on the client-rendered routes, `appIsListening()`
 * on the prerendered ones — a scan of prerendered HTML would miss everything
 * `practice.hydrated` and the stores add.
 */

/**
 * Known exemptions, by axe rule id. Every entry needs a cited reason; an
 * empty list is the goal. Nothing is exempt today.
 */
const EXEMPT_RULES: readonly string[] = [];

const BLOCKING = new Set(['serious', 'critical']);

type Route = {
  path: string;
  /** The app's own "the client has taken over" signal for this route. */
  ready: (page: Page) => Promise<void>;
};

async function runnerIsReady(page: Page): Promise<void> {
  await expect(page.getByTestId('prompt')).toHaveText('Ready?');
}

const ROUTES: Route[] = [
  { path: '/', ready: appIsListening },
  { path: '/play/', ready: appIsListening },
  { path: '/practice/find-the-note/', ready: runnerIsReady },
  { path: '/session/', ready: runnerIsReady },
  { path: '/progress/', ready: appIsListening },
  { path: '/settings/', ready: appIsListening },
];

test.beforeEach(async ({ page }) => {
  await page.route(SOUNDFONT_URLS, (route) => route.abort());
});

for (const route of ROUTES) {
  test(`${route.path} has no serious or critical axe violations`, async ({
    page,
  }) => {
    await page.goto(route.path);
    await route.ready(page);

    const results = await new AxeBuilder({ page })
      .withTags([
        'wcag2a',
        'wcag2aa',
        'wcag21a',
        'wcag21aa',
        'wcag22aa',
        'best-practice',
      ])
      .disableRules([...EXEMPT_RULES])
      .analyze();

    // Rule id, impact and the offending selectors: enough to fix from the
    // report without re-running axe by hand.
    const blocking = results.violations
      .filter((violation) => BLOCKING.has(violation.impact ?? ''))
      .map((violation) => ({
        rule: violation.id,
        impact: violation.impact,
        help: violation.help,
        targets: violation.nodes.map((node) => node.target.join(' ')),
      }));
    expect(blocking).toEqual([]);
  });
}
