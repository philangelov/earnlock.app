# EarnLock — Design Assets

Core visual assets for the app. This folder is the export target for the design review
(Figma → repo). The design system that governs these assets — color tokens, typography,
spacing, components, and per-screen wireframes — is documented in
[`../ui-ux.md`](../ui-ux.md).

## What belongs here

| Asset | Format | Status |
|---|---|---|
| Logo (full + mark) | SVG / PNG @1x@2x@3x | ⬜ export from Figma |
| App icon source | already in repo: `frontend/assets/images/icon.png` | ✅ exists (starter, replace with branded) |
| Splash | already in repo: `frontend/assets/images/splash-icon.png` (bg `#208AEF`) | ✅ exists |
| Tab bar icons | drawn in code: `frontend/src/components/Icon.tsx` (SVG) | ✅ exists |
| Color palette swatch sheet | PNG/SVG | ⬜ export (values in `frontend/src/theme/tokens.ts`) |
| Typography specimen | PNG/SVG | ⬜ export (Baloo 2 headings / Nunito body) |
| Screen wireframes | PNG/PDF | ⬜ export from Figma |
| Figma file link | URL | ⬜ paste below |

## Source of truth

- **Design tokens** (colors, fonts) live in code at
  [`frontend/src/theme/tokens.ts`](../../frontend/src/theme/tokens.ts) and are the single
  source for every color in the app — assets exported here must match those values.
- **Figma:** _paste the shared Figma file link here after the design freeze._

> ⬜ items are human/design tasks (Figma export). Starter assets should be replaced with
> EarnLock-branded versions before release.
