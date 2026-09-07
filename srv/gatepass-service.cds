using nub.gatepass from '../db/schema';

//Test SAP BTP CI Pipeline

// ════════════════════════════════════════════════════════════════════
//  ACTION PARAMETER TYPES
// ════════════════════════════════════════════════════════════════════

/**
 * One item confirmation supplied by the guard at check-out (BR-09).
 * Either returnedAtExit = true, or exitRemark explains why it is not
 * leaving.  Anything else blocks the check-out.
 */
type ItemConfirmation {
  ID             : UUID;
  returnedAtExit : Boolean;
  exitRemark     : String(100);
}

/**
 * GatePass Service — single OData V4 service.
 * Roles: Host, SecuritySupervisor, SecurityGuard, Admin (Section 3).
 *
 * Section 9 authorization is expressed here, on the service, so that it
 * holds for every caller — Fiori, curl or test.  Nothing below relies on
 * a button being hidden in the UI.
 */
@requires: 'authenticated-user'
service GatePassService {

  // ── Transactional ─────────────────────────────────────────────────

  /**
   * Section 9, row 1:
   *   Host       C R U D  (own; U/D only in DRAFT — enforced in the handler)
   *   Guard      R        (own plant, never other people's drafts)
   *   Supervisor R        (own plant)
   *   Admin      R        (all)
   *
   * The where clauses are what TC-09 tests: a second host opening the
   * first host's pass by direct URL must get nothing back.
   */
  @odata.draft.enabled
  @restrict: [
    {
      grant: 'CREATE',
      to   : 'Host'
    },
    {
      grant: [
        'READ',
        'UPDATE',
        'DELETE'
      ],
      to   : 'Host',
      where: 'createdBy = $user'
    },
    {
      grant: [
        'submit',
        'cancel',
        'copy'
      ],
      to   : 'Host',
      where: 'createdBy = $user'
    },

    {
      grant: 'READ',
      to   : 'SecurityGuard',
      where: 'plant.code = $user.plant'
    },
    {
      grant: [
        'checkIn',
        'checkOut'
      ],
      to   : 'SecurityGuard',
      where: 'plant.code = $user.plant'
    },

    {
      grant: 'READ',
      to   : 'SecuritySupervisor',
      where: 'plant.code = $user.plant'
    },
    {
      grant: [
        'approve',
        'rejectPass'
      ],
      to   : 'SecuritySupervisor',
      where: 'plant.code = $user.plant'
    },

    {
      grant: 'READ',
      to   : 'Admin'
    }
  ]
  entity VisitorPasses   as
    projection on gatepass.transaction.VisitorPasses {
      *,
      /** Days since the pass was raised — the ageing column on S2. */
      virtual null as ageingDays : Integer
    }
    actions {
      /** Host submits: validates BR-01–BR-07, assigns passNo (BR-12), determines status (BR-04). */
      action submit()                                                    returns VisitorPasses;
      /** Supervisor approves: checks BR-11 (not own pass). */
      action approve()                                                   returns VisitorPasses;
      /** Supervisor rejects: requires reason ≥ 10 chars (BR-10). */
      action rejectPass(reason: String(200) @mandatory )                 returns VisitorPasses;
      /** Host cancels: only from DRAFT, REQUESTED, APPROVED. Never from ON_SITE. */
      action cancel()                                                    returns VisitorPasses;
      /** Guard checks in: BR-05 recheck, BR-06 window, BR-07 duplicate, BR-08 badge. */
      action checkIn(badgeNo: String(10) @mandatory )                    returns VisitorPasses;
      /**
       * Guard checks out (BR-09).  `items` carries the confirmations made at
       * the gate; `remark` is recorded on the PassEvent when the guard forces
       * the check-out with items outstanding (Section 6.3).
       */
      action checkOut(items: many ItemConfirmation, remark: String(200)) returns VisitorPasses;
      /** Copy to a new DRAFT: visitor details + items carry over (BR-13). */
      action copy()                                                      returns VisitorPasses;
    };

  /**
   * Section 9, row 2.  The guard's UPDATE is narrowed to the two exit
   * fields inside the handler; the pass must be ON_SITE and at the
   * guard's own plant.
   */
  @restrict: [
    {
      grant: [
        'READ',
        'CREATE',
        'UPDATE',
        'DELETE'
      ],
      to   : 'Host',
      where: 'pass.createdBy = $user'
    },
    {
      grant: [
        'READ',
        'UPDATE',
        'confirmReturn'
      ],
      to   : 'SecurityGuard',
      where: 'pass.plant.code = $user.plant'
    },
    {
      grant: 'READ',
      to   : 'SecuritySupervisor',
      where: 'pass.plant.code = $user.plant'
    },
    {
      grant: 'READ',
      to   : 'Admin'
    }
  ]
  entity PassItems       as projection on gatepass.transaction.PassItems
    actions {
      /** Guard ticks one item back out at the gate (BR-09). */
      action confirmReturn(returned: Boolean, exitRemark: String(100)) returns PassItems;
    };

  /**
   * Section 6.3 / Section 9, row 3: readable by role, writable by nobody.
   * @readonly stops CREATE, UPDATE and DELETE at the protocol layer; the
   * handlers in the .js refuse them again so TC-10 passes even if this
   * annotation is ever removed.
   */
  @readonly
  @restrict: [
    {
      grant: 'READ',
      to   : 'Host',
      where: 'pass.createdBy = $user'
    },
    {
      grant: 'READ',
      to   : [
        'SecurityGuard',
        'SecuritySupervisor'
      ],
      where: 'pass.plant.code = $user.plant'
    },
    {
      grant: 'READ',
      to   : 'Admin'
    }
  ]
  entity PassEvents      as projection on gatepass.transaction.PassEvents;

  // ── Master & Config ───────────────────────────────────────────────
  // Section 9, row 4: "C R U — deactivate, never hard delete".
  // DELETE is granted to nobody, so isActive is the only way out.

  // DeleteRestrictions hides the generic Delete button in Fiori Elements
  // outright — nobody is ever granted DELETE (see the handler-level
  // MASTER_NO_DELETE guard too), so a visible-but-forbidden button would
  // just be a worse UX for the same, already-enforced rule.
  @restrict                                 : [
    {
      grant: [
        'READ',
        'CREATE',
        'UPDATE'
      ],
      to   : 'Admin'
    },
    {
      grant: 'READ',
      to   : [
        'Host',
        'SecurityGuard',
        'SecuritySupervisor'
      ]
    }
  ]
  @Capabilities.DeleteRestrictions.Deletable: false
  // Draft-enabled for the same reason VisitorPasses is: it is the editing
  // flow Fiori Elements supports out of the box (Edit -> change -> Save /
  // Cancel).  Without it the generated Object Page renders read-only with
  // no Edit button, whatever the Capabilities annotations say.
  @odata.draft.enabled
  entity Plants          as projection on gatepass.master.Plants;

  @restrict                                 : [
    {
      grant: [
        'READ',
        'CREATE',
        'UPDATE'
      ],
      to   : 'Admin'
    },
    {
      grant: 'READ',
      to   : [
        'Host',
        'SecurityGuard',
        'SecuritySupervisor'
      ]
    }
  ]
  @Capabilities.DeleteRestrictions.Deletable: false
  // Draft-enabled for the same reason VisitorPasses is: it is the editing
  // flow Fiori Elements supports out of the box (Edit -> change -> Save /
  // Cancel).  Without it the generated Object Page renders read-only with
  // no Edit button, whatever the Capabilities annotations say.
  @odata.draft.enabled
  entity Employees       as projection on gatepass.master.Employees;

  @restrict                                 : [
    {
      grant: [
        'READ',
        'CREATE',
        'UPDATE'
      ],
      to   : 'Admin'
    },
    {
      grant: 'READ',
      to   : [
        'Host',
        'SecurityGuard',
        'SecuritySupervisor'
      ]
    }
  ]
  @Capabilities.DeleteRestrictions.Deletable: false
  // Draft-enabled for the same reason VisitorPasses is: it is the editing
  // flow Fiori Elements supports out of the box (Edit -> change -> Save /
  // Cancel).  Without it the generated Object Page renders read-only with
  // no Edit button, whatever the Capabilities annotations say.
  @odata.draft.enabled
  entity VisitAreas      as projection on gatepass.master.VisitAreas;

  // Code lists — read-only for everyone
  @readonly
  entity VisitPurposes   as projection on gatepass.config.VisitPurposes;

  @readonly
  entity IdProofTypes    as projection on gatepass.config.IdProofTypes;

  @readonly
  entity PassStatus      as projection on gatepass.config.PassStatus;

  // ── R3: Visitor footfall ──────────────────────────────────────────

  /**
   * Section 10, R3 — count of passes and average duration by plant, area,
   * purpose and month, over CHECKED_OUT passes only.  Aggregated in the
   * database, not in the browser.
   */
  @readonly
  @cds.redirection.target: false // associations to VisitorPasses must not land here
  @restrict              : [{
    grant: 'READ',
    to   : [
      'Admin',
      'SecuritySupervisor'
    ]
  }]
  entity VisitorFootfall as
    select from gatepass.transaction.VisitorPasses {
      key plant.code           as plant        : String(4),
      key area.code            as area         : String(20),
      key purpose.code         as purpose      : String(12),
      key year(visitDate)      as visitYear    : Integer,
      key month(visitDate)     as visitMonth   : Integer,
          count(1)             as passCount    : Integer,
          avg(durationMinutes) as avgDuration  : Decimal(10, 1),
          sum(durationMinutes) as totalMinutes : Integer
    }
    where
      status.code = 'CHECKED_OUT'
    group by
      plant.code,
      area.code,
      purpose.code,
      year(visitDate),
      month(visitDate);

  // ── Unbound action ────────────────────────────────────────────────

  /** Admin runs once each evening: expire unused passes, flag overstays. */
  @requires: 'Admin'
  action runDayEndJob() returns {
    expired  : Integer;
    overstay : Integer;
  };
}

// ════════════════════════════════════════════════════════════════════
//  FREE-TEXT SEARCH
//  Section 10: "a single search box must find a visitor by mobile
//  number or by name.  A guard with a queue does not pick a filter
//  field first."  This is what makes $search — and therefore the Fiori
//  search field on the Gate Console — cover both.
// ════════════════════════════════════════════════════════════════════

annotate GatePassService.VisitorPasses with @cds.search: {
  visitorName,
  visitorMobile,
  passNo,
  visitorCompany,
  badgeNo
};

// @cds.search only wires the server-side $search handler; the
// Capabilities annotation is what tells the Fiori Elements List Report
// to render the search field in its toolbar in the first place.
annotate GatePassService.VisitorPasses with @Capabilities.SearchRestrictions: {Searchable: true};
