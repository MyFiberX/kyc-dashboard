
# FiberX KYC — Operator Console

A Vue 3 dashboard for the existing `KYC.backend`. Operators sign in with a username and password
and work KYC records, campaigns, subscription plans, reference data, registration links, API
clients and operator accounts.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173, proxying /api to the backend
```

The application listens on `https://localhost:7209` and `http://localhost:5112`.

### Talking to the API: two arrangements

**Direct (what `.env.development` is set to).** `VITE_API_BASE_URL=https://localhost:7209` — the
browser calls the API on its own origin. That is a cross-origin request, so the backend's CORS
policy has to allow it; in Development it admits **any loopback port**, so whatever port Vite takes
works with no configuration. Note the URL has no trailing slash: it is joined to paths like
`/api/v1/kyc`, and a slash would produce `//api/v1/kyc`.

**Proxied.** Leave `VITE_API_BASE_URL` empty and the dev server forwards `/api` and `/brand` to
`VITE_DEV_API_TARGET`. The browser stays on one origin, so CORS never applies at all.

### CORS

Configured under `Security:Cors` in the backend's `appsettings.json`:

```jsonc
"Cors": {
  "Origins": [],                        // exact origins: scheme + port, no trailing slash
  "AllowLocalhostInDevelopment": true   // any loopback port, Development only
}
```

It is **not** `AllowAnyOrigin`, for two reasons. This API is authenticated by an
`Authorization: Bearer` header, and a wildcard would let a page on any site script requests against
it with a token it obtained. A wildcard is also self-defeating — the CORS spec forbids pairing one
with credentials — so the permissive option is the one that breaks the header the API actually uses.

CORS is not authorization. It decides which *page* may read a response; every route still demands
the same credential and scope, and a non-browser caller (curl, an integration's server) ignores CORS
entirely. Listing an origin lets a page read only what the operator signed into it could already
read. `KYC.backend.Tests/CorsTests.cs` asserts both halves: configured origins are admitted, and
unlisted ones — including `http://localhost.attacker.com`, which a naive prefix match would have
let through — are not.

For production, either serve the dashboard from the same host as the API (leave `Origins` empty and
`VITE_API_BASE_URL` empty), or list the **dashboard's** origin in `Origins` — the backend names the
page's origin, not its own.

```bash
npm run type-check
npm run lint
npm run test
npm run build      # -> dist/
```

## The backend change this depends on

This dashboard required one change to the backend, and it is worth understanding before deploying.

The business endpoints — KYC, campaigns, subscriptions, provinces, regions — were mapped on a route
group carrying `.RequireApiClient()`. ASP.NET Core *stacks* authorization policies rather than
replacing them, so that group's `ApiClient`-only requirement was evaluated in addition to each
endpoint's scope policy. A SuperAdmin bearer token satisfied neither, and every one of those routes
answered **401 to the most privileged account in the system**. That was verified against the running
application, not inferred.

A browser dashboard therefore had exactly two options: ship an API client secret key in the
JavaScript bundle — which the backend's own `BUSINESS_API.md` forbids, because anyone who opens the
page can read it — or admit operators to those routes. The second was chosen.

The change reuses the pattern the backend already had for registration links, which were always an
operator screen:

- `Program.cs` — the business group no longer carries `.RequireApiClient()`.
- The five business endpoint files — `.RequireScope(x)` became `.RequireScopeOrOperator(x)`.

What this does **not** change:

- An API key still has to hold the scope an endpoint requires. `OperatorBusinessAccessTests`
  asserts that a key with only `KycRead` is still refused campaigns, subscriptions and analytics.
- The administrative surface (API clients, operator accounts) still requires the SuperAdmin role.
  An Admin is refused, and that is asserted too.
- The request logs stay integration-only. They record every caller's IP and user agent across the
  whole system, are deliberately not part of `KycAll`, and no operator token reaches them — so the
  console has no page for them.

`KYC.backend.Tests/OperatorBusinessAccessTests.cs` covers all of the above.

## Architecture

```
src/
├── api/          one typed function per backend endpoint; no axios call lives in a component
├── components/   ui/ (design system), charts/, BrandLogo
├── composables/  useListQuery (URL-synced filters, request cancellation)
├── layouts/      AppLayout, AppSidebar, AppTopbar
├── locales/      ar.json, en.json
├── router/       routes + permission guards
├── stores/       auth, ui, permissions
├── utils/        format (Intl), errors, status
└── views/        one directory per module
```

### Authentication

Operator sign-in against `/api/super-admin/auth/login`, which returns an access token and a refresh
token.

- The **access token is held in memory only**. It is a bearer credential; storage would let any
  script on the page read it back.
- The **refresh token is kept in `sessionStorage`** — the single deliberate exception, because
  without it a page reload ends the session. `sessionStorage` rather than `localStorage` so it dies
  with the tab rather than persisting on a shared machine.
- A 401 on any request triggers **one** refresh, shared across concurrent requests. The backend
  revokes each refresh token as it is used, so parallel refreshes would log the operator out.
- The profile is always re-fetched from `/me`; nothing about identity is trusted from storage.

### Authorization

Frontend permission checks are **UX only** — the backend re-checks everything and a 403 is handled
wherever one can arrive. The model is role-shaped because the backend's is: operators are never
issued scope claims. Both operator roles reach the business surface; SuperAdmin additionally
reaches API clients and operator accounts.

### Contract details worth knowing

- `publicResultUrl` appears **only** on a single-record read. The listing deliberately omits it —
  a link per row would hand out a durable, unauthenticated view of every customer at once.
- `priceAtSubmission` is displayed as-is. A record's total is never recomputed from a plan's current
  price, so editing a plan never rewrites history.
- Updates are partial. Only fields the operator actually changed are sent; `null` clears a nullable
  field, while omitting it leaves the stored value alone.
- `totalCount` is `null` when uncounted (`includeTotal=false`, or any cursor page). Null means "not
  counted", which the pagination UI distinguishes from zero.
- Analytics windows default to 30 days and are capped at 366; the picker cannot select a wider range,
  because the backend refuses one with a 400 rather than shortening it.
- KYC creation sends an `Idempotency-Key`, so a double submission cannot create two customers.

### Secret keys

Creating or rotating an API client returns a plaintext key once. It is rendered in a dialog that
cannot be dismissed by accident and is never written to any store, to storage, to a URL, or to a
log. `tests/security.spec.ts` asserts it never reaches browser storage, and the built bundle
contains no `sk_live` or `X-Secret-Key` string at all.

## Localization

Arabic and English, with full RTL/LTR. Layout uses CSS logical properties (`ms-`, `me-`, `ps-`,
`pe-`, `start`, `end`) rather than directional overrides, so the sidebar, tables, dialogs, chart
axes and pagination all mirror correctly. Dates, numbers and currency are formatted with `Intl`
under `ar-IQ` / `en-US`, matching the customer-facing pages. `tests/i18n.spec.ts` fails if either
locale is missing a key the other has.
