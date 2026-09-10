using GatePassService from '../srv/gatepass-service';

// ════════════════════════════════════════════════════════════════════
//  GLOBAL UI ANNOTATIONS (Labels & Field Controls)
// ════════════════════════════════════════════════════════════════════

annotate GatePassService.VisitorPasses with {
    ID                  @UI.Hidden;
    passNo              @title: '{i18n>PassNumber}' @readonly;
    status              @title: '{i18n>Status}' @readonly;
    visitorName         @title: '{i18n>VisitorName}' @mandatory @Common.FieldControl: #Mandatory;
    visitorCompany      @title: '{i18n>Company}' @mandatory @Common.FieldControl: #Mandatory;
    visitorMobile       @title: '{i18n>Mobile}' @mandatory @Common.FieldControl: #Mandatory;
    idProofType         @title: '{i18n>IdProofType}' @mandatory @Common.FieldControl: #Mandatory;
    idProofNumber       @title: '{i18n>IdProofNumber}' @mandatory @Common.FieldControl: #Mandatory;
    visitDate           @title: '{i18n>VisitDate}' @mandatory @Common.FieldControl: #Mandatory;
    validFrom           @title: '{i18n>ValidFrom}' @mandatory @Common.FieldControl: #Mandatory;
    validTo             @title: '{i18n>ValidTo}' @mandatory @Common.FieldControl: #Mandatory;
    purpose             @title: '{i18n>Purpose}' @mandatory @Common.FieldControl: #Mandatory;
    purposeDetail       @title: '{i18n>PurposeDetail}';
    plant               @title: '{i18n>Plant}' @mandatory @Common.FieldControl: #Mandatory;
    area                @title: '{i18n>Area}' @mandatory @Common.FieldControl: #Mandatory;
    host                @title: '{i18n>Host}' @readonly;
    inductionRef        @title: '{i18n>InductionRef}';
    inductionValidTill  @title: '{i18n>InductionValidTill}';
    vehicleNo           @title: '{i18n>VehicleNo}';
    badgeNo             @title: '{i18n>BadgeNo}' @readonly;
    actualInAt          @title: '{i18n>ActualIn}' @readonly;
    actualOutAt         @title: '{i18n>ActualOut}' @readonly;
    durationMinutes     @title: '{i18n>DurationMins}' @readonly;
    isOverstay          @title: '{i18n>Overstay}' @readonly;
    rejectionReason     @title: '{i18n>RejectionReason}' @readonly;
};

annotate GatePassService.PassItems with {
    ID                  @UI.Hidden;
    pass                @UI.Hidden;
    itemNo              @title: '{i18n>ItemNo}' @readonly;
    description         @title: '{i18n>Description}' @mandatory @Common.FieldControl: #Mandatory;
    serialNo            @title: '{i18n>SerialNo}';
    quantity            @title: '{i18n>Quantity}' @mandatory @Common.FieldControl: #Mandatory;
    isReturnable        @title: '{i18n>Returnable}' @mandatory @Common.FieldControl: #Mandatory;
    returnedAtExit      @title: '{i18n>Returned}' @readonly;
    exitRemark          @title: '{i18n>ExitRemark}';
};

annotate GatePassService.PassEvents with {
    ID                  @UI.Hidden;
    pass                @UI.Hidden;
    seq                 @title: '{i18n>Sequence}';
    fromStatus          @title: '{i18n>FromStatus}';
    toStatus            @title: '{i18n>ToStatus}';
    action              @title: '{i18n>Action}';
    actor               @title: '{i18n>Actor}';
    actedAt             @title: '{i18n>ActedAt}';
    remark              @title: '{i18n>Remark}';
};

// ════════════════════════════════════════════════════════════════════
//  VALUE HELPS (Dropdowns & F4)
// ════════════════════════════════════════════════════════════════════

annotate GatePassService.VisitorPasses with {
    purpose @(Common: {
        ValueListWithFixedValues,
        ValueList: {
            CollectionPath: 'VisitPurposes',
            Parameters: [ { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: purpose_code, ValueListProperty: 'code' } ]
        }
    });

    idProofType @(Common: {
        ValueListWithFixedValues,
        ValueList: {
            CollectionPath: 'IdProofTypes',
            Parameters: [ { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: idProofType_code, ValueListProperty: 'code' } ]
        }
    });

    plant @(Common: {
        ValueList: {
            CollectionPath: 'Plants',
            Parameters: [
                { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: plant_code, ValueListProperty: 'code' },
                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
            ]
        }
    });

    // VisitAreas has a composite key (code + plant): the ValueListParameterIn
    // below filters the dropdown to the pass's own plant, but filtering alone
    // never writes area_plant_code back onto the pass — that needs its own
    // Out parameter, or the association is left half-keyed after every pick
    // and submit's area lookup (code + plant together) finds nothing.
    area @(Common: {
        ValueList: {
            CollectionPath: 'VisitAreas',
            Parameters: [
                { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: area_code, ValueListProperty: 'code' },
                { $Type: 'Common.ValueListParameterIn', LocalDataProperty: plant_code, ValueListProperty: 'plant_code' },
                { $Type: 'Common.ValueListParameterOut', LocalDataProperty: area_plant_code, ValueListProperty: 'plant_code' },
                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
            ]
        }
    });
};

// ════════════════════════════════════════════════════════════════════
//  TEXT ASSOCIATIONS (Display name instead of code)
// ════════════════════════════════════════════════════════════════════

annotate GatePassService.Plants with {
    code @Common.Text: name @Common.TextArrangement: #TextFirst;
};

annotate GatePassService.VisitAreas with {
    code @Common.Text: name @Common.TextArrangement: #TextFirst;
};

annotate GatePassService.Employees with {
    ID @UI.Hidden @Core.Computed @Common.Text: name @Common.TextArrangement: #TextOnly;
};

annotate GatePassService.VisitPurposes with {
    code @Common.Text: name @Common.TextArrangement: #TextOnly;
};

annotate GatePassService.IdProofTypes with {
    code @Common.Text: name @Common.TextArrangement: #TextOnly;
};

annotate GatePassService.PassStatus with {
    code @Common.Text: name @Common.TextArrangement: #TextOnly;
};

// Apply Employee Text Association to Host field
annotate GatePassService.VisitorPasses with {
    host @Common.Text: host.name @Common.TextArrangement: #TextOnly;
};

// ════════════════════════════════════════════════════════════════════
//  ACTION SIDE EFFECTS (Automatic UI & List Refresh)
// ════════════════════════════════════════════════════════════════════

annotate GatePassService.VisitorPasses with @(
    Common.SideEffects #submit: {
        TriggerAction: 'GatePassService.submit',
        TargetProperties: [ 'status_code', 'passNo' ],
        TargetEntities: [ '', events ]
    },
    Common.SideEffects #approve: {
        TriggerAction: 'GatePassService.approve',
        TargetProperties: [ 'status_code' ],
        TargetEntities: [ '', events ]
    },
    Common.SideEffects #rejectPass: {
        TriggerAction: 'GatePassService.rejectPass',
        TargetProperties: [ 'status_code', 'rejectionReason' ],
        TargetEntities: [ '', events ]
    },
    Common.SideEffects #cancel: {
        TriggerAction: 'GatePassService.cancel',
        TargetProperties: [ 'status_code' ],
        TargetEntities: [ '', events ]
    },
    Common.SideEffects #checkIn: {
        TriggerAction: 'GatePassService.checkIn',
        TargetProperties: [ 'status_code', 'badgeNo', 'actualInAt' ],
        TargetEntities: [ '', events ]
    },
    Common.SideEffects #checkOut: {
        TriggerAction: 'GatePassService.checkOut',
        TargetProperties: [ 'status_code', 'actualOutAt', 'durationMinutes', 'badgeNo' ],
        TargetEntities: [ '', items, events ]
    }
);

annotate GatePassService.PassItems with @(
    Common.SideEffects #confirmReturn: {
        TriggerAction: 'GatePassService.confirmReturn',
        TargetProperties: [ 'returnedAtExit', 'exitRemark' ],
        TargetEntities: [ '' ]
    }
);

