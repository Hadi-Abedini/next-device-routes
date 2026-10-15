# Changelog

## 0.5.0

### Added

- **`root` option and per-variant `dir`.** Variant folders can live anywhere below the app
  directory — `root: '[lang]'` for projects whose routes start at `src/app/[lang]`, and
  `variants.<name>.dir` to place a single variant elsewhere. Prefix folders become route parameters
  of the rewrite (`/:lang/about → /:lang/mobile/about`); `redirectVariantPaths` keeps the prefix.
- **`<RouteDeviceProvider>`** (`next-device-routes/context`). Provides the device from the route
  that was rendered, so a shared root layout knows the device **without reading `headers()`** and the
  site stays statically generated. Props: `variants`, `depth`.
- `CRAWLER_TOKENS`, `TABLET_TOKENS`, `MOBILE_TOKENS` are exported for building custom variants.
- `debug: true` now also prints where each variant was looked up (`found` / `not found`).
- A CI workflow (Node 20/22/24, plus Next.js 14 / React 18) and `[lang]` integration fixtures.

### Fixed

- **Variants are now mutually exclusive.** Rewrites follow `variants` priority exactly like
  `getDevice()`. Previously a crawler whose User-Agent also contains `Mobile` (Googlebot's
  smartphone crawler) was a `bot` for `getDevice()` but fell through to `mobile/` for any route
  `bot/` lacked, and a `mobile` static page could shadow a `bot` dynamic page. **Behaviour change:**
  such a crawler now gets the base page for routes `bot/` doesn't have. See "SEO note" in the README
  to let Googlebot's smartphone crawler through as a phone instead.
- **Crawler tokens no longer catch real users:** `Pinterest` (the in-app browser) is now
  `Pinterestbot` / `pinterest.com/bot`, `spider` is `spider/` (so "Spiderman" is not a bot), and
  `WhatsApp` is `WhatsApp/`. `Sosospider` is listed explicitly.
- `getMatcher` caches by content as well as identity, so an inline `variants={{ ... }}` literal is
  no longer recompiled on every request.
- `DeviceProvider`'s `variant` prop is optional in the types, as it always was at runtime, and its
  value is memoized.
- Publishing: `.npmignore` (ignored because of `files`) and a stray `graphify-out/` entry are gone;
  the workflow runs on `v*` tags, checks the tag against `package.json`, and tests before publishing.
  `npm test` works on every Node version in `engines` (no glob needed).

### Changed

- `peerDependencies.next` is now `>=14.0.0` (was `>=13.4.0`), the range that is actually tested.
  Next.js 13 behaves differently around `next/headers` and layout segments.
- The example project now starts at `src/app/[lang]` and demonstrates the new options.
