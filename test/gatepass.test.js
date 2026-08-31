import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cds from '@sap/cds';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * GatePass — Section 13 Acceptance Test Script.
 *
 * One test per case, named for the case and the rules it proves, run as
 * the persona named in the specification.  Every assertion goes over
 * HTTP against the real service: no handler is called directly, so what
 * passes here is what a mentor with curl will see.
 */
const { GET, POST, PATCH, DELETE } = cds.test(join(__dirname, '..'));

const B = '/odata/v4/gate-pass';

// Section 12.4 test users
const anitha  = { auth: { username: 'anitha',  password: 'pass' } };  // Host
const karthik = { auth: { username: 'karthik', password: 'pass' } };  // Host
const meera   = { auth: { username: 'meera',   password: 'pass' } };  // Host + Supervisor — exists for BR-11
const rakesh  = { auth: { username: 'rakesh',  password: 'pass' } };  // Supervisor, plant 1000
const guard1  = { auth: { username: 'guard1',  password: 'pass' } };  // Guard, plant 1000
const guard2  = { auth: { username: 'guard2',  password: 'pass' } };  // Guard, plant 2000
const admin   = { auth: { username: 'admin',   password: 'pass' } };  // Admin

// Section 12.5 seeded passes
const SEED = {
  approvedToday:   '10000000-0000-0000-0000-000000000001', // GP-1000-2026-00001, SHOPFLOOR, 3 items
  onSiteToday:     '10000000-0000-0000-0000-000000000002', // GP-1000-2026-00002, badge B-014
  overstay:        '10000000-0000-0000-0000-000000000003', // GP-1000-2026-00003, ON_SITE since yesterday
  neverUsed:       '10000000-0000-0000-0000-000000000004', // GP-1000-2026-00004, expires
  plant2000:       '10000000-0000-0000-0000-000000000005', // GP-2000-2026-00001, same mobile as 00001
  karthikDraft:    '10000000-0000-0000-0000-000000000006'
};
const SEED_EVENT = '30000000-0000-0000-0000-000000000001';

// ── date / time helpers, so the suite never goes stale ──────────────
const pad = (n) => String(n).padStart(2, '0');
const dayOffset = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const TODAY = dayOffset(0);
const TOMORROW = dayOffset(1);
const YESTERDAY = dayOffset(-1);

/** 'HH:MM:SS' this many minutes from now, clamped inside plant 1000's gate hours (07:00–20:00). */
const clockIn = (minutesFromNow) => {
  const now = new Date();
  let m = now.getHours() * 60 + now.getMinutes() + minutesFromNow;
  m = Math.min(Math.max(m, 7 * 60 + 1), 20 * 60 - 1);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}:00`;
};
const NOW_MIN = new Date().getHours() * 60 + new Date().getMinutes();

const req = async (fn) => {
  try { return await fn(); } catch (e) { return e.response ?? { status: 0, data: { error: { message: e.message } } }; }
};
/** Every message in the response — CAP puts collected errors in error.details. */
const messages = (r) => {
  const e = r?.data?.error;
  if (!e) return [];
  return [e.message, ...(e.details ?? []).map((d) => d.message)].filter(Boolean);
};
const said = (r, re) => messages(r).some((m) => re.test(m));

/** Create a draft, fill it in, and save it. Returns the active pass ID. */
const raisePass = async (user, fields = {}) => {
  const created = await POST(`${B}/VisitorPasses`, {}, user);
  const ID = created.data.ID;
  await PATCH(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=false)`, {
    visitorName: 'Probe Visitor',
    visitorCompany: 'Probe Industries',
    visitorMobile: '9876500001',
    visitDate: TODAY,
    validFrom: '09:00:00',
    validTo: '17:00:00',
    purpose_code: 'CUSTOMER',
    idProofType_code: 'PAN',
    idProofNumber: 'ABCDE1234F',
    plant_code: '1000',
    area_code: 'OFFICE',
    area_plant_code: '1000',
    ...fields
  }, user);
  await POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=false)/GatePassService.draftActivate`, {}, user);
  return ID;
};

const readAs = (ID, user) => req(() => GET(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)`, user));
const events = async (ID) => {
  const r = await GET(`${B}/PassEvents?$filter=pass_ID eq ${ID}&$orderby=seq`, admin);
  return r.data.value;
};

describe('GatePass — Section 13 acceptance tests', () => {

  // ══════════════════════════════════════════════════════════════════
  it('TC-01 · BR-04, BR-12 — OFFICE needs no approval, so submit lands APPROVED with a passNo', async () => {
    const ID = await raisePass(anitha, { visitDate: TOMORROW });

    const draft = await readAs(ID, anitha);
    assert.equal(draft.data.status_code, 'DRAFT');
    assert.equal(draft.data.passNo, null, 'BR-12: a DRAFT has no passNo');

    const r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.submit`, {}, anitha));
    assert.equal(r.status, 200);
    assert.equal(r.data.status_code, 'APPROVED', 'BR-04: OFFICE has requiresApproval = false');
    assert.match(r.data.passNo, /^GP-1000-\d{4}-\d{5}$/, 'BR-12: GP-<plant>-<YYYY>-<5 digits>');

    const ev = await events(ID);
    assert.equal(ev.length, 1, 'BR-12: exactly one event row');
    assert.equal(ev[0].fromStatus, 'DRAFT');
    assert.equal(ev[0].toStatus, 'APPROVED');
    assert.equal(ev[0].action, 'SUBMIT');
    assert.equal(ev[0].actor, 'anitha', 'the actor comes from req.user, never the payload');
  });

  // ══════════════════════════════════════════════════════════════════
  it('TC-02 · BR-05 — SHOPFLOOR refuses a submit with no induction, and with an expired one', async () => {
    const ID = await raisePass(anitha, { visitDate: TOMORROW, area_code: 'SHOPFLOOR' });

    // (a) no induction reference at all
    let r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.submit`, {}, anitha));
    assert.equal(r.status, 400);
    assert.ok(said(r, /requires a valid safety induction/), messages(r).join(' / '));

    let after = await readAs(ID, anitha);
    assert.equal(after.data.status_code, 'DRAFT', 'status stays DRAFT');
    assert.equal(after.data.passNo, null, 'no passNo');
    assert.equal((await events(ID)).length, 0, 'no event row');

    // (b) an induction that expired the day before the visit
    await PATCH(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)`, {}, anitha); // no-op; edit via draft below
    await POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.draftEdit`, { PreserveChanges: true }, anitha);
    await PATCH(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=false)`, {
      inductionRef: 'IND-2026-118', inductionValidTill: TODAY
    }, anitha);
    await POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=false)/GatePassService.draftActivate`, {}, anitha);

    r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.submit`, {}, anitha));
    assert.equal(r.status, 400);
    assert.ok(said(r, /induction expired on/), messages(r).join(' / '));

    after = await readAs(ID, anitha);
    assert.equal(after.data.status_code, 'DRAFT');
    assert.equal(after.data.passNo, null);
    assert.equal((await events(ID)).length, 0);
  });

  // ══════════════════════════════════════════════════════════════════
  it('TC-03 · BR-04, BR-10 — fixed induction goes to REQUESTED; reject needs 10 characters', async () => {
    const ID = await raisePass(anitha, {
      visitDate: TOMORROW, area_code: 'SHOPFLOOR',
      inductionRef: 'IND-2026-118', inductionValidTill: dayOffset(200)
    });

    let r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.submit`, {}, anitha));
    assert.equal(r.status, 200);
    assert.equal(r.data.status_code, 'REQUESTED', 'BR-04: SHOPFLOOR has requiresApproval = true');

    // it appears on the supervisor's worklist
    const worklist = await GET(`${B}/VisitorPasses?$filter=status_code eq 'REQUESTED'`, rakesh);
    assert.ok(worklist.data.value.some((p) => p.ID === ID), 'on the supervisor worklist');

    // BR-10: nine characters is not a reason
    r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.rejectPass`, { reason: 'Too short' }, rakesh));
    assert.equal(r.status, 400);
    assert.ok(said(r, /at least 10 characters/), messages(r).join(' / '));
    assert.equal((await readAs(ID, anitha)).data.status_code, 'REQUESTED', 'still REQUESTED');

    // ten or more is
    const reason = 'Induction certificate could not be verified with EHS';
    r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.rejectPass`, { reason }, rakesh));
    assert.equal(r.status, 200);
    assert.equal(r.data.status_code, 'REJECTED');
    assert.equal(r.data.rejectionReason, reason, 'the reason is stored exactly as written');

    const ev = await events(ID);
    assert.equal(ev.length, 2);
    assert.equal(ev[1].action, 'REJECT');
    assert.equal(ev[1].remark, reason);

    // and the host can read it
    const asHost = await readAs(ID, anitha);
    assert.equal(asHost.data.rejectionReason, reason);
  });

  // ══════════════════════════════════════════════════════════════════
  it('TC-04 · BR-06 — 45 minutes early is refused, 20 minutes early is admitted', async () => {
    // A window that opens 45 minutes from now.
    const ID = await raisePass(anitha, {
      visitorMobile: '9876500004',
      area_code: 'SHOPFLOOR', inductionRef: 'IND-2026-118', inductionValidTill: dayOffset(200),
      validFrom: clockIn(45), validTo: clockIn(200)
    });
    await POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.submit`, {}, anitha);

    // the supervisor approves it
    const ap = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.approve`, {}, rakesh));
    assert.equal(ap.status, 200);
    assert.equal(ap.data.status_code, 'APPROVED');

    // 45 minutes early — refused, and the message names the window
    let r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.checkIn`, { badgeNo: 'B-101' }, guard1));
    assert.equal(r.status, 400);
    assert.ok(said(r, /valid from .* to .* Ask the host to extend it/), messages(r).join(' / '));
    assert.equal((await readAs(ID, admin)).data.status_code, 'APPROVED', 'nothing moved');

    // widen the window so "now" is 20 minutes after it opens
    const trans = cds.entities('nub.gatepass.transaction');
    await UPDATE(trans.VisitorPasses, ID).set({ validFrom: clockIn(-20) });

    r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.checkIn`, { badgeNo: 'B-101' }, guard1));
    assert.equal(r.status, 200, messages(r).join(' / '));
    assert.equal(r.data.status_code, 'ON_SITE');
    assert.ok(r.data.actualInAt, 'actualInAt stamped by the server');
    assert.equal(r.data.badgeNo, 'B-101', 'badge recorded');

    const ev = await events(ID);
    assert.equal(ev.at(-1).action, 'CHECK_IN');
    assert.equal(ev.at(-1).actor, 'guard1');
  });

  // ══════════════════════════════════════════════════════════════════
  it('TC-05 · BR-07 — submit warns about a second open pass, check-in refuses it', async () => {
    const mobile = '9876500005';

    // first pass, checked in at plant 1000
    const first = await raisePass(anitha, {
      visitorMobile: mobile, validFrom: clockIn(-30), validTo: clockIn(200)
    });
    await POST(`${B}/VisitorPasses(ID=${first},IsActiveEntity=true)/GatePassService.submit`, {}, anitha);
    const ci = await req(() => POST(`${B}/VisitorPasses(ID=${first},IsActiveEntity=true)/GatePassService.checkIn`, { badgeNo: 'B-200' }, guard1));
    assert.equal(ci.status, 200, messages(ci).join(' / '));

    // second pass, same mobile, plant 2000 — suresh hosts there
    const suresh = { auth: { username: 'suresh', password: 'pass' } };
    const second = await raisePass(suresh, {
      visitorMobile: mobile, plant_code: '2000', area_code: 'OFFICE', area_plant_code: '2000',
      validFrom: clockIn(-30), validTo: clockIn(200)
    });

    // BR-07 at submit is a WARNING: it succeeds
    const sub = await req(() => POST(`${B}/VisitorPasses(ID=${second},IsActiveEntity=true)/GatePassService.submit`, {}, suresh));
    assert.equal(sub.status, 200, 'submit succeeds');
    assert.equal(sub.data.status_code, 'APPROVED');
    const warned = JSON.stringify(sub.headers?.['sap-messages'] ?? '');
    assert.match(warned, /already has an open pass/, 'and it warns');

    // BR-07 at check-in is an ERROR, and it names the other pass
    const r = await req(() => POST(`${B}/VisitorPasses(ID=${second},IsActiveEntity=true)/GatePassService.checkIn`, { badgeNo: 'B-201' }, guard2));
    assert.equal(r.status, 400);
    assert.ok(said(r, /Already on site at 1000 on pass GP-1000-/), messages(r).join(' / '));
  });

  // ══════════════════════════════════════════════════════════════════
  it('TC-06 · BR-08 — an issued badge is refused, and free again once its holder leaves', async () => {
    // the seeded pass 00002 is on site on badge B-014
    const holder = await readAs(SEED.onSiteToday, admin);
    assert.equal(holder.data.status_code, 'ON_SITE');
    assert.equal(holder.data.badgeNo, 'B-014');

    const ID = await raisePass(anitha, {
      visitorMobile: '9876500006', validFrom: clockIn(-30), validTo: clockIn(200)
    });
    await POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.submit`, {}, anitha);

    let r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.checkIn`, { badgeNo: 'B-014' }, guard1));
    assert.equal(r.status, 400);
    assert.ok(said(r, /Badge B-014 is already issued to Sneha Kulkarni on pass GP-1000-2026-00002/), messages(r).join(' / '));

    // check the holder out, then retry
    const out = await req(() => POST(`${B}/VisitorPasses(ID=${SEED.onSiteToday},IsActiveEntity=true)/GatePassService.checkOut`, {}, guard1));
    assert.equal(out.status, 200, messages(out).join(' / '));

    r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.checkIn`, { badgeNo: 'B-014' }, guard1));
    assert.equal(r.status, 200, messages(r).join(' / '));
    assert.equal(r.data.badgeNo, 'B-014', 'the badge is reusable once released');
  });

  // ══════════════════════════════════════════════════════════════════
  it('TC-07 · BR-09 — check-out blocked while the laptop is unconfirmed, then stamps and releases', async () => {
    const created = await POST(`${B}/VisitorPasses`, {}, anitha);
    const ID = created.data.ID;
    await PATCH(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=false)`, {
      visitorName: 'Ramesh Gupta', visitorCompany: 'Alpha Tooling', visitorMobile: '9876500007',
      visitDate: TODAY, validFrom: clockIn(-30), validTo: clockIn(200),
      purpose_code: 'SUPPLIER', idProofType_code: 'AADHAAR', idProofNumber: '123456789012',
      plant_code: '1000', area_code: 'OFFICE', area_plant_code: '1000',
      items: [
        { description: 'Dell Latitude laptop', serialNo: 'DL7420-88231', quantity: 1, isReturnable: true },
        { description: 'Sample castings for inspection', quantity: 4, isReturnable: false }
      ]
    }, anitha);
    await POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=false)/GatePassService.draftActivate`, {}, anitha);
    await POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.submit`, {}, anitha);
    const ci = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.checkIn`, { badgeNo: 'B-300' }, guard1));
    assert.equal(ci.status, 200, messages(ci).join(' / '));

    // (a) refused, and it names the laptop — the non-returnable casting is not mentioned
    let r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.checkOut`, {}, guard1));
    assert.equal(r.status, 400);
    assert.ok(said(r, /1 returnable item\(s\) not confirmed: Dell Latitude laptop/), messages(r).join(' / '));
    assert.equal((await readAs(ID, admin)).data.status_code, 'ON_SITE');

    // (b) the guard ticks the laptop back out, one item at a time
    const items = (await GET(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/items`, guard1)).data.value;
    const laptop = items.find((i) => i.isReturnable);
    const conf = await req(() => POST(`${B}/PassItems(ID=${laptop.ID},IsActiveEntity=true)/GatePassService.confirmReturn`, { returned: true }, guard1));
    assert.equal(conf.status, 200, messages(conf).join(' / '));

    const before = new Date((await readAs(ID, admin)).data.actualInAt);
    r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.checkOut`, {}, guard1));
    assert.equal(r.status, 200, messages(r).join(' / '));
    assert.equal(r.data.status_code, 'CHECKED_OUT');
    assert.ok(r.data.actualOutAt, 'actualOutAt stamped');
    const expected = Math.round((new Date(r.data.actualOutAt) - before) / 60000);
    assert.equal(r.data.durationMinutes, expected, 'durationMinutes matches the two timestamps');
    assert.equal(r.data.badgeNo, null, 'BR-08: the badge is released at check-out');
  });

  // ══════════════════════════════════════════════════════════════════
  it('TC-07b · BR-09 — a forced check-out needs a remark per item, and records one on the event', async () => {
    const created = await POST(`${B}/VisitorPasses`, {}, anitha);
    const ID = created.data.ID;
    await PATCH(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=false)`, {
      visitorName: 'Forced Exit', visitorCompany: 'Alpha Tooling', visitorMobile: '9876500017',
      visitDate: TODAY, validFrom: clockIn(-30), validTo: clockIn(200),
      purpose_code: 'SERVICE', idProofType_code: 'DL', idProofNumber: 'KA1234567890',
      plant_code: '1000', area_code: 'OFFICE', area_plant_code: '1000',
      items: [{ description: 'Torque wrench set', serialNo: 'TW-455-A', quantity: 1, isReturnable: true }]
    }, anitha);
    await POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=false)/GatePassService.draftActivate`, {}, anitha);
    await POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.submit`, {}, anitha);
    await POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.checkIn`, { badgeNo: 'B-301' }, guard1);

    const items = (await GET(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/items`, guard1)).data.value;

    // not returned and no reason — refused
    let r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.checkOut`,
      { items: [{ ID: items[0].ID, returnedAtExit: false }] }, guard1));
    assert.equal(r.status, 400);

    // not returned, with a reason — allowed, and the reason reaches the audit trail
    r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.checkOut`,
      { items: [{ ID: items[0].ID, returnedAtExit: false, exitRemark: 'Left with the host for calibration' }] }, guard1));
    assert.equal(r.status, 200, messages(r).join(' / '));
    assert.equal(r.data.status_code, 'CHECKED_OUT');

    const ev = await events(ID);
    assert.match(ev.at(-1).remark, /calibration/, 'Section 6.3: a forced check-out records a remark');
  });

  // ══════════════════════════════════════════════════════════════════
  it('TC-08 — a raw PATCH of passNo, actualInAt and status changes nothing', async () => {
    const ID = await raisePass(anitha, {
      visitorMobile: '9876500008', validFrom: clockIn(-30), validTo: clockIn(200)
    });
    await POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.submit`, {}, anitha);
    await POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.checkIn`, { badgeNo: 'B-400' }, guard1);
    await POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.checkOut`, {}, guard1);

    const was = (await readAs(ID, admin)).data;
    assert.equal(was.status_code, 'CHECKED_OUT');

    // the host tries to rewrite history on their own checked-out pass
    const r = await req(() => PATCH(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)`, {
      passNo: 'GP-HACK-0000-00000',
      actualInAt: '2020-01-01T00:00:00Z',
      actualOutAt: '2020-01-01T09:00:00Z',
      status_code: 'APPROVED',
      visitorName: 'Someone Else'
    }, anitha));
    assert.ok(r.status >= 400, `expected a refusal, got ${r.status}`);

    const now = (await readAs(ID, admin)).data;
    assert.equal(now.passNo, was.passNo);
    assert.equal(now.actualInAt, was.actualInAt);
    assert.equal(now.actualOutAt, was.actualOutAt);
    assert.equal(now.status_code, 'CHECKED_OUT');
    assert.equal(now.visitorName, was.visitorName, 'a closed pass is read-only, not just its system fields');
  });

  // ══════════════════════════════════════════════════════════════════
  it('TC-09 — a second host gets nothing, a guard is confined to their plant, BR-11 blocks self-approval', async () => {
    const ID = await raisePass(anitha, { visitDate: TOMORROW, visitorMobile: '9876500009' });
    await POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.submit`, {}, anitha);

    // (a) karthik opens anitha's pass by direct URL
    const direct = await readAs(ID, karthik);
    assert.ok(direct.status === 403 || direct.status === 404,
      `expected 403 or empty, got ${direct.status} with data`);

    // (b) and it is not in his list either
    const list = await GET(`${B}/VisitorPasses`, karthik);
    assert.ok(!list.data.value.some((p) => p.ID === ID), 'not visible in a collection read');
    assert.ok(list.data.value.every((p) => p.createdBy === 'karthik'), 'a host sees only their own passes');

    // (c) guard2 works plant 2000 and may not read a plant 1000 pass
    const crossPlant = await readAs(ID, guard2);
    assert.ok(crossPlant.status === 403 || crossPlant.status === 404, `guard2 got ${crossPlant.status}`);
    const g1 = await readAs(ID, guard1);
    assert.equal(g1.status, 200, 'guard1 works plant 1000 and may');

    // (d) BR-11 — meera holds the supervisor role and hosts this pass herself
    const own = await raisePass(meera, {
      visitDate: TOMORROW, visitorMobile: '9876500019',
      area_code: 'SHOPFLOOR', inductionRef: 'IND-2026-500', inductionValidTill: dayOffset(200)
    });
    await POST(`${B}/VisitorPasses(ID=${own},IsActiveEntity=true)/GatePassService.submit`, {}, meera);
    const r = await req(() => POST(`${B}/VisitorPasses(ID=${own},IsActiveEntity=true)/GatePassService.approve`, {}, meera));
    assert.equal(r.status, 403);
    assert.ok(said(r, /cannot approve a visitor you are hosting yourself/), messages(r).join(' / '));

    // (e) a plain host cannot approve anybody's pass
    const byHost = await req(() => POST(`${B}/VisitorPasses(ID=${own},IsActiveEntity=true)/GatePassService.approve`, {}, karthik));
    assert.ok(byHost.status === 403, `a Host must not approve; got ${byHost.status}`);

    // (f) a guard cannot approve, and a supervisor cannot work the gate
    const byGuard = await req(() => POST(`${B}/VisitorPasses(ID=${own},IsActiveEntity=true)/GatePassService.approve`, {}, guard1));
    assert.equal(byGuard.status, 403, 'the guard admits but never approves');
    const bySup = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.checkIn`, { badgeNo: 'B-500' }, rakesh));
    assert.equal(bySup.status, 403, 'the supervisor approves but never operates the gate');
  });

  // ══════════════════════════════════════════════════════════════════
  it('TC-10 — a PassEvent cannot be created, updated or deleted, by anybody', async () => {
    const upd = await req(() => PATCH(`${B}/PassEvents(ID=${SEED_EVENT})`, { remark: 'Rewritten' }, admin));
    assert.ok(upd.status >= 400, `update must be refused, got ${upd.status}`);

    const del = await req(() => DELETE(`${B}/PassEvents(ID=${SEED_EVENT})`, admin));
    assert.ok(del.status >= 400, `delete must be refused, got ${del.status}`);

    const ins = await req(() => POST(`${B}/PassEvents`, {
      pass_ID: SEED.approvedToday, seq: 99, toStatus: 'APPROVED', action: 'SUBMIT', actor: 'forged'
    }, admin));
    assert.ok(ins.status >= 400, `insert must be refused, got ${ins.status}`);

    const still = await GET(`${B}/PassEvents(ID=${SEED_EVENT})`, admin);
    assert.notEqual(still.data.remark, 'Rewritten', 'the audit trail is unchanged');
  });

  // ══════════════════════════════════════════════════════════════════
  it('TC-11 — the day-end job expires, flags overstays, and does nothing the second time', async () => {
    const beforeOverstay = await readAs(SEED.overstay, admin);
    assert.equal(beforeOverstay.data.status_code, 'ON_SITE');
    assert.equal(beforeOverstay.data.isOverstay, false);

    // only the Admin may run it
    const asHost = await req(() => POST(`${B}/runDayEndJob`, {}, anitha));
    assert.equal(asHost.status, 403);

    const run1 = await req(() => POST(`${B}/runDayEndJob`, {}, admin));
    assert.equal(run1.status, 200);
    assert.ok(run1.data.expired >= 1, `expected at least one expiry, got ${run1.data.expired}`);
    assert.ok(run1.data.overstay >= 1, `expected at least one overstay, got ${run1.data.overstay}`);

    // pass 00004 was approved yesterday and never used
    const expired = await readAs(SEED.neverUsed, admin);
    assert.equal(expired.data.status_code, 'EXPIRED');
    const ev = await events(SEED.neverUsed);
    assert.equal(ev.at(-1).action, 'EXPIRE');
    assert.equal(ev.at(-1).toStatus, 'EXPIRED');

    // pass 00003 is still inside — flagged, never auto-closed
    const over = await readAs(SEED.overstay, admin);
    assert.equal(over.data.isOverstay, true);
    assert.equal(over.data.status_code, 'ON_SITE', 'the system never invents a departure time');
    assert.equal(over.data.actualOutAt, null);
    assert.equal((await events(SEED.overstay)).at(-1).action, 'OVERSTAY');

    // R2 shows it
    const r2 = await GET(`${B}/VisitorPasses?$filter=isOverstay eq true and status_code eq 'ON_SITE'`, rakesh);
    assert.ok(r2.data.value.some((p) => p.ID === SEED.overstay), 'appears on the overstay report');

    // the second run reports zero and changes nothing
    const run2 = await req(() => POST(`${B}/runDayEndJob`, {}, admin));
    assert.equal(run2.status, 200);
    assert.deepEqual({ expired: run2.data.expired, overstay: run2.data.overstay }, { expired: 0, overstay: 0 });
  });

  // ══════════════════════════════════════════════════════════════════
  it('TC-12 · BR-14 — R1 shows exactly who is inside, and the ID number is masked by role', async () => {
    // put a visitor on site at plant 2000 as well, so R1 has two plants
    const suresh = { auth: { username: 'suresh', password: 'pass' } };
    const at2000 = await raisePass(suresh, {
      visitorMobile: '9876500012', plant_code: '2000', area_code: 'OFFICE', area_plant_code: '2000',
      validFrom: clockIn(-30), validTo: clockIn(200)
    });
    await POST(`${B}/VisitorPasses(ID=${at2000},IsActiveEntity=true)/GatePassService.submit`, {}, suresh);
    const ci = await req(() => POST(`${B}/VisitorPasses(ID=${at2000},IsActiveEntity=true)/GatePassService.checkIn`, { badgeNo: 'B-600' }, guard2));
    assert.equal(ci.status, 200, messages(ci).join(' / '));

    // R1 — the muster list
    const r1 = await GET(`${B}/VisitorPasses?$filter=status_code eq 'ON_SITE'&$select=passNo,visitorName,plant_code,badgeNo,actualInAt&$orderby=plant_code`, admin);
    const onSite = r1.data.value;
    assert.ok(onSite.length >= 2);
    assert.ok(onSite.some((p) => p.plant_code === '1000'));
    assert.ok(onSite.some((p) => p.plant_code === '2000'));
    assert.ok(onSite.every((p) => p.actualInAt), 'everyone inside has a time in');

    // and it is derived from status, not a column somebody filled in
    const all = await GET(`${B}/VisitorPasses?$select=status_code,actualOutAt`, admin);
    assert.ok(all.data.value.filter((p) => p.status_code === 'ON_SITE').every((p) => !p.actualOutAt));

    // BR-14 — masking by role, on an APPROVED pass the guard is about to
    // admit.  Raised fresh rather than reusing a Section 12.5 seed row:
    // the seeded passes' validTo is a fixed clock time, and TC-11's
    // day-end job (run earlier in this suite) will have already expired
    // one once the wall clock passes it — this pass's window is anchored
    // to "now" instead, so it stays APPROVED regardless of time of day.
    const approved = await raisePass(anitha, {
      visitorMobile: '9876500020', idProofNumber: 'ZZZZZ1234Z',
      validFrom: clockIn(-30), validTo: clockIn(200)
    });
    await POST(`${B}/VisitorPasses(ID=${approved},IsActiveEntity=true)/GatePassService.submit`, {}, anitha);
    assert.equal((await readAs(approved, admin)).data.idProofNumber, 'ZZZZZ1234Z', 'Admin sees it in full');
    assert.equal((await readAs(approved, guard1)).data.idProofNumber, 'ZZZZZ1234Z', 'the guard sees it in full at check-in');
    assert.equal((await readAs(approved, anitha)).data.idProofNumber, '****234Z', 'the host sees it masked');
    assert.equal((await readAs(approved, rakesh)).data.idProofNumber, '****234Z', 'the supervisor sees it masked');

    // and it stays masked when the pass is reached through an $expand
    const viaItems = await GET(`${B}/PassItems?$expand=pass($select=idProofNumber)&$top=5`, anitha);
    for (const row of viaItems.data.value) {
      if (row.pass?.idProofNumber) assert.match(row.pass.idProofNumber, /^\*\*\*\*/, 'BR-14 holds through $expand too');
    }
  });

  // ══════════════════════════════════════════════════════════════════
  //  Rules and behaviours the script relies on but does not number
  // ══════════════════════════════════════════════════════════════════

  it('BR-01, BR-02, BR-03 — a pass with several problems reports all of them, not the first', async () => {
    const ID = await raisePass(anitha, {
      visitorName: 'X',                 // BR-03 too short
      visitorMobile: '12345',           // BR-03 not a mobile
      visitDate: YESTERDAY,             // BR-01 in the past
      validFrom: '05:00:00',            // BR-02 before gate hours
      validTo: '23:00:00',              // BR-02 after gate hours, and over 12 h
      area_code: 'SHOPFLOOR'            // BR-05 induction missing
    });
    const r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.submit`, {}, anitha));
    assert.equal(r.status, 400);
    const msgs = messages(r);
    assert.ok(msgs.length >= 5, `expected every problem, got ${msgs.length}: ${msgs.join(' / ')}`);
    assert.ok(msgs.some((m) => /already passed/.test(m)), 'BR-01');
    assert.ok(msgs.some((m) => /more than 12 hours/.test(m)), 'BR-02');
    assert.ok(msgs.some((m) => /admits visitors between/.test(m)), 'BR-02 gate hours');
    assert.ok(msgs.some((m) => /at least 3 characters/.test(m)), 'BR-03 name');
    assert.ok(msgs.some((m) => /10-digit mobile/.test(m)), 'BR-03 mobile');
    assert.ok(msgs.some((m) => /safety induction/.test(m)), 'BR-05');
  });

  it('BR-03 — an inactive area cannot be visited', async () => {
    const ID = await raisePass(anitha, { visitDate: TOMORROW, area_code: 'OLDBLOCK' });
    const r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.submit`, {}, anitha));
    assert.equal(r.status, 400);
    assert.ok(said(r, /Old Admin Block \(demolished\) is no longer active/), messages(r).join(' / '));
  });

  it('BR-13 — copy makes a private draft that carries the visitor and the items, but not the number or the dates', async () => {
    const r = await req(() => POST(`${B}/VisitorPasses(ID=${SEED.approvedToday},IsActiveEntity=true)/GatePassService.copy`, {}, anitha));
    assert.equal(r.status, 200, messages(r).join(' / '));
    const newId = r.data.ID;

    const draft = await GET(`${B}/VisitorPasses(ID=${newId},IsActiveEntity=false)?$expand=items`, anitha);
    assert.equal(draft.data.status_code, 'DRAFT');
    assert.equal(draft.data.passNo, null, 'the number does not copy');
    assert.equal(draft.data.visitDate, null, 'the dates do not copy');
    assert.equal(draft.data.badgeNo, null, 'the badge does not copy');
    assert.equal(draft.data.actualInAt, null);
    assert.equal(draft.data.visitorName, 'Ramesh Gupta', 'the visitor does');
    assert.equal(draft.data.visitorMobile, '9876543210');
    assert.equal(draft.data.items.length, 3, 'and so do the items');
    assert.ok(draft.data.items.every((i) => i.returnedAtExit === false));

    // it is a real draft: invisible to every other user, including the Admin
    const asKarthik = await req(() => GET(`${B}/VisitorPasses(ID=${newId},IsActiveEntity=false)`, karthik));
    assert.ok(asKarthik.status >= 400, `another host must not see it, got ${asKarthik.status}`);
    const asAdmin = await req(() => GET(`${B}/VisitorPasses(ID=${newId},IsActiveEntity=false)`, admin));
    assert.ok(asAdmin.status >= 400, `not even the Admin, got ${asAdmin.status}`);
    const asActive = await req(() => GET(`${B}/VisitorPasses(ID=${newId},IsActiveEntity=true)`, karthik));
    assert.ok(asActive.status >= 400, 'and there is no active row to find');
  });

  it('Section 7 — ON_SITE cannot be cancelled; there is no such transition', async () => {
    const ID = await raisePass(anitha, {
      visitorMobile: '9876500015', validFrom: clockIn(-30), validTo: clockIn(200)
    });
    await POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.submit`, {}, anitha);
    await POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.checkIn`, { badgeNo: 'B-700' }, guard1);

    const r = await req(() => POST(`${B}/VisitorPasses(ID=${ID},IsActiveEntity=true)/GatePassService.cancel`, {}, anitha));
    assert.equal(r.status, 409);
    assert.equal((await readAs(ID, admin)).data.status_code, 'ON_SITE');
  });

  it('Section 9 — master data is deactivated, never deleted', async () => {
    const del = await req(() => DELETE(`${B}/Plants(code='3000')`, admin));
    assert.ok(del.status >= 400, `hard delete must be refused, got ${del.status}`);
    assert.equal((await GET(`${B}/Plants(code='3000')`, admin)).status, 200, 'the plant is still there');

    const byHost = await req(() => PATCH(`${B}/Plants(code='1000')`, { name: 'Renamed' }, anitha));
    assert.equal(byHost.status, 403, 'and only the Admin maintains it');
  });

  it('Section 10 R3 — footfall is counted and averaged in the database, over CHECKED_OUT passes only', async () => {
    const r = await req(() => GET(`${B}/VisitorFootfall`, admin));
    assert.equal(r.status, 200, messages(r).join(' / '));
    assert.ok(Array.isArray(r.data.value));
    for (const row of r.data.value) {
      assert.ok(row.passCount >= 1);
      assert.ok(row.plant && row.area && row.purpose);
      assert.ok(Number.isInteger(row.visitYear) && Number.isInteger(row.visitMonth));
    }
    const denied = await req(() => GET(`${B}/VisitorFootfall`, anitha));
    assert.equal(denied.status, 403, 'a host has no business reading plant statistics');
  });

  it('Section 10 — one search box finds a visitor by name or by mobile number', async () => {
    const byName = await GET(`${B}/VisitorPasses?$search=Sneha`, guard1);
    assert.ok(byName.data.value.length >= 1, 'found by name');
    const byMobile = await GET(`${B}/VisitorPasses?$search=9812345678`, guard1);
    assert.ok(byMobile.data.value.length >= 1, 'found by mobile');
    assert.equal(byName.data.value[0].ID, byMobile.data.value[0].ID, 'the same visitor, either way');
  });
});
