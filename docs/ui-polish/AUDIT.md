# UI consistency audit

What the dashboard draws the same kind of thing with, measured in the source of this branch (the numbers are
occurrences in `src/renderer`), what this branch fixed, and what needs a decision before anyone changes it.
The inventory the numbers come from is [INVENTORY.md](INVENTORY.md); the before/after montages are the PNGs
beside this file ([08-audit.png](08-audit.png) shows the findings below that a screenshot can show,
[09-phone-and-filters.png](09-phone-and-filters.png) rows 16 and 17 of the fixes);
`tests/ui-sweep.mjs` is the check that keeps it honest (see [tests/README.md](../../tests/README.md)).

Colour meaning the audit holds the pages to: **emerald** = fine / running / on, **amber** = needs attention,
**rose** = a problem or destructive, **cyan** = information, **slate** = neutral.

## Fixed in this branch

| # | what | where | how |
|---|---|---|---|
| 1 | The light theme drew secondary text (`text-slate-400`, 805 uses) at #94a3b8 — fainter than `slate-500` and `slate-600` — and left every pale 100/200 accent (`text-amber-200` …) and every translucent one (`text-amber-400/80` …) as the dark theme draws them: pale yellow on white on the Link VMs button, the fleet scope chips, the VM capsules | `index.css` (light section) | the dark theme's order mirrored (400 → #475569, 600 → #64748b, 700 → #cbd5e1); 100/200 → the family's 700, translucent 300–500 → its 600 |
| 2 | In the light theme ~450 `hover:text-*` colours made text *fade out* under the pointer (`hover:text-slate-200` is near-white) | `index.css` | a hover darkens in the light theme |
| 3 | 22 hand-made toggles in 7 files, six different looks; most without an accessible name, several with `focus:outline-none` and no replacement | Settings, AppSettings, Config, NotificationDrawer, Templates, Diagnostics, SetupWizard | one Mantine `Switch` (46 × 24, emerald or the row's colour), named after its row, with a focus ring |
| 4 | Proxmox chips in five hand-made styles (three radii, two text sizes); the hub/VM capsule on ~30 fleet rows another | Proxmox, VmCapsule | one Mantine `Badge` pill (10 px, normal case, hairline border in its colour); the capsule a real button with a focus ring where it links |
| 5 | The Proxmox Show filter and cards/table switch: buttons with no pressed state for a screen reader | Proxmox | Mantine `SegmentedControl` (radio semantics, named "Show" / "View", icon choices named) |
| 6 | The OS picker a native select with option labels that repeat their group ("… purpose-built for the fleet …" under "DCS images — purpose-built for the fleet"); the storage pickers truncated ("local-lvm · lvmthi") | NewVmSheet (also the wizard's VM step) | Mantine `Select`: short names, the facts muted on the right, grouped, searchable on a keyboard |
| 7 | Loading the guests showed four blank pulsing boxes and the node card said "no guests" | Proxmox | card-shaped skeletons (the house `.skeleton`), a placeholder in the node card |
| 8 | A search or filter that matched no guest said "Nothing matches." | Proxmox | says what was filtered and offers "Clear the filters" |
| 9 | Wording: "1 stacks"; "found by its matched by the VM's SMBIOS uuid"; a container without a health check ending its line with "· none"; the Automatic image updates note promising a recreate the switch had turned off; the "Bake one" hint telling you to "tick" what is now a switch (and only shown for a cloud image) | Proxmox, AutoImageUpdates | fixed |
| 10 | Phone: the VM size steppers cut their unit ("32 G") | VmSizeControl | the number box is as wide as its digits |
| 11 | The fleet sheets were not dialogs to a screen reader | fleetShared `Sheet` | `role="dialog"`, `aria-modal`, titled |
| 12 | The scope chips (Everywhere · Hub · a VM, on 22 pages) had no pressed state and a native `title` | FleetScopeChips | `aria-pressed`, a named group, Mantine tooltips (also on a VM that does not answer) |
| 13 | Icon-only buttons (an ✕, a ✓, a chevron, a check box) with no name: a screen reader said "button" | 43 files, 85 names | named after what they do: "Close", "Cancel" / "Save" beside a rename field, "Clear the search", "Remove the card", "Show the runs" / "Hide the runs" with `aria-expanded`, "Select all" / "Clear the selection" … |
| 14 | Check boxes drawn as buttons (select a stack card, an image row, a template's HTTPS route, "Remember me") and toggles drawn as buttons (favorite star, export card, auto-refresh) had no state for a screen reader | StackCard, ImageList, Templates, Login, ContainerRow, Export, Trends | `role="checkbox"` + `aria-checked`, or `aria-pressed` |
| 15 | Empty table headers above a check box, expand or favorite column | ContainerList, ImageList, CronJobs | a hidden name ("Favorite", "Select", "Details") |
| 16 | Phone: the Activity type tabs and the Networks header ran off the screen (the page scrolled sideways at 390 px) | Activity, Networks | Activity's filter is a `SegmentedControl` that swipes inside its own row; the Networks header wraps its buttons under the title |
| 17 | Trends' time range: hand-made tabs with no selected state | Trends | `SegmentedControl` named "Time range", short labels on a phone |
| 18 | Terminal sign-in's "Remember for this session": a hand-made switch without a name | TerminalAuthGate | Mantine `Switch`, named |
| 19 | 85 selects, inputs and text areas under a visible label that was not tied to them (a `<label>` without `htmlFor`, a `<p>`, a `<span>`) or with no label at all: a screen reader said "combo box" or "edit text" | 28 files | each carries its visible label as its name ("Trigger Type", "Deploy into stack", "Timezone" …), an unlabelled one a short name ("Filter by action", "Zone", "Lines"), a row that repeats per item names the item ("Value of PUID", "Subdomain for web") |
| 20 | The Cron Jobs page was headed "Scheduled Tasks": the name of the Schedules page its own empty state sends you to | CronJobs | headed "Cron Jobs", like its sidebar entry and its top bar |
| 21 | The light theme remaps dark backgrounds by name and missed the most used ones: `bg-slate-800/50` (some 60 panels and tiles), `900/85` (the phone's tab bar: dark under every page), `900/90` and `800/90` (the dashboard's edit chips), the 700 shades (range tracks), the 950 wells and veils — the lock screen drew its (remapped, dark) title on a near-black veil | `index.css` (light section) | a panel is the white panel its `/60 · /80 · /97` siblings already were, a 700 shade a light grey, a well `#f1f5f9`, a veil the page colour; form fields keep their rule |
| 22 | The Proxmox templates card cut its facts to "2 cores · 4 GB ·…", "pve ·…", "192.…" (two columns in a quarter-width card); the This server card its footer to "The hub keeps stacks like an…" | Proxmox | one fact per line where the card is a quarter wide (the full value on hover); the footer wraps |

## Measured: the same thing drawn different ways

**Buttons** (720 `<button>`s). Radius: `rounded-lg` 505, `rounded-md` 58, `rounded` 58, `rounded-xl` 29,
`rounded-full` 15. Height: padding-sized `py-2` 217 / `py-1.5` 134 / `py-2.5` 62 / `py-1` 44 / `py-3` 21, and
fixed `h-7` 27, `h-8` 23, `h-9` 10, `h-11` 14. Text: `text-xs` 333, `text-[11px]` 82, `text-sm` 76, `text-[10px]`
62. The house constants of the Proxmox page (`BTN` = py-2 / text-xs / rounded-lg, `MINI` = h-8 / 11 px,
`ICON` = h-9 → h-8 from sm) match the most common values, so they are the de-facto standard: a toolbar button
is 32–36 px, a card's small action 28–32 px, a sheet's primary 44 px. *Not changed here* (720 call sites,
behaviour-neutral but a large diff against work in progress elsewhere) — see "One button scale" below.

**Cards / panels.** Radius `rounded-xl` 313, `rounded-lg` 251, `rounded-2xl` 80. Padding `p-4` 107, `p-3` 76,
`p-5` 32, `p-6` 20. Background `glass` 112, `bg-white/[0.03]` 88, `bg-slate-900/60` 59, `bg-slate-900/95` 34,
`bg-slate-800/40` 28, `bg-slate-800/50` 23. Border `border-white/5` 275, `border-white/10` 66,
`border-white/[0.03]` 39. The page-level card is `rounded-xl bg-white/[0.03] border-white/5 p-4` (Proxmox `CARD`);
an inner tile `rounded-lg bg-white/[0.03] border-white/5 px-3 py-2`.

**Inputs.** Two families: `bg-white/5 border-white/10` (105) with an emerald ring on focus, and
`bg-slate-800/50 border-white/10` (41; the Proxmox forms, amber on focus). The Mantine theme takes the first as
its default and the second as `variant="fleet"`, so a Mantine field matches the form it sits in.

**Chips.** 105 `rounded-full`, 49 `rounded`, 26 `rounded-md` spans at 9 or 10 px. The Mantine `Badge` pill
(`radius="xl"`, 10 px, 18 px tall) is the default now; the pages not touched here still draw their own.

**Page titles.** 23 pages open with an `<h1>` in four sizes (`text-2xl` 11, `text-xl` 9, `text-lg md:text-2xl`
3, `text-xl md:text-2xl` 2), others with an `<h2>` (`text-lg` … `text-xl`), and the top bar repeats the title
with a breadcrumb: on a desktop the page name is written three times in the first 150 px. — *needs a decision*.

**Page names.** 21 of the 38 pages go by two or three names: the sidebar's, the top bar's
(`constants/pageTitles.ts`, which is also the breadcrumb, the command palette's entry and the Quick actions page
list) and the page's own heading. The worst: Updates is "Updates", "Image Updates" and "System Updates" at
once, and the Cron Jobs page was headed "Scheduled Tasks" — the name of the Schedules page, whose empty state
it points to ("…schedule a task from the Scheduled Tasks page") — fixed here to "Cron Jobs". Schedules and
Cron Jobs also share one sidebar icon (`CalendarClock`). The rest — *needs a decision* (one name per page;
the top-bar title also feeds the command palette's search):

| page | sidebar | top bar | heading |
|---|---|---|---|
| updates | Updates | Image Updates | System Updates |
| config | Config | Server Config | Server Configuration |
| system | System | System Info | System Information |
| schedules | Schedules | Scheduled Tasks | Scheduled Tasks |
| stacks | Stacks | Stack Manager | Stack Manager (on a hub: Stacks) |
| logs | Logs | Logs | Log Viewer |
| notifications | Notifications | Notifications | Notification Center |
| templates | Templates | Templates | Stack Templates |
| activity | Activity | Activity | Activity Timeline |
| environment | Environment | Environment | Environment Variables |
| snapshots | Snapshots | Snapshots | System Snapshots |
| event-feed | Live Events | Live Events | Live Event Feed |
| secrets | Secrets | Secrets Manager | Secrets |
| export | Export | Export Center | Export Center |
| users | Users | User Management | User Management |
| trends | Trends | Resource Trends | Resource Trends |
| topology | Topology | Network Topology | Network Topology |
| backup | Backup | Backup & Restore | Backup & Restore |
| health / uptime | Health / Uptime | Health Monitor / Uptime Monitor | the same |

**Casing.** 345 headings and buttons in Title Case ("Add Bookmark", "Check Registry for Updates", "Update All
Stale (10)") next to the sentence case of the newer pages ("New VM stack", "Join code", "Add member"). —
*needs a decision* (a sweep of 345 strings).

**Tooltips.** 544 `title=` attributes (556 before this branch), 14 Mantine `<Tooltip>`s (3 before), and a
house `components/common/Tooltip` used twice (Settings, Users): three ways to show a hint. A `title` shows late, unstyled, never on
touch or keyboard focus. The Mantine tooltip is themed (dark bubble in both themes, 12 px, wraps at 320 px,
shows on keyboard focus too). This branch moved the hints of the controls it touched.

**Icons.** lucide sizes 14 (530), 12 (298), 13 (249), 16 (248), 11 (153), 10 (114), 15, 18, 9, 20. Toolbar
buttons use 14, card actions 12–13, page icons 20; 13, 15 and 11 are near-duplicates of their neighbours.

**Focus.** 26 elements set `focus:outline-none` with no replacement (CommandPalette, Terminal, Environment,
Settings ×3, DNS ×3, DiskAnalysis, DiskMonitor ×3, ServerSwitcher, ComposeViewer ×3, EditStackOverlay ×3,
CreateStackOverlay, VmSizeControl, CardStudio, SetupWizard ×2); the sweep reports the ones it can reach.

**Loading / empty.** 190 spinners on pages, 19 pages use `LoadingState` (spinner + text), 17 files the
`.skeleton` shimmer, 12 files `EmptyState`. The house order: a skeleton shaped like the content where the layout
is known (lists of cards), `LoadingState` where it is not, `EmptyState` with a next step when a list can be empty.

## Needs a decision (not changed)

| item | why it is not a safe change | suggestion |
|---|---|---|
| Title Case → sentence case (345 labels) | touches ~40 files of wording; merge conflicts with work in progress | one pass per page with the page's owner |
| The page name three times at the top (top-bar title, breadcrumb, page `<h1>`); two `<h1>`s per page | layout of every page | keep the page's own title, drop the top-bar title on desktop (the breadcrumb carries it) |
| One page-header component (title size, subtitle, actions) | 37 pages | `PageHeader` with the Proxmox header as the model |
| One button scale: five radii, eleven heights and four text sizes on 720 buttons | 720 call sites, a large diff against work in progress | three shared class constants (toolbar, card action, primary) from the Proxmox page's `BTN` / `MINI` / `ICON`, page by page |
| Amber means two things: "needs attention" everywhere, "Proxmox / VM / fleet" on the Proxmox page and the VM capsules | colour identity of the fleet UI | keep amber for the fleet's *identity* only in chrome (icons, capsules), never on a status |
| The fleet sheets (New VM, Link VMs, Join code, VM details, member menu) do not close on Escape; no focus trap | adds behaviour | Escape closes, focus moves into the sheet and back on close |
| ConfirmDialog focuses the confirm button, also for a destructive "Delete" (Enter deletes) | changes what Enter does | focus Cancel when `danger` |
| Sortable table headers are `<th onClick>`: not reachable by keyboard | markup of 22 tables | a `<button>` inside each sortable `<th>`, `aria-sort` on it |
| A narrow window collapses the sidebar and stores it; widening the window keeps it collapsed | behaviour | collapse for the phone shell without persisting it |
| 544 `title` hints → Mantine tooltips | 100+ files | icon-only buttons first (their `title` is their only hint) |
| Dead components: common `Badge`, `Button`, `Card`, `Modal`, `Skeleton`, `Spinner`, `Table`, `DiffViewer` are imported nowhere | deleting files | remove, or make them the shared components the pages use |
| The native checkboxes (13) stay: they are labelled, keyboard-usable and follow `accent-color`; only the toggles became switches | — | — |
| The setup wizard's step indicator stays hand-made: Mantine's `Stepper` puts each label *beside* its dot, five labelled steps do not fit 390 px without dropping the labels the current one shows under each dot | mobile layout | — |
| The scope chips stay chips, not a `SegmentedControl`: a hub with 8–16 VMs needs them to wrap on a desktop, which a segmented control cannot | — | — |
| Volumes in batch mode: a row is selected by clicking the row; there is no check box to reach by keyboard (Images and Stacks have one) | adds a control | a named `role="checkbox"` button per row, as in ImageList |
| The status bar always reads "API v--": it shows `useSystemStore().version`, and nothing ever calls `setVersion` (the Updates page fetches `/version` for itself) | adds a data flow | fill the store from the `/ping` answer the connection heartbeat already receives (it carries `version` and `api_version`), no new request |
| Two build times for a clone: the Templates card says "A clone builds in about 25 s", the New VM sheet's bake switch "a clone builds in about 40 s instead of about 85 s" | which number is true is a measurement, not a wording choice | measure once on the rig, use one number in both places |
| API (AIO, not this repo): `/containers` reports an *unhealthy* container as `healthy` (`test("healthy")` matches "unhealthy" first); `uptime_seconds` comes from `RunningFor`, which Docker counts from the container's creation, not its start; the response cache replays the first caller's `Access-Control-Allow-Origin`, so a second dashboard origin (the Android app next to a browser) gets CORS errors until the entry expires; `_api_cleanup_expired_tokens` rewrites `tokens.json` at every sign-in *outside* the `.tokens.lock` that `_api_store_token` holds, so two sign-ins at the same moment can drop the other one's fresh token (the sweep met it signing in four browsers at once, and now signs in one after the other) | other repository | one-line fixes in `.scripts/api-server.sh` (the last: run the cleanup inside the same `flock`) |

## Sweep findings

`tests/ui-sweep.mjs` against the lab (`tests/lab/lab.sh`), after every batch of fixes (each batch also passed
`npm run typecheck` and `npx vite build`):

| run | the check | result |
|---|---|---|
| 1 | first version | the sweep itself crashed |
| 2 | 38 pages × 2 themes × 2 widths, safe clicks | 152 runs · 1286 checks · 374 clicks · **52 failures**: 44 unnamed controls, 6 phone overflows (Activity's tabs, the Networks header), 2 empty elements |
| 3 | + the setup wizard's first run; openers (Guide, Batch mode, New …) and the checks again inside what they open | 156 runs · 1938 checks · 690 clicks · **68**: 60 unnamed buttons in modals, guides and result panels, 8 empty table headers |
| 4 | — | **4**: Volumes' select-all (fixed while the run went) |
| 5 | — | **0** |
| 6 | + every select, input and text area needs a name | **17**: 16 Config text rows (a placeholder that can be empty is no name), 1 page that stayed blank for 30 s (as in run 7) |
| 7 | + a page that does not render: its screenshot and text | **1**: Backup (light, desktop) blank white for 30 s — no console message, no failed request: its modules never all arrived from the Vite dev server, which serves them one by one to four browsers at once. The sweep now names the requests still open and gives a blank first load one more try, listed in the summary, never hidden; blank twice fails |
| 8 | — | **0**, and no first load needed a second try |

Everything the runs reported is fixed (rows 13–22 above), nothing is whitelisted beyond Vite's own messages,
the React DevTools hint and a network change. What the sweep does not see: destructive and saving actions
(never clicked), forms submitted, drag and drop, the Electron and Android shells, colour contrast, and a real
screen reader.

The final run (run 8, the tree of this branch's last source commit):

```
39 pages × 2 themes × 2 widths = 156 runs · 1938 checks · 690 clicks · 11536 focus checks · 401 s
failures: 0
```

## Merging into v2.0.0

This branch starts at `bbb9ff0`; `v2.0.0` has since taken the themes work (a dark and a light look per theme,
a theme engine that restyles the colour classes and Mantine's variables — including the `--dcs-*` tokens
`lib/mantine.tsx` of this branch gives its fields, dropdowns and chips). A trial merge in a throwaway worktree:

```bash
git merge refs/heads/v2.0.0      # one conflict, src/renderer/pages/SetupWizard.tsx: v2.0.0 renamed the
                                 # wizard's "Theme" preference "Mode", this branch named its select —
                                 # keep both: <label …>Mode</label> + <select aria-label="Mode"
node scripts/theme-classes.mjs   # the colour-class inventory check:themes holds CI to (this branch uses a few other classes)
npm run typecheck && npm run check:themes && npx vite build
```

The merged tree typechecked, passed `check:themes` (2265/2265) and built; the sweep on it (DCS Emerald, both
modes) found nothing: 156 runs · 1938 checks · 690 clicks · 11648 focus checks · failures 0. Nord Night, Rosé
Pine Dawn, Gruvbox, Paper Light and Dracula, looked at by hand, dress this branch's picker, badges, segmented
controls and switches in the theme.
