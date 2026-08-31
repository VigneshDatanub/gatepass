using GatePassService from '../../srv/gatepass-service';
using from '../common';

// ════════════════════════════════════════════════════════════════════
//  ADMIN CONSOLE — Master & Configuration Data (Section 3, Section 6.4)
//
//  "Administrator ... Maintains master and configuration data, runs the
//  day-end job."  Section 10 never names a screen for this, but the
//  persona's actual job needs one — Plants, Employees and VisitAreas
//  each get a plain List Report + Object Page here.  Create/Update are
//  already restricted to Admin server-side (srv/gatepass-service.cds);
//  Delete is annotated off entirely (Capabilities.DeleteRestrictions)
//  since deactivation, never hard delete, is the only way out (Section 9).
//
//  None of these three needs @odata.draft.enabled — master data is
//  maintained directly, not pre-registered and submitted like a pass.
// ════════════════════════════════════════════════════════════════════

// ── Plants ───────────────────────────────────────────────────────────

annotate GatePassService.Plants with {
    code          @title: '{i18n>PlantCode}' @Core.Immutable;
    name          @title: '{i18n>PlantName}';
    city          @title: '{i18n>City}';
    gateOpenTime  @title: '{i18n>GateOpenTime}';
    gateCloseTime @title: '{i18n>GateCloseTime}';
    isActive      @title: '{i18n>IsActive}';
};

annotate GatePassService.Plants with @(
    UI: {
        HeaderInfo: {
            TypeName: '{i18n>Plant}',
            TypeNamePlural: '{i18n>Plants}',
            Title: { Value: name },
            Description: { Value: code }
        },
        SelectionFields: [ isActive ],
        LineItem: [
            { $Type: 'UI.DataField', Value: code },
            { $Type: 'UI.DataField', Value: name },
            { $Type: 'UI.DataField', Value: city },
            { $Type: 'UI.DataField', Value: gateOpenTime },
            { $Type: 'UI.DataField', Value: gateCloseTime },
            { $Type: 'UI.DataField', Value: isActive }
        ],
        Facets: [
            { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#General', Label: '{i18n>General}' }
        ],
        FieldGroup #General: {
            Data: [
                { $Type: 'UI.DataField', Value: code },
                { $Type: 'UI.DataField', Value: name },
                { $Type: 'UI.DataField', Value: city },
                { $Type: 'UI.DataField', Value: gateOpenTime },
                { $Type: 'UI.DataField', Value: gateCloseTime },
                { $Type: 'UI.DataField', Value: isActive }
            ]
        }
    }
);

// ── Employees ────────────────────────────────────────────────────────

annotate GatePassService.Employees with {
    empNo        @title: '{i18n>EmpNo}';
    name         @title: '{i18n>EmployeeName}';
    email        @title: '{i18n>Email}';
    department   @title: '{i18n>Department}';
    defaultPlant @title: '{i18n>DefaultPlant}';
    isActive     @title: '{i18n>IsActive}';
};

annotate GatePassService.Employees with @(
    UI: {
        HeaderInfo: {
            TypeName: '{i18n>Employee}',
            TypeNamePlural: '{i18n>Employees}',
            Title: { Value: name },
            Description: { Value: empNo }
        },
        SelectionFields: [ isActive, defaultPlant_code ],
        LineItem: [
            { $Type: 'UI.DataField', Value: empNo },
            { $Type: 'UI.DataField', Value: name },
            { $Type: 'UI.DataField', Value: email },
            { $Type: 'UI.DataField', Value: department },
            { $Type: 'UI.DataField', Value: defaultPlant_code },
            { $Type: 'UI.DataField', Value: isActive }
        ],
        Facets: [
            { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#General', Label: '{i18n>General}' }
        ],
        FieldGroup #General: {
            Data: [
                { $Type: 'UI.DataField', Value: empNo },
                { $Type: 'UI.DataField', Value: name },
                { $Type: 'UI.DataField', Value: email },
                { $Type: 'UI.DataField', Value: department },
                { $Type: 'UI.DataField', Value: defaultPlant_code },
                { $Type: 'UI.DataField', Value: isActive }
            ]
        }
    }
);

annotate GatePassService.Employees with {
    defaultPlant @(Common: {
        ValueList: {
            CollectionPath: 'Plants',
            Parameters: [
                { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: defaultPlant_code, ValueListProperty: 'code' },
                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
            ]
        }
    });
};

// ── VisitAreas ───────────────────────────────────────────────────────

annotate GatePassService.VisitAreas with {
    code              @title: '{i18n>AreaCode}' @Core.Immutable;
    plant             @title: '{i18n>Plant}' @Core.Immutable;
    name              @title: '{i18n>AreaName}';
    requiresApproval  @title: '{i18n>RequiresApproval}';
    requiresInduction @title: '{i18n>RequiresInduction}';
    maxVisitorsOnSite @title: '{i18n>MaxVisitorsOnSite}';
    isActive          @title: '{i18n>IsActive}';
};

annotate GatePassService.VisitAreas with @(
    UI: {
        HeaderInfo: {
            TypeName: '{i18n>VisitArea}',
            TypeNamePlural: '{i18n>VisitAreas}',
            Title: { Value: name },
            Description: { Value: code }
        },
        SelectionFields: [ plant_code, isActive ],
        LineItem: [
            { $Type: 'UI.DataField', Value: plant_code },
            { $Type: 'UI.DataField', Value: code },
            { $Type: 'UI.DataField', Value: name },
            { $Type: 'UI.DataField', Value: requiresApproval },
            { $Type: 'UI.DataField', Value: requiresInduction },
            { $Type: 'UI.DataField', Value: maxVisitorsOnSite },
            { $Type: 'UI.DataField', Value: isActive }
        ],
        Facets: [
            { $Type: 'UI.ReferenceFacet', Target: '@UI.FieldGroup#General', Label: '{i18n>General}' }
        ],
        FieldGroup #General: {
            Data: [
                { $Type: 'UI.DataField', Value: plant_code },
                { $Type: 'UI.DataField', Value: code },
                { $Type: 'UI.DataField', Value: name },
                { $Type: 'UI.DataField', Value: requiresApproval },
                { $Type: 'UI.DataField', Value: requiresInduction },
                { $Type: 'UI.DataField', Value: maxVisitorsOnSite },
                { $Type: 'UI.DataField', Value: isActive }
            ]
        }
    }
);

annotate GatePassService.VisitAreas with {
    plant @(Common: {
        ValueList: {
            CollectionPath: 'Plants',
            Parameters: [
                { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: plant_code, ValueListProperty: 'code' },
                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
            ]
        }
    });
};
