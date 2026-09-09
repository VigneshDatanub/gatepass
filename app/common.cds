using nub.gatepass as schema from '../db/schema';
using GatePassService from '../srv/gatepass-service';

// ════════════════════════════════════════════════════════════════════
//  GLOBAL UI ANNOTATIONS (Labels & Field Controls)
// ════════════════════════════════════════════════════════════════════

annotate GatePassService.VisitorPasses with {
    ID                  @UI.Hidden;
    passNo              @title: '{i18n>PassNumber}' @readonly;
    status              @title: '{i18n>Status}' @readonly;
    visitorName         @title: '{i18n>VisitorName}';
    visitorCompany      @title: '{i18n>Company}';
    visitorMobile       @title: '{i18n>Mobile}';
    idProofType         @title: '{i18n>IdProofType}';
    idProofNumber       @title: '{i18n>IdProofNumber}';
    visitDate           @title: '{i18n>VisitDate}';
    validFrom           @title: '{i18n>ValidFrom}';
    validTo             @title: '{i18n>ValidTo}';
    purpose             @title: '{i18n>Purpose}';
    purposeDetail       @title: '{i18n>PurposeDetail}';
    plant               @title: '{i18n>Plant}';
    area                @title: '{i18n>Area}';
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
    description         @title: '{i18n>Description}';
    serialNo            @title: '{i18n>SerialNo}';
    quantity            @title: '{i18n>Quantity}';
    isReturnable        @title: '{i18n>Returnable}';
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
