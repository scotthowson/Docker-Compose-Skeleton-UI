# Dashboard tests

`tests/ui-sweep.mjs` opens every page of the dashboard in both themes at 1440 × 900 and at a 390 × 844 phone,
signed in to a lab API, and fails on console errors or warnings, uncaught exceptions, horizontal scroll on the
phone, leaked `undefined` / `NaN` / `[object Object]`, empty headings or pills, buttons, links and form fields without an
accessible name, focusable elements without a visible focus state, and on safe clicks (tabs, filters, view
switches, refresh, sheets that only open) that break the page. It never clicks anything that stops, deletes,
restarts, resets or updates. One screenshot per page, theme and width lands in `docs/ui-polish/sweep/`, with
`report.json` beside them. A page whose first load stays blank for 30 s (the dev server now and then stalls on one
of its hundreds of modules under four browsers) gets one more try; the summary lists every such page with the requests
it was still waiting on, and a page that stays blank twice fails.

Run it against the lab, never against a real server:

```bash
tests/lab/lab.sh start                                        # mock Proxmox, hub + member + fresh API copies, Vite on :3021
npm i --no-save --prefix /tmp/dcs-ui-sweep puppeteer-core@24  # once; the project does not depend on it
PUPPETEER_DIR=/tmp/dcs-ui-sweep WIZARD_API=http://127.0.0.1:41923 node tests/ui-sweep.mjs
tests/lab/lab.sh stop
```

`PAGES=proxmox,updates THEMES=dark VIEWPORTS=phone` narrows a run; `CLICKS=0` skips the clicks. The lab copies
the AIO checkout named by `AIO` (read-only) into `LAB` (default `/tmp/dcs-ui-lab`); its APIs never reach a
Docker daemon — `tests/lab/bin/docker` answers the read-only calls from a fixed set of containers and refuses
every call that would change something. The lab's throwaway admin is `lab` / `Lab-Only-Pass-123`.
