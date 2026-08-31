# GatePass — Visitor Gate Pass & On-Site Register

SAP BTP Trainee Programme, CAP Starter Project (Trainee 1). NubTech Industries Pvt. Ltd. —
Plant Security & EHS. Full specification: [`GatePass.md`](./GatePass.md).

## How to run it

```bash
npm install
npm test          # 20/20 — every Section 13 acceptance case, one test per rule
cds watch          # http://localhost:4004, SQLite in memory, seed data from db/data
```

`npm test` boots the service in-memory against SQLite and runs the full Section 13
acceptance script as HTTP calls — no UI involved — so it is exactly what a mentor
running curl would see. It is one command from a clean checkout, as Section 14 asks.

Open `http://localhost:4004` for the Fiori preview index, or go straight to an app:

| App | Path | Persona |
| --- | --- | --- |
| My Passes (S1) | `/my-passes/webapp/index.html` | Host |
| Approval Worklist (S2) | `/approvals/webapp/index.html` | Security Supervisor |
| Gate Console (S3) | `/gate-console/webapp/index.html` | Security Guard |
| Reports — On Site Now / Overstay (R1, R2) | `/reports/webapp/index.html` | Security office, Supervisor |
| Visitor Footfall (R3) | `/footfall/webapp/index.html` | Plant head, ISO audit |

Seed data (`db/data/*.csv`) is fixed to specific calendar dates, but Section 12.5's test
passes are only meaningful relative to "today" and "yesterday". Outside a `production`
profile, the service rebases the six seeded passes onto the current date at startup
(`rebaseSeedData` in `srv/gatepass-service.js`) so TC-04 through TC-12 stay reproducible
on whatever day you run this. It never runs against HANA.

## Test users (`cds.requires.auth.users` in `package.json`)

| Login | Password | Employee | Roles |
| --- | --- | --- | --- |
| `anitha` | `pass` | E1001 | Host |
| `karthik` | `pass` | E1002 | Host |
| `meera` | `pass` | E1003 | Host + SecuritySupervisor (plant 1000) — tests BR-11 |
| `rakesh` | `pass` | E1004 | SecuritySupervisor (plant 1000) |
| `suresh` | `pass` | E1005 | Host (plant 2000) |
| `guard1` | `pass` | — | SecurityGuard (plant 1000) |
| `guard2` | `pass` | — | SecurityGuard (plant 2000) — tests plant restriction |
| `admin` | `pass` | — | Admin |

## What's implemented

- **Data model** (`db/schema.cds`) — every field in Section 6, `master`/`config`/`transaction`
  contexts, compositions for `PassItems`/`PassEvents`, associations to master data.
- **All 14 business rules**, each traceable to a comment and a named test in
  `test/gatepass.test.js`. Submit collects every error in one pass rather than stopping
  at the first (Section 14's M2 gate).
- **Instance-based authorization** on the service (`srv/gatepass-service.cds`, `@restrict`
  with `where` clauses): a host reads and writes only their own passes; a guard and a
  supervisor are confined to their own plant; nobody can approve a pass they host, even
  holding the supervisor role (BR-11); a pass is writable only while it is `DRAFT` —
  editing an `APPROVED` pass and reactivating the draft is refused server-side
  (`assertStillDraft`), not just hidden in the UI.
- **The full status lifecycle** (Section 7) behind one transition table
  (`ACTION_MAP`) that every action consults; `ON_SITE → CANCELLED` does not exist and
  cannot be reached. Every transition writes exactly one `PassEvent` in the same
  transaction as the status change.
- **Check-out with item confirmation** (BR-09) — `checkOut` accepts the guard's
  confirmations directly, and `PassItems.confirmReturn` lets the guard tick items one at
  a time from the object page; a forced check-out with an outstanding item requires a
  remark, which is written onto the `PassEvent`.
- **BR-14 masking** in an `after('READ')` handler, holding through `$expand` from
  `PassItems`/`PassEvents` as well as a direct read.
- **The day-end job** — idempotent, HTTP-callable only by Admin, expires unused `APPROVED`
  passes and flags overstays without ever inventing a departure time.
- **All three personas' screens** — My Passes (S1), Approval Worklist (S2, with an
  auto-generated reject-reason dialog from the action's own parameter), Gate Console (S3,
  two tabs for Expected/On Site, `$search` wired to name/mobile/passNo/company/badge) —
  plus R1, R2 and a genuinely aggregated R3 (`VisitorFootfall`, grouped and averaged in
  the database).
- Every user-facing string lives in `srv/i18n/messages.properties` (business rule
  messages, resolved by key through CAP's `messages` bundle) or `srv/i18n/i18n.properties`
  (UI labels, resolved through the `labels` bundle) — nothing is hard-coded mid-logic.

### Known simplifications (said out loud, per Section 2's own advice)

- Gate Console's "Expected Today" tab filters on `status = APPROVED` rather than also
  pinning `visitDate = today`: OData annotations can't express a dynamic "today" default,
  and a controller extension felt like more custom code than the tab's value justified.
  The guard's search box (BR-mandated, and the 15-second test) narrows the rest of the way.
- `VisitAreas.maxVisitorsOnSite` is carried in the schema and CSVs per Section 6.4 but not
  enforced. No business rule in Section 8 assigns it one, and Section 2's rule is explicit
  about not inventing behaviour a line of the spec doesn't call for — flagged here instead.
- The Fiori Elements "Edit" button is visible on a closed pass; clicking it and saving is
  refused server-side with a clear message (see `assertStillDraft`). Hiding the button
  outright needs a per-instance capability expression FE doesn't support cleanly; the
  enforcement that TC-08 actually tests is server-side regardless.

## The three decisions that took the most thought

1. **Where check-out's item confirmations should live.** The spec gives `checkOut()` no
   parameters, but BR-09 requires ticking specific items. Adding `items` to the action
   payload (for the "confirm several at once" case) and a separate bound
   `PassItems.confirmReturn` action (for "the guard taps one row") cover both without
   ever letting a plain PATCH reach `returnedAtExit` — that field is system-set the same
   way `actualInAt` is.
2. **`@restrict` where-clauses vs. hand-written checks in the handler.** Putting plant and
   ownership restriction in the `.cds` file means it is enforced before a handler ever
   runs, holds for every entity read (including `$expand`), and is provably the same rule
   for Fiori and for curl. The cost is that CAP's `@restrict` failures surface as a bare
   403/404 with no custom message — traded deliberately, since TC-09 asks for exactly
   that shape of failure ("403 or empty, never data").
3. **Splitting `i18n.properties` into two bundles.** CAP resolves `req.error()` /
   `req.reject()` message keys from a bundle named `messages` (basename `messages.properties`)
   and resolves `{i18n>Key}` UI annotation labels from a bundle named for the CDS model
   (`i18n.properties`) — they are not the same lookup. Business-rule text belongs in the
   first; field/screen labels in the second. Getting this wrong silently turns every
   single-error validation failure into a 500 instead of a 400, which is how the bug was
   actually found.

## Project layout

```
db/schema.cds              master / config / transaction entities
db/data/*.csv               Section 12 test data
srv/gatepass-service.cds    service, @restrict, actions, VisitorFootfall aggregate, $search
srv/gatepass-service.js     business rules, status machine, masking, day-end job
srv/i18n/messages.properties   business-rule and lifecycle message texts
srv/i18n/i18n.properties       UI field/screen labels
app/my-passes/               S1 — Host
app/approvals/               S2 — Security Supervisor
app/gate-console/            S3 — Security Guard
app/reports/                 R1, R2
app/footfall/                R3
app/router/                  approuter (HTML5 + destinations)
test/gatepass.test.js        Section 13 acceptance script, one test per case/rule
mta.yaml, xs-security.json   Cloud Foundry deployment, XSUAA roles + plant attribute
```
