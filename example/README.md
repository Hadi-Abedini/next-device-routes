# Example

A TypeScript App Router project whose routes all start at `src/app/[lang]`.

```bash
npm install
npm run build
npm start
```

`npm install` fetches the published `next-device-routes`. To try the checkout one level up instead:

```bash
(cd .. && npm pack)
npm install ../next-device-routes-*.tgz
```

## What it shows

| Feature | Where |
| --- | --- |
| Variant folders below `[lang]` (`root`) | `next.config.ts` |
| One variant in a folder of its own (`dir`) — tablets live in `[lang]/tab` | `next.config.ts`, `src/app/[lang]/tab` |
| Redirect `/en/mobile/about` → `/en/about` | `redirectVariantPaths` in `next.config.ts` |
| The device in the root layout **without** reading the request | `src/app/layout.tsx` (`<RouteDeviceProvider>`) |
| A page shared by base and mobile that stays static | `[lang]/pricing` + `[lang]/mobile/pricing` (a one-line re-export) |
| The one route that does read the request | `[lang]/contact` (`<DeviceBoundary>`) |

Every route except `/[lang]/contact` is prerendered for both languages (`en`, `fa`) and every device.
`next build` marks `contact` with `●` too because of `generateStaticParams`; check the response
headers instead — it is served with `Cache-Control: no-store`.

## Try it

```bash
UA_DESKTOP="Mozilla/5.0 (Windows NT 10.0) Chrome/120"
UA_PHONE="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148"
UA_TABLET="Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) Mobile/15E148"
UA_GOOGLEBOT_PHONE="Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) Chrome/120 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"

curl -s localhost:3000/en/about   -A "$UA_DESKTOP"          # Base about
curl -s localhost:3000/en/about   -A "$UA_PHONE"            # Mobile about
curl -s localhost:3000/en/about   -A "$UA_GOOGLEBOT_PHONE"  # Bot about — a crawler, never "mobile"
curl -s localhost:3000/fa         -A "$UA_TABLET"           # Tablet home (from [lang]/tab)
curl -s localhost:3000/en/pricing -A "$UA_PHONE"            # the shared page, rendered as `mobile`
curl -s localhost:3000/en/contact -A "$UA_PHONE"            # base page; the request says `mobile`
curl -si localhost:3000/en/mobile/about | head -n 3         # 307 → /en/about
```

> TypeScript 5.x is required. Next.js 15 cannot load `next.config.ts` under TypeScript 7.
