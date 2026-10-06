import { expect, test } from '@playwright/test';

test('diag: chromium compressor gain', async ({ page }) => {
  await page.goto('about:blank');
  const out = await page.evaluate(async () => {
    const SR = 48000;
    async function run(amp: number, startS: number, withComp: boolean) {
      const ctx = new OfflineAudioContext(1, SR * 3, SR);
      const osc = ctx.createOscillator();
      osc.frequency.value = 440;
      const g = ctx.createGain();
      g.gain.value = amp;
      osc.connect(g);
      if (withComp) {
        const c = ctx.createDynamicsCompressor();
        c.threshold.value = -2;
        c.knee.value = 0;
        c.ratio.value = 20;
        c.attack.value = 0.001;
        c.release.value = 0.1;
        g.connect(c);
        c.connect(ctx.destination);
      } else g.connect(ctx.destination);
      osc.start(startS);
      const buf = await ctx.startRendering();
      const d = buf.getChannelData(0);
      const peak = (a: number, b: number) => {
        let p = 0;
        for (let i = Math.floor(a * SR); i < Math.floor(b * SR); i++)
          p = Math.max(p, Math.abs(d[i]));
        return Math.round(2000 * Math.log10(p / amp)) / 100;
      };
      return {
        first10ms: peak(startS, startS + 0.01),
        first50ms: peak(startS, startS + 0.05),
        at300ms: peak(startS + 0.25, startS + 0.3),
        late: peak(2.5, 3),
      };
    }
    return {
      below_t0: await run(0.5, 0, true),
      below_t1: await run(0.5, 1, true),
      full_t1: await run(1, 1, true),
      dry: await run(0.5, 0, false),
    };
  });
  expect(out).toEqual({});
});
