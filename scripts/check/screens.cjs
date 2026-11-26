// Walks every screen change of the site at phone size, photographs each one while it runs (strips saved to OUT), and checks
// that no two screens are ever shown at once, nothing gets stuck and nothing throws.
//   node scripts/check/screens.cjs
//   REDUCED=1 node scripts/check/screens.cjs     the same walk with "reduce motion" switched on
const fs = require('fs'), path = require('path');
const { OUT, launch, openPage, report, sleep } = require('./lib.cjs');
const reduced = !!process.env.REDUCED;

(async () => {
  const { expect, done } = report(reduced ? 'screens (reduced motion)' : 'screens');
  const browser = await launch();
  const { page, errors, backendCalls } = await openPage(browser, { width: 375, height: 812, reduced });
  const groups = [];
  const snap = () => page.evaluate(() => ({ step: state.step, screens: app.children.length, appOpacity: +(+getComputedStyle(app).opacity).toFixed(2), stuck: !!changing,
    crossFades: document.getAnimations().filter(a => a.effect?.pseudoElement?.startsWith('::view-transition')).length, screen: app.firstElementChild?.className }));
  const click = sel => page.evaluate(s => document.querySelector(s).click(), sel);

  // Runs an action, photographs at the given moments (ms after it), then checks the screen it ended on.
  async function change(name, action, moments, expectStep) {
    const t0 = Date.now(), files = [];
    await action();
    for (const at of moments) {
      const wait = at - (Date.now() - t0); if (wait > 0) await sleep(wait);
      const file = path.join(OUT, `${reduced ? 'reduced-' : ''}${name}-${String(at).padStart(4, '0')}.png`);
      const s = await snap(); await page.screenshot({ path: file });
      files.push({ file, label: `${name} +${Date.now() - t0}ms · opacity ${s.appOpacity}` });
      if (!reduced) expect(s.crossFades === 0 && s.screens === 1, `${name} +${at}ms: one screen, no browser cross-fade`);
    }
    await sleep(300);
    const end = await snap();
    expect(end.step === expectStep && !end.stuck && end.appOpacity === 1 && end.screens === 1, `${name}: ends on step ${expectStep}, fully visible, not stuck (step ${end.step}, opacity ${end.appOpacity}, stuck ${end.stuck})`);
    groups.push({ name, files });
  }

  await change('1-cover-to-story', () => click('.marble-start'), [0, 400, 1200, 2600], 1);
  await change('2-skip-to-marbles', () => click('[data-action="skip"]'), [60, 150, 260, 420, 900, 1600], 12);
  // A second tap while a screen is fading out must be ignored, not jump ahead.
  if (reduced) await click('.slide-arrow.prev');   // with reduced motion there is no fade, so nothing to ignore
  else {
    const ignored = await page.evaluate(async () => { document.querySelector('.slide-arrow.prev').click(); const during = !!changing; go(13); const step = state.step; await new Promise(r => setTimeout(r, 900)); return { during, step }; });
    expect(ignored.during && ignored.step === 11, 'a tap while a screen fades out is ignored');
  }
  await sleep(300);
  await change('3-skip-again', () => click('[data-action="skip"]'), [1500], 12);
  await change('4-back-to-story', () => click('.slide-arrow.prev'), [60, 150, 260, 420, 900], 11);
  await sleep(6500);   // the last scene finishes, the marble rests on the see-saw
  await change('5-story-to-marbles', () => click('.slide-arrow.next'), [0, 120, 230, 330, 600, 1400], 12);
  // The marble page takes three taps: the marbles part, the question appears, then it moves on. With reduced motion it takes one.
  if (!reduced) for (let tap = 0; tap < 2; tap++) { await click('.slide-arrow.next'); await sleep(1500); }
  await change('6-marbles-to-concern', () => click('.slide-arrow.next'), [100, 400, 800, 1600], 13);
  await change('7-concern-to-shelves', () => click('.ask-row'), [60, 150, 240, 420, 900], 13);
  await sleep(1200);
  await page.evaluate(() => document.querySelector('.pick:not(.add-own)').click()); await sleep(800);
  await page.evaluate(() => [...document.querySelectorAll('#sheet button')].find(b => !b.classList.contains('x') && !b.dataset.legal)?.click()); await sleep(3500);
  await page.evaluate(() => { if (document.querySelector('#sheet').open) document.querySelector('#sheet').close(); }); await sleep(300);
  expect(await page.evaluate(() => state.picked.size) === 1, 'a marble was put in the jar');
  await click('.send-jar'); await sleep(600);
  await page.evaluate(() => { const f = document.querySelector('.send-form'); f.elements.name.value = 'Preview Tester'; f.email.value = 'preview@example.com'; });
  await change('8-send-to-ending', () => page.evaluate(() => document.querySelector('.send-form').requestSubmit()), [300, 1300, 2000, 2700, 4000], 13);
  expect(await page.evaluate(() => !!document.querySelector('.finale')), 'the closing screen is shown after sending');
  await change('9-keep-exploring', () => page.evaluate(() => document.querySelector('.finale button').click()), [60, 160, 320, 800], 13);
  expect(await page.evaluate(() => !document.querySelector('.finale')), '"Keep exploring" removes the closing screen');
  await change('10-back-to-start', () => click('[data-action="restart"]'), [60, 150, 260, 420, 900], 0);
  await change('11-start-again', () => click('.marble-start'), [2600], 1);

  expect(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
  expect(backendCalls.includes('JAR'), `the jar went to the stubbed backend only (${backendCalls.length} calls answered locally)`);

  // One contact strip per change, to look at: OUT/strip-<name>.png
  const sheet = await browser.newPage();
  for (const g of groups.filter(x => x.files.length > 1)) {
    const html = '<body style="margin:0;background:#333;font:12px -apple-system,sans-serif;color:#fff"><div style="display:flex;gap:6px;padding:6px">' +
      g.files.map(f => `<figure style="margin:0"><img src="data:image/png;base64,${fs.readFileSync(f.file).toString('base64')}" style="width:210px;display:block"><figcaption style="padding:3px 0;width:210px">${f.label}</figcaption></figure>`).join('') + '</div></body>';
    await sheet.setViewport({ width: g.files.length * 216 + 6, height: 500 }); await sheet.setContent(html);
    await sheet.screenshot({ path: path.join(OUT, `${reduced ? 'reduced-' : ''}strip-${g.name}.png`), fullPage: true });
  }
  console.log(`\nPictures: ${OUT}`);
  await browser.close();
  done();
})().catch(e => { console.error('FAILED to run:', e); process.exit(1); });
