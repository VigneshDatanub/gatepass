using GatePassService from '../../srv/gatepass-service';
using from '../common';

// ════════════════════════════════════════════════════════════════════
//  S1: LIST REPORT (My Passes)
// ════════════════════════════════════════════════════════════════════

annotate GatePassService.VisitorPasses with @(
    UI: {
        HeaderInfo: {
            TypeName: 'Visitor Pass',
            TypeNamePlural: 'Visitor Passes',
            Title: { $Type: 'UI.DataField', Value: passNo },
            Description: { $Type: 'UI.DataField', Value: visitorName }
        },
        
        SelectionFields: [ passNo, status_code, visitDate, visitorName ],

        LineItem: [
            { $Type: 'UI.DataField', Value: passNo },
            { $Type: 'UI.DataField', Value: visitorName },
            { $Type: 'UI.DataField', Value: visitorCompany },
            { $Type: 'UI.DataField', Value: visitDate },
            { $Type: 'UI.DataField', Value: validFrom },
            {
                $Type: 'UI.DataField',
                Value: status_code,
                Criticality: status.criticality
            }
        ]
    }
);

// ════════════════════════════════════════════════════════════════════
//  S2: OBJECT PAGE (My Passes)
// ════════════════════════════════════════════════════════════════════

annotate GatePassService.VisitorPasses with @(
    UI: {
        // ── Actions (Header level) ──
        Identification: [
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'GatePassService.submit',
                Label: '{i18n>Submit}',
                // Only show submit when in DRAFT
                ![@UI.Hidden]: {$edmJson: {$Ne: [{$Path: 'status_code'}, 'DRAFT']}}
            },
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'GatePassService.cancel',
                Label: '{i18n>Cancel}',
                // Cancel allowed in DRAFT, REQUESTED, APPROVED
                ![@UI.Hidden]: {$edmJson: {$Not: {$In: [{$Path: 'status_code'}, ['DRAFT', 'REQUESTED', 'APPROVED']]}}}
            },
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'GatePassService.copy',
                Label: '{i18n>Copy}'
            }
        ],

        // ── Header Facets ──
        HeaderFacets: [
            {
                $Type: 'UI.ReferenceFacet',
                Target: '@UI.DataPoint#Status'
            },
            {
                $Type: 'UI.ReferenceFacet',
                Target: '@UI.DataPoint#VisitDate'
            }
        ],

        DataPoint #Status: {
            Value: status_code,
            Title: '{i18n>Status}',
            Criticality: status.criticality
        },
        DataPoint #VisitDate: {
            Value: visitDate,
            Title: '{i18n>VisitDate}'
        },

        // ── Body Facets ──
        Facets: [
            {
                $Type: 'UI.CollectionFacet',
                ID: 'VisitDetailsCollection',
                Label: '{i18n>VisitDetails}',
                Facets: [
                    {
                        $Type: 'UI.ReferenceFacet',
                        Target: '@UI.FieldGroup#VisitInfo',
                        Label: '{i18n>General}'
                    },
                    {
                        $Type: 'UI.ReferenceFacet',
                        Target: '@UI.FieldGroup#IdentityInfo',
                        Label: '{i18n>VisitorIdentity}'
                    }
                ]
            },
            {
                $Type: 'UI.ReferenceFacet',
                Target: 'items/@UI.LineItem',
                Label: '{i18n>CarryingItems}'
            },
            {
                $Type: 'UI.ReferenceFacet',
                Target: '@UI.FieldGroup#GateLog',
                Label: '{i18n>GateLog}'
            },
            {
                $Type: 'UI.ReferenceFacet',
                Target: 'events/@UI.LineItem',
                Label: '{i18n>AuditTrail}'
            }
        ],

        FieldGroup #VisitInfo: {
            Data: [
                { $Type: 'UI.DataField', Value: plant_code },
                { $Type: 'UI.DataField', Value: area_code },
                { $Type: 'UI.DataField', Value: purpose_code },
                { $Type: 'UI.DataField', Value: purposeDetail },
                { $Type: 'UI.DataField', Value: visitDate },
                { $Type: 'UI.DataField', Value: validFrom },
                { $Type: 'UI.DataField', Value: validTo },
                { $Type: 'UI.DataField', Value: inductionRef },
                { $Type: 'UI.DataField', Value: inductionValidTill }
            ]
        },

        FieldGroup #IdentityInfo: {
            Data: [
                { $Type: 'UI.DataField', Value: visitorName },
                { $Type: 'UI.DataField', Value: visitorCompany },
                { $Type: 'UI.DataField', Value: visitorMobile },
                { $Type: 'UI.DataField', Value: idProofType_code },
                { $Type: 'UI.DataField', Value: idProofNumber },
                { $Type: 'UI.DataField', Value: vehicleNo }
            ]
        },

        FieldGroup #GateLog: {
            Data: [
                { $Type: 'UI.DataField', Value: badgeNo },
                { $Type: 'UI.DataField', Value: actualInAt },
                { $Type: 'UI.DataField', Value: actualOutAt },
                { $Type: 'UI.DataField', Value: durationMinutes },
                { $Type: 'UI.DataField', Value: isOverstay },
                { $Type: 'UI.DataField', Value: rejectionReason }
            ]
        }
    }
);

// ── PassItems Line Item ──
annotate GatePassService.PassItems with @(
    UI: {
        LineItem: [
            { $Type: 'UI.DataField', Value: itemNo, ![@HTML5.CssDefaults]: { width: '5rem' } },
            { $Type: 'UI.DataField', Value: description, ![@HTML5.CssDefaults]: { width: '14rem' } },
            { $Type: 'UI.DataField', Value: serialNo, ![@HTML5.CssDefaults]: { width: '10rem' } },
            { $Type: 'UI.DataField', Value: quantity, ![@HTML5.CssDefaults]: { width: '6rem' } },
            { $Type: 'UI.DataField', Value: isReturnable, ![@HTML5.CssDefaults]: { width: '7rem' } },
            { $Type: 'UI.DataField', Value: returnedAtExit, ![@HTML5.CssDefaults]: { width: '7rem' } },
            { $Type: 'UI.DataField', Value: exitRemark, ![@HTML5.CssDefaults]: { width: '12rem' } },
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'GatePassService.confirmReturn',
                Label: '{i18n>ConfirmReturn}',
                Inline: true
            }
        ]
    }
);

// ── PassEvents Line Item ──
annotate GatePassService.PassEvents with @(
    UI: {
        LineItem: [
            { $Type: 'UI.DataField', Value: actedAt, ![@HTML5.CssDefaults]: { width: '11rem' } },
            { $Type: 'UI.DataField', Value: action, ![@HTML5.CssDefaults]: { width: '8rem' } },
            { $Type: 'UI.DataField', Value: actor, ![@HTML5.CssDefaults]: { width: '10rem' } },
            { $Type: 'UI.DataField', Value: fromStatus, ![@HTML5.CssDefaults]: { width: '8rem' } },
            { $Type: 'UI.DataField', Value: toStatus, ![@HTML5.CssDefaults]: { width: '8rem' } },
            { $Type: 'UI.DataField', Value: remark, ![@HTML5.CssDefaults]: { width: '14rem' } }
        ],
        PresentationVariant: {
            SortOrder: [ { Property: seq, Descending: false } ]
        }
    }
);
