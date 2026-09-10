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

        // Importance ranks which columns a ResponsiveTable may drop first
        // as the viewport narrows — Check In/Out and Status are pinned
        // High so a guard on a smaller screen never loses the one button
        // they came here to press.
        LineItem #GateConsole: [
            { $Type: 'UI.DataField', Value: passNo, ![@UI.Importance]: #High, ![@HTML5.CssDefaults]: { width: '11rem' } },
            { $Type: 'UI.DataField', Value: visitorName, ![@UI.Importance]: #High, ![@HTML5.CssDefaults]: { width: '12rem' } },
            { $Type: 'UI.DataField', Value: visitorCompany, ![@UI.Importance]: #Low, ![@HTML5.CssDefaults]: { width: '12rem' } },
            { $Type: 'UI.DataField', Value: validFrom, ![@UI.Importance]: #Medium, ![@HTML5.CssDefaults]: { width: '7rem' } },
            { $Type: 'UI.DataField', Value: validTo, ![@UI.Importance]: #Low, ![@HTML5.CssDefaults]: { width: '7rem' } },
            { $Type: 'UI.DataField', Value: badgeNo, ![@UI.Importance]: #Medium, ![@HTML5.CssDefaults]: { width: '7.5rem' } },
            {
                $Type: 'UI.DataField',
                Value: status_code,
                Criticality: status.criticality,
                ![@UI.Importance]: #High,
                ![@HTML5.CssDefaults]: { width: '9.5rem' }
            },
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'GatePassService.checkIn',
                Label: '{i18n>CheckIn}',
                Inline: true,
                ![@UI.Importance]: #High,
                ![@UI.Hidden]: {$edmJson: {$Ne: [{$Path: 'status_code'}, 'APPROVED']}}
            },
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'GatePassService.checkOut',
                Label: '{i18n>CheckOut}',
                Inline: true,
                ![@UI.Importance]: #High,
                ![@UI.Hidden]: {$edmJson: {$Ne: [{$Path: 'status_code'}, 'ON_SITE']}}
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
