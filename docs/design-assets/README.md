# EarnLock — Design Assets

Core visual assets for the app. This folder is the export target for the design review
(Figma → repo). The design system that governs these assets — color tokens, typography,
spacing, components, and per-screen wireframes — is documented in
[`../ui-ux.md`](../ui-ux.md).

## What belongs here

| Asset | Format | Status |
|---|---|---|
| Logo (full + mark) | SVG / PNG @1x@2x@3x | ⬜ export from Figma |
| App icon source | already in repo: `mobile/assets/images/icon.png`, `mobile/assets/expo.icon/` | ✅ exists |
| Splash | already in repo: `mobile/assets/images/splash-icon.png` (bg `#208AEF`) | ✅ exists |
| Tab bar icons | already in repo: `mobile/assets/images/tabIcons/` (home, explore) | ✅ exists (starter set) |
| Color palette swatch sheet | PNG/SVG | ⬜ export (values in `ui-ux.md` §2) |
| Typography specimen | PNG/SVG | ⬜ export (Spline Sans / rounded, `ui-ux.md` §3) |
| Screen wireframes | PNG/PDF | ⬜ export from Figma (11 screens, `ui-ux.md` §7) |
| Figma file link | URL | ⬜ paste below |

## Source of truth

- **Design tokens** (colors, fonts, spacing) live in code at
  [`mobile/src/constants/theme.ts`](../../mobile/src/constants/theme.ts) and
  [`mobile/src/global.css`](../../mobile/src/global.css), and are documented in
  [`ui-ux.md`](../ui-ux.md). Assets exported here must match those values — the proposed
  accent palette (`accent`, `success`, `warning`, `danger`) is in `ui-ux.md` §2.2.
- **Figma:** _paste the shared Figma file link here after the design freeze._

> ⬜ items are human/design tasks (Figma export). The `mobile/assets/` entries above are the
> existing Expo starter assets and should be replaced with EarnLock-branded versions.
