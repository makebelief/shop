# Mitchy Kitchen Storefront

Production-ready static single-page application for Mitchy Kitchen & Household
Abode.


## Local development

Requirements: Node.js 20 or newer.

```bash
npm run dev
```

Open `http://localhost:8080`.

## Production

```bash
npm start
```

The server uses `PORT` and `HOST` environment variables when provided, serves
immutable static assets, adds baseline security headers, exposes `/health`, and
falls back to `index.html` for client-side routes.

Run the production and security checks before deployment:

```bash
npm run check
```

## Deployment

- **Netlify:** deploy this repository; `netlify.toml` publishes `public/`.
- **Vercel:** deploy this repository; `vercel.json` provides SPA rewrites.
- **Docker:** build with `docker build -t mitchy-kitchen .` and run with
  `docker run -p 8080:8080 mitchy-kitchen`.
- **Any static host:** publish the `public/` directory and configure unknown
  routes to return `public/index.html`.

## Project structure

```text
public/
  assets/       Compiled application JavaScript and CSS
  brand/        Logo and browser icon assets
  media/        Locally hosted product and category images
  vendor/       Locally hosted icon fonts and styles
  index.html    Production HTML entry point
scripts/
  check.mjs     Deployment structure validation
server.mjs      Dependency-free production and development server
```

The `.source-archive/` directory is reserved for the original downloaded mirror
and is not included in deployments.

See [SECURITY.md](SECURITY.md) for the security architecture, controls,
reporting process, and operational deployment requirements.
