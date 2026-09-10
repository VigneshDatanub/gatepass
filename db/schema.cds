namespace nub.gatepass;

using {
  cuid,
  managed,
  sap.common.CodeList
} from '@sap/cds/common';

// ════════════════════════════════════════════════════════════════════
//  CODE LISTS  (Section 6.5)
// ════════════════════════════════════════════════════════════════════

context config {
  /**
   * Visit purposes — drives conditional mandatory on purposeDetail (BR-03).
   */
  entity VisitPurposes : CodeList {
    key code : String(12);
  }

  /**
   * ID proof types accepted at the gate.
   */
  entity IdProofTypes : CodeList {
    key code : String(12);
  }

  /**
   * Pass status — criticality drives Fiori badge colour:
   *   1 = red (REJECTED, EXPIRED),  2 = amber (REQUESTED),
   *   3 = green (APPROVED, CHECKED_OUT),  5 = blue (ON_SITE).
   */
  entity PassStatus : CodeList {
    key code        : String(12);
        criticality : Integer;
  }
}

// ════════════════════════════════════════════════════════════════════
//  MASTER DATA  (Section 6.4)
// ════════════════════════════════════════════════════════════════════

context master {
  /**
   * Plants — the four sites.  Gate hours are used by BR-02.
   * Inactive plants remain readable on old passes but leave value helps.
   */
  entity Plants : managed {
    key code          : String(4);
        name          : String(100) @mandatory;
        city          : String(40);
        gateOpenTime  : Time;
        gateCloseTime : Time;
        isActive      : Boolean default true;
  }

  /**
   * Employees — everybody who can be a host.
   * empNo and email are unique business identifiers; ID is the technical key.
   * An inactive employee cannot host a new pass but stays readable (BR-03).
   */
  @assert.unique: {
    empNo: [empNo],
    email: [email]
  }
  entity Employees : cuid, managed {
    empNo        : String(10)  @mandatory;
    name         : String(80)  @mandatory;
    email        : String(100) @mandatory;
    department   : String(40);
    defaultPlant : Association to Plants;
    isActive     : Boolean default true;
  }

  /**
   * Visit areas — defined per plant.  The two Boolean flags drive the
   * entire process (BR-04 requiresApproval, BR-05 requiresInduction).
   * Composite key: code + plant.
   */
  entity VisitAreas : managed {
    key code              : String(20);
    key plant             : Association to Plants;
        name              : String(100) @mandatory;
        requiresApproval  : Boolean default false;
        requiresInduction : Boolean default false;
        maxVisitorsOnSite : Integer;
        isActive          : Boolean default true;
  }
}

// ════════════════════════════════════════════════════════════════════
//  TRANSACTIONAL  (Sections 6.1 – 6.3)
// ════════════════════════════════════════════════════════════════════

context transaction {
  /**
   * VisitorPasses — the single document in this application.
   * One planned or actual visit by one visitor.
   */
  entity VisitorPasses : cuid, managed {
    // ── Identification ──
    passNo             : String(20); // Sys: GP-<plant>-<YYYY>-<5 digits>, assigned at submit (BR-12)
    host               : Association to master.Employees; // Sys: always the logged-in user
    plant              : Association to master.Plants @mandatory; // Yes: defaults from the host's employee record
    area               : Association to master.VisitAreas @mandatory; // Yes: must be active and belong to the chosen plant

    // ── Visit details ──
    purpose            : Association to config.VisitPurposes @mandatory; // Yes
    purposeDetail      : String(200); // Cond: mandatory when purpose = OTHER, min 15 chars
    visitorName        : String(80) @mandatory; // Yes: min 3 chars
    visitorCompany     : String(80) @mandatory; // Yes
    visitorMobile      : String(10) @mandatory; // Yes: exactly 10 digits, first digit 6-9
    idProofType        : Association to config.IdProofTypes @mandatory; // Yes
    idProofNumber      : String(20) @mandatory; // Yes: masked on read (BR-14)
    visitDate          : Date @mandatory; // Yes: not in the past (BR-01)
    validFrom          : Time @mandatory; // Yes: inside plant gate hours (BR-02)
    validTo            : Time @mandatory; // Yes: after validFrom, same day, max 12 h (BR-02)
    inductionRef       : String(30); // Cond: when area.requiresInduction (BR-05)
    inductionValidTill : Date; // Cond: on or after visitDate (BR-05)
    vehicleNo          : String(15); // No: gate log only

    // ── Status and gate ──
    status             : Association to config.PassStatus; // Sys: changed only by actions (Section 7)
    badgeNo            : String(10); // Sys: captured by the guard at check-in (BR-08)
    actualInAt         : DateTime; // Sys: stamped by the server at check-in
    actualOutAt        : DateTime; // Sys: stamped by the server at check-out
    durationMinutes    : Integer; // Sys: computed at check-out
    isOverstay         : Boolean default false; // Sys: set by the day-end job
    rejectionReason    : String(200); // Cond: mandatory on reject, min 10 chars (BR-10)

    // ── Compositions ──
    items              : Composition of many PassItems
                           on items.pass = $self;
    events             : Composition of many PassEvents
                           on events.pass = $self;
  }

  /**
   * PassItems — owned by the pass (Composition).
   * One line per item carried in: laptop, toolkit, sample box.
   */
  entity PassItems : cuid, managed {
    pass           : Association to VisitorPasses;
    itemNo         : Integer; // Sys: line number 10, 20, 30 …
    description    : String(100) @mandatory; // Yes: min 3 chars
    serialNo       : String(40); // No: recommended for laptops
    quantity       : Integer default 1 @mandatory; // Yes: 1-99
    isReturnable   : Boolean default true @mandatory; // Yes: false for a sample being handed over
    returnedAtExit : Boolean default false; // Sys: ticked by the guard at check-out (BR-09)
    exitRemark     : String(100); // Cond: mandatory when returnable item not confirmed
  }

  /**
   * PassEvents — write once, never touched again (Section 6.3).
   * One row per status change.  No user, no role, no screen may update or delete.
   */
  entity PassEvents : cuid {
    pass       : Association to VisitorPasses;
    seq        : Integer; // Event order within the pass
    fromStatus : String(12); // Empty on the first event
    toStatus   : String(12);
    action     : String(20); // SUBMIT, APPROVE, REJECT, CHECK_IN, CHECK_OUT, CANCEL, EXPIRE, OVERSTAY
    actor      : String(80); // req.user.id — never from the payload
    actedAt    : DateTime; // Server time — never from the browser
    remark     : String(200); // Mandatory for REJECT and forced check-out
  }
}
