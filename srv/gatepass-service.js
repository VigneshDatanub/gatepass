import cds from '@sap/cds';

// ════════════════════════════════════════════════════════════════════
//  STATUS TRANSITION TABLE  (Section 7)
//  "Put the check in one place on the server that every action calls"
// ════════════════════════════════════════════════════════════════════

const ACTION_MAP = {
  //  action      allowed from-statuses                     target (null = determined by BR-04)
  submit:   { from: ['DRAFT'],                              to: null       },
  approve:  { from: ['REQUESTED'],                          to: 'APPROVED' },
  rejectPass: { from: ['REQUESTED'],                        to: 'REJECTED' },
  cancel:   { from: ['DRAFT', 'REQUESTED', 'APPROVED'],    to: 'CANCELLED'},
  checkIn:  { from: ['APPROVED'],                           to: 'ON_SITE'  },
  checkOut: { from: ['ON_SITE'],                            to: 'CHECKED_OUT' },
  expire:   { from: ['APPROVED'],                           to: 'EXPIRED'  },
  overstay: { from: ['ON_SITE'],                            to: 'ON_SITE'  },
};

/** Convert "HH:MM:SS" to minutes since midnight. */
function timeToMinutes(t) {
  if (!t) return 0;
  const parts = t.split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}


// ════════════════════════════════════════════════════════════════════
//  SERVICE HANDLER
// ════════════════════════════════════════════════════════════════════

export default class GatePassService extends cds.ApplicationService {

  async init() {
    const {
      VisitorPasses, PassItems, PassEvents,
      Employees, VisitAreas, Plants
    } = this.entities;

    // ── DB-level entity refs — for writes that bypass service restrictions ──
    const dbTrans = () => cds.entities('nub.gatepass.transaction');

    // ────────────────────────────────────────────────────────────────
    //  HELPERS
    // ────────────────────────────────────────────────────────────────

    /** Find the employee record for the logged-in user via user attribute email. */
    const getEmployee = async (req) => {
      const email = req.user.attr?.email;
      if (!email) return null;
      return SELECT.one.from(Employees).where({ email });
    };

    /**
     * BR-12: Generate next passNo in format GP-<plant>-<YYYY>-<5 digits>.
     * Uses MAX query on existing passes for the plant and year.
     */
    const generatePassNo = async (plantCode) => {
      const year = new Date().getFullYear();
      const prefix = `GP-${plantCode}-${year}-`;
      const existing = await SELECT.from(dbTrans().VisitorPasses)
        .columns('passNo')
        .where({ plant_code: plantCode })
        .and(`passNo like '${prefix}%'`)
        .orderBy('passNo desc')
        .limit(1);

      let nextNum = 1;
      if (existing.length > 0 && existing[0].passNo) {
        const lastPart = existing[0].passNo.split('-').pop();
        nextNum = parseInt(lastPart, 10) + 1;
      }
      return prefix + String(nextNum).padStart(5, '0');
    };

    /**
     * BR-12: Write exactly one PassEvent in the same transaction.
     * Uses DB-level entity to bypass any service-level restrictions on PassEvents.
     */
    const writeEvent = async (passId, fromStatus, toStatus, action, req, remark = null) => {
      const DBEvents = dbTrans().PassEvents;
      // Get next seq for this pass
      const rows = await SELECT.from(DBEvents)
        .columns('seq')
        .where({ pass_ID: passId })
        .orderBy('seq desc')
        .limit(1);
      const seq = (rows.length > 0 ? rows[0].seq : 0) + 1;

      await INSERT.into(DBEvents).entries({
        ID: cds.utils.uuid(),
        pass_ID: passId,
        seq,
        fromStatus: fromStatus || '',
        toStatus,
        action,
        actor: req.user.id,
        actedAt: new Date().toISOString(),
        remark
      });
    };

    /** Validate that the action is allowed from the current status. */
    const assertTransition = (currentStatus, action, req) => {
      const rule = ACTION_MAP[action];
      if (!rule) return req.reject(400, `Unknown action: ${action}`);
      if (!rule.from.includes(currentStatus)) {
        return req.reject(409, `Cannot ${action} a pass in status ${currentStatus}`);
      }
    };


    // ────────────────────────────────────────────────────────────────
    //  DRAFT LIFECYCLE
    // ────────────────────────────────────────────────────────────────

    /**
     * before NEW — set host, default plant, initial status on new drafts.
     * "host is always the logged-in user. Not selectable."
     */
    this.before('NEW', VisitorPasses.drafts, async (req) => {
      const emp = await getEmployee(req);
      if (!emp) {
        return req.reject(403, 'You must be a registered employee to create a visitor pass.');
      }
      if (!emp.isActive) {
        return req.reject(403, `${emp.name} is no longer active and cannot host a visitor.`);
      }
      req.data.host_ID = emp.ID;
      req.data.plant_code = emp.defaultPlant_code;
      req.data.status_code = 'DRAFT';
    });


    // ────────────────────────────────────────────────────────────────
    //  PROTECT SYSTEM FIELDS  (Section 6.1 — "never accepted from a browser")
    // ────────────────────────────────────────────────────────────────

    this.before(['UPDATE', 'PATCH'], [VisitorPasses, VisitorPasses.drafts], (req) => {
      const forbidden = [
        'passNo', 'actualInAt', 'actualOutAt', 'durationMinutes',
        'isOverstay', 'badgeNo', 'status_code'
      ];
      for (const f of forbidden) {
        delete req.data[f];
      }
    });


    // ────────────────────────────────────────────────────────────────
    //  BEFORE SAVE  — auto-number items, strip injected events
    // ────────────────────────────────────────────────────────────────

    this.before('SAVE', VisitorPasses, async (req) => {
      // Strip any events from the payload — events are system-created only
      if (req.data.events) delete req.data.events;

      // Auto-number items if itemNo not set (Section 6.2: 10, 20, 30 …)
      if (req.data.items) {
        let counter = 0;
        for (const item of req.data.items) {
          counter += 10;
          if (!item.itemNo) item.itemNo = counter;
        }
      }
    });


    // ────────────────────────────────────────────────────────────────
    //  SUBMIT  (BR-01 to BR-07, BR-12)
    // ────────────────────────────────────────────────────────────────

    this.on('submit', [VisitorPasses, VisitorPasses.drafts], async (req) => {
      const { ID } = req.params[0];
      const targetEntity = req.target.name; // Either active or draft
      const pass = await SELECT.one.from(targetEntity).where({ ID });
      if (!pass) return req.reject(404, 'Pass not found.');

      // Ownership check
      if (pass.createdBy !== req.user.id) {
        return req.reject(403, 'You can only submit your own passes.');
      }

      // Status transition check
      assertTransition(pass.status_code, 'submit', req);

      // Load related data for validation
      const area  = pass.area_code
        ? await SELECT.one.from(VisitAreas).where({ code: pass.area_code, plant_code: pass.area_plant_code })
        : null;
      const plant = pass.plant_code
        ? await SELECT.one.from(Plants, pass.plant_code)
        : null;
      const host  = pass.host_ID
        ? await SELECT.one.from(Employees, pass.host_ID)
        : null;

      // ── Collect ALL errors — never stop at the first ──
      let hasErrors = false;
      const err = (msg, target) => { req.error(400, msg, target); hasErrors = true; };

      // Mandatory fields
      if (!pass.visitorName || pass.visitorName.trim().length < 3)
        err('Visitor name must be at least 3 characters.', 'in/visitorName');
      if (!pass.visitorCompany)
        err('Visitor company is required.', 'in/visitorCompany');
      if (!pass.visitorMobile || !/^[6-9]\d{9}$/.test(pass.visitorMobile))
        err('Enter a valid 10-digit mobile number.', 'in/visitorMobile');
      if (!pass.visitDate)
        err('Visit date is required.', 'in/visitDate');
      if (!pass.validFrom)
        err('Valid from time is required.', 'in/validFrom');
      if (!pass.validTo)
        err('Valid to time is required.', 'in/validTo');
      if (!pass.purpose_code)
        err('Visit purpose is required.', 'in/purpose_code');
      if (!pass.idProofType_code)
        err('ID proof type is required.', 'in/idProofType_code');
      if (!pass.idProofNumber)
        err('ID proof number is required.', 'in/idProofNumber');
      if (!pass.area_code)
        err('Visit area is required.', 'in/area_code');
      if (!pass.plant_code)
        err('Plant is required.', 'in/plant_code');

      // BR-01: visitDate not in the past
      const today = new Date().toISOString().slice(0, 10);
      if (pass.visitDate && pass.visitDate < today) {
        err('A pass cannot be raised for a date that has already passed.', 'in/visitDate');
      }

      // BR-02: time window validations
      if (pass.validFrom && pass.validTo) {
        const fromMin = timeToMinutes(pass.validFrom);
        const toMin   = timeToMinutes(pass.validTo);

        if (toMin <= fromMin) {
          err('The visit window must end after it starts.', 'in/validTo');
        } else {
          // Max 12 hours
          if ((toMin - fromMin) > 720) {
            err('A pass cannot cover more than 12 hours.', 'in/validTo');
          }
          // Inside plant gate hours
          if (plant) {
            const gateOpen  = timeToMinutes(plant.gateOpenTime);
            const gateClose = timeToMinutes(plant.gateCloseTime);
            if (fromMin < gateOpen || toMin > gateClose) {
              err(
                `Plant ${plant.name} admits visitors between ${plant.gateOpenTime} and ${plant.gateCloseTime}.`,
                'in/validFrom'
              );
            }
          }
        }
      }

      // BR-03: active checks
      if (host  && !host.isActive)  err(`${host.name} is no longer active and cannot host a visitor.`, 'in/host_ID');
      if (plant && !plant.isActive) err(`Plant ${plant.name} is no longer active.`, 'in/plant_code');
      if (area  && !area.isActive)  err(`Area ${area.name} is no longer active.`, 'in/area_code');

      // Area must belong to the selected plant
      if (pass.area_plant_code && pass.plant_code && pass.area_plant_code !== pass.plant_code) {
        err('The selected area must belong to the chosen plant.', 'in/area_code');
      }

      // BR-05: induction check
      if (area?.requiresInduction) {
        if (!pass.inductionRef) {
          err(`Area ${area.name} requires a valid safety induction.`, 'in/inductionRef');
        }
        if (!pass.inductionValidTill || pass.inductionValidTill < pass.visitDate) {
          err(
            `The induction expired on ${pass.inductionValidTill || 'N/A'}; the visitor cannot enter ${area.name}.`,
            'in/inductionValidTill'
          );
        }
      }

      // Conditional: purposeDetail when purpose = OTHER
      if (pass.purpose_code === 'OTHER') {
        if (!pass.purposeDetail || pass.purposeDetail.trim().length < 15) {
          err('When purpose is OTHER, provide details of at least 15 characters.', 'in/purposeDetail');
        }
      }

      // Stop if any validation errors
      if (hasErrors) return;

      // BR-07: warning — same mobile with an open pass (warning at submit, error at check-in)
      const openPasses = await SELECT.from(dbTrans().VisitorPasses)
        .where({ visitorMobile: pass.visitorMobile, ID: { '!=': ID } })
        .and(`status_code in ('APPROVED','REQUESTED','ON_SITE')`);
      if (openPasses.length > 0) {
        const other = openPasses[0];
        req.warn(`Warning: this visitor already has an open pass today at plant ${other.plant_code}.`);
      }

      // BR-04: determine target status from area configuration
      const targetStatus = area?.requiresApproval ? 'REQUESTED' : 'APPROVED';

      // BR-12: generate passNo
      const passNo = await generatePassNo(pass.plant_code);

      // Update pass — status + passNo in one UPDATE
      await UPDATE(targetEntity, ID).set({
        status_code: targetStatus,
        passNo
      });

      // BR-12: write event in the same transaction
      await writeEvent(ID, 'DRAFT', targetStatus, 'SUBMIT', req);

      return SELECT.one.from(targetEntity, ID);
    });


    // ────────────────────────────────────────────────────────────────
    //  APPROVE  (BR-11)
    // ────────────────────────────────────────────────────────────────

    this.on('approve', [VisitorPasses, VisitorPasses.drafts], async (req) => {
      const { ID } = req.params[0];
      const targetEntity = req.target.name;
      const pass = await SELECT.one.from(targetEntity).where({ ID });
      if (!pass) return req.reject(404, 'Pass not found.');

      assertTransition(pass.status_code, 'approve', req);

      // BR-11: nobody may approve a pass on which they are the host
      if (pass.createdBy === req.user.id) {
        return req.reject(403, 'You cannot approve a visitor you are hosting yourself.');
      }

      await UPDATE(targetEntity, ID).set({ status_code: 'APPROVED' });
      await writeEvent(ID, 'REQUESTED', 'APPROVED', 'APPROVE', req);

      return SELECT.one.from(targetEntity, ID);
    });


    // ────────────────────────────────────────────────────────────────
    //  REJECT  (BR-10, BR-11)
    // ────────────────────────────────────────────────────────────────

    this.on('rejectPass', [VisitorPasses, VisitorPasses.drafts], async (req) => {
      const { ID } = req.params[0];
      const targetEntity = req.target.name;
      const { reason } = req.data;
      const pass = await SELECT.one.from(targetEntity).where({ ID });
      if (!pass) return req.reject(404, 'Pass not found.');

      assertTransition(pass.status_code, 'rejectPass', req);

      // BR-11: segregation of duties
      if (pass.createdBy === req.user.id) {
        return req.reject(403, 'You cannot reject a visitor you are hosting yourself.');
      }

      // BR-10: reason of at least 10 characters
      if (!reason || reason.trim().length < 10) {
        return req.reject(400, 'Give a reason of at least 10 characters. The host has to be able to act on it.');
      }

      await UPDATE(targetEntity, ID).set({
        status_code: 'REJECTED',
        rejectionReason: reason.trim()
      });
      await writeEvent(ID, 'REQUESTED', 'REJECTED', 'REJECT', req, reason.trim());

      return SELECT.one.from(targetEntity, ID);
    });


    // ────────────────────────────────────────────────────────────────
    //  CANCEL  (only from DRAFT / REQUESTED / APPROVED, never ON_SITE)
    // ────────────────────────────────────────────────────────────────

    this.on('cancel', [VisitorPasses, VisitorPasses.drafts], async (req) => {
      const { ID } = req.params[0];
      const targetEntity = req.target.name;
      const pass = await SELECT.one.from(targetEntity).where({ ID });
      if (!pass) return req.reject(404, 'Pass not found.');

      // Ownership check
      if (pass.createdBy !== req.user.id) {
        return req.reject(403, 'You can only cancel your own passes.');
      }

      assertTransition(pass.status_code, 'cancel', req);

      await UPDATE(targetEntity, ID).set({ status_code: 'CANCELLED' });
      await writeEvent(ID, pass.status_code, 'CANCELLED', 'CANCEL', req);

      return SELECT.one.from(targetEntity, ID);
    });


    // ────────────────────────────────────────────────────────────────
    //  CHECK IN  (BR-05 recheck, BR-06, BR-07, BR-08)
    // ────────────────────────────────────────────────────────────────

    this.on('checkIn', [VisitorPasses, VisitorPasses.drafts], async (req) => {
      const { ID } = req.params[0];
      const targetEntity = req.target.name;
      const { badgeNo } = req.data;
      const pass = await SELECT.one.from(targetEntity).where({ ID });
      if (!pass) return req.reject(404, 'Pass not found.');

      assertTransition(pass.status_code, 'checkIn', req);

      let hasErrors = false;
      const err = (msg) => { req.error(400, msg); hasErrors = true; };

      // BR-08: badgeNo is mandatory at check-in
      if (!badgeNo || !badgeNo.trim()) {
        err('Enter the badge number issued.');
      }

      // BR-06: check-in only from 30 min before validFrom until validTo, on visitDate
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      if (pass.visitDate !== todayStr) {
        err(`This pass is valid on ${pass.visitDate}, not today.`);
      } else {
        const fromMin = timeToMinutes(pass.validFrom);
        const toMin   = timeToMinutes(pass.validTo);
        const nowMin  = now.getHours() * 60 + now.getMinutes();

        if (nowMin < (fromMin - 30) || nowMin > toMin) {
          err(
            `This pass is valid from ${pass.validFrom} to ${pass.validTo} on ${pass.visitDate}. Ask the host to extend it.`
          );
        }
      }

      // BR-05: recheck induction at check-in
      const area = pass.area_code
        ? await SELECT.one.from(VisitAreas).where({ code: pass.area_code, plant_code: pass.area_plant_code })
        : null;

      if (area?.requiresInduction) {
        if (!pass.inductionRef) {
          err(`Area ${area.name} requires a valid safety induction.`);
        }
        if (pass.inductionValidTill && pass.inductionValidTill < todayStr) {
          err(`The induction expired on ${pass.inductionValidTill}; the visitor cannot enter ${area.name}.`);
        }
      }

      // BR-07: same visitorMobile cannot be ON_SITE on two passes — HARD ERROR at check-in
      const onSite = await SELECT.from(dbTrans().VisitorPasses)
        .where({ visitorMobile: pass.visitorMobile, status_code: 'ON_SITE', ID: { '!=': ID } });
      if (onSite.length > 0) {
        const other = onSite[0];
        err(`Already on site at plant ${other.plant_code} on pass ${other.passNo} — check them out there first.`);
      }

      // BR-08: badge must not be held by another ON_SITE pass
      if (badgeNo && badgeNo.trim()) {
        const badgeInUse = await SELECT.from(dbTrans().VisitorPasses)
          .where({ badgeNo: badgeNo.trim(), status_code: 'ON_SITE', ID: { '!=': ID } });
        if (badgeInUse.length > 0) {
          const holder = badgeInUse[0];
          err(`Badge ${badgeNo} is already issued to ${holder.visitorName} on pass ${holder.passNo}.`);
        }
      }

      if (hasErrors) return;

      // All checks passed — stamp arrival
      const arrivalTime = new Date().toISOString();
      await UPDATE(targetEntity, ID).set({
        status_code: 'ON_SITE',
        badgeNo: badgeNo.trim(),
        actualInAt: arrivalTime
      });

      await writeEvent(ID, 'APPROVED', 'ON_SITE', 'CHECK_IN', req);

      return SELECT.one.from(targetEntity, ID);
    });


    // ────────────────────────────────────────────────────────────────
    //  CHECK OUT  (BR-09 — returnable items)
    // ────────────────────────────────────────────────────────────────

    this.on('checkOut', [VisitorPasses, VisitorPasses.drafts], async (req) => {
      const { ID } = req.params[0];
      const targetEntity = req.target.name;
      const pass = await SELECT.one.from(targetEntity).where({ ID });
      if (!pass) return req.reject(404, 'Pass not found.');

      assertTransition(pass.status_code, 'checkOut', req);

      // BR-09: every returnable item must be confirmed or have an exitRemark
      const items = await SELECT.from(PassItems).where({ pass_ID: ID });
      const unconfirmed = items.filter(i => i.isReturnable && !i.returnedAtExit && !i.exitRemark);

      if (unconfirmed.length > 0) {
        const names = unconfirmed.map(i => i.description).join(', ');
        return req.reject(
          400,
          `${unconfirmed.length} returnable item(s) not confirmed: ${names}. Confirm them, or record why they are not leaving.`
        );
      }

      // Stamp departure, compute duration, release badge
      const now = new Date();
      const inTime = new Date(pass.actualInAt);
      const durationMinutes = Math.round((now.getTime() - inTime.getTime()) / 60000);

      await UPDATE(targetEntity, ID).set({
        status_code: 'CHECKED_OUT',
        actualOutAt: now.toISOString(),
        durationMinutes
      });

      await writeEvent(ID, 'ON_SITE', 'CHECKED_OUT', 'CHECK_OUT', req);

      return SELECT.one.from(targetEntity, ID);
    });


    // ────────────────────────────────────────────────────────────────
    //  COPY  (BR-13)
    // ────────────────────────────────────────────────────────────────

    this.on('copy', [VisitorPasses, VisitorPasses.drafts], async (req) => {
      const { ID } = req.params[0];
      const targetEntity = req.target.name;
      const pass = await SELECT.one.from(targetEntity).where({ ID });
      if (!pass) return req.reject(404, 'Pass not found.');

      // Ownership check — only the host can copy their own pass
      if (pass.createdBy !== req.user.id) {
        return req.reject(403, 'You can only copy your own passes.');
      }

      const items = await SELECT.from(PassItems).where({ pass_ID: ID });

      // Build new DRAFT — visitor details + items carry over;
      // number, status, dates, badge, times do NOT.
      const newId = cds.utils.uuid();
      const DBPasses = dbTrans().VisitorPasses;
      const DBItems  = dbTrans().PassItems;

      await INSERT.into(DBPasses).entries({
        ID:               newId,
        host_ID:          pass.host_ID,
        plant_code:       pass.plant_code,
        area_code:        pass.area_code,
        area_plant_code:  pass.area_plant_code,
        purpose_code:     pass.purpose_code,
        purposeDetail:    pass.purposeDetail,
        visitorName:      pass.visitorName,
        visitorCompany:   pass.visitorCompany,
        visitorMobile:    pass.visitorMobile,
        idProofType_code: pass.idProofType_code,
        idProofNumber:    pass.idProofNumber,
        inductionRef:     pass.inductionRef,
        inductionValidTill: pass.inductionValidTill,
        vehicleNo:        pass.vehicleNo,
        status_code:      'DRAFT',
        isOverstay:       false,
        createdBy:        req.user.id,
        createdAt:        new Date().toISOString(),
        modifiedBy:       req.user.id,
        modifiedAt:       new Date().toISOString()
      });

      // Copy items
      if (items.length > 0) {
        let counter = 0;
        await INSERT.into(DBItems).entries(
          items.map(i => ({
            ID:            cds.utils.uuid(),
            pass_ID:       newId,
            itemNo:        (counter += 10, counter),
            description:   i.description,
            serialNo:      i.serialNo,
            quantity:      i.quantity,
            isReturnable:  i.isReturnable,
            returnedAtExit: false
          }))
        );
      }

      req.info(`Pass copied from ${pass.passNo || 'draft'}. Check the dates and the induction validity before submitting.`);

      return SELECT.one.from(targetEntity, newId);
    });


    // ────────────────────────────────────────────────────────────────
    //  DAY-END JOB  (Section 4, step 6)
    // ────────────────────────────────────────────────────────────────

    this.on('runDayEndJob', async (req) => {
      const now    = new Date();
      const todayStr  = now.toISOString().slice(0, 10);
      const nowTime   = now.toTimeString().slice(0, 8); // HH:MM:SS
      const DBPasses = dbTrans().VisitorPasses;

      let expired = 0, overstay = 0;

      // 1. APPROVED passes past validity and never used → EXPIRED
      const expirable = await SELECT.from(DBPasses)
        .where({ status_code: 'APPROVED' })
        .and(`(visitDate < '${todayStr}' OR (visitDate = '${todayStr}' AND validTo < '${nowTime}'))`);

      for (const pass of expirable) {
        await UPDATE(DBPasses, pass.ID).set({ status_code: 'EXPIRED' });
        await writeEvent(pass.ID, 'APPROVED', 'EXPIRED', 'EXPIRE', req);
        expired++;
      }

      // 2. ON_SITE passes past validity → flag isOverstay (status stays ON_SITE)
      const overstayers = await SELECT.from(DBPasses)
        .where({ status_code: 'ON_SITE', isOverstay: false })
        .and(`(visitDate < '${todayStr}' OR (visitDate = '${todayStr}' AND validTo < '${nowTime}'))`);

      for (const pass of overstayers) {
        await UPDATE(DBPasses, pass.ID).set({ isOverstay: true });
        await writeEvent(pass.ID, 'ON_SITE', 'ON_SITE', 'OVERSTAY', req);
        overstay++;
      }

      req.info(`Day-end job completed: ${expired} expired, ${overstay} overstay flagged.`);
      return { expired, overstay };
    });


    // ────────────────────────────────────────────────────────────────
    //  BR-14: MASK idProofNumber  (after READ)
    // ────────────────────────────────────────────────────────────────

    this.after('READ', VisitorPasses, (data, req) => {
      const mask = (pass) => {
        if (!pass || !pass.idProofNumber) return;
        // Admin sees full
        if (req.user.is('Admin')) return;
        // Guard sees full only during check-in (pass status APPROVED)
        if (req.user.is('SecurityGuard') && pass.status_code === 'APPROVED') return;
        // Everyone else sees masked: ****<last 4>
        pass.idProofNumber = '****' + pass.idProofNumber.slice(-4);
      };

      if (Array.isArray(data)) data.forEach(mask);
      else mask(data);
    });


    // ────────────────────────────────────────────────────────────────
    //  PASSEVENT IMMUTABILITY  (Section 6.3, TC-10)
    //  "No user, no role, no screen, not the Admin, not the person
    //   who wrote it two minutes ago, may update or delete a PassEvent."
    // ────────────────────────────────────────────────────────────────

    this.before(['UPDATE', 'DELETE'], PassEvents, (req) => {
      return req.reject(403, 'Audit trail events cannot be modified or deleted.');
    });

    this.before('CREATE', PassEvents, (req) => {
      // Allow if request is internal via our dbE logic which drops req, 
      // but if req exists from OData layer, block it.
      if (req.user) {
        return req.reject(403, 'Events are created by the system only.');
      }
    });


    await super.init();
  }
}
