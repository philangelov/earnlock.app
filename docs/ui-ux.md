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

> **Data rule: no invented numbers.** Everything the app reports about a learner —
> streak, accuracy, minutes earned, subject mastery, the Learn roadmap — comes from
> `GET /stats`, computed server-side from their real `quiz_history`. `store/content.ts`
> holds only what is identical for every learner (the subject list, the recap exercise).
> There is no demo learner, no seeded streak, and no `coins` (an invented second currency
> that never had a backend — screen-time seconds are the currency). Where a learner has
> done nothing, the screen renders an **empty state**, never a plausible-looking zero.
>
> **Backend wiring status:** `/auth/*`, `/profile`, `/knowledge/*`, `/quiz/generate`,
> `/quiz/submit`, `/screentime/balance`, `/stats` and `/wakeup/*` are implemented. `/sos`
> is not — the client still flips `sosUsed`/`debt` locally. See
> [`api-contract.md`](./api-contract.md).

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

### 7.3 Auth — Sign in with Apple / Google
`onboarding/account.tsx`. EarnLock has no passwords: two provider buttons (Apple's inverts
with the interface per Apple's guidance; Google's keeps its four-colour mark) plus a Skip.
The native sheet returns an identity token, `POST /auth/oauth` exchanges it for a session,
and the tokens go to `expo-secure-store`. A skipped user can browse but cannot earn time —
quizzes are generated and graded server-side.

### 7.4 Today tab — `(tabs)/today`
The lock/timer screen, both states in one screen. Deliberately quiet: one ring, one
sentence, one action, and nothing else competing for attention.
- **`EarnDial`** — a 244pt ring standing free on the page, not boxed in a card: the
  screen's whole job is to answer "am I locked, and for how long", and an edge around the
  answer adds nothing. **Locked** it is an empty monochrome track around a lock glyph
  (restraint reads as calm; red would read as punishment). **Unlocked** the arc fills with
  the accent, a soft aura breathes just *outside* the ring, and the `M:SS` countdown runs in
  tabular numerals. A full ring means "at least one lesson's reward still banked"; it clamps
  rather than overflowing.

  The aura is an SVG `RadialGradient` on an oversized canvas, transparent everywhere inside
  the ring and peaking just beyond its outer edge. Two earlier attempts got this wrong: a
  CSS `radial-gradient` behind the ring filled the dial's interior with a flat pale disc
  (its stops measure to the box's farthest *corner*, not to the ring), and a hairline circle
  drawn to "give the ring an edge" simply read as a stray mark floating around it. The
  inside of the dial belongs to the number.
- One caption, then the single CTA **"Earn screen time"** → `/quiz`.
- SOS-debt banner (`dangerSoft`) when repaying an SOS.
- "Connect Screen Time" card, only when the device can but hasn't.
- Week card: real day streak + minutes earned today, over seven `StreakDots` read from
  `stats.daily` (bucketed in the device's timezone).
- One "Your apps" group: the shielded-app count → `/apps`, and **Emergency unlock** →
  `/sos` directly beneath it. They belong together — both answer "what about my apps?" —
  and the group's footer states the once-a-day rule so the row doesn't have to.

The countdown is *not* the client's to decide. `unlockUntil` is a local mirror of the
server's `unlocked_until`, resynced on mount and on every return to the foreground, and
the device clock is used only to render the digits.

The EarnLock mark lives in the nav bar (`headerRight`), tinted `text3`, where it rides
beside the large title and shrinks away on scroll rather than competing with the dial.

### 7.5 Learn tab — `(tabs)/learn`
A Mimo/Duolingo-style roadmap, where **every node is one real quiz**. Done nodes come
from `quiz_history` and carry the score actually scored (`4/5`); the active node is the
quiz `/quiz/generate` will hand back next; locked nodes genuinely cannot be started until
it is finished. Five quizzes make a chapter, numbered from `stats.totals.quizzes` so the
number stays right past the 30-attempt `recent` cap.
- Top: three pills — day streak, quizzes done, accuracy (the last only once it exists).
- Path: nodes on a serpentine (`sin` at quarter-turns), joined by cubic curves with
  vertical control handles so the trail leaves and enters each node straight down, over a
  faint dot grid. Segments already **walked** are drawn in the accent over a gradient, the
  rest in a sunken neutral — so the path itself reports progress, and the accent always
  terminates exactly at the node you can press. A slow halo breathes on the active node.
- Dark mode: `fill` all but disappears against black, so the unwalked trail, the dot grid
  and the locked nodes each step one rung up the neutral ramp (`fillStrong` / `border`).
  Without that the path looked like it simply stopped at the active node. Depth comes from
  the raised "lip" behind each node rather than a drop shadow, which is invisible on black.
- Chapters render newest-first, so the only pressable thing on the page is on the first
  screenful.

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
- **Recap** (`/recap`): a fill-in-the-blank sentence **authored by the server** in the
  same generation call as the questions, so it closes the idea the quiz actually covered.
  Pick a chip, check, then → `/earned`. It carries its own answer because it grades
  nothing: `/quiz/submit` already paid out before this screen renders. Landing here
  without a quiz session redirects out rather than rendering a broken sentence.
- **Earned** (`/earned`): `success` ring counting **+15 minutes** up, "Nice work!" copy,
  unlocked app tiles, CTA **"Start using my apps"** → claims the reward (unlock window in
  the store) and returns `/home`.
*(Planned wiring: `earned_seconds` / `new_balance_seconds` from `POST /quiz/submit`;
reward rules live in `backend/app/config.py` — 900s per quiz.)*

### 7.9 SOS — `sos` (form sheet)
Presented as a native `formSheet` with `sheetAllowedDetents: 'fitToContents'`, so the
sheet is exactly as tall as its content. **Nothing in the sheet adds `insets.bottom`** —
UIKit already anchors a form sheet above the home indicator, and padding by the safe-area
inset on top of that leaves a band of dead white under the last control, which reads as
the sheet having slipped down the screen.

Contents:
- `exclamationmark.shield.fill` icon in a `dangerSoft` box; copy: unlock all apps for
  **2 minutes**, right now.
- Warning banner: **1 SOS per day**; using it puts you in debt — repaid by **finishing
  your next quiz** (which is longer: 7 questions instead of 5 on the backend).
- CTA in `danger`: "Use my SOS · 2 min" — disabled ("No SOS left today") once used, then
  a plain "Not now".
*(Planned wiring: a backend SOS endpoint — not implemented yet; today the store flips
`sosUsed`/`debt` locally.)*

### 7.10 Wake-Up Lock — `wakeup`
Immersive full-bleed sunrise gradient (fixed palette, identical in light/dark — it's a
piece of art, not a themed surface): "07:30 / Good morning", copy that social apps are
locked, a "3 questions to unlock" badge, and **"Start morning quiz"** → `/quiz`.
Reached from Profile → Wake-Up Lock.
*(Planned wiring: native scheduled lock + a backend wake-up status/complete flow — not
implemented yet.)*

### 7.11 Insights tab — `(tabs)/insights`
Four cards, every figure from `GET /stats`, each chart animated on entry:
- **Time earned** — a 7-day `BarChart` of minutes earned. One series, so no legend; bars
  share one hue and only *today* is accented (a different fact, not a bigger number); an
  idle day draws a 3px seed so "zero" and "absent" don't look alike; exactly one direct
  label (today's).
- **Accuracy** — a `Ring` for where you stand, a `TrendLine` for where you're going
  (last 14 quizzes, y pinned to 0..1 so 96% vs 98% isn't a dramatic climb). The line
  draws on via a growing SVG mask, not a dash offset — `react-native-svg` won't report a
  path's arc length, and guessing it makes the line finish early or repeat.
- **Subject mastery** — one `Meter` per subject, real because `/quiz/submit` tallies each
  question's `subject` into `subject_stats`. Magnitude, not identity: all bars share one
  hue.
- **Screen time** — earned vs spent, where spent is `earned − remaining`.
- Four stat tiles (best streak, quizzes, questions right, time earned): a single number
  needs no axis.

Before the first quiz, the whole tab is a single `EmptyState`. `accuracy` arrives as
`null` (not `0`) precisely so it can.

### 7.12 Profile tab — `(tabs)/profile`
A tappable avatar, name, grade and provider, then three real mini-stats (streak / quizzes /
accuracy) — shown only once `/stats` has answered. Then **Screen Time**, **Appearance**,
**Learning** (grade / subjects / study material) and **Account**.

**The avatar** opens the system photo picker (`expo-image-picker`). The pick is copied out
of the cache directory — which iOS may purge — into the documents directory, and it is that
copy's URI the store persists. The picture never leaves the device: no upload, no column.

**Appearance** is a real `UISegmentedControl` — SwiftUI's `Picker` under
`pickerStyle('segmented')`, via `@expo/ui/swift-ui`. The sliding thumb, press states,
haptics and dark-mode palette are all the system's. Because `@expo/ui/swift-ui` is
iOS-only (importing it elsewhere crashes with "Unable to get view config"), it lives in
`components/SegmentedControl.ios.tsx` beside a token-built fallback in
`SegmentedControl.tsx`, rather than behind a `Platform.OS` branch. Its `Host` is handed
EarnLock's *own* colour scheme, not the device's: appearance is an in-app setting, and
this control is how you change it, so it must repaint with the choice you just made. It is
rendered **without an enclosing card** — a segmented control is already a container, and a
second one around it just draws a box around a box.

**Account** offers **Sign out** (drops the tokens and wipes this device; the account
survives) and **Delete account** (`DELETE /account`, an irreversible cascade). The group
only renders when signed in — a signed-out user has no account to sign out of or delete,
and two buttons that lie about what they do would be worse than none. There is no "Reset
data" and no "Preview lock screen".

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

## 8.1 Navigation chrome

Tab stacks use `tabStackOptions` (`theme/navTheme.ts`): **the Settings-app header,
exactly.** Expanded, there is no bar and the large title sits on the page. Scrolled, the
title collapses into a translucent `headerBlurEffect: 'systemChromeMaterial'` strip — the
frost Settings itself uses — and the content scrolls *under* it, visibly blurred through
the glass (on Today the dial's countdown and aura bleed through the bar).

Every option is load-bearing; each was tried the other way and reverted:

- **`headerTransparent: true`** is what lets content scroll under the bar. False makes the
  bar opaque and pushes content down — no blur, nothing behind it.
- **`headerBlurEffect`** is the frost. `'none'` removes it and the title floats on the raw
  content; **`'systemUltraThinMaterial'` is so faint it reads as no blur at all** (this is
  what "not transparent like Settings" meant). `systemChromeMaterial` is the Settings
  material.
- **`headerShadowVisible: true`** keeps the hairline, which also *pins the material*:
  hiding it (`false`) gives the collapsed bar a transparent background, and the title
  floats on the content again.

The space at rest, and the content scrolling under the bar rather than starting below it,
both come from `contentInsetAdjustmentBehavior="automatic"` on `TabScreen`.

## 8.1.1 Icon wells and stat glyphs

Grouped-list rows wear Settings-style icon wells: a saturated rounded square (`iconBlue`,
`iconIndigo`, `iconPurple`, `iconOrange`, `iconTeal`, `iconRed`, `iconGray`) with a white
`onIcon` glyph. These are the one place other hues are allowed, and they are **decoration,
not meaning**: the colour identifies a row at a glance, it never encodes state. State is
still said with `accent` (earned / unlocked / active) and `danger` (destructive) — which is
why `iconRed` is exactly `danger` rather than a fourth shade of red.

Metrics follow the same rule through
[`components/StatGlyph.tsx`](../frontend/src/components/StatGlyph.tsx), which binds the
icon *and* its colour to the metric rather than to the screen. A streak is orange on Today,
Learn, Insights and Profile; accuracy is always purple; quizzes are always blue. One table,
so a figure is recognisable on a page you have never read.

## 8.2 Entering animations — use `Appear`, not `entering={…}`

Reanimated layout animations (`entering={FadeIn}`, `ZoomIn`, …) were observed to
**intermittently never start** on a cold launch of this app: same build, same route,
sometimes the Today dial rendered its countdown and sometimes an empty ring. A layout
animation that fails does not degrade to "shown without animation" — it leaves the view
at its opening frame, `opacity: 0`, forever.

So on the surfaces that matter (Today, Learn, Insights, Recap) mount animations go through
[`components/Appear.tsx`](../frontend/src/components/Appear.tsx), which drives opacity and
transform from a shared value with `withTiming` — the same UI runtime that powers the
dial's sweep and the chart bars, and which never missed. Worst case there is a view that
snaps in, not one that never arrives. The hero countdown itself is not animated at all:
the number the screen exists to show must not depend on an animation completing.

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
