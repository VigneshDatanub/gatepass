using GatePassService from '../../srv/gatepass-service';
using from '../common';

// ════════════════════════════════════════════════════════════════════
//  S3: GATE CONSOLE (Optimized for Security Guards)
// ════════════════════════════════════════════════════════════════════

annotate GatePassService.VisitorPasses with @(
    UI: {
        // ── List Report ──
        SelectionFields #GateConsole: [ passNo, visitDate, status_code ],

        // Tab 1: APPROVED passes waiting to arrive.  Tab 2: everyone
        // currently inside.  Section 10: "a guard with a queue does not
        // pick a filter field first" — these are the two states the
        // gate actually cares about; the free-text search below (bound
        // via @cds.search in the .cds) covers "find this one visitor"
        // inside either tab.
        SelectionPresentationVariant #ExpectedToday: {
            Text: '{i18n>ExpectedToday}',
            SelectionVariant: {
                SelectOptions: [
                    { $Type: 'UI.SelectOptionType', PropertyName: status_code, Ranges: [ { Sign: #I, Option: #EQ, Low: 'APPROVED' } ] }
                ]
            },
            PresentationVariant: {
                SortOrder: [ { Property: validFrom, Descending: false } ],
                Visualizations: [ '@UI.LineItem#GateConsole' ]
            }
        },

        SelectionPresentationVariant #OnSiteGate: {
            Text: '{i18n>OnSiteNow}',
            SelectionVariant: {
                SelectOptions: [
                    { $Type: 'UI.SelectOptionType', PropertyName: status_code, Ranges: [ { Sign: #I, Option: #EQ, Low: 'ON_SITE' } ] }
                ]
            },
            PresentationVariant: {
                SortOrder: [ { Property: actualInAt, Descending: false } ],
                Visualizations: [ '@UI.LineItem#GateConsole' ]
            }
        },

        LineItem #GateConsole: [
            { $Type: 'UI.DataField', Value: passNo },
            { $Type: 'UI.DataField', Value: visitorName },
            { $Type: 'UI.DataField', Value: visitorCompany },
            { $Type: 'UI.DataField', Value: validFrom },
            { $Type: 'UI.DataField', Value: validTo },
            { $Type: 'UI.DataField', Value: badgeNo },
            {
                $Type: 'UI.DataField',
                Value: status_code,
                Criticality: status.criticality
            },
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'GatePassService.checkIn',
                Label: '{i18n>CheckIn}',
                Inline: true,
                ![@UI.Hidden]: {$edmJson: {$ne: [{$Path: 'status_code'}, 'APPROVED']}}
            },
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'GatePassService.checkOut',
                Label: '{i18n>CheckOut}',
                Inline: true,
                ![@UI.Hidden]: {$edmJson: {$ne: [{$Path: 'status_code'}, 'ON_SITE']}}
            }
        ],

        // ── Object Page (Gate Console Variant) ──
        HeaderFacets #GateConsole: [
            {
                $Type: 'UI.ReferenceFacet',
                Target: '@UI.DataPoint#Status'
            },
            {
                $Type: 'UI.ReferenceFacet',
                Target: '@UI.DataPoint#BadgeNo'
            }
        ],

        DataPoint #BadgeNo: {
            Value: badgeNo,
            Title: '{i18n>BadgeNo}'
        },

        Facets #GateConsole: [
            {
                $Type: 'UI.ReferenceFacet',
                Target: '@UI.FieldGroup#IdentityCheck',
                Label: '{i18n>IdentityCheck}'
            },
            {
                $Type: 'UI.ReferenceFacet',
                Target: 'items/@UI.LineItem',
                Label: '{i18n>CarryingItems}'
            }
        ],

        FieldGroup #IdentityCheck: {
            Data: [
                { $Type: 'UI.DataField', Value: visitorName },
                { $Type: 'UI.DataField', Value: visitorCompany },
                { $Type: 'UI.DataField', Value: idProofType_code },
                { $Type: 'UI.DataField', Value: idProofNumber },
                { $Type: 'UI.DataField', Value: vehicleNo }
            ]
        }
    }
);
