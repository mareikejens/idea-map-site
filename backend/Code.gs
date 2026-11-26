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
    .concat(ideas.length ? ['We want to talk about the marbles ' + (first || 'you') + ' picked:'].concat(ideas.map(t => '• ' + t)) : [])
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

if (typeof module !== 'undefined') module.exports = { agenda, withAgenda, lines };   // for testing outside Google
