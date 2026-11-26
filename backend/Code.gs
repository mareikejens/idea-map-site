// Backend for the idea map: a Google Apps Script web app that writes into the Google Sheet it belongs to.
// Setup is in backend/README.md. Nothing here needs editing except, if you like, the two settings below.

const NOTIFY = true;        // email the sheet's owner whenever a jar is sent
const MAX = 2000;           // longest text kept per cell

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
