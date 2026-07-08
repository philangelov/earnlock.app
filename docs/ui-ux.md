# EarnLock — UI/UX Design System

> Status: implemented design system (transcribed from the `EarnLock.dc.html` design
> prototype). Companion docs: [`architecture.md`](./architecture.md),
> [`api-contract.md`](./api-contract.md). Design direction: **Apple Fitness** (calm,
> big numbers, rings) for the screen-time surfaces; **Mimo/Duolingo** (friendly,
> progress-driven) for the quiz flow.

## 1. Principles

1. **Light-first with a real dark theme.** The app defaults to light (matching the
   prototype) and offers a persisted in-app light/dark toggle (Profile → Appearance,
   stored in AsyncStorage). Every token has a light and a dark value.
2. **The number is the reward.** Balances and countdowns are the hero of the ring
   screens — big Baloo 2 numerals inside a `ProgressRing`, like closing an activity ring.
3. **Friction where it matters.** Learning Mode's 10-second locked button and the SOS
   warning are intentional friction, and should *look* intentional, not broken.
4. **One CTA per screen.** Locked, Quiz, Earned — each has a single obvious next action
   (a `PrimaryButton`).
5. **Consistent tokens.** Every color comes from
   [`frontend/src/theme/tokens.ts`](../frontend/src/theme/tokens.ts)
   (`LightTokens` / `DarkTokens`); no ad-hoc hex values in components.

## 2. Color tokens

All tokens live in [`frontend/src/theme/tokens.ts`](../frontend/src/theme/tokens.ts) and are
consumed via the `useTokens()` hook from `frontend/src/theme/theme.tsx`.

### 2.1 Neutrals & surfaces

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#eef0f6` | `#000000` | screen background |
| `bg2` | `#ffffff` | `#000000` | alternate page background |
| `surface` | `#ffffff` | `#121216` | cards, list rows, option buttons |
| `surface2` | `#e9eaf1` | `#1e1e24` | ring tracks, disabled fills, progress tracks |
| `text` | `#191a24` | `#ffffff` | primary text |
| `text2` | `#666a7a` | `#9a9aa4` | secondary text, descriptions |
| `text3` | `#8f92a4` | `#84848f` | tertiary text, section labels, inactive tabs |
| `border` | `#e3e4ee` | `#2a2a31` | hairlines, card & option borders |
| `scrim` | `rgba(8,8,14,0.55)` | same | dim overlay behind modals & locked-app tiles |

### 2.2 Accent families

Four accent families, each with a `*Soft` variant (same hue at ~15% alpha in dark; a pale
tint in light) for icon boxes, chips, and banners:

| Token | Light | Dark | Role |
|---|---|---|---|
| `primary` | `#7c3aed` | `#8b5cf6` | purple — main CTAs, selection, progress |
| `primaryPress` | `#6a2fd8` | `#7a45f0` | pressed primary fill |
| `primarySoft` | `#f0e9ff` | `rgba(139,92,246,0.18)` | tinted primary surface |
| `onPrimary` | `#ffffff` | `#ffffff` | text/icon on a `primary` fill |
| `success` | `#00a851` | `#00e676` | green — earned time, correct answers |
| `successSoft` | `#e0f7ea` | `rgba(0,230,118,0.15)` | correct-answer fill |
| `danger` | `#f5384e` | `#ff4d5e` | red — locked state, SOS, wrong answers |
| `dangerSoft` | `#ffe8ea` | `rgba(255,77,94,0.15)` | wrong-answer fill, debt banner |
| `pink` | `#e6248a` | `#ff2d9b` | pink — streak, journey accents |
| `pinkSoft` | `#ffe4f1` | `rgba(255,45,155,0.16)` | tinted pink surface |
| `blue` | `#0a84ff` | `#1e9bff` | blue — coins, info |
| `blueSoft` | `#e2efff` | `rgba(30,155,255,0.16)` | tinted blue surface |

Role aliases map onto these families (so screens can name the *role* they mean):
`cyan`/`gold` → blue, `teal` → success, `orange`/`fire` → pink. `cyan`, `teal`, and
`orange` have matching `*Soft` variants; `gold` and `fire` are bare color aliases
without `*Soft` counterparts.

Usage in components:

```ts
const t = useTokens(); // LightTokens or DarkTokens
<View style={{ backgroundColor: t.surface, borderColor: t.border }} />
```

**Semantic usage (don't mix):** `primary` = interactive/CTA. `success` = time & correctness.
`danger` = locked, SOS, and wrong. `pink` = streak/journey flair. `blue` = coins/info.
Never use `danger` for a normal CTA.

> Note: the splash screen (app.json) still uses the legacy blue `#208AEF`; product UI does
> not — all in-app color comes from the tokens above.

## 3. Typography

Two Google Font families, loaded via `@expo-google-fonts` in
`frontend/src/app/_layout.tsx` and referenced through the `Font` map in
`frontend/src/theme/tokens.ts`:

- **Baloo 2** — headings, titles, CTAs, and the big hero numbers.
  Weights: `Baloo2_500Medium`, `Baloo2_600SemiBold`, `Baloo2_700Bold`, `Baloo2_800ExtraBold`.
- **Nunito** — body text, labels, captions.
  Weights: `Nunito_400Regular` … `Nunito_900Black`.

On native, custom font weights only apply through the exact family name, so components
reference the weighted variant directly (e.g. `Font.baloo700`) instead of `fontWeight`.

Representative scale (values from the implemented screens):

| Role | Font | Notes |
|---|---|---|
| Hero number | Baloo 2 800, ~40–56 | ring balance / minutes-earned count-up |
| Screen title | Baloo 2 800, ~24–28 | e.g. SOS sheet title, headlines |
| Section header | Baloo 2 700, ~18–22 | card titles |
| CTA label | Baloo 2 700, 17.5 | `PrimaryButton` |
| Body | Nunito 400/600, ~15–16 | questions, descriptions, explanations |
| Label / caption | Nunito 700/800, ~11–13 | section labels, chips, tab labels (often uppercase, `text3`) |

*(Recommended, not yet applied: `fontVariant: ['tabular-nums']` on live countdown digits
so they don't jitter.)*

## 4. Spacing, radius, layout

There is no shared exported spacing scale yet — values are transcribed 1:1 from the design
prototype. The conventions in the implemented screens:

- **Screen padding:** 20–28 horizontal (most screens use 26).
- **Corner radius:** cards ~19–24, `PrimaryButton` 19, bottom-sheet top corners 32 — always
  with `borderCurve: 'continuous'` for the squircle look.
- **Big CTA button:** full-width `PrimaryButton` — `primary` fill, `onPrimary` label,
  vertical padding 17, colored drop shadow (`0 12px 20px {fill}66`), 0.97 press-scale.
- **Safe areas:** `Screen` applies the top inset (the OS draws the real status bar);
  the custom `TabBar` pads by the bottom inset; non-tab screens opt into `bottomInset`.
- **Pinned CTAs:** `Screen`'s scroll container uses `flexGrow: 1`, so a
  `<View style={{ flex: 1 }} />` spacer pins the CTA to the bottom.

## 5. Component inventory

**Implemented (in [`frontend/src/components`](../frontend/src/components)):**

| Component | Purpose |
|---|---|
| `Screen` | page container: theme background, top safe-area inset, optional scroll |
| `PrimaryButton` | full-width Baloo 700 CTA with press-scale, colored shadow, disabled state |
| `ProgressRing` | SVG donut (track + arc from 12 o'clock); supports concentric rings (Stats uses three) + centered overlay content |
| `TabBar` | custom bottom tab bar for the `(tabs)` group (Home / Journey / Stats / Profile) |
| `Icon` | every SVG glyph from the prototype, transcribed into `react-native-svg` |

**Patterns currently implemented inline in screens** (candidates for extraction later, not
separate components today):

| Pattern | Lives in |
|---|---|
| Quiz option row (selected/correct/wrong states + check/x badge) | `app/quiz.tsx` |
| 10s locked "Keep reading…" continue button with progress fill | `app/learning.tsx` |
| Subject select cards | `app/subjects.tsx` |
| Streak/coin stat pills | `(tabs)/home.tsx`, `(tabs)/journey.tsx` |
| SOS-debt banner (`dangerSoft`) | `(tabs)/home.tsx` |
| Locked-app tiles with `scrim` + lock overlay | `(tabs)/home.tsx`, `app/blacklist.tsx` |

## 6. Answer-state colors (Quiz)

All option rows use a 2px border on a `surface` fill:

| State | Fill / border | Extra |
|---|---|---|
| Default option | `surface` + `border` border | — |
| Selected (pre-check) | `primarySoft` + `primary` border | — |
| Correct answer (post-check) | `successSoft` + `success` border | `checkCircle` badge in `success` |
| Picked wrong (post-check) | `dangerSoft` + `danger` border | `xCircle` badge in `danger` |
| Other options (post-check) | `surface` + `border` border | dimmed (`opacity: 0.5`) |

The Recap fill-in-the-blank chip uses the same primary/success/danger state colors.

## 7. Screens (wireframe descriptions)

Ordered by the user's journey. Routes are files in
[`frontend/src/app`](../frontend/src/app) (expo-router).

> **Backend wiring status:** the frontend currently runs entirely on the mocked zustand
> store (`frontend/src/store/useEarnLock.ts`) and static content
> (`frontend/src/store/content.ts`) — fixed questions, local reward math, persisted
> onboarding. The per-screen endpoint notes below describe the **planned** wiring to the
> Flask backend (`/auth/*`, `/profile`, `/quiz/generate`, `/quiz/submit` exist today; the
> other endpoints mentioned are not implemented yet — see
> [`api-contract.md`](./api-contract.md)).

### 7.1 Welcome — `index`
Logo icon, one-line pitch, benefit rows, single **"Get started"** CTA → `/grade`.
Redirects straight to `/home` once `onboarded` is set.

### 7.2 Onboarding — `grade` → `subjects` → `import` → `blacklist`
Full-screen steps, each with a pinned "Continue" `PrimaryButton`:
1. **Grade** (`/grade`) — grade stepper (up/down), one big value.
2. **Focus Subjects** (`/subjects`) — multi-select subject cards (Math, History, Biology,
   English, Physics, Chemistry, Geography, Coding).
3. **Knowledge import** (`/import`) — paste notes or pick a document
   (`expo-document-picker`); also reachable later from Profile → Knowledge Hub.
4. **Blacklist** (`/blacklist`) — toggle which apps get locked; completes onboarding and
   replaces to `/home`.
*(Planned wiring: save via `PUT /profile` after register/login. On iOS the blacklist step
will open the native `FamilyActivityPicker` — not yet implemented.)*

### 7.3 Auth (login / register) — **not yet implemented in the frontend**
The backend exposes `POST /auth/register` and `POST /auth/login` (Supabase Auth JWTs),
but there are no auth screens yet. Planned: email + password fields on `surface` inputs,
primary CTA, secondary link to switch mode; store the JWT and continue to the tabs.

### 7.4 Home tab — `(tabs)/home`
The lock/timer screen, both states in one screen:
- Header: greeting + streak (`fire`) and coin (`gold`) pills.
- Hero card: `ProgressRing` — **locked**: `pink` sliver, `dangerSoft` lock icon box,
  "Locked / 0 min available"; **unlocked**: `success` ring counting the remaining
  minutes down live (`M:SS`).
- Primary CTA: **"Earn screen time"** → `/journey`.
- SOS-debt banner (`dangerSoft`) when repaying an SOS.
- Locked/unlocked app tiles (lock overlay uses `scrim`).
- Bottom: "Emergency unlock" row → `/sos`.
*(Planned wiring: balance from the backend instead of the local `unlockUntil` timestamp.)*

### 7.5 Journey tab — `(tabs)/journey`
Mimo-style level map: an SVG road with level nodes (done / active / locked), a breathing
pulse on the active node, coin + streak pills on top. "Start" on the active level resets
the quiz flow and pushes `/quiz`.

### 7.6 Quiz flow — `quiz` (reference: Mimo)
- Header: thin progress bar (`primary` on `surface2`), back + close affordances.
- Body: subject tag (colored dot: Biology = `success`, History = `pink`), prompt, 4
  emoji-labeled options (states in §6). Currently 2 static multiple-choice questions
  (`MC_COUNT` from `store/content.ts`) plus the recap step.
- Button: **"Check"** → correct: "Continue →"; wrong: "See why →" routes through
  **Learning Mode** (`router.replace`, so the loop never stacks screens).
- After the last question → `/recap`.
*(Planned wiring: questions from `POST /quiz/generate` — 5 questions, or 7 in SOS debt —
and grading via `POST /quiz/submit`.)*

### 7.7 Learning Mode — `learning`
Shown per wrong answer: "LEARNING MODE" tag, star icon in a `primarySoft` box, the
question's explanation, and a continue button **disabled for 10 seconds** with a visible
countdown ("Keep reading… Ns") and a `primarySoft` progress fill sweeping across the
button. Forces the child to read. Then back to `/quiz` (or `/recap` after the last
question).

### 7.8 Recap + Earned — `recap`, `earned`
- **Recap** (`/recap`): fill-in-the-blank sentence; pick the word chip, check, then →
  `/earned`.
- **Earned** (`/earned`): `success` ring counting **+15 minutes** up, "Nice work!" copy,
  unlocked app tiles, CTA **"Start using my apps"** → claims the reward (unlock window in
  the store) and returns `/home`.
*(Planned wiring: `earned_seconds` / `new_balance_seconds` from `POST /quiz/submit`;
reward rules live in `backend/app/config.py` — 900s per quiz.)*

### 7.9 SOS — `sos` (transparent modal)
Presented as a `transparentModal` bottom sheet over the current screen (`scrim` backdrop,
tap outside to dismiss):
- `shieldAlert` icon in a `dangerSoft` box; copy: unlock all apps for **2 minutes**, right
  now.
- Warning banner: **1 SOS per day**; using it puts you in debt — repaid by **finishing
  your next quiz** (which is longer: 7 questions instead of 5 on the backend).
- CTA in `danger`: "Use my SOS (2 min)" — disabled ("No SOS left today") once used.
*(Planned wiring: a backend SOS endpoint — not implemented yet; today the store flips
`sosUsed`/`debt` locally.)*

### 7.10 Wake-Up Lock — `wakeup`
Immersive full-bleed sunrise gradient (fixed palette, identical in light/dark — it's a
piece of art, not a themed surface): "07:30 / Good morning", copy that social apps are
locked, a "3 questions to unlock" badge, and **"Start morning quiz"** → `/quiz`.
Reached from Profile → Wake-Up Lock.
*(Planned wiring: native scheduled lock + a backend wake-up status/complete flow — not
implemented yet.)*

### 7.11 Stats tab — `(tabs)/stats`
Apple-Fitness-style progress: three concentric activity rings (questions = `pink`,
minutes earned = `success`, day streak = `cyan`) with a legend, weekly focus bars, and
per-subject mastery. Currently all static sample data from `store/content.ts`.

### 7.12 Profile tab — `(tabs)/profile`
Avatar with `primary` ring, name, grade + subjects chips, stat tiles (streak / coins /
solved), then settings rows: **Knowledge Hub** → `/import`, **Locked apps** →
`/blacklist`, **Wake-Up Lock** → `/wakeup`, **Exchange rate** (info), **Appearance**
(light/dark toggle).
*(Planned wiring: grade + subjects via `GET`/`PUT /profile`.)*

## 8. Navigation map

```
index (Welcome; redirects to /home once onboarded)
   └─▶ /grade ─▶ /subjects ─▶ /import ─▶ /blacklist ─▶ (tabs)

(tabs) — custom TabBar: home · journey · stats · profile
   home ──▶ journey ──▶ quiz ⇄ learning ─▶ recap ─▶ earned ─▶ home
   home ──▶ sos            (transparent-modal bottom sheet)
   profile ─▶ import · blacklist · wakeup
   wakeup ──▶ quiz         (morning quiz)
```

## 9. Accessibility & polish

- Maintain contrast: the tertiary text tokens were deliberately adjusted from the
  prototype for small-size legibility (`text3` darkened in light, lightened in dark —
  see the comments in `tokens.ts`).
- Theme is an **in-app persisted toggle** (defaults to light, stored in AsyncStorage under
  `earnlock-theme`); the first visible frame waits for the persisted choice so it never
  flashes the wrong theme. (`app.json` sets `userInterfaceStyle: automatic`, but the app
  does not currently follow the OS setting.)
- Countdown/balance digits: use `tabular-nums` so digits don't jitter — recommended, not
  yet applied.
- Honour safe areas: `Screen` handles the top inset, `TabBar` the bottom; the OS renders
  the real status bar and home indicator (no fake "9:41" bar or pill from the prototype).
- Learning Mode's locked button clearly shows *why* it's disabled: the countdown label and
  the progress fill sweeping the button — never a dead button.
- Interactive elements set `accessibilityRole`/`accessibilityState` (see `PrimaryButton`,
  the learning lock button, the SOS backdrop).
