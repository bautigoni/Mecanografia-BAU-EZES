# CLAUDE.md

> Authoritative project guide for agents and developers. `AGENTS.md` points
> here; `ENGINEERING_RULES.md` and `.cursor/rules/*` hold the condensed rules;
> `dbnew.md` is the backend implementation log; `DEPLOY.md` is the ops runbook.

## 1. Project Overview

**TYPELY** (previously codenamed *EduTic*) is a gamified typing and digital
literacy learning app for primary school students. Spanish-first
(Latin-American Spanish), keyboard-driven, real activities — no placeholder
gameplay. Students learn to locate keys, type letters/words, use the spacebar,
Shift, Backspace, tildes and the ñ, and progress through a chain of magical
floating islands of increasing difficulty.

Core visual direction:

- Magical floating islands in a dreamy pastel sky.
- Premium, kid-friendly educational product — playful but never childish.
- Soft 3D fantasy game feeling — bright art, soft shadows.
- Clean glassmorphism UI: translucent cards over the immersive art.
- Minimal interfaces that keep the artwork visible at all times.

## 2. Brand & Naming

- **Product name:** TYPELY (uppercase wordmark).
- Internal identifiers like `EduTicUser`, the localStorage prefix `edutic_*`,
  the world ids `island1..island15`, and the npm `name: "edutic"` are kept for
  backward compatibility — only **user-facing strings** read "TYPELY". URLs,
  asset paths and localStorage keys are stable and must not be renamed.

## 3. Architecture (current)

TYPELY started frontend-only (localStorage) and now has a real backend. It runs
as **three Docker containers behind a Caddy reverse proxy** at
`typely.bauhub.online`:

| Layer | Stack | Where | Exposed |
| --- | --- | --- | --- |
| Frontend | Vite 7 + **React 19** + TypeScript + **Tailwind 4**, built to static files served by Nginx | `src/`, `Dockerfile`, `nginx.conf` | `127.0.0.1:3005` |
| API | **Fastify + Drizzle ORM** (TS, ESM) | `api/`, `Dockerfile.api` | `127.0.0.1:3006`, proxied under `/api/*` |
| Database | **Postgres 16** | `db/init/*.sql` | loopback only |

- **Hot path stays local.** The typing engine reads/writes `localStorage` so the
  game never blocks on the network. The API only receives a batched
  level-complete POST and is the source of truth for cross-device progress +
  teacher/admin dashboards.
- **Graceful fallback.** `src/utils/api.ts` + `src/hooks/useAuth.tsx` fall back
  to the localStorage user list when the API is unreachable, so demo mode and
  offline play keep working. `usingApi` is exposed so dashboards can show a
  "backend offline" state.
- See `dbnew.md` for the full backend log and `DEPLOY.md` for the 3-container
  deploy/ops runbook. The optional `server/index.mjs` is a separate invitation-
  email scaffold (NOT in compose) — don't assume it's running.

## 4. Roles & Auth

Roles: `superadmin`, `admin-sede`, `profesor`, `alumno`. After login each role
lands on its own surface via `routeForRole` (`/admin-general`, `/admin-sede`,
`/profesor`, `/mundos`).

- **Demo mode is student-only.** `demoLogin()` in `src/utils/storage.ts` always
  returns the seeded demo student and routes to `/mundos`. It can never reach an
  admin/teacher surface — this is a hard rule.
- **Staff** (superadmin/admin-sede/profesor) sign in with username/password via
  `authenticateAny`; students are blocked from the staff form path. Superadmin
  `admin`/`admin` always works via a defensive fallback.
- **Google sign-in** matches by normalised email (`normalizeEmail`, server-side
  ID-token verification against Google JWKS — never trust the client payload).
- **Temp passwords:** sede admins are created/reset with a temp password +
  `mustChangePassword`; `ProtectedRoute` forces `/cambiar-contrasena` until
  changed. Google (passwordless) bypasses it. Never display the current password.
- **RBAC** (`api/src/rbac.ts`): `canGrantRole(actor,target)` — an `admin_sede`
  can never grant `admin_sede` or higher; `canActOnSede` blocks cross-sede
  mutations. Every user-mutating endpoint calls these.
- **Read-only impersonation (support)** — `POST /api/admin/impersonate`
  (`api/src/routes/support.ts`) lets superadmin/admin-general/admin-sede VIEW
  another in-scope account for 30 min after a **triple check** (own password +
  exact phrase `ACCEDER EN MODO LECTURA` + legal acknowledgment). It mints an
  access token with a `readOnly` claim and NO refresh cookie (dies in 30 min);
  a global preHandler in `server.ts` rejects every mutation made with a
  `readOnly` token. Never targets a superadmin. Front: `ImpersonateModal` +
  global `ImpersonationBanner` (countdown), wired through `useAuth`
  (`startImpersonation`/`stopImpersonation`). Audited as `impersonate_start`.

## 5. Visual Design System

### Typography
- Loaded from Google Fonts in `index.html`:
  - **Fredoka** (500/600/700) — display: headings, key labels, buttons, wordmark.
  - **Nunito** (600–900) — body, inputs, paragraphs.
- CSS variables in `src/styles/global.css`:
  `--font-display: "Fredoka", …` and `--font-body: "Nunito", …`.

### Color palette
- Sky blue `#9fc8ff` `#cfeeff`; deep navy `#17355f` `#153b78`; turquoise/mint
  `#22c7b8` `#54e8c6` `#5be8ba`; electric blue/violet `#536bff` `#3159e8`
  `#7c71ff` `#9b7cff` `#5932d4`; soft pink `#ff9fca`; gold `#facc15` `#ffd552`;
  glass white `rgba(255,255,255,0.55→0.92)`.

### Gradients / radius / shadows / animation
- Primary action gradient: `linear-gradient(135deg, #54e8c6, #25c8df, #536bff)`.
- Magical/completion: `linear-gradient(145deg, #5be8ba, #607bff, #ff9fca)`.
- Radius: small 14–18px, pills/buttons 18–24px, glass cards 24–36px, circle 999px.
- Shadows are soft and colorful, never harsh black. Glass panels:
  `0 24px 60px rgba(54,86,134,0.2)`.
- Animations are soft and purposeful; honour `prefers-reduced-motion: reduce`.

### Keyboard (GameplayPage)
- Five rows (`num`, `top`, `home`, `bot`, `mod`), each with its own gradient so
  kids can scan home-row position by colour. Per-key hover lift, shine sweep,
  press-pop. Assisted mode highlights the `expectedKey` derived in `keyCapFor()`.

## 6. Responsive System

> **Primary target device: touch Chromebooks** (Acer and similar) — small but
> rectangular screens. Many of them are **3:2**, not 16:9 (1366×912, 2256×1504),
> which matters because all the island art is 16:9. Phones are NOT a target yet;
> they are a planned future step (see §6.2). Optimise for the Chromebook first.

`src/styles/global.css` holds the visual system + all page CSS. Responsiveness
targets three device classes:

- **Common monitors (≥1280px):** the default desktop layout.
- **Small laptops / Chromebooks (1280–1366 wide but SHORT, ~768/800 tall):** the
  real constraint is *height* — handled by the existing `@media (max-height: …)`
  blocks (720/620/560). Width layout = desktop.
- **Phones (≤768px):** handled by a single consolidated **"RESPONSIVE PASS"
  section appended at the END of `global.css`** (width-only `≤768 / ≤600 / ≤430`
  queries, placed last so they win the cascade without editing the scattered
  earlier overrides). Desktop/Chromebook are untouched by it.

### 6.1 Island stage — the level-map coordinate system

The island map has ONE coordinate system, and everything on it is measured as a
percentage of that system. Never `vmin`, never pixels.

- `.island-stage` (in `global.css`) is a box with the art's own aspect ratio,
  centred and **contained** — the art always fits entirely, so a level node can
  never end up off-screen. `IslandDetailPage` only supplies the ratio through
  `--art-ar`; the box itself is pure CSS, with no measuring and no `resize`
  listener.
- Behind it, `.island-backdrop` covers the viewport and may crop freely: it
  fills the bands that `contain` leaves over. `island1` uses the real pastel sky;
  every other world reuses its own art, scaled and blurred
  (`.island-backdrop--blur`). That blur disappears once the art ships in layers.
- Level nodes size themselves as a **% of the stage** (`clamp(2.75rem,5.34%,14rem)`
  + `aspect-square`), and the number inside uses `cqw` against the node. The
  `5.34%` and `24.21cqw` reproduce the original `9.5vmin` / `2.3vmin` at
  1920×1080 — that is the reference resolution for every conversion here.
- Node positions live ONLY in `src/data/levelPositions.ts`, as percentages of
  the art. **Never** freeze a position as CSS: a rule like
  `#btnisland6lvl1 { transform: translate(15px,-35px) }` is valid at exactly one
  screen size and drifts at every other. The `LevelPositionEditor` copies a data
  array — use that. Do not use `DevLayoutEditor`'s "Generar CSS" on level nodes.

Measured after the switch to `contain` (2026-08-24): the node/stage ratio stays
at 5.34 % from 375×812 to 3440×1440, and no node falls off-screen anywhere. On
3:2 Chromebooks the old `cover` box was cropping **16 % of the image**.

**The platform discs stay painted into the art** — that is a deliberate art
decision. So placing a level is still a visual judgement: the node has to land
on a disc someone drew. What `contain` buys is that once it is right, it stays
right at every resolution.

**Placing levels — the visual editor.** This is the intended workflow; it saves
straight to `src/data/levelPositions.ts`, no copy-paste.

1. Enable it once per browser (it persists):
   `localStorage.setItem("typely_dev_editor","1")`
2. Open `/worlds/island2?editor=1` on the dev server.
3. Drag a node — the whole block moves (base, blue presser, number, glow).
   Arrow keys nudge it; `Shift` makes the step coarse (x10) and `Alt` makes it
   fine (position 0.1 %, rotations 0.5°, scale 0.01). The handler calls
   `preventDefault` on every arrow **before** checking whether a node is
   selected, because `Alt + ←` is the browser's Back and would otherwise leave
   the page mid-adjustment.
4. `S` `X` `Y` `Z` `P` toggle scale / rotateX / rotateY / rotateZ / perspective;
   arrows then adjust the active one. `Esc` deselects.
5. `N` and `M` do the same for the **number** drawn on top of the button: `N`
   moves it (all four arrows), `M` resizes it. See below for why it needs its
   own controls. The **"Ver apretado"** toggle switches the selected node to its
   pressed art, and while it is on `N` and the sliders write the *pressed*
   number position instead of the resting one.
6. Zoom with the wheel (anchored at the cursor), `+` / `-`, or the panel
   buttons; pan with `Space` + drag or the middle mouse button; `0` fits.
7. **`Ctrl/Cmd + S`, or the green "Guardar en el archivo" button** — writes the
   island's array and Vite's HMR reloads it. "Copiar arreglo" stays as a
   fallback for when the dev endpoint isn't there.

Everything the editor stores is resolution-independent: position in **% of the
stage**, sizes as **scale factors**, tilts in **degrees**. It never writes a
pixel — that is what used to break at other resolutions.

**Why the number needs its own offset (`numX` / `numY` / `numSize`).** The
number is drawn at the centre of the node box, which is the centre of the
button PNG. The button image gets the node's tilt and scale; the number
deliberately does **not** — it keeps the base camera angle so it stays readable
on a steeply tilted node. The moment a node is tilted or scaled, therefore, the
canvas centre stops coinciding with the visible centre of the raised disc, and
the number reads as off-centre. These three fields correct it per level.

They are in **% of the button's width** (`cqw`), never pixels: the node declares
`container-type: inline-size`, so a `numY: 2` is 2 % of that button's width at
any resolution and the correction scales with the button. The same rule as
everything else here — a pixel offset would be right at one screen size only.

**The pressed state needs its own pair.** When a button is pressed its disc
sinks, and *how far* is decided by each island's art — a cookie and a stone ring
do not travel the same distance. `numXHover` / `numYHover` hold the number's
position in that state; left undefined they fall back to the resting pair. Note
they are written even when `0`, because "absent" and "zero" mean different
things here. The generic sink itself used to be a hardcoded `-6px → -1px`, which
made the effect a different size on every screen; it is now `-5.85cqw →
-0.97cqw`, the same values converted at the 1920×1080 reference.

**Editing the pressed state needs the toggle**, not the mouse: to see it by
hovering you would have to hold the pointer over the node, and then the keyboard
is unusable. That is what "Ver apretado" is for.

The panel also has a **"NumSize global"** slider. That one multiplies every
number on the island and is **not saved** — it is for eyeballing a global size
before hard-coding it in `IslandDetailPage`. The per-level `Num tamaño` is the
one that persists.

**The zoom is a lens, not a state.** It is a CSS `transform` on a layer wrapping
the whole stage, so it changes nothing in the data: `pctFromClient` keeps working
untouched because `getBoundingClientRect()` already returns the transformed rect.
Verified: at 1.95x, clicking a node's visual centre still reports its exact
stored `x` / `y`. Two details that are easy to get wrong if this is ever
reworked — the transform goes on its **own layer**, not on `.island-stage`, whose
entrance animation also animates `transform` and would fight it; and the HUD
panel is rendered through a **portal to `<body>`**, or the lens would magnify the
control panel along with the map.

The write endpoint lives in `scripts/vite-plugin-level-positions.ts`, registered
in `vite.config.ts` with `apply: "serve"`, so it exists only under `vite dev`
and never reaches the production bundle or the Nginx container. It preserves the
comment block at the head of each island's array and the per-line trailing
comments.

To check placement without opening the app:

```bash
node scripts/preview-level-positions.mjs                    # las 15 islas
node scripts/preview-level-positions.mjs island6 --grid     # con grilla de %
node scripts/preview-level-positions.mjs island6 --zoom 62,26,20   # x,y,span%
```

It draws each node over the real art at its true relative size (the same
5.34 %), writing PNGs to `.preview-niveles/` (gitignored). Needs
`npm install sharp --no-save`. Use it to confirm a node sits on its disc before
and after editing `levelPositions.ts`; the `--zoom` view carries a fine
percentage grid so you can read a platform's centre straight off the image.

### 6.2 Planned: scrollable island map for phones (NOT implemented)

`contain` guarantees the whole island is visible, which is right on Chromebooks
but cramped on a phone: at 375×812 the stage is only 375×211, and the 44 px
minimum touch target inflates each node to 11.7 % of the stage (vs the correct
5.34 %), leaving buttons overlapping. Phones are not a target yet, so this is
deliberately left undone.

When phones do become a target, do NOT try to make the whole island fit. Let it
take the full height and **pan horizontally** — the same thing Candy Crush and
Duolingo do with their maps. At 375×812 that yields a 1443×812 stage and 77 px
nodes: correct proportions, comfortable touch targets, no clamping. Note this is
the exact stage size the old `cover` code already produced — what was missing
was a way to *reach* the parts beyond the screen edge.

Coordinates do not change. The stage stays the same reference system; only the
window onto it moves. The sketch:

```css
@media (max-width: 768px) {
  .island-stage-wrap { overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; }
  .island-stage {
    position: relative; inset: auto; margin: 0;
    height: 100%;
    width: auto;          /* aspect-ratio derives the width */
  }
}
```

Three things still have to be built on top of that sketch:

1. **Auto-centre on entry.** Without it the student opens the map on a random
   slice. `scrollIntoView({ inline: "center", block: "nearest" })` on the
   "Actual" node when the world mounts.
2. **A scroll affordance.** A primary-school kid will not guess there is more map
   to the right. An edge gradient, or a one-time nudge animation.
3. **Pick the scale.** Full height is 3.85 screens of panning. The minimum that
   keeps a node at 44 px without the clamp kicking in is an 824 px stage, i.e.
   2.2 screens. Choose somewhere in that range.

One known wrinkle: the popover's collision logic (`useLayoutEffect` in
`IslandDetailPage`, keyed on `viewportTick`) clamps against the **viewport**.
Inside a scrolling container that maths has to account for scroll offset.

The `.island-backdrop` sits outside the scrolling wrapper, so it stays put while
the map pans — a free parallax effect.

Key responsive rules in that section:
- Global `overflow-x: hidden` safety ≤768px.
- **Gameplay:** the keyboard's per-key `min-width` is reduced so all rows fit a
  phone (keys shrink, stay centred); target card / status / stage go full-width;
  decorative robots hidden; compact exit button.
- **Island detail:** back/profile become icon-only, compact HUD, no collision.
- **Logros:** the 4-column reward grid collapses to 2×2.

### 6.3 Level buttons — one themed button per island

The node the kid presses is not one shared graphic. **Each of the 15 islands has
its own button**, redesigned in the material of its terrain: stone with grass on
the green islands, ice and bronze on the clockwork one, a glazed cookie on
candyland. A grass button on a pink cake reads as a mistake, which is why one
button could never serve fifteen worlds.

`levelButtonFor(worldId, pressed)` in `src/utils/assets.ts` resolves them from
`LEVEL_BUTTON_BY_WORLD`. All fifteen are registered; an island missing from that
map falls back to the plain stone `btn-default`, which is now a safety net
rather than anyone's normal state.

**Two images per island** — resting and pressed. The game swaps them on hover,
so they must be drawn with the same camera, the same size and in the same place
on the canvas; if they differ the button jumps under the cursor.

**Storage.**

| Where | What | Tracked |
|---|---|---|
| `Images/level-buttons/btn-islandN.png` | the raw two-state sheet exactly as generated | yes, never edited |
| `Images/level-buttons/LEEME.md` | the full recipe for adding a new island's button | yes |
| `Images/level-buttons/REFERENCIA-boton-clasico.png` | the shape reference that goes with the generation prompt | yes |
| `public/assets/level-buttons/btn-islandN[-pressed].webp` | what the game loads | yes |
| `public/assets/level-buttons/_backups/` | originals kept before a colour pass | gitignored |

Sheets are never edited by hand. `scripts/import-level-button.mjs` holds a table
of per-island measurements and produces both WebP in one run; re-running it
regenerates them from the untouched source.

**Geometry — the invariant that keeps them interchangeable.** Every button is
framed on a **600×445 canvas with the centre of its base at (299.5, 214)**,
inherited from `btn-default.png`. That is what lets a node's `x`/`y` mean the
same thing in every island: the coordinate lands on the base that rests on the
painted platform, not on the alpha bounding box. The importer picks the largest
scale that still fits the canvas with that centre pinned.

**Sizes are not identical, and that is expected.** Reference base width is
454 px; the fifteen land between **333 px** (island 9) and **454 px** (islands 1,
11, 14, 15). The more the decoration spills outside the footprint — maple
leaves, ferns, sand — the smaller the button has to be drawn to fit the canvas.
Practical consequence: **islands whose base came out small need a higher `scale`
on their nodes.** That is per-island tuning done once in the visual editor.

**The number's contrast is a hard requirement, not a nicety.** The game draws a
large white number on the disc, so the disc must be an even, mid-to-dark colour.
Measured across the fifteen: 2.80:1 (island 1, the only one below the 3:1 floor
for large text) up to 8.0:1. `scripts/lighten-disc.mjs` can lighten or darken
just the disc without touching the rest — it samples the disc's own hue and
matches by hue and saturation, never by lightness, so a gradient survives.

**The number's colour is per island too.** Not completed → **white**, the
highest-contrast option on any disc. Completed → a colour of that island's own,
so progress reads at a glance without a system green pasted over fifteen
different buttons. Each value comes from measuring what the number actually
sits on in that button and taking its **split complement** — the opposite hue
pulled 25 % back toward the original, the relation that contrasts without
clashing — then picking, from a palette of hues that stay vivid, the nearest one
clearing 3.5:1. They live in `LEVEL_NUMBER_DONE` / `levelNumberDoneColor()` and
regenerate with `node scripts/level-number-colors.mjs`. Almost all are light;
island 1 is the exception and goes dark, because its disc is the one pale enough
that white itself only reaches 2.80:1 — the completed colour is what makes that
island legible.

**Adding an island's button:** follow `Images/level-buttons/LEEME.md`. One step
in it is deliberately manual — measuring the base on a percentage grid — and the
file explains why it cannot be automated: decoration spills outside the
footprint asymmetrically and is painted in the same material as the base, so
neither silhouette nor colour detection survives all fifteen cases.

### Login mascots — flanking robots
The two login robots are positioned inline in `LoginPage.tsx` with Tailwind
viewport units (no dedicated CSS class anymore): female left
(`bottom-[17.5vh] left-[5.5vw] max-h-[62vh]`), male right
(`bottom-[7.5vh] right-[8vw] max-h-[72vh]`). They're sized purely by height
so both scale together; the `bottom` offsets stand each robot on a painted
island. Tune those four values for placement/size. The login card is fixed
at `w-[min(32rem,92vw)]` with the original (non-fluid) typography — do NOT
reintroduce vmin-clamped fonts on the login card (it ballooned the UI and
pushed buttons off-screen on short displays).

## 7. Gameplay Curriculum

Defined in `src/data/activities.ts`. Each `Activity` carries `worldId`,
`levelNumber`, `inputType` (`letter | word | phrase | symbol | correction`),
`mode` (`assisted | independent`), optional `requiresShift` / `requiresAccent`,
and a `targets[]` array.

- There are **15 worlds** (`island1..island15`) in difficulty order. The
  **level count is per-island, NOT fixed** — it is driven by the number of
  `Activity` records for that world. To add a level you must add BOTH a new
  `Activity` AND a matching coordinate in `src/data/levelPositions.ts`.
- Difficulty rises by world: letters → words/phrases → mayúsculas, ñ, tildes,
  inverted signs `¿ ¡` → punctuation, symbols, emails, real questions, and
  beyond (digital-skills worlds).
- Helpers: `getActivityById(id)` (falls back to first), `activitiesByWorld[worldId]`.
- Level ↔ activity id mapping: `<worldId>-l<level>` for worlds 2+, legacy ids for
  world 1 (`letter-a1 … backspace-a1`).

### Digital-skills scaffold
`src/data/digitalSkills.ts` defines a parallel `SkillChallenge` model (mouse,
touchpad, windows, tabs, shortcuts, text editing, UI literacy). `SkillLevelView`
/ `ShortcutLevelView` render these; `SkillChallengeShell` provides the pastel chrome.

## 8. Progress Persistence

`src/utils/progress.ts` manages `localStorage.edutic_progress_v1` →
`Record<WorldKey, Record<levelNumber, LevelProgress>>`.

- `markLevelComplete(worldId, level, accuracy, attempts)` at end of `GameplayPage`
  (also POSTed to `/api/progress/complete` when API-backed).
- `levelState()` → `"Completado" | "Actual" | "Bloqueado"`;
  `getCurrentLevelNumber()`; `resetProgress()`.
- `src/data/worlds.ts` rebuilds `World.levels[]` each render from
  `activitiesByWorld` + the progress snapshot, so unlocks reflect live.
- World order is the single source of truth in `WORLD_PEDAGOGY_ORDER`; each world
  shows its pedagogical `displayNumber` (e.g. "M3").

## 9. Project Structure

- `src/App.tsx` — routes + protected-route composition (lazy-loads heavy pages).
- `src/pages/` — `LoginPage`, `WorldsPage`, `IslandDetailPage`, `GameplayPage`,
  `RewardsPage`, `AccountPage`, `MissionsPage`, `SkillLevelView`,
  `ShortcutLevelView`, `ChangePasswordPage`, `AdminGeneralPage`,
  `TeacherPage`, `TeacherClassPage`, `TeacherStudentPage`, plus the routed
  admin-sede screens in `src/pages/admin/` (incl. `ApiInspectorPage` at
  `/admin/api` — superadmin/admin-general/admin-sede only, backed by
  `GET /api/admin/inspector`).
- `src/components/` — `auth/`, `common/` (`Brand`, `Button`, `Toast`),
  `dashboard/DashboardShell`, `dev/LevelPositionEditor`, `digitalSkills/`,
  `layout/TopNav`.
- `src/data/` — `activities.ts`, `worlds.ts`, `levelPositions.ts`,
  `digitalSkills.ts`, `seed.ts`.
- `src/hooks/useAuth.tsx` — API-aware auth provider (async, localStorage fallback).
- `src/utils/` — `api.ts` (typed API client), `assets.ts` (public-URL map),
  `progress.ts`, `storage.ts`, `image.ts`, `googleAuth.ts`,
  `studentStatus.ts`, `userContext.ts`.
- `src/styles/global.css` — entire visual system + page CSS + the responsive pass.
- `api/src/` — `server.ts`, `auth.ts`, `rbac.ts`, `seed.ts`, `db/{index,schema}.ts`,
  `routes/{auth,users,sedes,progress,import}.ts`.
- `db/init/` — `001_schema.sql`, `002_partitions.sql`.
- `public/assets/edutic-art/` — web-safe image copies used by the app.
- `Images/`, `Images-new/` — **original source art (never modified).**

## 10. Asset Pipeline

Originals in `Images/` and `Images-new/` are **never** modified. Web copies live
in `public/assets/edutic-art/` and are produced by the Python helpers
(`Images-new/process_mecano.py` for mascots/favicons, `process_ships.py` for
ships): verify alpha, **trim transparent padding**, downscale to a 1024px longest
edge.

- Reference assets by their stable names via `src/utils/assets.ts` — do not rename.
- The login web copies are kept trimmed (character fills the frame, no dead
  padding) so positioning is predictable — e.g. `mascot-women-wave.webp` is
  ~706×1024 (trimmed from the 1254² source). When replacing art, change the
  original and re-run the scripts; keep the web copy trimmed.
- One-off image edits may use `npx`/Node `sharp` (installed `--no-save`). Local
  asset backups live in `_backups/` (gitignored, not shipped).
- **Level buttons have their own pipeline** and do not go through the Python
  helpers: raw two-state sheets in `Images/level-buttons/`, turned into the
  shipped WebP by `scripts/import-level-button.mjs`. See §6.3 for the geometry
  contract and `Images/level-buttons/LEEME.md` for the step-by-step recipe.

## 11. Mascots — Where They Appear

- **LoginPage:** large flanking robots (female left, male right), sized by the
  proportional formula in §6. Decorative.
- **WorldsPage:** smaller corner mascots, kept inset so islands don't collide.
- **IslandDetailPage:** *no* robots — only the ship pointing at the current level.
- **GameplayPage:** two flanking robots with motivational speech bubbles (error
  tone when accuracy < 60% with ≥1 attempt). Hidden on phones.

## 12. Behaviour Notes (gameplay / island map / login)

- **Gameplay shell** is a fixed-height (`100dvh`, `overflow:hidden`) flex column
  so the keyboard/bg/robots never shift while typing. Adaptive `target-card`
  variants (`letter | word | phrase | symbol | long`); phrases scroll on a single
  line. Level complete → modal with 3-star rating + Reintentar / Volver (no auto-
  advance).
- **Island map**: level bubbles sit on the painted platforms; colour = state
  (green Completado / violet Actual / grey Bloqueado). Positions are platform-
  center % coords in `src/data/levelPositions.ts`. Compact floating HUD
  (`.island-hud`) + popover beside the selected node. **Dev-only** position editor
  (`?editor=1`, gated by `import.meta.env.DEV`, stripped from prod).
- **Login card**: glass card with halo, shimmering "TYPELY" wordmark, role-aware
  form. Card width `min(32rem, …)`.

## 13. Deployment

Containerised behind Nginx + Caddy. `Dockerfile` (frontend, multi-stage
`node:22-alpine` → `nginx:alpine`, runs `npm ci && npm run build`),
`Dockerfile.api` (API), `docker-compose.yml` (services `mecanografia`, `api`,
`db`, all loopback-bound; `db` healthcheck; `api` reads secrets from
`/run/secrets/*`). `nginx.conf` does SPA fallback. `.dockerignore` excludes
`node_modules`, `dist`, `.env*`, `secrets/*`, `Images*/`, `Skills/`, `.claude/`,
docs. Full runbook in `DEPLOY.md`.

### 13.1 Frontend deploy to the Oracle VM — RULE

**Never build the frontend Docker image on the Oracle VM** (`168.75.68.75`,
`/opt/apps/typely`, ~956MB RAM). `docker compose build mecanografia` there takes
15-20 min and BuildKit OOM-crashes. The **required** procedure (≈1 min) is:

1. Build the static bundle **locally** — it must include the Google vars or you
   break sign-in (Vite inlines them):
   `VITE_GOOGLE_CLIENT_ID="…" VITE_GOOGLE_ALLOWED_DOMAINS="" npm run build`.
2. `tar -czf fe-dist.tgz dist nginx.conf` and `scp` it to the VM.
3. On the VM build a **trivial nginx image that only COPYs the prebuilt `dist/`**
   (`FROM nginx:alpine` + COPY `nginx.conf` + COPY `dist`), tag it
   `typely-mecanografia:latest`, then
   `docker compose up -d --no-build --force-recreate mecanografia`.
4. Verify the served bundle hash matches local:
   `curl -s http://127.0.0.1:3005/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'`
   must equal the hash in local `dist/index.html`, and HTTP must be `200`.

The slow on-VM build (`DOCKER_BUILDKIT=0` + detached `nohup`, never BuildKit) is
the fallback ONLY for the **API** image, which can't be shipped as a static
bundle. The VM tracks `dev` (its local branch is named `main` but mirrors
`origin/dev`); the DB is **Supabase**, not the local `db` container.

## 14. Skills (for agents)

- `Skills/skill.md` — **EduTic Design Skill**: pixel-spec for the login card and
  visual system; match reference images, compare by screenshot.
- `Skills/frontend-design/SKILL.md` — Anthropic **frontend-design** skill
  (distinctive, production-grade UI; avoid generic AI aesthetics). A working copy
  also lives at `.claude/skills/frontend-design/` for local Claude Code use.
- `.opencode/agents/` — OpenCode subagents (not Claude Code): `flash` (simple),
  `chill` (standard logic), `pro` (architecture/infra) + the
  `enrutador-complejidad` routing skill.

## 15. Non-Negotiables

- Do not modify original images in `Images/` or `Images-new/` — use the web
  copies under `public/assets/`; regenerate copies via the Python scripts.
- Do not draw islands or mascots with CSS; no background art inside bordered
  frames; no white boxes behind transparent assets.
- Keep student UI immersive and minimal — never make it look like an admin
  dashboard. Gameplay must be real and keyboard-driven, never placeholder.
- Respect RBAC: students only on student surfaces; demo can never be superadmin;
  lower roles never reach higher-role screens.
- Never put secrets in `VITE_*` (inlined into the public bundle). Backend secrets
  (`JWT_SECRET`, `RESEND_API_KEY`, OAuth client secret) stay server-side.
- Keep Docker building; do not bind host ports 80/443 in app compose; keep the
  `127.0.0.1:3005` / `:3006` ports stable. Don't ship dead buttons.
- Spanish must be correct: tildes (á é í ó ú), ñ, mayúsculas, inverted `¿` `¡`.
- **Branch on `dev`, never commit directly to `master`.** `master` is the
  host/production branch; it only changes through a reviewed pull request from
  `dev` when everything is ready (see §17).
- After any code change run `npm run build` (= `tsc --noEmit && vite build`); fix
  failures before claiming done. Report which files changed and how to test.
- Deploy the frontend to the Oracle VM with the prebuilt-`dist` procedure in
  §13.1 — never trigger a full `docker compose build` of `mecanografia` on the
  956MB VM (it OOM-crashes and wastes 15-20 min).

## 16. Quick Start

```bash
npm install          # frontend deps
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # tsc --noEmit && vite build
```

Demo: the login "Entrar en modo demo" button enters as a student. Staff/admin and
the API/DB require the backend (see `DEPLOY.md`). Reset demo data by clearing the
`edutic_*` localStorage keys (listed in `README.md`).

## 17. Branching & Git Workflow

The repo has two long-lived branches:

- **`dev` — all development happens here.** Branch off `dev`, commit your work to
  `dev` (or to short-lived feature branches that merge back into `dev`), and push
  `dev`. This is the default working branch for everyone — humans and agents.
- **`main` — host/production only.** Every push to `main` **auto-deploys** to
  `typely.bauhub.online` via `.github/workflows/deploy.yml`, so it must stay
  releasable at all times.

Hard rules:

1. **Never commit or push directly to `main`.** It changes *only* through a
   pull request from `dev`, and *only* when the work is finished and tested
   ("cuando esté todo listo").
2. **`dev` → `main` via Pull Request.** When everything is ready, open a PR from
   `dev` into `main`, review it, then merge. Do not fast-forward random branches
   into `main` by hand.
3. **Before opening the PR**, run `npm run build` (`tsc --noEmit && vite build`)
   plus `npx tsc -p api/tsconfig.json`, and the deploy checklist (see
   `DEPLOY.md` / §13) so `main` never breaks.
4. Keep `dev` merged up to date with `main` after each release so the two don't
   drift.
5. The legacy `master` branch is historical only — do not use it.

```bash
git checkout dev          # work happens here
# …edit, commit…
git push origin dev       # pushes to origin/dev (never to main)
# when ready for production: open a PR  dev → main  and merge it
```
