# EarnLock — UI/UX Design System

> Status: MVP design blueprint. Companion docs: [`architecture.md`](./architecture.md),
> [`api-contract.md`](./api-contract.md). Design direction: **Apple Fitness** (dark, calm,
> big numbers) for the shell and screen-time surfaces; **Mimo** (friendly, progress-driven)
> for the quiz flow.

## 1. Principles

1. **Dark-first, Apple-Fitness calm.** Deep black/near-black backgrounds, generous space,
   one bright accent at a time. The earned-time number is the hero on lock/timer screens.
2. **The number is the reward.** Balances and countdowns use very large, tabular figures —
   the value should feel tangible, like closing an activity ring.
3. **Friction where it matters.** Learning Mode's 10-second locked button and the SOS
   warning are intentional friction, and should *look* intentional, not broken.
4. **One CTA per screen.** Locked, Quiz, Result — each has a single obvious next action.
5. **Consistent tokens.** Everything below extends the existing `constants/theme.ts`; no
   ad-hoc colors or spacing in components.

## 2. Color tokens

### 2.1 Existing neutral tokens (keep as-is)
From [`mobile/src/constants/theme.ts`](../mobile/src/constants/theme.ts) — do not change:

| Token | Light | Dark | Use |
|---|---|---|---|
| `text` | `#000000` | `#ffffff` | primary text |
| `background` | `#ffffff` | `#000000` | screen background |
| `backgroundElement` | `#F0F0F3` | `#212225` | cards, list rows, inputs |
| `backgroundSelected` | `#E0E1E6` | `#2E3135` | pressed/selected state |
| `textSecondary` | `#60646C` | `#B0B4BA` | captions, hints |

### 2.2 Proposed accent palette (new — to add to `Colors`)
Anchored on the existing splash blue (`#208AEF`) so brand feels continuous. Each role has a
light and a dark value (dark values are brighter to hold contrast on black), plus an
`onColor` for text/icons placed on top of that fill.

| Token | Light | Dark | Role |
|---|---|---|---|
| `accent` | `#208AEF` | `#4AA3FF` | primary — main CTA, links, progress, selection |
| `accentMuted` | `#E6F2FE` | `#12324D` | tinted accent surface (chips, subtle fills) |
| `onAccent` | `#FFFFFF` | `#08121C` | text/icon on an `accent` fill |
| `success` | `#248A3D` | `#30D158` | earned time, correct answers, timer running |
| `warning` | `#C15C00` | `#FF9F0A` | SOS / debt state, "time low" |
| `danger` | `#D70015` | `#FF453A` | locked state, wrong answers, destructive |
| `onStatus` | `#FFFFFF` | `#08121C` | text on success/warning/danger fills |

Suggested addition to `theme.ts` (mirrors the current structure):
```ts
export const Colors = {
  light: {
    // ...existing neutral tokens...
    accent: '#208AEF', accentMuted: '#E6F2FE', onAccent: '#FFFFFF',
    success: '#248A3D', warning: '#C15C00', danger: '#D70015', onStatus: '#FFFFFF',
  },
  dark: {
    // ...existing neutral tokens...
    accent: '#4AA3FF', accentMuted: '#12324D', onAccent: '#08121C',
    success: '#30D158', warning: '#FF9F0A', danger: '#FF453A', onStatus: '#08121C',
  },
} as const;
```

**Semantic usage (don't mix):** `accent` = interactive/brand. `success` = time & correctness.
`warning` = SOS debt. `danger` = locked & wrong. Never use `danger` for a normal CTA.

## 3. Typography

Fonts come from `Fonts` (`theme.ts`) + CSS vars in `global.css` — keep them:
- **Display / sans:** `--font-display` = **Spline Sans, Inter**, system fallback. Default UI.
- **Rounded:** SF Pro Rounded — used for the big countdown/balance numerals (Fitness feel).
- **Mono:** `ui-monospace` stack — code hints only.
- **Serif:** Georgia — not used in product UI.

Type scale (map to `ThemedText` `type` props; extend where noted):

| Role | Size / weight | Notes |
|---|---|---|
| Hero number | ~64–80, rounded, tabular | balance & countdown; `fontVariant: ['tabular-nums']` |
| `title` | ~28 bold | screen titles (exists) |
| `subtitle` | ~22 semibold | section headers (exists) |
| Body | ~16 regular | questions, descriptions |
| `small` | ~14 | hints, explanations (exists) |
| `code` | mono ~14 | dev hints only (exists) |
| Caption | ~12 `textSecondary` | metadata, timestamps |

## 4. Spacing, radius, layout

Use the existing `Spacing` scale — do not introduce new pixel values:

`half:2 · one:4 · two:8 · three:16 · four:24 · five:32 · six:64`

- **Screen padding:** `Spacing.four` (24) horizontal.
- **Card radius:** `Spacing.four` (24) for large cards; `Spacing.three` (16) for rows.
- **Content max width:** `MaxContentWidth = 800` (already defined) — center on web/tablet.
- **Bottom inset:** respect `BottomTabInset` (ios 50 / android 80) so CTAs clear the tab bar.
- **Big CTA button:** full-width, `accent` fill, `onAccent` text, radius `Spacing.five` (32),
  vertical padding `Spacing.three`.

## 5. Component inventory

**Reuse (already in `mobile/src/components`):** `ThemedText`, `ThemedView`, `HintRow`,
`ui/Collapsible`, `ExternalLink`, `AnimatedIcon`, `AppTabs` (+ `.web`), `WebBadge`.

**New components to build:**
| Component | Purpose |
|---|---|
| `PrimaryButton` | full-width `accent` CTA with pressed + disabled states |
| `CountdownRing` / `BalanceNumber` | hero number, tabular, optional ring (Fitness) |
| `QuestionCard` | prompt + 4 option buttons, selected/correct/wrong states |
| `ProgressDots` | Mimo-style per-question progress indicator |
| `LockedContinueButton` | Continue button disabled for 10s with visible countdown |
| `SubjectChip` | selectable Focus-Subject chip (`accentMuted` when selected) |
| `SegmentedControl` | grade/age selection |
| `StatusBanner` | SOS/debt/warning banners using `warning`/`danger` |
| `MaterialRow` | Knowledge Hub list item + "Generate quiz" action |

## 6. Answer-state colors (Quiz)

| State | Fill / border | Text |
|---|---|---|
| Default option | `backgroundElement` | `text` |
| Selected (pre-submit) | `accentMuted` + `accent` border | `text` |
| Correct (post-submit) | `success` (subtle) | `success` |
| Wrong (post-submit) | `danger` (subtle) | `danger` |

## 7. Screens (wireframe descriptions)

Ordered by the user's journey. Each notes the endpoints it touches (see
[`api-contract.md`](./api-contract.md)).

### 7.1 Onboarding (P5) — reference: Apple Fitness welcome
Sequence of full-screen steps:
1. **Welcome / value prop** — logo/`AnimatedIcon`, one-line pitch, single "Get Started".
2. **Grade / Age** — `SegmentedControl`; large, one choice.
3. **Focus Subjects** — grid of `SubjectChip` (Math, History, Biology, English), multi-select.
4. **Screen Time permission** — explain why, then native `requestAuthorization()` (P3).
5. **Save** — `PUT /profile` (or register first via `/auth/register`).

Layout: centered content, progress dots at top, primary CTA pinned bottom.

### 7.2 Auth (login / register)
Email + password fields (`backgroundElement` inputs), primary CTA, secondary text link to
switch mode. Calls `/auth/register` or `/auth/login`; on success store JWT and go to Locked.

### 7.3 Locked State (P4) — the home screen when apps are locked
- Top: `danger`-tinted lock icon + "Apps Locked".
- Center hero: current **balance** (`BalanceNumber`) from `GET /screentime/balance`
  (`0s` when empty).
- Primary CTA: **"Start a Quiz to earn time"** → Quiz Flow.
- Secondary: small SOS entry (§7.7) and a link to the Blacklist/Profile.

### 7.4 Quiz Flow (P4) — reference: Mimo
- Header: `ProgressDots` (count = `question_count` from `/quiz/generate`, may be 5 or 7),
  close/quit affordance.
- Body: `QuestionCard` — prompt + 4 tappable options.
- On select → enable "Continue"; collect answers locally.
- On last question → `POST /quiz/submit`.
- Wrong answers route through **Learning Mode** before advancing.

### 7.5 Learning Mode (P4)
Shown per wrong answer: the `explanation` from `/quiz/submit`, and a **`LockedContinueButton`**
disabled for 10s with a visible countdown on the button. Forces the child to read.

### 7.6 Result (P4)
- Hero: **earned_seconds** in `success` color, celebratory but calm.
- `correct_count / total` summary.
- New balance (`new_balance_seconds`).
- Primary CTA: "Done" → back to Timer/Locked. On earn, client calls native
  `startShield(new_balance_seconds)`.

### 7.7 Screen Time Timer (P4) — reference: Apple Fitness countdown
- Big `CountdownRing` counting the earned seconds down.
- `success` while healthy, shifts to `warning` when low.
- At `0` → native lock re-applies and the screen becomes Locked State.

### 7.8 SOS button (P5)
- Clearly a "break glass" control (uses `warning`/`danger`).
- Copy: "2-minute emergency unlock — once per day."
- Prominent warning: **"Your next quiz will be 7 questions."**
- Calls `POST /sos`; on success show a 120s countdown; on `409` show "already used today".

### 7.9 Wake-Up Lock (P5)
- **Settings toggle:** enable auto-lock at 07:30 (native `scheduleWakeUpLock`).
- **Morning screen:** driven by `GET /wakeup/status`; if `active`, present 3 questions;
  on pass call `POST /wakeup/complete` and lift the shield.

### 7.10 Profile + Knowledge Hub (P5)
- **Profile:** shows/edits grade + focus subjects (`SubjectChip`s) → `PUT /profile`.
- **Knowledge import:** text area to paste notes or a link → `POST /knowledge/import`.
- **Materials list:** `MaterialRow`s from `GET /knowledge`, each with **"Generate quiz from
  this"** → `/quiz/generate` with `source: "material"`.

### 7.11 The Blacklist (P5)
- Button opens the native `FamilyActivityPicker` (P3 `pickApps()`).
- Shows the chosen locked apps; persists the selection; used by `lockApps()`.

## 8. Navigation map

```
Onboarding (first run only)
   └─▶ Auth ─▶ Main (Expo Router tabs)
                 ├─ Home:     Locked State  ⇄  Quiz Flow ─▶ Learning Mode ─▶ Result ─▶ Timer
                 ├─ Learn:    Knowledge Hub  (import + materials → quiz)
                 └─ Profile:  Profile · Blacklist · Wake-Up settings · SOS
   Wake-Up morning screen is presented modally when GET /wakeup/status.active === true
```

## 9. Accessibility & polish

- Maintain contrast: on dark `background (#000)`, `accent #4AA3FF` and status colors pass
  against black; verify `onAccent`/`onStatus` on their fills.
- Countdown/balance use `tabular-nums` so digits don't jitter.
- Respect `userInterfaceStyle: automatic` (app.json) — every token has a light + dark value.
- Honour safe areas + `BottomTabInset` so CTAs are never under the home indicator/tab bar.
- Learning Mode's locked button must clearly show *why* it's disabled (the countdown), not
  look like a dead button.
