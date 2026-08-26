import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import cds from '@sap/cds';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * GatePass - Backend Automated Tests (TC-01 through TC-12)
 * We use the built-in Node test runner with @sap/cds/test.
 */
describe('GatePassService', () => {

  // Boot up the CDS server in-memory for testing
  const { GET, POST, PATCH, expect, data } = cds.test(join(__dirname, '..'));

  // Pre-fetch some data for tests
  let draftId, requestedId, onSiteId;

  // We use the mock users defined in package.json:
  // - anitha (Host)
  // - karthik (Host)
  // - meera (SecuritySupervisor)
  // - guard1 (SecurityGuard)
  // - admin (Admin)
  const asAnitha = { auth: { username: 'anitha', password: 'pass' } };
  const asKarthik = { auth: { username: 'karthik', password: 'pass' } };
  const asMeera = { auth: { username: 'meera', password: 'pass' } };
  const asGuard = { auth: { username: 'guard1', password: 'pass' } };
  const asAdmin = { auth: { username: 'admin', password: 'pass' } };

  // Set up tomorrow's date for valid test passes
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  // Set up yesterday's date for past date tests
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  // Helper to create a basic valid draft
  const createDraft = async (areaCode, purpose = 'CUSTOMER', detail = null) => {
    const res = await POST('/odata/v4/gate-pass/VisitorPasses', {}, asAnitha);
    const id = res.data.ID;
    
    // Update draft with valid data
    await PATCH(`/odata/v4/gate-pass/VisitorPasses(ID=${id},IsActiveEntity=false)`, {
      visitorName: 'Test Visitor',
      visitorCompany: 'Test Co',
      visitorMobile: '9988776655',
      visitDate: tomorrowStr,
      validFrom: '10:00:00',
      validTo: '14:00:00',
      purpose_code: purpose,
      purposeDetail: detail,
      idProofType_code: 'PAN',
      idProofNumber: 'ABCDE1234F',
      area_code: areaCode,
      plant_code: '1000',
      area_plant_code: '1000'
    }, asAnitha);
    return id;
  };

  it('TC-01: Submit valid pass for OFFICE -> APPROVED (BR-04)', async () => {
    const id = await createDraft('OFFICE');
    const res = await POST(`/odata/v4/gate-pass/VisitorPasses(ID=${id},IsActiveEntity=false)/GatePassService.submit`, {}, asAnitha);
    
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status_code, 'APPROVED', 'OFFICE requires no approval');
    assert.match(res.data.passNo, /^GP-1000-/, 'Pass number generated (BR-12)');
  });

  it('TC-02: Submit valid pass for SHOPFLOOR -> REQUESTED (BR-04)', async () => {
    const id = await createDraft('SHOPFLOOR');
    
    // Shopfloor requires induction (BR-05), so patch that first
    await PATCH(`/odata/v4/gate-pass/VisitorPasses(ID=${id},IsActiveEntity=false)`, {
      inductionRef: 'IND-123',
      inductionValidTill: tomorrowStr
    }, asAnitha);

    const res = await POST(`/odata/v4/gate-pass/VisitorPasses(ID=${id},IsActiveEntity=false)/GatePassService.submit`, {}, asAnitha);
    
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status_code, 'REQUESTED', 'SHOPFLOOR requires approval');
    requestedId = res.data.ID; // Save for approval test
  });

  it('TC-03: Submit fails if date is in the past (BR-01)', async () => {
    const id = await createDraft('OFFICE');
    
    await PATCH(`/odata/v4/gate-pass/VisitorPasses(ID=${id},IsActiveEntity=false)`, {
      visitDate: yesterdayStr
    }, asAnitha);

    const res = await POST(`/odata/v4/gate-pass/VisitorPasses(ID=${id},IsActiveEntity=false)/GatePassService.submit`, {}, asAnitha).catch(e => e.response);
    
    assert.strictEqual(res.status, 400);
    assert.match(res.data.error.message, /has already passed/, 'Caught past date error');
  });

  it('TC-04: Cannot submit if missing purpose detail when OTHER', async () => {
    const id = await createDraft('OFFICE', 'OTHER');
    
    const res = await POST(`/odata/v4/gate-pass/VisitorPasses(ID=${id},IsActiveEntity=false)/GatePassService.submit`, {}, asAnitha).catch(e => e.response);
    
    assert.strictEqual(res.status, 400);
    assert.match(res.data.error.message, /provide details of at least 15 characters/, 'Caught missing purpose detail');
  });

  it('TC-05: Check-in fails outside time window (BR-06)', async () => {
    // Pass 1 is GP-1000-2026-00001 (APPROVED), but date is 2026-08-26 (past in real life, or we can make it fail for wrong date)
    const res = await POST(`/odata/v4/gate-pass/VisitorPasses(ID=10000000-0000-0000-0000-000000000001,IsActiveEntity=true)/GatePassService.checkIn`, {
      badgeNo: 'B-TEST'
    }, asGuard).catch(e => e.response);

    assert.strictEqual(res.status, 400);
    assert.match(res.data.error.message, /(not today|Ask the host to extend it)/, 'Window check enforced');
  });

  it('TC-06: Supervisor approves pass (BR-11 segregation check)', async () => {
    assert.ok(requestedId, 'Need requestedId from TC-02');
    
    // Activate the draft so it becomes an active document (releases draft lock)
    await POST(`/odata/v4/gate-pass/VisitorPasses(ID=${requestedId},IsActiveEntity=false)/GatePassService.draftActivate`, {}, asAnitha);

    // Anitha cannot approve her own pass
    let res = await POST(`/odata/v4/gate-pass/VisitorPasses(ID=${requestedId},IsActiveEntity=true)/GatePassService.approve`, {}, asAnitha).catch(e => e.response);
    assert.strictEqual(res.status, 403, 'Self-approval prevented');

    // Meera (Supervisor) can approve
    res = await POST(`/odata/v4/gate-pass/VisitorPasses(ID=${requestedId},IsActiveEntity=true)/GatePassService.approve`, {}, asMeera);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status_code, 'APPROVED');
  });

  it('TC-07: Reject requires reason >= 10 chars (BR-10)', async () => {
    // Create another requested pass for rejection
    const id = await createDraft('SHOPFLOOR');
    await PATCH(`/odata/v4/gate-pass/VisitorPasses(ID=${id},IsActiveEntity=false)`, { inductionRef: 'I-1', inductionValidTill: tomorrowStr }, asAnitha);
    await POST(`/odata/v4/gate-pass/VisitorPasses(ID=${id},IsActiveEntity=false)/GatePassService.submit`, {}, asAnitha);

    // Activate the draft
    await POST(`/odata/v4/gate-pass/VisitorPasses(ID=${id},IsActiveEntity=false)/GatePassService.draftActivate`, {}, asAnitha);

    // Reject without reason
    let res = await POST(`/odata/v4/gate-pass/VisitorPasses(ID=${id},IsActiveEntity=true)/GatePassService.rejectPass`, { reason: 'No' }, asMeera).catch(e => e.response);
    assert.strictEqual(res.status, 400);

    // Reject with valid reason
    res = await POST(`/odata/v4/gate-pass/VisitorPasses(ID=${id},IsActiveEntity=true)/GatePassService.rejectPass`, { reason: 'Visitor not allowed' }, asMeera);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status_code, 'REJECTED');
  });

  it('TC-10: PassEvents are immutable', async () => {
    // Try to update an event (e.g. ID 30000000-0000-0000-0000-000000000001)
    const res = await PATCH(`/odata/v4/gate-pass/PassEvents(ID=30000000-0000-0000-0000-000000000001,IsActiveEntity=true)`, { remark: 'Hacked' }, asAdmin).catch(e => e.response);
    assert.ok(res.status === 403 || res.status === 422, 'Update blocked natively by CAP or by our hook');
  });

  it('TC-11: ID Masking based on roles (BR-14)', async () => {
    // Admin sees full
    let res = await GET(`/odata/v4/gate-pass/VisitorPasses(ID=10000000-0000-0000-0000-000000000001,IsActiveEntity=true)`, asAdmin);
    assert.ok(!res.data.idProofNumber.startsWith('****'), 'Admin sees full ID');

    // Host sees masked
    res = await GET(`/odata/v4/gate-pass/VisitorPasses(ID=10000000-0000-0000-0000-000000000001,IsActiveEntity=true)`, asAnitha);
    assert.ok(res.data.idProofNumber.startsWith('****'), 'Host sees masked ID');
  });

  it('TC-12: Cannot modify system fields directly', async () => {
    const id = await createDraft('OFFICE');
    // Try to inject passNo
    await PATCH(`/odata/v4/gate-pass/VisitorPasses(ID=${id},IsActiveEntity=false)`, {
      passNo: 'HACKED-PASS'
    }, asAnitha);

    const res = await GET(`/odata/v4/gate-pass/VisitorPasses(ID=${id},IsActiveEntity=false)`, asAnitha);
    assert.notStrictEqual(res.data.passNo, 'HACKED-PASS', 'System field protected from injection');
  });

});
