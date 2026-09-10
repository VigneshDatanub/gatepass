import cds from '@sap/cds';

// ════════════════════════════════════════════════════════════════════
//  STATUS TRANSITION TABLE  (Section 7)
//  "Put the check in one place on the server that every action calls
//   — not scattered across seven handlers."
//
//  Every action below goes through assertTransition().  ON_SITE →
//  CANCELLED is absent on purpose and always will be: a person is
//  physically inside a factory, and the only way that pass ends is a
//  human at the gate pressing Check Out.
// ════════════════════════════════════════════════════════════════════

const ACTION_MAP = {
  //  action        allowed from-statuses                    target (null = decided by BR-04)
  submit:     { from: ['DRAFT'],                             to: null          },
  approve:    { from: ['REQUESTED'],                         to: 'APPROVED'    },
  rejectPass: { from: ['REQUESTED'],                         to: 'REJECTED'    },
  cancel:     { from: ['DRAFT', 'REQUESTED', 'APPROVED'],    to: 'CANCELLED'   },
  checkIn:    { from: ['APPROVED'],                          to: 'ON_SITE'     },
  checkOut:   { from: ['ON_SITE'],                           to: 'CHECKED_OUT' },
  expire:     { from: ['APPROVED'],                          to: 'EXPIRED'     },
  overstay:   { from: ['ON_SITE'],                           to: 'ON_SITE'     }
};

/**
 * Fields no browser may ever set (Section 6.1).  "If a PATCH can set
 * them, a visitor can be given a departure time they never had and the
 * whole register is worthless."  TC-08 proves it.
 */
const SYSTEM_FIELDS = [
  'passNo', 'actualInAt', 'actualOutAt', 'durationMinutes',
  'isOverstay', 'badgeNo', 'status_code', 'status',
  'rejectionReason', 'host_ID', 'host'
];

// ── Time helpers ────────────────────────────────────────────────────
// Date and clock are both read in SERVER-LOCAL time.  Mixing
// toISOString() (UTC) with getHours() (local) silently shifts the
// check-in window by the UTC offset, which in IST is 5½ hours.
// Deploy with TZ set to the plant's timezone.

const TIMEZONE = process.env.TZ || 'Asia/Kolkata';

const formatParts = (d, options) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour12: false, ...options }).formatToParts(d);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
};

/** 'YYYY-MM-DD' in plant/server timezone. */
const localDate = (d = new Date()) => {
  const p = formatParts(d, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.year}-${p.month}-${p.day}`;
};

/** Minutes since midnight in plant/server timezone. */
const localMinutes = (d = new Date()) => {
  const p = formatParts(d, { hour: '2-digit', minute: '2-digit' });
  return Number(p.hour) * 60 + Number(p.minute);
};

/** 'HH:MM:SS' in plant/server timezone. */
const localTime = (d = new Date()) => {
  const p = formatParts(d, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${p.hour}:${p.minute}:${p.second}`;
};

/** Convert 'HH:MM:SS' to minutes since midnight. */
const timeToMinutes = (t) => {
  if (!t) return 0;
  const p = String(t).split(':').map(Number);
  return (p[0] || 0) * 60 + (p[1] || 0);
};

/** Whole days between two 'YYYY-MM-DD' / ISO timestamps. */
const daysBetween = (fromISO, to = new Date()) => {
  if (!fromISO) return null;
  const from = new Date(fromISO);
  if (Number.isNaN(from.getTime())) return null;
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
};


// ════════════════════════════════════════════════════════════════════
//  SERVICE HANDLER
// ════════════════════════════════════════════════════════════════════

export default class GatePassService extends cds.ApplicationService {

  async init() {
    const { VisitorPasses, PassItems, PassEvents, Employees, VisitAreas, Plants } = this.entities;

    // ── DB-level entity refs ────────────────────────────────────────
    // Every system write goes through these.  Writing through the
    // service entities instead would re-enter @restrict and the
    // read-only guards below, and the server would be unable to do the
    // very things only the server is allowed to do.
    const db = () => cds.entities('nub.gatepass.transaction');
    const DBPasses = () => db().VisitorPasses;
    const DBItems  = () => db().PassItems;
    const DBEvents = () => db().PassEvents;


    // ────────────────────────────────────────────────────────────────
    //  HELPERS
    // ────────────────────────────────────────────────────────────────

    /**
     * Resolve the logged-in user to an employee row.
     * Section 6.4 says email is "matched against req.user.id".  Under
     * XSUAA req.user.id is the e-mail; with mocked auth it is the login
     * name, so we accept either and never require an XSUAA attribute
     * that the identity provider may not send.
     */
    const getEmployee = async (req) => {
      const candidates = [req.user.attr?.email, req.user.id].filter(Boolean);
      if (!candidates.length) return null;
      return SELECT.one.from(Employees).where({ email: { in: candidates } });
    };

    /**
     * i18n-keyed error that lets validation continue (errors are
     * collected, not thrown).  `status: 400` is set explicitly: CAP's
     * dispatcher only infers 400 from a batch of two or more collected
     * errors, and defaults a single one to 500 — which would turn every
     * one-problem validation failure into a server error instead of a
     * bad request.
     */
    const collect = (req, key, args, target) => {
      req.error({ status: 400, code: key, message: key, args, target });
    };

    /** i18n-keyed hard stop. */
    const fail = (req, status, key, args) => req.reject({ status, code: key, message: key, args });

    /**
     * BR-12: next passNo as GP-<plant>-<YYYY>-<5 digits>, per plant per
     * year, never reused.  The LIKE argument is bound, not interpolated
     * — plant_code arrives from the payload.
     */
    const generatePassNo = async (plantCode) => {
      const year = new Date().getFullYear();
      const prefix = `GP-${plantCode}-${year}-`;
      const last = await SELECT.one.from(DBPasses())
        .columns('passNo')
        .where({ plant_code: plantCode, passNo: { like: prefix + '%' } })
        .orderBy('passNo desc');

      let next = 1;
      if (last?.passNo) {
        const n = parseInt(last.passNo.slice(prefix.length), 10);
        if (Number.isFinite(n)) next = n + 1;
      }
      return prefix + String(next).padStart(5, '0');
    };

    /**
     * BR-12: "Every status change writes exactly one PassEvent in the
     * same transaction."  This runs on the request transaction, so if
     * anything after it throws, the status change rolls back with it —
     * status and audit commit together or not at all.
     */
    const writeEvent = async (passId, fromStatus, toStatus, action, req, remark = null) => {
      const last = await SELECT.one.from(DBEvents())
        .columns('seq').where({ pass_ID: passId }).orderBy('seq desc');

      await INSERT.into(DBEvents()).entries({
        ID: cds.utils.uuid(),
        pass_ID: passId,
        seq: (last?.seq ?? 0) + 1,
        fromStatus: fromStatus || '',
        toStatus,
        action,
        actor: req.user.id,          // never from the payload
        actedAt: new Date().toISOString(),
        remark
      });
    };

    /** Section 7: the one place every action asks "is this move legal?". */
    const assertTransition = (currentStatus, action, req) => {
      const rule = ACTION_MAP[action];
      if (!rule) return fail(req, 400, 'INVALID_ACTION', [action]);
      if (!rule.from.includes(currentStatus)) {
        return fail(req, 409, 'INVALID_STATUS', [action, currentStatus]);
      }
    };

    /** Load the active pass an action was invoked on. */
    const loadPass = async (req) => {
      const { ID } = req.params[req.params.length - 1];
      const pass = await SELECT.one.from(DBPasses()).where({ ID });
      if (!pass) return fail(req, 404, 'PASS_NOT_FOUND');
      return pass;
    };

    /**
     * BR-14: "Mask on the server in an after-read handler.  Never in the UI."
     * Full only for the Admin, and for the guard on a pass that is
     * APPROVED — that is, at the moment of check-in, which is the only
     * moment a guard needs to compare the number against the card.
     */
    const maskIdProof = (row, req) => {
      if (!row?.idProofNumber) return;
      if (req.user.is('Admin')) return;
      if (req.user.is('SecurityGuard') && row.status_code === 'APPROVED') return;
      row.idProofNumber = '****' + row.idProofNumber.slice(-4);
    };

    /** True when the caller is the host of, or raised, this pass (BR-11). */
    const isOwnPass = async (pass, req) => {
      if (pass.createdBy === req.user.id) return true;
      const emp = await getEmployee(req);
      return !!(emp && pass.host_ID === emp.ID);
    };

    /**
     * Read the pass back for the action's response.  Internal cds.ql does
     * not run the after-READ handlers, so the mask is applied by hand —
     * otherwise every action would answer with an unmasked ID number.
     */
    const respond = async (ID, req) => {
      const row = await SELECT.one.from(VisitorPasses).where({ ID });
      maskIdProof(row, req);
      if (row && 'ageingDays' in row) row.ageingDays = daysBetween(row.createdAt);
      return row;
    };


    // ════════════════════════════════════════════════════════════════
    //  DRAFT LIFECYCLE
    // ════════════════════════════════════════════════════════════════

    /**
     * Section 6.1: host is "always the logged-in user.  Not selectable —
     * nobody registers a visitor on someone else's behalf."  Plant only
     * defaults from the host record, so copy() and the user can override it.
     */
    this.before('NEW', VisitorPasses.drafts, async (req) => {
      const emp = await getEmployee(req);
      if (!emp) return fail(req, 403, 'NOT_EMPLOYEE');
      // BR-03: an inactive employee cannot host a new pass.
      if (!emp.isActive) return fail(req, 403, 'BR03_HOST_INACTIVE', [emp.name]);

      req.data.host_ID = emp.ID;
      req.data.status_code = 'DRAFT';
      req.data.isOverstay = false;
      if (!req.data.plant_code) req.data.plant_code = emp.defaultPlant_code;
    });


    // ════════════════════════════════════════════════════════════════
    //  WRITE PROTECTION
    // ════════════════════════════════════════════════════════════════

    /**
     * Section 6.1 — passNo, actualInAt and actualOutAt (and the rest of
     * the system set) are stripped from every inbound write, draft or
     * active.  TC-08.
     */
    // Registered on the DRAFT (where a browser types) and on a direct
    // UPDATE of an active pass (where curl tries).  Deliberately NOT on
    // NEW or on CREATE of the active entity: NEW is where the system
    // itself sets host_ID and status_code (handler above), and CREATE
    // of the active entity is draft activation, which legitimately
    // carries the whole saved draft across — stripping either would
    // wipe the very fields the system just set.
    const stripSystemFields = (req) => {
      const sent = SYSTEM_FIELDS.filter((f) => f in (req.data || {}));
      for (const f of sent) delete req.data[f];
      if (sent.length) req.warn({ code: 'SYS_FIELDS_IGNORED', message: 'SYS_FIELDS_IGNORED', args: [sent.join(', ')] });
    };
    this.before('UPDATE', VisitorPasses.drafts, stripSystemFields);
    this.before('UPDATE', VisitorPasses, stripSystemFields);

    /**
     * Section 9: the host may update or delete "own; U/D only in DRAFT".
     * Section 4, step 2: at submit "header and items go read-only".
     * Ownership is already enforced by @restrict; this adds the status
     * half of the rule.  Draft activation of a DRAFT pass still passes,
     * which is what lets a host save their draft.
     */
    const assertStillDraft = async (req) => {
      const { ID } = req.params?.[0] ?? {};
      if (!ID) return;
      const current = await SELECT.one.from(DBPasses()).columns('status_code').where({ ID });
      if (!current) return;                       // first activation — no active row yet
      if (current.status_code !== 'DRAFT') {
        return fail(req, 403, 'PASS_READONLY', [current.status_code]);
      }
    };
    this.before(['UPDATE', 'DELETE'], VisitorPasses, assertStillDraft);

    /**
     * The same rule for the items the visitor carries.  The guard's two
     * exit fields are written by confirmReturn/checkOut, never by a PATCH.
     */
    this.before(['CREATE', 'UPDATE', 'DELETE'], PassItems, async (req) => {
      for (const f of ['returnedAtExit', 'exitRemark', 'itemNo']) delete req.data?.[f];
      const passId = req.data?.pass_ID ?? (await SELECT.one.from(DBItems())
        .columns('pass_ID').where({ ID: req.params?.[0]?.ID ?? null }))?.pass_ID;
      if (!passId) return;
      const pass = await SELECT.one.from(DBPasses()).columns('status_code').where({ ID: passId });
      if (pass && pass.status_code !== 'DRAFT') return fail(req, 403, 'PASS_READONLY', [pass.status_code]);
    });

    /**
     * Section 6.3 — "No user, no role, no screen, not the Admin, not the
     * person who wrote it two minutes ago, may update or delete a
     * PassEvent."  @readonly already refuses these at the protocol
     * layer; this is the belt to that pair of braces.  TC-10.
     */
    this.before(['CREATE', 'UPDATE', 'DELETE'], PassEvents, (req) =>
      fail(req, 403, 'EVENTS_IMMUTABLE'));

    /**
     * Section 9, row 4: master data is deactivated, never hard-deleted —
     * "Inactive plants leave the value help but old passes still resolve."
     * DELETE is granted to no role in the .cds; this names the reason.
     */
    for (const entity of [Plants, Employees, VisitAreas]) {
      this.before('DELETE', entity, (req) => fail(req, 403, 'MASTER_NO_DELETE'));
    }


    // ════════════════════════════════════════════════════════════════
    //  SUBMIT  (BR-01 … BR-07, BR-12)
    // ════════════════════════════════════════════════════════════════

    this.on('submit', VisitorPasses, async (req) => {
      const pass = await loadPass(req);
      const ID = pass.ID;

      assertTransition(pass.status_code, 'submit', req);

      // VisitAreas is keyed by (code, plant); Section 6.1 requires the area
      // to belong to the chosen plant anyway, so pass.plant_code — not the
      // separate area_plant_code foreign-key column — is the value that
      // resolves it. This also means a value-help or API client that only
      // ever sets area_code still finds the right row.
      const [area, plant, host] = await Promise.all([
        pass.area_code
          ? SELECT.one.from(VisitAreas).where({ code: pass.area_code, plant_code: pass.plant_code })
          : null,
        pass.plant_code ? SELECT.one.from(Plants).where({ code: pass.plant_code }) : null,
        pass.host_ID ? SELECT.one.from(Employees).where({ ID: pass.host_ID }) : null
      ]);

      // ── Collect every error.  "A pass with three problems reports all
      //    three, not the first." (M2 gate) ──
      const before = req.messages?.length ?? 0;
      const err = (key, args, target) => collect(req, key, args, target);

      // Mandatory fields (Section 6.1)
      if (!pass.visitorName || pass.visitorName.trim().length < 3) err('BR03_NAME_SHORT', [], 'in/visitorName');
      if (!pass.visitorCompany) err('MANDATORY_COMPANY', [], 'in/visitorCompany');
      if (!pass.visitorMobile || !/^[6-9]\d{9}$/.test(pass.visitorMobile)) err('BR03_MOBILE', [], 'in/visitorMobile');
      if (!pass.visitDate) err('MANDATORY_VISITDATE', [], 'in/visitDate');
      if (!pass.validFrom) err('MANDATORY_VALIDFROM', [], 'in/validFrom');
      if (!pass.validTo) err('MANDATORY_VALIDTO', [], 'in/validTo');
      if (!pass.purpose_code) err('MANDATORY_PURPOSE', [], 'in/purpose_code');
      if (!pass.idProofType_code) err('MANDATORY_IDTYPE', [], 'in/idProofType_code');
      if (!pass.idProofNumber) err('MANDATORY_IDNUMBER', [], 'in/idProofNumber');
      if (!pass.area_code) err('MANDATORY_AREA', [], 'in/area_code');
      if (!pass.plant_code) err('MANDATORY_PLANT', [], 'in/plant_code');

      // BR-01: visitDate is not in the past.
      if (pass.visitDate && pass.visitDate < localDate()) {
        err('BR01_PAST_DATE', [], 'in/visitDate');
      }

      // BR-02: validTo after validFrom, window ≤ 12 h, inside gate hours.
      if (pass.validFrom && pass.validTo) {
        const fromMin = timeToMinutes(pass.validFrom);
        const toMin = timeToMinutes(pass.validTo);
        if (toMin <= fromMin) {
          err('BR02_WINDOW_ORDER', [], 'in/validTo');
        } else {
          if (toMin - fromMin > 720) err('BR02_MAX_12H', [], 'in/validTo');
          if (plant) {
            const open = timeToMinutes(plant.gateOpenTime);
            const close = timeToMinutes(plant.gateCloseTime);
            if (fromMin < open || toMin > close) {
              err('BR02_GATE_HOURS', [plant.name, plant.gateOpenTime, plant.gateCloseTime], 'in/validFrom');
            }
          }
        }
      }

      // BR-03: host, plant and area all active.
      if (host && !host.isActive) err('BR03_HOST_INACTIVE', [host.name], 'in/host_ID');
      if (plant && !plant.isActive) err('BR03_PLANT_INACTIVE', [plant.name], 'in/plant_code');
      if (area && !area.isActive) err('BR03_AREA_INACTIVE', [area.name], 'in/area_code');
      if (pass.area_code && !area) err('AREA_UNKNOWN', [], 'in/area_code');

      // Section 6.1: the area must belong to the chosen plant.
      if (pass.area_plant_code && pass.plant_code && pass.area_plant_code !== pass.plant_code) {
        err('AREA_WRONG_PLANT', [], 'in/area_code');
      }

      // BR-05: induction, when the area demands one.
      if (area?.requiresInduction) {
        if (!pass.inductionRef) err('BR05_INDUCTION_REQUIRED', [area.name], 'in/inductionRef');
        if (!pass.inductionValidTill) {
          err('BR05_INDUCTION_DATE_REQUIRED', [area.name], 'in/inductionValidTill');
        } else if (pass.visitDate && pass.inductionValidTill < pass.visitDate) {
          err('BR05_INDUCTION_EXPIRED', [pass.inductionValidTill, area.name], 'in/inductionValidTill');
        }
      }

      // Section 6.1: purposeDetail is mandatory, min 15 chars, when purpose = OTHER.
      if (pass.purpose_code === 'OTHER' && (!pass.purposeDetail || pass.purposeDetail.trim().length < 15)) {
        err('BR03_PURPOSE_DETAIL', [], 'in/purposeDetail');
      }

      if ((req.messages?.length ?? 0) > before) return;  // nothing is written on a failed submit

      // BR-07 at submit is a WARNING: the host may legitimately be
      // registering tomorrow's visit.  At check-in the same rule is a
      // hard error, because the muster list would go wrong.
      const open = await SELECT.from(DBPasses())
        .where({ visitorMobile: pass.visitorMobile, ID: { '!=': ID }, status_code: { in: ['REQUESTED', 'APPROVED', 'ON_SITE'] } });
      if (open.length) {
        req.warn({ code: 'BR07_OPEN_PASS_WARNING', message: 'BR07_OPEN_PASS_WARNING', args: [open[0].plant_code] });
      }

      // BR-04: determination, not validation — one config column, two outcomes.
      const target = area?.requiresApproval ? 'REQUESTED' : 'APPROVED';

      // BR-12: passNo is drawn here and never at draft creation.
      const passNo = await generatePassNo(pass.plant_code);

      await UPDATE(DBPasses(), ID).set({ status_code: target, passNo });
      await writeEvent(ID, 'DRAFT', target, 'SUBMIT', req);
      req.notify({ message: 'PASS_SUBMITTED', args: [passNo] });

      return respond(ID, req);
    });


    // ════════════════════════════════════════════════════════════════
    //  APPROVE  (BR-11)
    // ════════════════════════════════════════════════════════════════

    this.on('approve', VisitorPasses, async (req) => {
      const pass = await loadPass(req);
      assertTransition(pass.status_code, 'approve', req);

      // BR-11: nobody may approve a pass on which they are the host,
      // even holding the supervisor role.  meera exists to test this.
      if (await isOwnPass(pass, req)) return fail(req, 403, 'BR11_SELF_APPROVE');

      await UPDATE(DBPasses(), pass.ID).set({ status_code: 'APPROVED' });
      await writeEvent(pass.ID, 'REQUESTED', 'APPROVED', 'APPROVE', req);
      req.notify({ message: 'PASS_APPROVED', args: [pass.passNo || ''] });
      return respond(pass.ID, req);
    });

    // ════════════════════════════════════════════════════════════════
    //  REJECT  (BR-10, BR-11)
    // ════════════════════════════════════════════════════════════════

    this.on('rejectPass', VisitorPasses, async (req) => {
      const pass = await loadPass(req);
      const { reason } = req.data;

      assertTransition(pass.status_code, 'rejectPass', req);
      if (await isOwnPass(pass, req)) return fail(req, 403, 'BR11_SELF_APPROVE');

      // BR-10: at least 10 characters — "the host has to be able to act on it".
      if (!reason || reason.trim().length < 10) return fail(req, 400, 'BR10_REASON_SHORT');

      await UPDATE(DBPasses(), pass.ID).set({
        status_code: 'REJECTED',
        rejectionReason: reason.trim()          // read-only forever after
      });
      await writeEvent(pass.ID, 'REQUESTED', 'REJECTED', 'REJECT', req, reason.trim());
      req.notify({ message: 'PASS_REJECTED', args: [pass.passNo || ''] });
      return respond(pass.ID, req);
    });


    // ════════════════════════════════════════════════════════════════
    //  CANCEL  (DRAFT / REQUESTED / APPROVED only — never ON_SITE)
    // ════════════════════════════════════════════════════════════════

    this.on('cancel', VisitorPasses, async (req) => {
      const pass = await loadPass(req);
      // Section 4: "The pass stays visible and countable — deleting it
      // destroys the audit trail."
      assertTransition(pass.status_code, 'cancel', req);

      await UPDATE(DBPasses(), pass.ID).set({ status_code: 'CANCELLED' });
      await writeEvent(pass.ID, pass.status_code, 'CANCELLED', 'CANCEL', req);
      req.notify({ message: 'PASS_CANCELLED', args: [pass.passNo || ''] });
      return respond(pass.ID, req);
    });


    // ════════════════════════════════════════════════════════════════
    //  CHECK IN  (BR-05 recheck, BR-06, BR-07, BR-08)
    // ════════════════════════════════════════════════════════════════

    this.on('checkIn', VisitorPasses, async (req) => {
      const pass = await loadPass(req);
      const ID = pass.ID;
      const badgeNo = (req.data.badgeNo || '').trim();

      assertTransition(pass.status_code, 'checkIn', req);

      const before = req.messages?.length ?? 0;
      const err = (key, args) => collect(req, key, args);

      // BR-08: the badge number is mandatory at check-in.
      if (!badgeNo) err('BR08_BADGE_REQUIRED');

      // BR-06: from 30 minutes before validFrom until validTo, on visitDate.
      // 31 minutes early is a hard error; 29 is fine.
      const today = localDate();
      if (pass.visitDate !== today) {
        err('BR06_WRONG_DATE', [pass.visitDate]);
      } else {
        const nowMin = localMinutes();
        const fromMin = timeToMinutes(pass.validFrom);
        const toMin = timeToMinutes(pass.validTo);
        if (nowMin < fromMin - 30 || nowMin > toMin) {
          err('BR06_OUTSIDE_WINDOW', [pass.validFrom, pass.validTo, pass.visitDate]);
        }
      }

      // BR-05 again, at the gate: "An expired induction cannot reach the
      // shop floor."  Checked against today, not against visitDate.
      const area = pass.area_code
        ? await SELECT.one.from(VisitAreas).where({ code: pass.area_code, plant_code: pass.plant_code })
        : null;
      if (area?.requiresInduction) {
        if (!pass.inductionRef) err('BR05_INDUCTION_REQUIRED', [area.name]);
        if (!pass.inductionValidTill) err('BR05_INDUCTION_DATE_REQUIRED', [area.name]);
        else if (pass.inductionValidTill < today) err('BR05_INDUCTION_EXPIRED', [pass.inductionValidTill, area.name]);
      }

      // BR-07 at check-in is an ERROR, and the message names the other pass.
      const onSite = await SELECT.one.from(DBPasses())
        .where({ visitorMobile: pass.visitorMobile, status_code: 'ON_SITE', ID: { '!=': ID } });
      if (onSite) err('BR07_ON_SITE_ERROR', [onSite.plant_code, onSite.passNo]);

      // BR-08: the badge must not be held by another pass that is on site.
      if (badgeNo) {
        const held = await SELECT.one.from(DBPasses())
          .where({ badgeNo, status_code: 'ON_SITE', ID: { '!=': ID } });
        if (held) err('BR08_BADGE_IN_USE', [badgeNo, held.visitorName, held.passNo]);
      }

      if ((req.messages?.length ?? 0) > before) return;

      await UPDATE(DBPasses(), ID).set({
        status_code: 'ON_SITE',
        badgeNo,
        actualInAt: new Date().toISOString()     // stamped by the server, never from a browser
      });
      await writeEvent(ID, 'APPROVED', 'ON_SITE', 'CHECK_IN', req);
      req.notify({ message: 'CHECKIN_SUCCESS', args: [pass.visitorName, badgeNo] });
      return respond(ID, req);
    });


    // ════════════════════════════════════════════════════════════════
    //  ITEM CONFIRMATION  (BR-09)
    // ════════════════════════════════════════════════════════════════

    /**
     * The guard ticks one item back out at the gate.  This is the only
     * write path to returnedAtExit / exitRemark: PassItems is a draft
     * composition child, so a plain PATCH cannot reach it, and the host
     * must never be able to tick their own visitor's laptop back in.
     */
    this.on('confirmReturn', PassItems, async (req) => {
      const { ID } = req.params[req.params.length - 1];
      const item = await SELECT.one.from(DBItems()).where({ ID });
      if (!item) return fail(req, 404, 'ITEM_NOT_FOUND');

      const pass = await SELECT.one.from(DBPasses()).where({ ID: item.pass_ID });
      if (!pass || pass.status_code !== 'ON_SITE') return fail(req, 409, 'BR09_ONLY_ON_SITE');

      const returned = req.data.returned !== false;
      const exitRemark = (req.data.exitRemark || '').trim() || null;

      // Section 6.2: a returnable item that is NOT confirmed needs a remark.
      if (item.isReturnable && !returned && !exitRemark) return fail(req, 400, 'BR09_REMARK_REQUIRED');

      await UPDATE(DBItems(), ID).set({ returnedAtExit: returned, exitRemark });
      req.notify({ message: 'ITEM_RETURN_CONFIRMED' });
      return SELECT.one.from(PassItems).where({ ID });
    });


    // ════════════════════════════════════════════════════════════════
    //  CHECK OUT  (BR-09, duration, badge released)
    // ════════════════════════════════════════════════════════════════

    this.on('checkOut', VisitorPasses, async (req) => {
      const pass = await loadPass(req);
      const ID = pass.ID;

      assertTransition(pass.status_code, 'checkOut', req);

      const items = await SELECT.from(DBItems()).where({ pass_ID: ID });

      // Confirmations may also arrive inline on the action, which is
      // what the check-out dialog and the acceptance tests use.
      for (const c of req.data.items || []) {
        const item = items.find((i) => i.ID === c.ID);
        // An item ID from another pass is never accepted.
        if (!item) return fail(req, 400, 'BR09_ITEM_NOT_ON_PASS', [c.ID]);
        const returned = c.returnedAtExit !== false;
        const remark = (c.exitRemark || '').trim() || null;
        if (item.isReturnable && !returned && !remark) return fail(req, 400, 'BR09_REMARK_REQUIRED');
        await UPDATE(DBItems(), item.ID).set({ returnedAtExit: returned, exitRemark: remark });
        item.returnedAtExit = returned;
        item.exitRemark = remark;
      }

      // BR-09: blocked while any returnable item is unconfirmed, unless
      // the guard has given a remark for each.
      const unconfirmed = items.filter((i) => i.isReturnable && !i.returnedAtExit && !i.exitRemark);
      if (unconfirmed.length) {
        return fail(req, 400, 'BR09_ITEMS_UNCONFIRMED', [
          unconfirmed.length,
          unconfirmed.map((i) => i.description).join(', ')
        ]);
      }

      // Section 6.3: the event remark is mandatory for a FORCED check-out
      // — one where a returnable item left unconfirmed with a reason.
      const forced = items.filter((i) => i.isReturnable && !i.returnedAtExit);
      const remark = (req.data.remark || '').trim()
        || (forced.length
          ? `Forced check-out: ${forced.map((i) => `${i.description} — ${i.exitRemark}`).join('; ')}`
          : null);

      const now = new Date();
      const inAt = pass.actualInAt ? new Date(pass.actualInAt) : null;
      const durationMinutes = inAt ? Math.max(0, Math.round((now - inAt) / 60000)) : null;

      await UPDATE(DBPasses(), ID).set({
        status_code: 'CHECKED_OUT',
        actualOutAt: now.toISOString(),
        durationMinutes,
        badgeNo: null                 // BR-08: the badge is released at check-out
      });
      await writeEvent(ID, 'ON_SITE', 'CHECKED_OUT', 'CHECK_OUT', req, remark);
      req.notify({ message: 'CHECKOUT_SUCCESS', args: [pass.visitorName] });
      return respond(ID, req);
    });


    // ════════════════════════════════════════════════════════════════
    //  COPY  (BR-13)
    // ════════════════════════════════════════════════════════════════

    /**
     * "Copy: any pass copies into a new DRAFT.  Visitor details, ID proof
     * and items carry over; number, status, dates, badge and times do not."
     *
     * The copy is created through the draft NEW event, not INSERTed into
     * the active table — otherwise the "draft" would be a visible active
     * row that every other host could read, and drafts are private.
     */
    this.on('copy', VisitorPasses, async (req) => {
      const source = await loadPass(req);
      const items = await SELECT.from(DBItems()).where({ pass_ID: source.ID }).orderBy('itemNo');

      // NEW's own response carries only the key — the draft's
      // DraftAdministrativeData_DraftUUID (needed to attach items) has
      // to be read back separately.
      const created = await this.send({
        event: 'NEW',
        entity: VisitorPasses.drafts.name,
        data: {
          plant_code: source.plant_code,
          area_code: source.area_code,
          area_plant_code: source.area_plant_code,
          purpose_code: source.purpose_code,
          purposeDetail: source.purposeDetail,
          visitorName: source.visitorName,
          visitorCompany: source.visitorCompany,
          visitorMobile: source.visitorMobile,
          idProofType_code: source.idProofType_code,
          idProofNumber: source.idProofNumber,
          vehicleNo: source.vehicleNo
          // visitDate, validFrom, validTo, inductionRef, inductionValidTill,
          // passNo, status, badgeNo and the timestamps deliberately do NOT copy.
        }
      });
      const newId = (Array.isArray(created) ? created[0] : created).ID;
      const draftRow = await SELECT.one.from(VisitorPasses.drafts)
        .columns('ID', 'DraftAdministrativeData_DraftUUID')
        .where({ ID: newId });

      if (items.length) {
        await INSERT.into(PassItems.drafts).entries(items.map((i, n) => ({
          ID: cds.utils.uuid(),
          pass_ID: newId,
          itemNo: (n + 1) * 10,
          description: i.description,
          serialNo: i.serialNo,
          quantity: i.quantity,
          isReturnable: i.isReturnable,
          returnedAtExit: false,
          exitRemark: null,
          IsActiveEntity: false,
          HasActiveEntity: false,
          HasDraftEntity: false,
          DraftAdministrativeData_DraftUUID: draftRow.DraftAdministrativeData_DraftUUID
        })));
      }

      req.info({ code: 'BR13_COPIED', message: 'BR13_COPIED', args: [source.passNo || 'draft'] });
      return SELECT.one.from(VisitorPasses.drafts).where({ ID: newId });
    });


    // ════════════════════════════════════════════════════════════════
    //  DAY-END JOB  (Section 4, step 6)
    // ════════════════════════════════════════════════════════════════

    this.on('runDayEndJob', async (req) => {
      const today = localDate();
      const now = localTime();
      let expired = 0, overstay = 0;

      // Anything whose window has closed as of this moment: either the
      // visit date is behind us, or it is today and validTo has passed.
      // Two queries merged by ID, rather than one OR-across-columns
      // object — that shape isn't expressible as a single plain-object
      // .where(), and a raw SQL fragment is exactly the injection risk
      // Section 8 exists to avoid.
      const pastValidity = async (extra) => {
        const [a, b] = await Promise.all([
          SELECT.from(DBPasses()).where({ ...extra, visitDate: { '<': today } }),
          SELECT.from(DBPasses()).where({ ...extra, visitDate: today, validTo: { '<': now } })
        ]);
        const byId = new Map([...a, ...b].map((p) => [p.ID, p]));
        return [...byId.values()];
      };

      // 1. APPROVED, validity passed, never used → EXPIRED.
      //    "The visitor never turns up.  Nobody has to remember anything."
      for (const pass of await pastValidity({ status_code: 'APPROVED' })) {
        await UPDATE(DBPasses(), pass.ID).set({ status_code: 'EXPIRED' });
        await writeEvent(pass.ID, 'APPROVED', 'EXPIRED', 'EXPIRE', req);
        expired++;
      }

      // 2. ON_SITE past validTo → flag, never auto-close.  "The system
      //    never invents a departure time — that is P3 again, with a
      //    computer behind it."  isOverstay is the only field that moves,
      //    and the filter on it is what makes a second run a no-op.
      for (const pass of await pastValidity({ status_code: 'ON_SITE', isOverstay: false })) {
        await UPDATE(DBPasses(), pass.ID).set({ isOverstay: true });
        await writeEvent(pass.ID, 'ON_SITE', 'ON_SITE', 'OVERSTAY', req);
        overstay++;
      }

      req.info({ code: 'DAYEND_DONE', message: 'DAYEND_DONE', args: [expired, overstay] });
      return { expired, overstay };
    });


    // ════════════════════════════════════════════════════════════════
    //  BR-14: MASK idProofNumber, and the S2 ageing column
    // ════════════════════════════════════════════════════════════════

    this.after('READ', VisitorPasses, (data, req) => {
      for (const row of Array.isArray(data) ? data : [data]) {
        if (!row) continue;
        maskIdProof(row, req);
        if ('ageingDays' in row) row.ageingDays = daysBetween(row.createdAt);
      }
    });

    // The same mask when the pass is reached through an $expand from its
    // children — otherwise BR-14 has a hole a single query wide.
    this.after('READ', [PassItems, PassEvents], (data, req) => {
      for (const row of Array.isArray(data) ? data : [data]) {
        if (row?.pass) maskIdProof(row.pass, req);
      }
    });


    // ════════════════════════════════════════════════════════════════
    //  DEVELOPMENT SEED DATA
    // ════════════════════════════════════════════════════════════════

    // Section 12.5 fixes the starting passes relative to "today" and
    // "yesterday".  A CSV cannot say that, so outside production the
    // seeded rows are rebased onto the current date at startup.  Without
    // this, TC-04, TC-06, TC-11 and R1 stop working the day after the
    // CSVs are written.
    if (!cds.env.profiles?.includes('production')) {
      cds.once('served', () => rebaseSeedData().catch((e) =>
        cds.log('gatepass').warn('seed rebase skipped:', e.message)));
    }

    await super.init();
  }
}

/**
 * Move the six seeded passes of Section 12.5 onto today / yesterday /
 * tomorrow.  Development and test profiles only; never runs on HANA.
 */
async function rebaseSeedData() {
  const trans = cds.entities('nub.gatepass.transaction');
  if (!trans?.VisitorPasses) return;

  const day = (offset) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return localDate(d);
  };
  const at = (offset, time) => new Date(`${day(offset)}T${time}`).toISOString();

  const plan = [
    // id suffix, visitDate, actualInAt
    ['0001', day(0), null],                    // APPROVED today — happy path (TC-04)
    ['0002', day(0), at(0, '09:30:00')],       // ON_SITE today on badge B-014 (R1, BR-08)
    ['0003', day(-1), at(-1, '14:00:00')],     // ON_SITE since yesterday — overstay (TC-11, R2)
    ['0004', day(-1), null],                   // APPROVED, never used — expires (TC-11)
    ['0005', day(0), null],                    // same mobile, plant 2000 — BR-07 trap (TC-05)
    ['0006', day(1), null]                     // karthik's draft — tomorrow
  ];

  for (const [suffix, visitDate, actualInAt] of plan) {
    const ID = `10000000-0000-0000-0000-00000000${suffix}`;
    const row = await SELECT.one.from(trans.VisitorPasses).columns('ID').where({ ID });
    if (!row) continue;
    await UPDATE(trans.VisitorPasses, ID).set(
      actualInAt ? { visitDate, actualInAt } : { visitDate }
    );
  }
}
