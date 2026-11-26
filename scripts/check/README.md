# Browser checks

Small scripts that open the site in headless Chrome and check what is easy to break and hard to see: screens that ghost over
each other, headlines that wrap, marbles that fall wrong, a cover that sits on the bottom edge. They are the checks that were
run by hand while building the idea map, saved so any session (or you) can run them again before a deploy.

They are **not part of the website**: `scripts/publish-home.sh` leaves this folder out of what goes to mareikejens.com.

## Run them

```sh
# once: the driver, installed outside the repo so nothing extra lands in it
npm install --prefix ~/.idea-map-checks puppeteer-core
export NODE_PATH=~/.idea-map-checks/node_modules    # in every terminal you run a check from

# in a second terminal, in the repo root: serve the site
python3 -m http.server 4177

# then, in the repo root
node scripts/check/layout.cjs          # one-line headlines, room under "Click here" (about 1 minute)
node scripts/check/screens.cjs         # every screen change, with pictures of each one mid-way (about 2 minutes)
REDUCED=1 node scripts/check/screens.cjs   # the same walk with "reduce motion" switched on
node scripts/check/gravity.cjs         # marbles falling, a full jar, the worry marble (a few minutes)
ONLY=drop node scripts/check/gravity.cjs   # just one part: drop, pile or worry
```

Each prints `ok` / `FAIL` lines and exits with 1 if anything failed.

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `SITE` | `http://localhost:4177/` | Where the site is. Can be the live domain to check what is deployed. |
| `CHROME` | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` | The Chrome to drive. |
| `OUT` | `<temp folder>/idea-map-checks` | Where pictures are saved (`screens.cjs`). |
| `REDUCED` | off | `screens.cjs` only: run with "reduce motion". |
| `ONLY` | all | `gravity.cjs` only: `drop`, `pile` or `worry`. |

## Safe to run against the live site

Every check goes through `lib.cjs`, which answers calls to the Google Sheet backend locally. A check never writes a row to
the Sheet, never sends an email and never changes the dashboard numbers, even with `SITE=https://mareikejens.com/`.
Keep it that way: a new check must open pages with `openPage()`, not with its own `browser.newPage()`.

## What they know about the code

The checks reach into the page's own variables (`state`, `go`, `changing`, `ideas`, `Play._test`, `MarbleRun`). If one of
those is renamed or the screen order changes, the check fails with an error and needs updating together with the code.
The screen numbers used in `screens.cjs` are the current ones: 0 cover, 1-11 story, 12 marble page, 13 concern list and game.

## Known and accepted

- `layout.cjs` accepts that "What concerns you most?" wraps on a 320px phone (by about 6px). From 360px up it must be one line.
- Headless Chrome runs at 60 Hz, so these checks say nothing about 120 Hz screens or real phones.
- The expected worry times (2.1 s and 0.93 s) are measured values, not requirements: if the physics is tuned on purpose, update them.
