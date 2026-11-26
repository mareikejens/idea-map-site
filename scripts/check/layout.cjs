// Layout checks at several screen sizes: the headlines that must stay on one line, and the room under "Click here" on the cover.
//   node scripts/check/layout.cjs
const { launch, openPage, report, sleep } = require('./lib.cjs');

(async () => {
  const { expect, done } = report('layout');
  const browser = await launch();

  console.log('Cover: room under "Click here" on laptop screens (it once sat on the bottom edge)');
  for (const [w, h] of [[1100, 620], [1280, 650], [1440, 760], [1512, 800], [1728, 950], [1920, 1000]]) {
    const { page } = await openPage(browser, { width: w, height: h });
    await sleep(600);
    const room = await page.evaluate(() => Math.round(innerHeight - document.querySelector('.marble-start span').getBoundingClientRect().bottom));
    expect(room >= 40, `${w}x${h}: ${room}px under "Click here" (at least 40)`);
    await page.close();
  }

  console.log('\nConcern list headline ("What concerns you most?") on one line');
  for (const w of [320, 360, 375, 390, 414, 430, 480, 768, 1280]) {
    const { page } = await openPage(browser, { width: w, height: 800, query: '?skip' });
    await sleep(500);
    const m = await page.evaluate(() => { const h = document.querySelector('.ask-stage h1'), r = document.createRange(); r.selectNodeContents(h); return { lines: new Set([...r.getClientRects()].map(x => Math.round(x.top))).size, font: getComputedStyle(h).fontSize }; });
    // 320px (the smallest phones) is known to wrap by a few pixels; everything from 360px up must be one line.
    if (w >= 360) expect(m.lines === 1, `${w}px: ${m.lines} line(s) at ${m.font}`); else console.log(`  info  ${w}px: ${m.lines} line(s) at ${m.font} (not required)`);
    await page.close();
  }

  console.log('\nStory headline "What if… We lose control?" on one line');
  for (const w of [320, 360, 375, 414, 480, 768, 1280, 1512]) {
    const { page } = await openPage(browser, { width: w, height: 800 });
    await page.evaluate(() => { state.fullName = 'Preview'; state.name = 'Preview'; state.worried = 'yes'; go(1); }); await sleep(400);
    await page.evaluate(() => go(2)); await sleep(400);
    await page.evaluate(() => { document.querySelector('.held')?.classList.add('shown'); goPass = true; go(3); }); await sleep(1500);
    const lines = await page.evaluate(() => {
      document.querySelector('.stage').classList.add('whatif-now', 'stressed');
      const h1 = document.querySelector('.headline h1'), rects = [];
      for (const s of ['.whatif', '.answer']) { const r = document.createRange(); r.selectNodeContents(h1.querySelector(s)); rects.push(...r.getClientRects()); }
      return new Set(rects.map(x => Math.round(x.top))).size;
    });
    expect(lines === 1, `${w}px: ${lines} line(s)`);
    await page.close();
  }

  await browser.close();
  done();
})().catch(e => { console.error('FAILED to run:', e); process.exit(1); });
