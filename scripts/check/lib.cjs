// Shared helpers for the browser checks in this folder (see README.md).
//
// Every check opens the site through openPage(). It answers the Google Sheet backend locally, so a check can never write a
// row to the real Sheet, send an email or touch the real visitor numbers, even when SITE points at the live domain.
const fs = require('fs'), os = require('os'), path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SITE = (process.env.SITE || 'http://localhost:4177/').replace(/\/?$/, '/');
const OUT = process.env.OUT || path.join(os.tmpdir(), 'idea-map-checks');
fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const launch = () => puppeteer.launch({ executablePath: CHROME, headless: 'new' });

// A page at the given size. Options: reduced (prefers-reduced-motion), cpu (slow-down factor), query (for example "?skip").
async function openPage(browser, { width, height, reduced = false, cpu = 1, query = '' } = {}) {
  const page = await browser.newPage();
  const errors = [], backendCalls = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  await page.setRequestInterception(true);
  page.on('request', request => {
    if (!request.url().includes('script.google.com')) return request.continue();
    let type = 'JAR';
    try { type = JSON.parse(request.postData() || '{}').type || 'JAR'; } catch {}
    backendCalls.push(type);
    request.respond({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}' });
  });
  const phone = width < 700;
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  if (cpu > 1) await (await page.createCDPSession()).send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.goto(SITE + query, { waitUntil: 'networkidle0' });
  return { page, errors, backendCalls };
}

// Collects pass/fail lines and sets the exit code, so a check can be run by hand or from a script.
function report(title) {
  const failures = [];
  const expect = (ok, what) => { console.log((ok ? '  ok    ' : '  FAIL  ') + what); if (!ok) failures.push(what); };
  const done = () => { console.log(failures.length ? `\n${title}: ${failures.length} FAILED` : `\n${title}: all passed`); process.exitCode = failures.length ? 1 : 0; };
  return { expect, done };
}

module.exports = { SITE, OUT, sleep, launch, openPage, report };
