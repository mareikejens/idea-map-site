// Everything that gravity moves in the flow, at several screen sizes and CPU speeds:
//   drop   marbles falling from the shelves into the jar (play.js, Matter.js)
//   pile   the jar filled with every marble, live and rebuilt after a reload (jar.js)
//   worry  the "Are you worried?" marble rolling to the edge (app.js)
//   node scripts/check/gravity.cjs            all three (a few minutes)
//   ONLY=drop node scripts/check/gravity.cjs  one of them
const { launch, openPage, report, sleep } = require('./lib.cjs');
const only = process.env.ONLY;
const SCREENS = [[320, 568, 'iPhone SE 1'], [375, 667, 'iPhone 8'], [390, 844, 'iPhone 14'], [430, 932, 'iPhone Pro Max'], [768, 1024, 'iPad'], [1280, 720, 'laptop, low'], [1512, 900, 'MacBook']];

async function openShelves(browser, w, h, cpu) {
  const s = await openPage(browser, { width: w, height: h, cpu, query: '?skip' });
  await sleep(700);
  await s.page.evaluate(() => document.querySelector('.ask-row').click());
  await sleep(1600);
  return s;
}
const insideJar = page => page.evaluate(() => {
  const jar = document.querySelector('.play .bottle').getBoundingClientRect();
  const balls = [...document.querySelectorAll('.play .bottle .ball')].map(e => e.getBoundingClientRect());
  return { drawn: balls.length, inside: balls.filter(r => r.left >= jar.left - 1 && r.right <= jar.right + 1 && r.top >= jar.top - 1 && r.bottom <= jar.bottom + 1).length,
    picked: state.picked.size, loose: Play._test.loose.size };
});

(async () => {
  const { expect, done } = report('gravity');
  const browser = await launch();

  if (!only || only === 'drop') {
    console.log('Marbles falling into the jar (4 marbles of the first problem, 250 ms apart)');
    for (const [w, h, label] of SCREENS) for (const cpu of [1, 6]) {
      const { page, errors } = await openShelves(browser, w, h, cpu);
      const r = await page.evaluate(async () => {
        const area = ideas.filter(i => i.g === state.area && !i.own).slice(0, 5), t0 = performance.now();
        for (const idea of area) { Play._test.autoAdd(idea); await new Promise(r => setTimeout(r, 250)); }
        while (Play._test.loose.size && performance.now() - t0 < 20000) await new Promise(r => setTimeout(r, 50));
        return { dropped: area.length, seconds: +((performance.now() - t0) / 1000).toFixed(1) };
      });
      await sleep(1500);
      const j = await insideJar(page);
      expect(j.picked === r.dropped && j.inside === j.drawn && j.loose === 0 && errors.length === 0,
        `${label} ${w}x${h}, CPU ${cpu}x: ${j.picked}/${r.dropped} landed in ${r.seconds}s, ${j.inside}/${j.drawn} inside the glass`);
      await page.close();
    }
  }

  if (!only || only === 'pile') {
    console.log('\nA full jar, dropped one by one and rebuilt after a reload');
    for (const [w, h, label] of [SCREENS[0], SCREENS[2], SCREENS[6]]) for (const cpu of [1, 4]) {
      const { page, errors } = await openShelves(browser, w, h, cpu);
      const total = await page.evaluate(async () => { const all = ideas.filter(i => !i.own); for (const i of all) { Play._test.autoAdd(i); await new Promise(r => setTimeout(r, 140)); } return all.length; });
      const t0 = Date.now(); while (Date.now() - t0 < 30000 && await page.evaluate(() => Play._test.loose.size)) await sleep(200);
      await sleep(2500);
      const live = await insideJar(page);
      await page.reload({ waitUntil: 'networkidle0' }); await sleep(2500);
      const rebuilt = await insideJar(page);
      expect(live.picked === total && live.inside === live.drawn && rebuilt.picked === total && rebuilt.inside === rebuilt.drawn && errors.length === 0,
        `${label} ${w}x${h}, CPU ${cpu}x: ${total} marbles, live ${live.inside}/${live.drawn} inside, after reload ${rebuilt.inside}/${rebuilt.drawn} inside`);
      await page.close();
    }
  }

  if (!only || only === 'worry') {
    console.log('\nThe "Are you worried?" marble, released on the rail (expected: about 2.1 s from calm, about 0.9 s near the edge)');
    for (const [w, h, label] of [[375, 812, 'phone'], [1512, 800, 'laptop']]) for (const cpu of [1, 6]) for (const level of [0, 0.8]) {
      const { page } = await openPage(browser, { width: w, height: h, cpu });
      await page.evaluate(() => { state.fullName = 'Preview'; state.name = 'Preview'; go(1); }); await sleep(700);
      await page.evaluate(() => go(2)); await sleep(4500);
      await page.evaluate(() => document.querySelector('.held')?.classList.add('shown')); await sleep(600);
      const r = await page.evaluate(async lvl => {
        const x = MarbleRun.brink - 150 + lvl * 150 + (lvl ? 0 : 1);
        worry = { x, v: 0, dragging: false, released: true, anchor: { x, y: 0 }, last: performance.now(), answer: lvl ? 'yes' : 'no', level: lvl };
        const t0 = performance.now();
        await new Promise(res => { (function f(now) { if (state.step !== 2 || now - t0 > 15000) res(); else requestAnimationFrame(f); })(t0); });
        return { seconds: +((performance.now() - t0) / 1000).toFixed(2), reached: state.step === 3 };
      }, level);
      const expected = level ? 0.93 : 2.1;
      expect(r.reached && Math.abs(r.seconds - expected) < 0.7, `${label}, CPU ${cpu}x, released ${level ? 'near the edge' : 'on the calm slope'}: ${r.seconds}s`);
      await page.close();
    }
  }

  await browser.close();
  done();
})().catch(e => { console.error('FAILED to run:', e); process.exit(1); });
