# TODO — Direct hero polish + local dev/LAN workflow

## Implementation checklist

- [x] Apply checker/grid pattern directly inside the Direct hero container so it overlaps with the gradient.
- [x] Remove the extra enclosing visual wrapper around the hero + lower panels.
- [x] Keep the Direct lower panels lighter so the page feels less boxed-in.
- [x] Add a single-command local dev startup for the whole app (frontend + API together).
- [x] Bind local dev to `0.0.0.0:3333` so phones/laptops on the LAN can reach it.
- [x] Dynamically determine the current LAN IP on startup.
- [x] Override `APP_URL` and `NEXTAUTH_URL` at startup so local-network testing uses the same LAN origin for UI and API.
- [x] Restore reliable local access to `/` and `/direct` during dev.
- [x] Make the local dev path faster with Next.js Turbopack.
- [x] Add Bun-aware wrappers for dev/build when Bun is installed.
- [ ] Migrate to Vite.

## Why Vite is not checked off

This repo is a Next.js App Router application with server rendering, route handlers, middleware, cookies/session flows, and in-process API routes. A switch to Vite is not a build-flag change; it is a framework migration that would require replacing:

- App Router rendering
- route handlers / API endpoints
- middleware behavior
- server-side auth/session flows
- Next-specific asset/build/runtime behavior

For speed without breaking architecture, the safe improvement is **Next + Turbopack**, with **Bun-aware execution** when Bun is available.

## Test checklist

- [x] `npm run lint`
- [x] `npm run dev` starts with a single command
- [x] Startup prints both localhost and LAN URLs
- [x] `/` returns HTTP 200 in local dev
- [x] `/direct` returns HTTP 200 in local dev
- [x] `http://<LAN-IP>:3333/api/...` is reachable on the same origin as the UI during local dev
- [x] Direct hero screenshot verifies checker/grid pattern overlaps the gradient

## Current local workflow

Run:

```bash
npm run dev
```

The launcher will:

1. detect the current LAN IP
2. bind Next dev to `0.0.0.0:3333`
3. set `APP_URL` + `NEXTAUTH_URL` to `http://<LAN-IP>:3333` for that run
4. start the whole app (UI + API) in one process
5. prefer Bun automatically if Bun is installed; otherwise fall back to Node/npm
