using GatePassService from '../../srv/gatepass-service';
using from '../common';

// ════════════════════════════════════════════════════════════════════
//  S2: APPROVAL WORKLIST (Section 10)
//
//  "Only REQUESTED passes for that plant, oldest first, with an ageing
//  column.  Approve and Reject; Reject opens a dialog demanding the
//  reason."
//
//  The plant restriction and the "REQUESTED only" filter are the
//  @restrict where-clause and the SelectionVariant below; a supervisor
//  who tries another plant's URL gets nothing back regardless of what
//  this screen shows (Section 9, TC-09).  Reject takes a mandatory
//  parameter, so Fiori Elements renders the confirmation as a dialog
//  automatically — no custom controller code needed for that.
// ════════════════════════════════════════════════════════════════════

annotate GatePassService.VisitorPasses with @(
    UI: {
        SelectionFields #Approvals: [ plant_code, visitDate ],

        // The worklist itself: REQUESTED only, oldest first.
        SelectionPresentationVariant #PendingApproval: {
            Text: '{i18n>PendingApproval}',
            SelectionVariant: {
                SelectOptions: [
                    { $Type: 'UI.SelectOptionType', PropertyName: status_code, Ranges: [ { Sign: #I, Option: #EQ, Low: 'REQUESTED' } ] }
                ]
            },
            PresentationVariant: {
                SortOrder: [ { Property: createdAt, Descending: false } ],
                Visualizations: [ '@UI.LineItem#Approvals' ]
            }
        },

        LineItem #Approvals: [
            { $Type: 'UI.DataField', Value: passNo },
            { $Type: 'UI.DataField', Value: visitorName },
            { $Type: 'UI.DataField', Value: visitorCompany },
            { $Type: 'UI.DataField', Value: area_code },
            { $Type: 'UI.DataField', Value: visitDate },
            { $Type: 'UI.DataField', Value: validFrom },
            { $Type: 'UI.DataField', Value: validTo },
            {
                $Type: 'UI.DataField',
                Value: ageingDays,
                Label: '{i18n>AgeingDays}',
                Criticality: #Critical,
                CriticalityRepresentation: #WithoutIcon
            },
            {
                $Type: 'UI.DataField',
                Value: status_code,
                Criticality: status.criticality
            },
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'GatePassService.approve',
                Label: '{i18n>Approve}',
                Inline: true,
                ![@UI.Hidden]: { $edmJson: { $ne: [ { $Path: 'status_code' }, 'REQUESTED' ] } }
            },
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'GatePassService.rejectPass',
                Label: '{i18n>Reject}',
                Inline: true,
                ![@UI.Hidden]: { $edmJson: { $ne: [ { $Path: 'status_code' }, 'REQUESTED' ] } }
            }
        ],

        // ── Object page: read-only review of the request ──
        HeaderFacets #Approvals: [
            { $Type: 'UI.ReferenceFacet', Target: '@UI.DataPoint#Status' }
        ],

        Identification #Approvals: [
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'GatePassService.approve',
                Label: '{i18n>Approve}',
                ![@UI.Hidden]: { $edmJson: { $ne: [ { $Path: 'status_code' }, 'REQUESTED' ] } }
            },
            {
                $Type: 'UI.DataFieldForAction',
                Action: 'GatePassService.rejectPass',
                Label: '{i18n>Reject}',
                ![@UI.Hidden]: { $edmJson: { $ne: [ { $Path: 'status_code' }, 'REQUESTED' ] } }
            }
        ],

        Facets #Approvals: [
            {
                $Type: 'UI.ReferenceFacet',
                Target: '@UI.FieldGroup#RequestDetails',
                Label: '{i18n>VisitDetails}'
            },
            {
                $Type: 'UI.ReferenceFacet',
                Target: '@UI.FieldGroup#VisitorDetails',
                Label: '{i18n>VisitorIdentity}'
            },
            {
                $Type: 'UI.ReferenceFacet',
                Target: 'items/@UI.LineItem',
                Label: '{i18n>CarryingItems}'
            },
            {
                $Type: 'UI.ReferenceFacet',
                Target: 'events/@UI.LineItem',
                Label: '{i18n>AuditTrail}'
            }
        ],

        FieldGroup #RequestDetails: {
            Data: [
                { $Type: 'UI.DataField', Value: passNo },
                { $Type: 'UI.DataField', Value: host_ID },
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

        FieldGroup #VisitorDetails: {
            Data: [
                { $Type: 'UI.DataField', Value: visitorName },
                { $Type: 'UI.DataField', Value: visitorCompany },
                { $Type: 'UI.DataField', Value: visitorMobile },
                { $Type: 'UI.DataField', Value: idProofType_code },
                { $Type: 'UI.DataField', Value: idProofNumber },
                { $Type: 'UI.DataField', Value: vehicleNo }
            ]
        }
    }
);
