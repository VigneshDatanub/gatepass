using nub.gatepass from '../db/schema';

/**
 * GatePass Service — single OData V4 service.
 * Roles: Host, SecuritySupervisor, SecurityGuard, Admin (Section 3).
 */
@requires: 'authenticated-user'
service GatePassService {

  // ── Transactional ─────────────────────────────────────────────────

  @odata.draft.enabled
  entity VisitorPasses as projection on gatepass.transaction.VisitorPasses actions {
    /** Host submits: validates BR-01–BR-07, assigns passNo (BR-12), determines status (BR-04). */
    action submit()                                returns VisitorPasses;
    /** Supervisor approves: checks BR-11 (not own pass). */
    action approve()                               returns VisitorPasses;
    /** Supervisor rejects: requires reason ≥ 10 chars (BR-10). */
    action rejectPass(reason : String(200))        returns VisitorPasses;
    /** Host cancels: only from DRAFT, REQUESTED, APPROVED. */
    action cancel()                                returns VisitorPasses;
    /** Guard checks in: BR-05 recheck, BR-06 window, BR-07 duplicate, BR-08 badge. */
    action checkIn(badgeNo : String(10))           returns VisitorPasses;
    /** Guard checks out: BR-09 returnable items, stamps departure, computes duration. */
    action checkOut()                              returns VisitorPasses;
    /** Copy to new DRAFT: visitor details + items carry over (BR-13). */
    action copy()                                  returns VisitorPasses;
  };

  // Composition children — auto-exposed but explicit for annotations
  entity PassItems  as projection on gatepass.transaction.PassItems;
  entity PassEvents as projection on gatepass.transaction.PassEvents;

  // ── Master & Config (read-only for most, CRUD for Admin) ──────────

  @restrict: [
    { grant: '*', to: 'Admin' },
    { grant: 'READ', to: ['Host', 'SecurityGuard', 'SecuritySupervisor'] }
  ]
  entity Plants       as projection on gatepass.master.Plants;

  @restrict: [
    { grant: '*', to: 'Admin' },
    { grant: 'READ', to: ['Host', 'SecurityGuard', 'SecuritySupervisor'] }
  ]
  entity Employees    as projection on gatepass.master.Employees;

  @restrict: [
    { grant: '*', to: 'Admin' },
    { grant: 'READ', to: ['Host', 'SecurityGuard', 'SecuritySupervisor'] }
  ]
  entity VisitAreas   as projection on gatepass.master.VisitAreas;

  // Code lists — read-only for everyone
  @readonly entity VisitPurposes as projection on gatepass.config.VisitPurposes;
  @readonly entity IdProofTypes  as projection on gatepass.config.IdProofTypes;
  @readonly entity PassStatus    as projection on gatepass.config.PassStatus;

  // ── Unbound action ────────────────────────────────────────────────

  /** Admin runs once each evening: expire unused passes, flag overstays. */
  @requires: 'Admin'
  action runDayEndJob() returns {
    expired  : Integer;
    overstay : Integer;
  };
}

// ════════════════════════════════════════════════════════════════════
//  UI ANNOTATIONS
// ════════════════════════════════════════════════════════════════════

// ── Value Helps (active rows only) ──────────────────────────────────

annotate GatePassService.VisitorPasses with {
  plant       @Common.ValueList: {
    CollectionPath: 'Plants',
    Parameters: [
      { $Type: 'Common.ValueListParameterInOut',  LocalDataProperty: plant_code,  ValueListProperty: 'code' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'city' }
    ]
  };
  area        @Common.ValueList: {
    CollectionPath: 'VisitAreas',
    Parameters: [
      { $Type: 'Common.ValueListParameterInOut',  LocalDataProperty: area_code,  ValueListProperty: 'code' },
      { $Type: 'Common.ValueListParameterIn',     LocalDataProperty: plant_code, ValueListProperty: 'plant_code' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
    ]
  };
  purpose     @Common.ValueList: {
    CollectionPath: 'VisitPurposes',
    Parameters: [
      { $Type: 'Common.ValueListParameterInOut',  LocalDataProperty: purpose_code,  ValueListProperty: 'code' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
    ]
  };
  idProofType @Common.ValueList: {
    CollectionPath: 'IdProofTypes',
    Parameters: [
      { $Type: 'Common.ValueListParameterInOut',  LocalDataProperty: idProofType_code,  ValueListProperty: 'code' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
    ]
  };
  host        @Common.ValueList: {
    CollectionPath: 'Employees',
    Parameters: [
      { $Type: 'Common.ValueListParameterInOut',  LocalDataProperty: host_ID,  ValueListProperty: 'ID' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'empNo' }
    ]
  };
  status      @Common.ValueList: {
    CollectionPath: 'PassStatus',
    Parameters: [
      { $Type: 'Common.ValueListParameterInOut',  LocalDataProperty: status_code,  ValueListProperty: 'code' },
      { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
    ]
  };
};

// ── Field Labels ────────────────────────────────────────────────────

annotate GatePassService.VisitorPasses with {
  passNo             @title: 'Pass Number';
  host               @title: 'Host';
  plant              @title: 'Plant';
  area               @title: 'Visit Area';
  purpose            @title: 'Purpose';
  purposeDetail      @title: 'Purpose Detail';
  visitorName        @title: 'Visitor Name';
  visitorCompany     @title: 'Visitor Company';
  visitorMobile      @title: 'Visitor Mobile';
  idProofType        @title: 'ID Proof Type';
  idProofNumber      @title: 'ID Proof Number';
  visitDate          @title: 'Visit Date';
  validFrom          @title: 'Valid From';
  validTo            @title: 'Valid To';
  inductionRef       @title: 'Induction Reference';
  inductionValidTill @title: 'Induction Valid Till';
  vehicleNo          @title: 'Vehicle Number';
  status             @title: 'Status';
  badgeNo            @title: 'Badge Number';
  actualInAt         @title: 'Arrival Time';
  actualOutAt        @title: 'Departure Time';
  durationMinutes    @title: 'Duration (min)';
  isOverstay         @title: 'Overstay';
  rejectionReason    @title: 'Rejection Reason';
};

annotate GatePassService.PassItems with {
  itemNo         @title: 'Item No';
  description    @title: 'Description';
  serialNo       @title: 'Serial Number';
  quantity       @title: 'Quantity';
  isReturnable   @title: 'Returnable';
  returnedAtExit @title: 'Returned';
  exitRemark     @title: 'Exit Remark';
};

annotate GatePassService.PassEvents with {
  seq        @title: 'Seq';
  fromStatus @title: 'From';
  toStatus   @title: 'To';
  action     @title: 'Action';
  actor      @title: 'Actor';
  actedAt    @title: 'Acted At';
  remark     @title: 'Remark';
};

// ── List Report Columns ─────────────────────────────────────────────

annotate GatePassService.VisitorPasses with @UI: {
  HeaderInfo: {
    TypeName:       'Visitor Pass',
    TypeNamePlural: 'Visitor Passes',
    Title:          { Value: passNo },
    Description:    { Value: visitorName }
  },
  SelectionFields: [ status_code, plant_code, visitDate, visitorName, visitorMobile ],
  LineItem: [
    { Value: passNo,         Label: 'Pass No' },
    { Value: visitorName,    Label: 'Visitor' },
    { Value: visitorCompany, Label: 'Company' },
    { Value: plant_code,     Label: 'Plant' },
    { Value: area_code,      Label: 'Area' },
    { Value: visitDate,      Label: 'Visit Date' },
    { Value: validFrom,      Label: 'From' },
    { Value: validTo,        Label: 'To' },
    { Value: status_code,    Label: 'Status', Criticality: status.criticality }
  ],
  Facets: [
    { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#Visit',    Label: 'Visit Details' },
    { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#Visitor',  Label: 'Visitor Details' },
    { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#Gate',     Label: 'Gate Details' },
    { $Type: 'UI.ReferenceFacet', Target: 'items/@UI.LineItem',      Label: 'Items Carried' },
    { $Type: 'UI.ReferenceFacet', Target: 'events/@UI.LineItem',     Label: 'Event History' }
  ],
  FieldGroup #Visit: {
    Data: [
      { Value: passNo },
      { Value: host_ID },
      { Value: plant_code },
      { Value: area_code },
      { Value: purpose_code },
      { Value: purposeDetail },
      { Value: visitDate },
      { Value: validFrom },
      { Value: validTo },
      { Value: vehicleNo }
    ]
  },
  FieldGroup #Visitor: {
    Data: [
      { Value: visitorName },
      { Value: visitorCompany },
      { Value: visitorMobile },
      { Value: idProofType_code },
      { Value: idProofNumber },
      { Value: inductionRef },
      { Value: inductionValidTill }
    ]
  },
  FieldGroup #Gate: {
    Data: [
      { Value: status_code, Criticality: status.criticality },
      { Value: badgeNo },
      { Value: actualInAt },
      { Value: actualOutAt },
      { Value: durationMinutes },
      { Value: isOverstay },
      { Value: rejectionReason }
    ]
  }
};

annotate GatePassService.PassItems with @UI: {
  LineItem: [
    { Value: itemNo },
    { Value: description },
    { Value: serialNo },
    { Value: quantity },
    { Value: isReturnable },
    { Value: returnedAtExit },
    { Value: exitRemark }
  ]
};

annotate GatePassService.PassEvents with @UI: {
  LineItem: [
    { Value: seq },
    { Value: action },
    { Value: fromStatus },
    { Value: toStatus },
    { Value: actor },
    { Value: actedAt },
    { Value: remark }
  ]
};
