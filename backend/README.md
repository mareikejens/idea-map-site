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

## Coffee invites: the jar as the agenda

When a visitor chooses "Bring my jar to coffee" and books a time, their marbles are written into the calendar invite:
the ideas they picked, then the ones they added themselves, then their note. Both of you see it in the event.

One more step, once, after the set-up above:

1. In the Apps Script editor, choose **setup** in the function list in the toolbar and press **Run**.
2. Allow access to your calendar when Google asks.

From then on the script looks at your calendar whenever it changes. It finds upcoming events whose guest has sent a
coffee jar and puts the jar under whatever the booking page wrote.

Good to know:

- Jar and booking are matched by **email address**. The site asks for it before the calendar opens and tells the visitor
  to book with the same one. A different address at booking means no agenda in that invite (the jar is still in the sheet).
- Google does not email the guest again when the agenda is added. They see it when they open the event in their calendar.
- If you already pasted `Code.gs` before this existed: paste the new version, then **Deploy → Manage deployments → Edit →
  Version: New version**, then run **setup**.
- Switch it off with `AGENDA = false` at the top of `Code.gs`.

## Optional: log what visitors look at

Paste the same URL into `"trackEndpoint"` as well. Then every opened idea, every marble dropped and the answer to
"Are you worried?" lands in a tab "Events", with the visitor's name, even if they never send their jar.

Before you switch this on, tell visitors: put a sentence into `"notice"` under `"welcome"` in `content.js`
(it shows under the name field). `track.js` explains what is collected.

## Dashboard: who came and what they looked at

The script keeps a **Dashboard** tab in the same Sheet. It is rewritten after every event and every jar, so it is always
current, also on a phone. It shows:

- **Overview:** unique visitors, how many started the story, reached the marbles, opened a marble, filled and sent a jar,
  and the median and average time on the site.
- **Marbles:** per marble, how many visitors opened it, how often, how often it went into a jar, and the seconds it was read.
- **Concern picked** on "What concerns you most?".
- **Visitors**, latest first: time on the site, answers, marbles opened and in the jar, whether the jar was sent.

Good to know:

- **Leaving out test visits:** type a date into cell **B2** of the tab. Only visits from that day on are counted.
  B2 is the only cell to edit: everything else is overwritten.
- **Time on the site** runs from a visitor's first to their last recorded action. Pauses longer than 10 minutes are not
  counted (`BREAK_MINUTES` in `Code.gs`). Reading the last screen after the last action is not measured.
- **A visitor** is one browser tab. The same person on phone and laptop counts twice.
- The tab appears with the first visit after the script is updated. To get it at once, run **refreshDashboard** in the editor.

## Changing the script later

After editing `Code.gs` in the Apps Script editor: **Deploy → Manage deployments → Edit → Version: New version**.
The URL stays the same.
