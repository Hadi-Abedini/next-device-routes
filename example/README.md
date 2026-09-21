# Example

A TypeScript App Router project using `next.config.ts`.

```bash
npm install
npm run build
npm start
```

Then compare the responses:

```bash
curl -s localhost:3000/        -A "Mozilla/5.0 (Windows NT 10.0) Chrome/120"        # Base home
curl -s localhost:3000/        -A "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile" # Mobile home
curl -s localhost:3000/        -A "Mozilla/5.0 (iPad; CPU OS 16_0) Mobile"          # Tablet home
curl -s localhost:3000/about   -A "compatible; Googlebot/2.1"                       # Bot about
curl -s localhost:3000/contact -A "Mozilla/5.0 (iPhone) Mobile"                     # Base contact (fallback)
```

> TypeScript 5.x is required. Next.js 15 cannot load `next.config.ts` under TypeScript 7.
