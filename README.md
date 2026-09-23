# next-device-routes

Device-type and crawler aware routing for the Next.js **App Router**.

No middleware, no runtime cost, no dependencies. Your folder structure is scanned once when
`next.config` loads and compiled into native `rewrites`, which Next.js matches against the
`User-Agent` header at the edge.

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

A fallback page like `/contact` above has no way to tell devices apart on its own — see
[Reading the device in your components](#reading-the-device-in-your-components) for a hook and
context that cover exactly that case.

## Supported route types

| Folder | Generated source |
| --- | --- |
| `about` | `/about` |
| `[slug]` | `/:slug` |
| `[...path]` | `/:path+` |
| `[[...path]]` | `/:path*` |
| `(group)` | no segment, contents are hoisted |

`_private`, `@parallel` and `(.)intercepting` folders are skipped.

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
  redirectVariantPaths: true,
  permanentRedirects: false,
  debug: true,
})
```

| Option | Default | Description |
| --- | --- | --- |
| `variants` | `bot`, `tablet`, `mobile` | Folder name → User-Agent rule. Key order sets priority. |
| `appDir` | `app`, then `src/app` | App Router directory, relative to the project root. |
| `pageExtensions` | `nextConfig.pageExtensions`, else `tsx, ts, jsx, js, mdx, md` | Page file extensions to scan for. |
| `redirectVariantPaths` | `false` | Redirect `/mobile/:path*` → `/:path*` so variant URLs are not indexed. |
| `permanentRedirects` | `false` | Use `308` instead of `307` for those redirects. |
| `cwd` | `process.cwd()` | Project root used to resolve `appDir`. |
| `debug` | `false` | Print every generated rewrite during build. |

### Variant rules

`match` and `exclude` are plain substrings, compared case-insensitively against the whole
`User-Agent` header. A variant only applies when `match` hits and `exclude` does not.

```js
mobile: ['Mobi', 'iPhone']                      // shorthand for { match: [...] }
mobile: { match: ['Mobi'], exclude: ['iPad'] }  // full form
tablet: false                                   // disabled
```

`variants` replaces the defaults entirely. To extend them instead:

```js
import { withDeviceRoutes, defaultVariants } from 'next-device-routes'

export default withDeviceRoutes(config, {
  variants: { ...defaultVariants, tv: ['SmartTV', 'Tizen', 'WebOS'] },
})
```

Default variants, in priority order:

- **`bot`** — Google, Bing, Yandex, Baidu, DuckDuckGo, Apple; social previews (Facebook, X,
  LinkedIn, Slack, Telegram, WhatsApp, Discord); AI crawlers (GPTBot, ClaudeBot, PerplexityBot).
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

Routing handles pages that genuinely differ per device. But a route with no dedicated
mobile/tablet/bot version — like `/contact` in the example above — has no way to tell devices
apart on its own. `getDevice()`, `<DeviceProvider>` and `useDevice()` cover that case:

```tsx
// app/contact/layout.tsx — a Server Component
import { getDevice } from 'next-device-routes/server'
import { DeviceProvider } from 'next-device-routes/context'

export default async function ContactLayout({ children }: { children: React.ReactNode }) {
  const device = await getDevice() // reads the User-Agent header, once, on the server
  return <DeviceProvider variant={device.variant}>{children}</DeviceProvider>
}
```

```tsx
// app/components/nav.tsx — a Client Component, anywhere under that layout
'use client'
import { useDevice } from 'next-device-routes/context'

export function Nav() {
  const { isMobile } = useDevice()
  return isMobile ? <MobileNav /> : <DesktopNav />
}
```

`getDevice()` runs the same matching rules as `withDeviceRoutes` and returns:

```ts
{ variant: 'mobile' | 'tablet' | 'bot' | string | null, isMobile, isTablet, isBot, isBase }
```

`variant` is `null` and `isBase` is `true` when nothing matched (the common desktop case).
`isMobile` / `isTablet` / `isBot` are convenience flags for the three default variant names; for a
custom variant (like a `tv` folder), compare `variant === 'tv'` directly.

You don't need the client hook at all if a Server Component is enough — `getDevice()` works
anywhere `next/headers` does (Server Components, Route Handlers, Server Actions,
`generateMetadata`):

```tsx
export default async function Page() {
  const device = await getDevice()
  return device.isBot ? <StaticVersion /> : <InteractiveVersion />
}
```

**Keep it in sync with your `variants`.** If you passed a custom `variants` object to
`withDeviceRoutes`, pass the *same* object to `getDevice({ variants })` — otherwise the two can
disagree about what counts as "mobile". Defining it once in its own module and importing it in
both places avoids the drift entirely:

```ts
// device-variants.ts
export const variants = { bot: [...], tablet: [...], mobile: [...] }
```

**This costs static rendering — scope it deliberately.** `headers()` is a dynamic API: any layout
that calls `getDevice()` makes every page under it server-rendered on every request, not
statically generated. Put it in the layout of just the route segment that needs it (as above), not
in the root layout, or you'll silently lose static generation for your entire site. The
[example](./example) does exactly this — only `/contact` is dynamic; every other route, including
the `mobile` and `tablet` variants, stays static.

## Caveats

**CDN caching.** One URL now returns different HTML per device, so any cache in front of your app
must key on the `User-Agent` (or a normalized device header your CDN provides). Without that, the
first variant cached is served to everyone. Next.js overwrites the `Vary` header itself, so this
cannot be set from `next.config` — configure it on the CDN.

**Dev server.** Routes are scanned when `next.config` loads. Restart `next dev` after adding a page
to a variant folder.

**iPadOS.** Modern iPad Safari sends a desktop macOS User-Agent by default and is indistinguishable
from a Mac at the header level. Android tablets rarely include `Tablet` in their UA and fall through
to `mobile`; add their tokens to the `tablet` variant if you need them.

**Cloaking.** Serving crawlers a page whose content differs materially from what users see violates
search engine guidelines. The `bot` variant is meant for rendering strategy — static, JS-free
markup — not for different content.

**Shared root layout.** `app/layout.tsx` wraps every variant. Put variant-only chrome in
`app/mobile/layout.tsx`.

## How it works

Static routes are emitted into `rewrites().beforeFiles` so they take priority over the identically
named base page. Dynamic routes go into `afterFiles`, so real files in `public/` and `/_next/*`
assets are never swallowed by a catch-all. Within a variant, routes are sorted by specificity —
static segments first, catch-alls last — mirroring Next's own precedence.

User-Agent conditions become `has` / `missing` entries on each rewrite. Next compiles these into a
case-sensitive anchored RegExp, so each token is expanded into character classes
(`iPad` → `[iI][pP][aA][dD]`) to make matching case-insensitive.

`getDevice()` doesn't reuse those rewrite conditions — it compiles the same `variants` into a plain
case-insensitive `RegExp` and tests the request's `user-agent` header directly. Simpler, since a
runtime `.test()` call has no need for Next's anchored, flag-less rewrite format.

## Example

A runnable TypeScript app lives in [`example/`](./example).

```bash
cd example && npm install && npm run build && npm start

curl -s localhost:3000/ -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120"
curl -s localhost:3000/ -A "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile"
```

## Publishing your own fork

```bash
npm view <your-package-name>   # E404 means the name is free
npm login
npm test
npm pack --dry-run             # inspect the tarball contents
npm publish
```

Update `name`, `author`, `repository` and `LICENSE` first. `files` in `package.json` already limits
the tarball to `index.js`, `server.js`, `context.js`, their `.d.ts` files, `lib/`, `README.md` and
`LICENSE` — no `.npmignore` needed. Bump releases with `npm version patch|minor|major`; a published
version can never be overwritten.

## Development

```bash
npm install   # pulls in next/react/react-dom as devDependencies, for the test suite only
npm test      # node:test — 43 tests, no test framework dependency
```

The package itself has zero runtime `dependencies`; `next` and `react` are `peerDependencies` (any
Next.js app already has both) and only appear as `devDependencies` here so `npm test` can exercise
`next/headers` and render `<DeviceProvider>` with real React.

## License

MIT
