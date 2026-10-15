# next-device-routes

Device-type and crawler aware routing for the Next.js **App Router**.

No middleware, no runtime cost, no dependencies. Your folder structure is scanned once when
`next.config` loads and compiled into native `rewrites`, which Next.js matches against the
`User-Agent` header at the edge.

- Works with any route layout, including projects whose routes all start at `app/[lang]` —
  [`root` and `dir`](#where-the-variant-folders-live).
- Keeps your site **statically generated**, even when a shared root layout needs to know the
  device — [Reading the device without losing SSG](#reading-the-device-without-losing-ssg).
- Needs Next.js 14 or 15 (tested on both) and Node 18.17+.

```bash
npm install next-device-routes
```

## Quick start

```ts
// next.config.ts
import type { NextConfig } from 'next'
import { withDeviceRoutes } from 'next-device-routes'

const config: NextConfig = withDeviceRoutes({
  reactStrictMode: true,
})

export default config
```

JavaScript works the same way:

```js
// next.config.mjs
import { withDeviceRoutes } from 'next-device-routes'

export default withDeviceRoutes({ reactStrictMode: true })
```

Then add a variant folder inside `app/`:

```
app/
├─ layout.tsx              shared root layout
├─ page.tsx                base — desktop and anything unmatched
├─ about/page.tsx
├─ contact/page.tsx
├─ blog/[slug]/page.tsx
│
├─ mobile/                 phones
│  ├─ layout.tsx           optional, wraps only this variant
│  ├─ page.tsx             →  /
│  ├─ about/page.tsx       →  /about
│  └─ blog/[slug]/page.tsx →  /blog/:slug
│                          /contact is absent → phones fall back to the base page
├─ tablet/
│  └─ page.tsx
└─ bot/                    crawlers and link previews
   └─ about/page.tsx
```

The URL never changes. `/about` stays `/about` for every visitor; only the rendered page differs.
A route that does not exist inside a variant folder is simply not rewritten, so the base route
serves it.

| Request | `User-Agent` | Rendered page |
| --- | --- | --- |
| `/` | Chrome on Windows | `app/page.tsx` |
| `/` | iPhone | `app/mobile/page.tsx` |
| `/` | iPad | `app/tablet/page.tsx` |
| `/about` | Android | `app/mobile/about/page.tsx` |
| `/about` | Googlebot | `app/bot/about/page.tsx` |
| `/contact` | iPhone | `app/contact/page.tsx` (fallback) |

Variants are mutually exclusive and ordered by priority (`bot`, then `tablet`, then `mobile`): a
request that is a `bot` never ends up in `mobile/`, even when `bot/` has no page for that route and
`mobile/` does. In that case the base route serves it — the same answer `getDevice()` gives.

A fallback page like `/contact` above has no way to tell devices apart on its own — see
[Reading the device in your components](#reading-the-device-in-your-components) for the options
that cover exactly that case without making the rest of the site dynamic.

Routes start below `app/` (say `src/app/[lang]`)? See
[Where the variant folders live](#where-the-variant-folders-live).

## Supported route types

| Folder | Generated source |
| --- | --- |
| `about` | `/about` |
| `[slug]` | `/:slug` |
| `[...path]` | `/:path+` |
| `[[...path]]` | `/:path*` |
| `(group)` | no segment, contents are hoisted |

`_private`, `@parallel` and `(.)intercepting` folders are skipped.

## Where the variant folders live

By default a variant folder is `<appDir>/<name>` — `app/mobile`, `app/bot`. When all of your routes
start further down — say every page lives in `src/app/[lang]` — tell the package once with `root`:

```ts
withDeviceRoutes(config, {
  appDir: 'src/app',
  root: '[lang]',          // variant folders are src/app/[lang]/mobile, .../tablet, .../bot
})
```

```
src/app/
├─ layout.tsx
└─ [lang]/
   ├─ page.tsx             /en
   ├─ about/page.tsx       /en/about
   ├─ mobile/
   │  ├─ page.tsx          /en       →  rendered from [lang]/mobile for phones
   │  └─ about/page.tsx    /en/about →  ditto
   └─ bot/about/page.tsx   /en/about →  for crawlers
```

The folders above the variant (`[lang]`) are part of the URL, so they become route parameters of
the generated rewrite: `/:lang/about  →  /:lang/mobile/about`. Static, dynamic and catch-all
folders all work, and route groups such as `(site)` are ignored, as in Next.js itself.

A single variant can live somewhere else. `dir` is a path relative to the app directory and
overrides `root` and the variant's name for that variant only:

```ts
withDeviceRoutes(config, {
  appDir: 'src/app',
  root: '[lang]',
  variants: {
    bot:    { match: ['Googlebot', 'bingbot'] },                 // src/app/[lang]/bot
    tablet: { match: ['iPad'], dir: '[lang]/tab' },              // src/app/[lang]/tab
    mobile: { match: ['Mobi'], dir: 'mobile' },                  // src/app/mobile (variant first, [lang] below it)
  },
})
```

Rules for `dir` / `root`:

- Every folder except the last is a prefix that is part of the URL. The **last** folder must be a
  plain, static folder name: it becomes a real URL segment in the rewrite destination
  (`/en/mobile/about`), which is why it can't be a `[param]` or a `(group)`.
- With `dir: 'mobile'` and the language below it (`mobile/[lang]/about`), there is no prefix: the
  `[lang]` folder is simply part of the variant's own routes.
- A path outside the app directory (`..`) or through a `_private` / `@slot` folder is rejected
  with an error that names the variant.
- Set `debug: true` to print where each variant is looked up (`found` / `not found`) and every
  generated rewrite.

Variants under a dynamic prefix like `[lang]` are emitted into `afterFiles` rewrites only: a
dynamic first segment must never run ahead of real files (`public/`, `/_next/*`). Next.js still
checks `afterFiles` before dynamic routes, so the variant page wins over the base `[lang]/...`
page, as expected.

## TypeScript

Types ship with the package — there is no `@types/next-device-routes` to install.

- `next.config.ts` is supported, and the return value is a plain `NextConfig`.
- `page.tsx` and `page.ts` are detected in variant folders, alongside `.jsx`, `.js`, `.mdx` and `.md`.
- Options are checked, so typos like `varients` or `{ match: 'Mobi' }` fail at compile time.
- A function-shaped config keeps its shape and is typed with Next's own `(phase, { defaultConfig })`
  signature.

```ts
import type { NextConfig } from 'next'
import { withDeviceRoutes, defaultVariants } from 'next-device-routes'
import type { DeviceRoutesOptions, Variant, NextConfigFn } from 'next-device-routes'

const options: DeviceRoutesOptions = {
  variants: { ...defaultVariants, tv: ['Tizen'] satisfies string[] },
  redirectVariantPaths: true,
}

const config: NextConfig = withDeviceRoutes({ reactStrictMode: true }, options)
export default config
```

If your project uses Next's `pageExtensions`, it is picked up automatically — including the
`page.tsx` naming convention:

```ts
withDeviceRoutes({ pageExtensions: ['page.tsx', 'page.ts'] })  // finds app/mobile/about/page.page.tsx
```

> **Note:** Next.js 15 cannot load `next.config.ts` under TypeScript 7 — this is a Next.js
> limitation, unrelated to this package. Use TypeScript 5.x, or a `next.config.mjs`.

## Options

```js
withDeviceRoutes(nextConfig, {
  variants: {
    // key = folder name inside app/ — ORDER IS PRIORITY
    bot:    { match: ['Googlebot', 'bingbot'] },
    tablet: { match: ['iPad', 'Tablet'] },
    mobile: { match: ['Mobi', 'iPhone'], exclude: ['iPad'] },
  },
  appDir: 'src/app',
  root: '[lang]',
  redirectVariantPaths: true,
  permanentRedirects: false,
  debug: true,
})
```

| Option | Default | Description |
| --- | --- | --- |
| `variants` | `bot`, `tablet`, `mobile` | Folder name → User-Agent rule. Key order sets priority. |
| `appDir` | `app`, then `src/app` | App Router directory, relative to the project root. |
| `root` | none | Folder inside `appDir` that holds the variant folders, e.g. `[lang]`. A variant's own `dir` overrides it. See [Where the variant folders live](#where-the-variant-folders-live). |
| `pageExtensions` | `nextConfig.pageExtensions`, else `tsx, ts, jsx, js, mdx, md` | Page file extensions to scan for. |
| `redirectVariantPaths` | `false` | Redirect `/mobile/:path*` → `/:path*` (`/en/mobile/...` → `/en/...` under a prefix) so variant URLs are not indexed. |
| `permanentRedirects` | `false` | Use `308` instead of `307` for those redirects. |
| `cwd` | `process.cwd()` | Project root used to resolve `appDir`. |
| `debug` | `false` | Print where each variant is looked up and every generated rewrite during build. |

### Variant rules

`match` and `exclude` are plain substrings, compared case-insensitively against the whole
`User-Agent` header. A variant only applies when `match` hits and `exclude` does not.

```js
mobile: ['Mobi', 'iPhone']                      // shorthand for { match: [...] }
mobile: { match: ['Mobi'], exclude: ['iPad'] }  // full form
mobile: { match: ['Mobi'], dir: '[lang]/m' }    // with its own folder
tablet: false                                   // disabled
```

**Priority is strict.** `variants` is ordered, and the first variant that applies to a User-Agent
owns it — whether or not it has a page for the route being requested. Googlebot's smartphone
crawler (`... Mobile Safari ... Googlebot/2.1`) is therefore a `bot`: with no `bot/pricing` page it
gets the base page, never `mobile/pricing`. This is also what `getDevice()` returns, so the
rewrite and the hook can't disagree.

> **SEO note.** Search engines index the mobile version of a site. If you serve phones a different
> page than the base one and want Googlebot's smartphone crawler to see what phones see, let it
> through as a phone: `bot: { match: CRAWLER_TOKENS, exclude: ['Googlebot'] }` hides Googlebot from
> the `bot` variant, and its `Mobile` token then makes it a `mobile`. (`CRAWLER_TOKENS` is exported
> from `next-device-routes`.) Otherwise, give `bot/` the pages you want crawlers to index.

`variants` replaces the defaults entirely. To extend them instead:

```js
import { withDeviceRoutes, defaultVariants } from 'next-device-routes'

export default withDeviceRoutes(config, {
  variants: { ...defaultVariants, tv: ['SmartTV', 'Tizen', 'WebOS'] },
})
```

Default variants, in priority order:

- **`bot`** — Google, Bing, Yandex, Baidu, DuckDuckGo, Apple; social previews (Facebook, X,
  LinkedIn, Pinterest, Slack, Telegram, WhatsApp, Discord); AI crawlers (GPTBot, ClaudeBot,
  PerplexityBot). Tokens are deliberately specific — real people on the Pinterest app, or on a
  browser whose UA merely contains the word "spider", are not bots.
- **`tablet`** — iPad, Kindle, Silk, PlayBook, and UAs containing `Tablet`.
- **`mobile`** — iPhone, iPod, Android, `Mobi`, Windows Phone, BlackBerry, Opera Mini, webOS,
  with tablets excluded.

### Working with your own config

Other keys pass through untouched, your `rewrites` and `redirects` are preserved, and a
function-shaped config stays a function:

```ts
export default withDeviceRoutes(async (phase, { defaultConfig }) => ({
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/old', destination: '/about' }]
  },
}))
```

## Reading the device in your components

`useDevice()` (a hook for Client Components) reads the device from the closest provider. There are
three ways to feed it. Pick by what the route can know **at build time**.

| You want | Use | Request read? | Route stays static? |
| --- | --- | --- | --- |
| The device in a shared (root) layout's Client Components | `<RouteDeviceProvider>` | no | **yes** |
| A fixed device inside one variant's layout | `<DeviceProvider variant="mobile">` | no | **yes** |
| The real device on a route that has no variant page | `<DeviceBoundary>` | yes | no — that route only |

### `RouteDeviceProvider` — the device from the route

The rewrite picks a variant *before* rendering, so the route Next.js renders for a phone's `/about`
is `[lang]/mobile/about`, and the router's segments say so. `<RouteDeviceProvider>` reads them: no
`headers()`, no literal to keep in sync, nothing becomes dynamic. Put it in the shared layout:

```tsx
// src/app/layout.tsx — wraps every route and every device
import { RouteDeviceProvider } from 'next-device-routes/context'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RouteDeviceProvider depth={1}>{children}</RouteDeviceProvider>
      </body>
    </html>
  )
}
```

| Prop | Default | Meaning |
| --- | --- | --- |
| `variants` | `bot`, `tablet`, `mobile` | The variant **folder names as they appear in the route tree**, in priority order. An array (`['mobile']`), a map (`{ mobile: 'm' }`), or a map with a depth per variant (`{ tablet: { segment: 'tab', depth: 0 } }`). Use the *last folder* of a variant's `dir`. |
| `depth` | `0` | How many route segments sit between this layout and the variant folders. `0` when the variant folders are direct children of the layout; `1` for a root layout above `[lang]/`; if the provider lives *inside* `src/app/[lang]/layout.tsx`, keep `0`. |

```tsx
// a custom tablet folder (`dir: '[lang]/tab'`) under a root layout above [lang]
<RouteDeviceProvider depth={1} variants={{ bot: 'bot', tablet: 'tab', mobile: 'mobile' }}>
```

```tsx
// any Client Component below it
'use client'
import { useDevice } from 'next-device-routes/context'

export function Nav() {
  const { isMobile } = useDevice()
  return isMobile ? <MobileNav /> : <DesktopNav />
}
```

Things to know:

- **It reports the route, not the header.** On a route that has no variant page (`/contact` with no
  `mobile/contact`) every device renders the base route, so `useDevice()` says "base" for all of
  them. That is correct — and statically cacheable. Use one of the two options below for such routes.
- **Client Components only.** A Server Component in a shared layout can't know which variant it is
  part of without the request. Move the device-dependent UI into a Client Component, or into the
  variant's own layout (which is a literal — see below).
- **Segments, not the pathname.** The browser URL is `/en/about`; the rendered route is
  `/en/mobile/about`. The provider reads the router's segments, which follow the rendered route —
  including on client-side navigations. Don't use `usePathname()` for this.
- **Give `[lang]` a `generateStaticParams`.** A route with an unknown `[lang]` can't be prerendered at
  all; list the languages you ship, and the variant routes below them are prerendered with it. On
  Next.js with Cache Components/PPR, `useSelectedLayoutSegments()` also needs the params known at
  build time to avoid a dynamic hole.
- **No provider, no value.** `useDevice()` throws a clear error outside a provider.

### `DeviceProvider` — a literal

Inside a variant folder the device is a build-time fact, so the layout can simply state it. The
closest provider wins:

```tsx
// src/app/[lang]/mobile/layout.tsx
import { DeviceProvider } from 'next-device-routes/context'

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  return <DeviceProvider variant="mobile">{children}</DeviceProvider>
}
```

You rarely need it when a `RouteDeviceProvider` sits above — but it is still the way to give a
*Server Component* in that variant's layout a device it can pass down as a prop, and it costs nothing.
`<DeviceProvider variant={null}>` (or no `variant`) means "base route".

### `DeviceBoundary` — only the request can tell

A route with no variant page is served to every device. To tell them apart there, render
`<DeviceBoundary>` in that segment only. It calls `getDevice()` and provides the result:

```tsx
// app/contact/layout.tsx
import { DeviceBoundary } from 'next-device-routes/server'

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <DeviceBoundary>{children}</DeviceBoundary> // only /contact becomes dynamic
}
```

`<DeviceBoundary variants={variants}>` accepts the same `variants` as `getDevice()`. Calling
`await getDevice()` in a layout and passing `device.variant` to `<DeviceProvider>` still works.

`getDevice()` runs the same matching rules as `withDeviceRoutes` and returns:

```ts
{ variant: 'mobile' | 'tablet' | 'bot' | string | null, isMobile, isTablet, isBot, isBase }
```

`variant` is `null` and `isBase` is `true` when nothing matched (the common desktop case).
`isMobile` / `isTablet` / `isBot` are convenience flags for the three default variant names; for a
custom variant (like a `tv` folder), compare `variant === 'tv'` directly.

`getDevice()` also works directly in any Server Component, Route Handler, Server Action or
`generateMetadata` — wherever `next/headers` does:

```tsx
export default async function Page() {
  const device = await getDevice()
  return device.isBot ? <StaticVersion /> : <InteractiveVersion />
}
```

**Keep it in sync with your `variants`.** If you passed a custom `variants` object to
`withDeviceRoutes`, pass the *same* object to `getDevice({ variants })` and `<DeviceBoundary>` —
otherwise they can disagree about what counts as "mobile". Define it once in its own module:

```ts
// device-variants.ts
export const variants = { bot: [...], tablet: [...], mobile: [...] }
```

(An inline `variants={{ ... }}` object is fine too: compiled matchers are cached by content, so a
fresh literal per render doesn't recompile.)

## Reading the device without losing SSG

`getDevice()` and `<DeviceBoundary>` read `headers()`. During `next build`, Next.js prerenders each
route by rendering its whole tree — root layout, nested layouts, page. If any of them reads
`headers()`, that route bails out of prerendering and is rendered on every request. A root layout
belongs to every route, so reading the device there makes **the entire site** dynamic. Nothing in
Next.js can avoid that: a header value does not exist at build time, and forcing the route static
(`dynamic = 'force-static'`) makes `headers()` return empty.

The way out is to not need the header, because this package has already routed on it:

1. **Root layout → `<RouteDeviceProvider>`.** The device comes from the rendered route, which the
   rewrite chose per request but which exists at build time. Every route, for every device, is
   prerendered; the layout reads no request API. This is what the example does, and the integration
   suite asserts it (`/en/about` for a phone, a tablet, a crawler and a desktop — all static).
2. **A route that has no page per device, but should look different per device.** Don't read the
   header — give that route a copy inside the variant. A one-line re-export keeps a single source of
   truth and stays static:

   ```tsx
   // src/app/[lang]/mobile/pricing/page.tsx
   export { default } from '../../pricing/page'
   // add `generateStaticParams` / `generateMetadata` to the re-export if the page has them
   ```

   Phones are rewritten to `[lang]/mobile/pricing`, which renders the same component under the mobile
   variant — so `useDevice()` inside it reports `mobile`, and the layout of `mobile/` applies.
3. **Truly request-dependent, once.** Reserve `<DeviceBoundary>` for the few routes where the answer
   cannot be derived from a route (a header-dependent API, personalized output). Only those routes
   are dynamic.

Limits imposed by Next.js itself:

- **Granularity is the route.** Without Partial Prerendering, one request read anywhere in a
  route's tree makes that whole route dynamic.
- **With Cache Components (PPR)**, wrap `<DeviceBoundary>` in `<Suspense>`: the route keeps a
  prerendered static shell and only the boundary's subtree streams at request time.
- **Client-side detection** (reading `navigator.userAgent` in an effect) keeps a route static but
  renders the base markup first, then changes after hydration. Prefer a variant folder.
- **Request isolation** comes from Next.js: `headers()` is scoped to the current request with
  AsyncLocalStorage. This package keeps no request data in module state — only compiled `variants`
  rules are cached.
- **The build summary lies a little.** With `generateStaticParams`, `next build` marks every route
  that has it with `●`, including one whose boundary reads `headers()`. Check the response instead:
  a dynamically rendered route is served with `Cache-Control: private, no-cache, no-store`.

## Caveats

**CDN caching.** One URL now returns different HTML per device, so any cache in front of your app
must key on the `User-Agent` (or a normalized device header your CDN provides). Without that, the
first variant cached is served to everyone. Next.js overwrites the `Vary` header itself, so this
cannot be set from `next.config` — configure it on the CDN.

**Dev server.** Routes are scanned when `next.config` loads. Restart `next dev` after adding a page
to a variant folder. `debug: true` shows what was found.

**Variant folder names are reserved.** `app/mobile` is a route segment like any other, so a real
page of your own at `/mobile` can't coexist with the variant. Rename the variant (`dir`) or the page.
Without `redirectVariantPaths`, `/mobile/about` is also reachable directly — turn it on to keep
variant URLs out of search indexes.

**A static page beats a variant's dynamic page.** If the base has a static `blog/new` and the
variant only has `blog/[slug]`, a phone requesting `/blog/new` gets the base page: Next.js serves
real files before `afterFiles` rewrites. Add `mobile/blog/new` if phones should see a variant page.
(Under a dynamic prefix like `[lang]` every base page is dynamic, so this does not arise.)

**Crawlers and SEO.** Priority is strict (see [Variant rules](#variant-rules)): Googlebot's
smartphone crawler is a `bot`, not a `mobile`. Serving crawlers a page whose content differs
materially from what users see violates search engine guidelines — the `bot` variant is meant for
rendering strategy (static, JS-free markup), not for different content.

**iPadOS.** Modern iPad Safari sends a desktop macOS User-Agent by default and is indistinguishable
from a Mac at the header level. Android tablets rarely include `Tablet` in their UA and fall through
to `mobile`; add their tokens to the `tablet` variant if you need them.

**Next.js versions.** Tested on Next.js 14.2 and 15.5 (React 18 and 19) in CI. Next.js 13 is not
supported. The device-from-route behaviour relies on `useSelectedLayoutSegments()`, which follows
the rewritten route tree on both versions.

## How it works

Static routes are emitted into `rewrites().beforeFiles` so they take priority over the identically
named base page. Dynamic routes go into `afterFiles`, so real files in `public/` and `/_next/*`
assets are never swallowed by a catch-all; so are all routes of a variant under a dynamic prefix
(`[lang]/mobile`). Within a variant, routes are sorted by specificity — static segments first,
catch-alls last — mirroring Next's own precedence. All static routes of a variant collapse into
one alternation rule, so the rule count depends on the number of variants and dynamic routes, not on
the number of pages.

User-Agent conditions become `has` / `missing` entries on each rewrite. Next compiles these into a
case-sensitive anchored RegExp, so each token is expanded into character classes
(`iPad` → `[iI][pP][aA][dD]`) to make matching case-insensitive.

**Variants are made mutually exclusive in the rules themselves.** A rule for a variant also carries
a `missing` condition for every variant above it in priority — written as one anchored expression
with lookaheads (`(?=.*match)(?!.*exclude).*`), so a higher variant's `exclude` is honoured. A given
User-Agent therefore matches the rules of at most one variant, which is why the order of rules, and
whether they sit in `beforeFiles` or `afterFiles`, can't change the outcome.

`getDevice()` doesn't reuse those rewrite conditions — it compiles the same `variants` into a plain
case-insensitive `RegExp` and tests the request's `user-agent` header directly, picking the first
variant that applies. Same priority, simpler matcher.

## Example

A runnable TypeScript app lives in [`example/`](./example). Its routes start at `src/app/[lang]`, one
variant has a custom folder, the root layout uses `<RouteDeviceProvider>`, and only `/contact`
reads the request.

```bash
cd example && npm install && npm run build && npm start

curl -s localhost:3000/en/about -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120"
curl -s localhost:3000/en/about -A "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile"
```

## Publishing your own fork

Update `name`, `author`, `repository` and `LICENSE` first, then:

```bash
npm view <your-package-name>   # E404 means the name is free
npm test && npm run test:integration
npm pack --dry-run             # inspect the tarball contents
npm version patch|minor|major  # bumps package.json and creates the git tag
git push --follow-tags         # the publish workflow runs on `v*` tags
```

`files` in `package.json` limits the tarball to `index.js`, `server.js`, `context.js`, their `.d.ts`
files, `lib/`, `README.md` and `LICENSE`. The GitHub workflow publishes through npm trusted
publishing when a `v*` tag is pushed, after the tests pass on Node 20, 22 and 24, and refuses a tag
that doesn't match the version in `package.json`. A published version can never be overwritten.

## Development

```bash
npm install               # pulls in next/react/react-dom as devDependencies, for the test suite only
npm test                  # node:test unit tests, no test framework dependency
npm run test:integration  # real `next build` of test/fixtures/rendering-app and lang-app
```

The integration suites check which routes Next.js prerenders, that request values reach the
components that read them, that concurrent requests never see each other's headers, and — with
the `[lang]` fixture — that a project rooted at `src/app/[lang]` stays fully static and still knows
the device in its root layout.

The package itself has zero runtime `dependencies`; `next` (>=14) and `react` are
`peerDependencies` (any Next.js app already has both) and only appear as `devDependencies` here so
`npm test` can exercise `next/headers` and render the providers with real React. CI also runs both
suites against Next.js 14 / React 18.

## License

MIT
