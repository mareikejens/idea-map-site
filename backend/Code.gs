// Backend for the idea map: a Google Apps Script web app that writes into the Google Sheet it belongs to.
// Setup is in backend/README.md. Nothing here needs editing except, if you like, the two settings below.

const NOTIFY = true;        // email the sheet's owner whenever a jar is sent
const MAX = 2000;           // longest text kept per cell
const AGENDA = true;        // write the visitor's marbles into the coffee invite (needs setup() run once, see README)
const AGENDA_TITLE = 'Agenda: the marbles in your jar';   // also marks where our part of the invite text begins
const LOOK_AHEAD_DAYS = 90; // how far into the future booked coffees are looked for

// Every request from the site arrives here as a POST with JSON in the body (sent as plain text, see play.js).
function doPost(e) {
  try {
    const data = JSON.parse((e.postData && e.postData.contents) || '{}');
    // "website" is a field no person can see. Only bots fill it in: accept politely, store nothing.
    if (data.website) return reply({ ok: true });
    if (data.type) logEvent(data); else logJar(data);
    // Keep the Dashboard tab current. It only reads and summarises: if it ever fails, the visit above is saved all the same.
    try { refreshDashboard(); } catch (err) {}
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false });
  }
}

// One row per jar that a visitor sends: this is the list of who wants to talk about what.
function logJar(d) {
  const ideas = (d.ideas || []).map(i => i.title + ' (' + i.problem + ')');
  const own = (d.own || []).map(i => i.title + (i.note ? ': ' + i.note : ''));
  sheet('Jars', ['When', 'Name', 'Email', 'Coffee', 'Worried', 'Reading', 'Ideas', 'Own ideas', 'Note', 'Visitor'])
    .appendRow([new Date(), d.name, d.email, d.coffee ? 'yes' : '', d.worried, d.reading, ideas.join('\n'), own.join('\n'), d.note, d.visitor].map(clean));
  if (NOTIFY) {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Marble jar from ' + (d.name || 'a visitor'),
      [d.name, d.email, '', d.reading, '', ideas.concat(own).map(t => '• ' + t).join('\n'), '', d.note || ''].join('\n'));
  }
  // The visitor may have booked before sending (or sends again with a changed jar): bring the invite up to date now.
  // If the calendar is not authorised yet, the jar is still saved: this must never make a send fail.
  if (AGENDA && d.coffee) { try { syncAgendas(); } catch (err) {} }
}

// ---- Coffee invites -------------------------------------------------------------------------------------------
// The booking page (a Google Calendar appointment schedule) creates the calendar event, not this site. So the jar
// cannot travel with the booking. Instead: every time your calendar changes, look for upcoming events whose guest
// has sent a "coffee" jar, and write that jar into the event's description. The guest sees it in their invite.
// The link between booking and jar is the email address, which is why the site asks for it before the calendar opens.

// Run this once by hand in the Apps Script editor (choose "setup" in the toolbar, press Run, allow Calendar access).
function setup() {
  for (const t of ScriptApp.getProjectTriggers()) if (t.getHandlerFunction() === 'syncAgendas') ScriptApp.deleteTrigger(t);
  ScriptApp.newTrigger('syncAgendas').forUserCalendar(Session.getEffectiveUser().getEmail()).onEventUpdated().create();
  syncAgendas();
}

// Writing the description changes the calendar, which calls this again. It stops there, because the second time
// nothing is different and nothing is written.
function syncAgendas() {
  const jars = coffeeJars();
  if (!Object.keys(jars).length) return;
  const now = new Date(), until = new Date(now.getTime() + LOOK_AHEAD_DAYS * 864e5);
  for (const event of CalendarApp.getDefaultCalendar().getEvents(now, until)) {
    const guest = event.getGuestList().map(g => g.getEmail().toLowerCase()).find(mail => jars[mail]);
    if (!guest) continue;
    const before = event.getDescription() || '', after = withAgenda(before, jars[guest]);
    if (after !== before) event.setDescription(after);
  }
}

// The latest coffee jar per email address, already written out as agenda text.
function coffeeJars() {
  const tab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Jars'), jars = {};
  if (!tab) return jars;
  // Columns as written in logJar: When, Name, Email, Coffee, Worried, Reading, Ideas, Own ideas, Note, Visitor.
  for (const [, name, email, coffee, , , ideas, own, note] of tab.getDataRange().getValues().slice(1)) {
    const mail = String(email).trim().toLowerCase();
    if (mail && coffee) jars[mail] = agenda(name, lines(ideas), lines(own), note);   // later rows replace earlier ones
  }
  return jars;
}

// A cell holds one marble per line. clean() may have put a ' in front to disarm a formula: take it off again.
function lines(cell) {
  return String(cell || '').replace(/^'/, '').split('\n').map(s => s.trim()).filter(Boolean);
}

function agenda(name, ideas, own, note) {
  const first = String(name || '').trim().split(/\s+/)[0];
  return [AGENDA_TITLE]
    .concat(ideas.map(t => '• ' + t))   // straight under the title: no "We want to talk about the marbles … picked:" line (owner, 26 Nov)
    .concat(own.length ? ['', 'Added by ' + (first || 'you') + ':'].concat(own.map(t => '• ' + t)) : [])
    .concat(String(note || '').trim() ? ['', 'Note: ' + String(note).trim()] : [])
    .join('\n');
}

// Keep whatever the booking page wrote, and put the agenda under it. An agenda from an earlier jar is replaced.
function withAgenda(description, text) {
  const at = description.indexOf(AGENDA_TITLE);
  const own = (at < 0 ? description : description.slice(0, at)).replace(/\s+$/, '');
  return (own ? own + '\n\n' : '') + text;
}

// One row per thing a visitor does (optional: only arrives if "trackEndpoint" is set in content.js).
function logEvent(d) {
  sheet('Events', ['When', 'Visitor', 'Name', 'Event', 'Detail', 'Seconds', 'Jar so far'])
    .appendRow([new Date(), d.visitor, d.name, d.type, d.title || d.answer || d.idea || '', d.ms ? Math.round(d.ms / 1000) : '', (d.jar || []).join(', ')].map(clean));
}

// ---- Dashboard ------------------------------------------------------------------------------------------------
// A "Dashboard" tab in this Sheet, rewritten after every event and every jar: how many people came, how long they stayed,
// which marbles they opened and what went into their jars. Nothing to set up: the tab appears with the next visit (or run
// refreshDashboard once in the editor). To leave out your own test visits, type a date and time into cell B2 of that tab: only
// visits from then on are counted, and the tab recalculates at once (onEdit). Everything else on the tab is overwritten each time, so do not edit it by hand.
const DASHBOARD = 'Dashboard';
const BREAK_MINUTES = 10;                            // a pause longer than this does not count as time on the site
const TEST_VISITOR = /^(claude-check|setuptest)/;   // visits made by the setup checks: never counted
// How far a visitor got. The site sends "scene" events numbered 2 to 13 ("12: All my ideas ...", 13 is the concern screen);
// the older events still place visitors who came before those existed. 14 = the shelves with the idea marbles.
const STEP_LABELS = { 1: '1: Started the story', 3: '3: Answered "Are you worried?"', 13: '13: Concern screen', 14: '14: Shelves with the idea marbles' };
const STEP_OF = { start: 1, worried: 3, ask: 13, game: 14 };
const TEST_NAME = /test/i;                           // a visitor who gave a name with "test" in it (Test, Mareike Test, Setup test ...): never counted

// Runs by itself whenever someone edits the Sheet by hand (a "simple trigger": no setup, no permission to give). Typing a date
// into B2 of the Dashboard tab recalculates it at once; any other edit does nothing.
function onEdit(e) {
  const cell = e && e.range;
  if (cell && cell.getSheet().getName() === DASHBOARD && cell.getA1Notation() === 'B2') refreshDashboard();
}

function refreshDashboard() {
  // One rewrite at a time. If locking is not available (a simple trigger may not be allowed to), carry on without it.
  let lock = null;
  try { lock = LockService.getScriptLock(); if (!lock.tryLock(2000)) return; } catch (err) { lock = null; }   // another rewrite is running: that one will do
  try {
    const book = SpreadsheetApp.getActiveSpreadsheet();
    const rows = name => { const t = book.getSheetByName(name); return t ? t.getDataRange().getValues().slice(1) : []; };
    const tab = book.getSheetByName(DASHBOARD) || book.insertSheet(DASHBOARD, 0);
    const typed = tab.getRange('B2').getValue(), from = typed instanceof Date ? typed : null;
    const page = dashboardRows(summarise(rows('Events'), rows('Jars'), from), from, new Date());
    tab.clear();
    tab.getRange(1, 1, page.rows.length, page.width).setValues(page.rows);
    tab.getRangeList(page.bold).setFontWeight('bold');
    tab.getRangeList(page.dates).setNumberFormat('dd/mm/yyyy hh:mm').setHorizontalAlignment('left');
    tab.getRange('B2').setNumberFormat('dd/mm/yyyy').setBackground('#fff8e1');   // the one cell meant for typing
    tab.setColumnWidth(1, 260);
    tab.setColumnWidths(2, page.width - 1, 150);                  // wide enough for the column headings and the date in D1
  } finally { if (lock) { try { lock.releaseLock(); } catch (err) {} } }
}

// Turns the raw rows of "Events" and "Jars" (without their header rows) into the numbers on the dashboard.
// No Google services in here, so it can be tested outside Google.
function summarise(events, jars, from) {
  // A name is often only given late in a visit (in the send form), so the earlier rows of the same visitor have none:
  // one row with a test name leaves the whole visitor out.
  const tests = new Set();
  for (const [, id, name] of events) if (TEST_NAME.test(String(name || ''))) tests.add(String(id));
  for (const [, name, , , , , , , , id] of jars) if (TEST_NAME.test(String(name || ''))) tests.add(String(id));
  const counts = (when, id) => !!id && !TEST_VISITOR.test(String(id)) && !tests.has(String(id)) && when instanceof Date && (!from || when >= from);
  const visitors = new Map(), marbles = new Map(), concerns = new Map(), labels = Object.assign({}, STEP_LABELS), skips = new Map();
  const visitor = (id, when) => {
    if (!visitors.has(id)) visitors.set(id, { id: String(id), name: '', first: when, last: when, minutes: 0, did: new Set(), worried: '', concern: '', opened: new Set(), jar: [], sent: false, coffee: false, furthest: 0, skippedFrom: '' });
    return visitors.get(id);
  };
  // Columns as written in logEvent: When, Visitor, Name, Event, Detail, Seconds, Jar so far.
  for (const [when, id, name, type, detail, seconds, jar] of events) {
    if (!counts(when, id)) continue;
    const v = visitor(id, when), title = String(detail || '');
    if (name) v.name = String(name);
    // Time on the site: from one action to the next, as long as the pause between them is short.
    const pause = (when - v.last) / 60000;
    if (pause > 0 && pause <= BREAK_MINUTES) v.minutes += pause;
    if (when > v.last) v.last = when;
    v.did.add(type);
    v.jar = String(jar || '').split(',').map(s => s.trim()).filter(Boolean);
    if (type === 'worried') v.worried = title;
    const step = type === 'scene' ? parseInt(title, 10) : STEP_OF[type] || 0;
    if (type === 'scene' && step) labels[step] = title;   // the headline the site sent, latest wins
    if (step > v.furthest) v.furthest = step;
    if (type === 'skip' && !v.skippedFrom) {
      v.skippedFrom = title;
      skips.set(title, (skips.get(title) || 0) + 1);
    }
    if (type === 'ask' && title) {
      v.concern = title;
      if (!concerns.has(title)) concerns.set(title, new Set());
      concerns.get(title).add(v.id);
    }
    if (title && (type === 'open' || type === 'read' || type === 'add' || type === 'remove')) {
      if (!marbles.has(title)) marbles.set(title, { title, openers: new Set(), opens: 0, adds: 0, removes: 0, seconds: 0 });
      const m = marbles.get(title);
      if (type === 'open') { m.opens++; m.openers.add(v.id); v.opened.add(title); }
      if (type === 'read') m.seconds += Number(seconds) || 0;
      if (type === 'add') m.adds++;
      if (type === 'remove') m.removes++;
    }
  }
  // Columns as written in logJar: When, Name, Email, Coffee, Worried, Reading, Ideas, Own ideas, Note, Visitor.
  for (const [when, name, , coffee, , , , , , id] of jars) {
    if (!counts(when, id)) continue;
    const v = visitor(id, when);
    v.sent = true;
    if (coffee) v.coffee = true;
    if (name) v.name = String(name);
  }
  const all = [...visitors.values()], did = type => all.filter(v => v.did.has(type)).length;
  const times = all.map(v => v.minutes).sort((a, b) => a - b), middle = Math.floor(times.length / 2);
  const round = n => Math.round(n * 10) / 10;
  return {
    visitors: all.length,
    started: did('start'), answered: did('worried'), reached: did('game'), opened: did('open'), added: did('add'),
    sawField: all.filter(v => v.furthest >= 12).length, skipped: all.filter(v => v.skippedFrom).length,
    concernScreen: all.filter(v => v.furthest >= 13).length, pickedConcern: all.filter(v => v.concern).length,
    skips: [...skips].sort((a, b) => b[1] - a[1]).map(([from, n]) => from + ' (' + n + ')').join(', '),
    // The funnel: per step, how many got at least that far and how many stopped there.
    steps: Object.keys(labels).map(Number).sort((a, b) => a - b).map(step => ({ label: labels[step],
      reached: all.filter(v => v.furthest >= step).length, stopped: all.filter(v => v.furthest === step).length })),
    sent: all.filter(v => v.sent).length, coffee: all.filter(v => v.coffee).length,
    worried: ['yes', 'little', 'no'].map(answer => [answer, all.filter(v => v.worried === answer).length]),
    medianMinutes: times.length ? round(times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2) : 0,
    averageMinutes: times.length ? round(times.reduce((a, b) => a + b, 0) / times.length) : 0,
    marbles: [...marbles.values()].map(m => ({ title: m.title, visitors: m.openers.size, opens: m.opens, adds: m.adds, removes: m.removes, seconds: m.seconds }))
      .sort((a, b) => b.visitors - a.visitors || b.adds - a.adds || b.seconds - a.seconds || a.title.localeCompare(b.title)),
    concerns: [...concerns].map(([title, who]) => ({ title, visitors: who.size })).sort((a, b) => b.visitors - a.visitors || a.title.localeCompare(b.title)),
    people: all.sort((a, b) => b.first - a.first).map(v => ({ first: v.first, name: v.name, minutes: round(v.minutes), worried: v.worried, concern: v.concern,
      furthest: labels[v.furthest] || '', skippedFrom: v.skippedFrom, opened: v.opened.size, inJar: v.jar.length, sent: v.sent ? (v.coffee ? 'yes, with coffee' : 'yes') : '', id: v.id }))
  };
}

// Lays the summary out as the cells of the tab: one block under the other, so it also reads well on a phone.
function dashboardRows(s, from, now) {
  const rows = [], bold = [], dates = ['D1'];
  const title = text => { rows.push([]); rows.push([text]); bold.push('A' + rows.length); };
  const width = 11, last = String.fromCharCode(64 + width);
  const header = cells => { rows.push(cells); bold.push('A' + rows.length + ':' + last + rows.length); };
  rows.push(['Idea map dashboard', '', 'Updated', now]); bold.push('A1');
  rows.push(['Counting visits from', from || '', 'Type a date and time into B2 to leave out earlier visits. Empty counts everything. Visitors with "test" in their name are always left out.']);
  title('Overview');
  rows.push(['Unique visitors', s.visitors]);
  rows.push(['Started the story', s.started]);
  rows.push(['Answered "Are you worried?"', s.answered, s.worried.map(([answer, n]) => answer + ': ' + n).join(', ')]);
  rows.push(['Saw the marble field (all the marbles)', s.sawField, s.skipped ? s.skipped + ' used Skip to get there' : '']);
  rows.push(['Reached the concern screen', s.concernScreen]);
  rows.push(['Picked a concern', s.pickedConcern]);
  rows.push(['Reached the shelves with the idea marbles', s.reached]);
  rows.push(['Opened at least one marble', s.opened]);
  rows.push(['Put at least one marble in the jar', s.added]);
  rows.push(['Sent a jar', s.sent, s.coffee ? s.coffee + ' with a coffee request' : '']);
  rows.push(['Time on the site, median (minutes)', s.medianMinutes, 'Half of the visitors stayed longer than this, half shorter.']);
  rows.push(['Time on the site, average (minutes)', s.averageMinutes, 'From first to last action; pauses over ' + BREAK_MINUTES + ' minutes are not counted.']);
  title('How far visitors got');
  header(['Step', 'Got at least this far', 'Stopped here']);
  for (const st of s.steps) rows.push([st.label, st.reached, st.stopped]);
  if (s.skips) rows.push(['Used Skip from', s.skips]);
  title('Marbles');
  header(['Marble', 'Visitors who opened it', 'Times opened', 'Put in a jar', 'Taken out again', 'Seconds read (all visitors)']);
  for (const m of s.marbles) rows.push([m.title, m.visitors, m.opens, m.adds, m.removes, m.seconds]);
  title('Concern picked on the concern screen');
  header(['Concern', 'Visitors']);
  for (const c of s.concerns) rows.push([c.title, c.visitors]);
  title('Visitors, latest first');
  header(['First seen', 'Name', 'Minutes on the site', 'Worried', 'Got as far as', 'Skipped from', 'Concern picked', 'Marbles opened', 'Marbles in the jar', 'Sent the jar', 'Visitor']);
  const firstPerson = rows.length + 1;
  for (const p of s.people) rows.push([p.first, p.name, p.minutes, p.worried, p.furthest, p.skippedFrom, p.concern, p.opened, p.inJar, p.sent, p.id]);
  if (s.people.length) dates.push('A' + firstPerson + ':A' + rows.length);
  return { rows: rows.map(r => r.concat(Array(width - r.length).fill(''))), width, bold, dates };
}

// The tab with this name, created with a header row the first time it is needed.
function sheet(name, header) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let tab = book.getSheetByName(name);
  if (!tab) { tab = book.insertSheet(name); tab.appendRow(header); tab.setFrozenRows(1); }
  return tab;
}

// Visitors type free text. Cut it to size, and stop a cell that starts with = + - @ from being run as a formula.
function clean(value) {
  if (value instanceof Date) return value;
  const text = String(value == null ? '' : value).slice(0, MAX);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function reply(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

if (typeof module !== 'undefined') module.exports = { agenda, withAgenda, lines, summarise, dashboardRows };   // for testing outside Google
