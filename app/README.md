# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## QR Public Deployment Runbook

This project supports public viewer access for the Today page through `GET /api/today/public`.

### 1) Required environment variables

- `API_PORT=4310`
- `VITE_API_BASE=` (same-origin deploy) or `VITE_API_BASE=https://api.your-domain.com`
- `VITE_SUPABASE_URL=https://your-project.supabase.co`
- `VITE_SUPABASE_ANON_KEY=...`
- `SUPABASE_URL=https://your-project.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `MASTER_USER_ID=...` (optional; when set, only this user can access private APIs)
- `PUBLIC_ALLOWED_ORIGINS=https://your-domain.com`
- `TRUST_PROXY_FOR_RATE_LIMIT=false` (set `true` only behind trusted reverse proxy)

If you use multiple origins, separate them with commas:

`PUBLIC_ALLOWED_ORIGINS=https://your-domain.com,https://viewer.your-domain.com`

Recommended `.env` values for this workspace (local dev):

```env
API_PORT=4310
ENABLE_CLIPBOARD_MONITOR=true
VITE_API_BASE=
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
MASTER_USER_ID=ce5b52cd-988b-4dfb-b384-280dba78cd41
PUBLIC_ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
TRUST_PROXY_FOR_RATE_LIMIT=false
```

Recommended `.env` values for public viewer deployment:

```env
API_PORT=4310
ENABLE_CLIPBOARD_MONITOR=true
VITE_API_BASE=
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
MASTER_USER_ID=ce5b52cd-988b-4dfb-b384-280dba78cd41
PUBLIC_ALLOWED_ORIGINS=https://your-domain.com
TRUST_PROXY_FOR_RATE_LIMIT=true
```

### 1.1) Supabase schema

Apply the SQL in `app/docs/supabase-schema.sql` to your Supabase project (SQL editor or migrations).

### 1.2) Supabase RLS (optional)

If you want to enforce master-only access at the DB layer, apply `app/docs/supabase-rls.sql`.

### 1.3) Google login

Enable Google in Supabase Auth Providers. Set the Site URL to your app origin (for local dev: `http://localhost:5173`) and
add redirect URLs as needed. The login page uses OAuth with redirectTo = window.location.origin.

### 2) Local run (dev)

```bash
npm run dev
```

`npm run dev` starts both Vite web (`5173`) and API (`4310`).

### 3) Build web app

```bash
npm run build
```

### 4) QR flow rules

- Dashboard `Show QR` generates `/today?key={token}` when token is present.
- Public endpoint behavior:
  - `qr_public_enabled=true` => `/today` is public.
  - `qr_public_enabled=false` => valid `?key=` token required.

### 5) Tunnel/domain setup

The API server is loopback-only (`127.0.0.1`). For public viewer access, use a tunnel/reverse proxy running on the same machine.

1. Expose frontend route `/today` to viewers via your domain or tunnel.
2. Publicly route only `/api/health` and `/api/today/public` to local API `http://127.0.0.1:4310`.
3. Keep other private API paths (`/api/settings`, `/api/items/*`, `/api/events/*`, `/api/ingest`) non-public.
4. Add viewer web origin(s) to `PUBLIC_ALLOWED_ORIGINS`.
5. Ensure `/api/today/public` is reachable from the viewer origin.
6. Ensure your proxy sanitizes `Host` (fixed to your public domain) and always injects `x-forwarded-for`.
7. If your proxy is trusted and sets `x-forwarded-for`, enable `TRUST_PROXY_FOR_RATE_LIMIT=true` for per-viewer rate-limit buckets.

If you split frontend and API across different origins, set `VITE_API_BASE` to the API public URL.

### 6) Verify from mobile

1. Open Dashboard and click `Show QR`.
2. Scan QR with phone.
3. Confirm Today page loads and shows date, stats, and item grid.
4. Toggle `qr_public_enabled` off and verify token URL still works.

### 7) Automated QR/API checks

Run default local checks:

```bash
npm run verify:qr
```

Run with explicit public behavior and token:

```bash
VERIFY_API_BASE=http://127.0.0.1:4310 \
VERIFY_WEB_BASE=https://your-domain.com \
VERIFY_EXPECT_PUBLIC_NO_KEY=false \
VERIFY_QR_KEY=8fa3d92c41c0eab52e0a1f7f1d8d1c31 \
npm run verify:qr
```

Windows `cmd.exe`:

```bat
set "VERIFY_API_BASE=http://127.0.0.1:4310"
set "VERIFY_WEB_BASE=https://your-domain.com"
set "VERIFY_EXPECT_PUBLIC_NO_KEY=false"
set "VERIFY_QR_KEY=8fa3d92c41c0eab52e0a1f7f1d8d1c31"
npm run verify:qr
```

Windows PowerShell:

```powershell
$env:VERIFY_API_BASE = "http://127.0.0.1:4310"
$env:VERIFY_WEB_BASE = "https://your-domain.com"
$env:VERIFY_EXPECT_PUBLIC_NO_KEY = "false"
$env:VERIFY_QR_KEY = "8fa3d92c41c0eab52e0a1f7f1d8d1c31"
npm run verify:qr
```

Supported variables:

- `VERIFY_API_BASE` (default: `http://127.0.0.1:4310`)
- `VERIFY_WEB_BASE` (optional, when you want `/today` HTML route check)
- `VERIFY_EXPECT_PUBLIC_NO_KEY` (`true` or `false`)
- `VERIFY_QR_KEY` (optional token check)

### 8) Unique image coverage report

Report unique-image mapping/file coverage:

```bash
npm run report:unique-images
```

Strict mode (fail when missing map entry or missing icon file exists):

```bash
UNIQUE_IMAGE_REPORT_STRICT=true npm run report:unique-images
```

Windows `cmd.exe`:

```bat
set "UNIQUE_IMAGE_REPORT_STRICT=true"
npm run report:unique-images
```

Windows PowerShell:

```powershell
$env:UNIQUE_IMAGE_REPORT_STRICT = "true"
npm run report:unique-images
```
