# Backend: jars into a Google Sheet

The site is static, so it needs somewhere to send a jar. This is a small Google Apps Script that lives inside a Google Sheet
in your own Google account: every sent jar becomes a row, and you get an email. No server, no cost, no third party.

## Set up (about five minutes, once)

1. Create a new Google Sheet. Name it e.g. "Idea map jars".
2. In the sheet: **Extensions → Apps Script**. Delete what is in the editor and paste the whole of `Code.gs`. Save.
3. **Deploy → New deployment**. Type: **Web app**. Execute as: **Me**. Who has access: **Anyone**. Deploy.
4. Google asks you to authorise the script (it needs the sheet, and Gmail for the notification). Allow.
5. Copy the **Web app URL** (it ends in `/exec`).
6. In `content.js`, paste it into `"endpoint": ""` under `"send"`. Publish the site.

Test: send yourself a jar. A tab "Jars" appears in the sheet with one row, and you get an email.

## Optional: log what visitors look at

Paste the same URL into `"trackEndpoint"` as well. Then every opened idea, every marble dropped and the answer to
"Are you worried?" lands in a tab "Events", with the visitor's name, even if they never send their jar.

Before you switch this on, tell visitors: put a sentence into `"notice"` under `"welcome"` in `content.js`
(it shows under the name field). `track.js` explains what is collected.

## Changing the script later

After editing `Code.gs` in the Apps Script editor: **Deploy → Manage deployments → Edit → Version: New version**.
The URL stays the same.
