using GatePassService from '../../srv/gatepass-service';
using from '../common';

// ════════════════════════════════════════════════════════════════════
//  REPORTS  R1 On Site Now, R2 Overstay  (Section 10)
//
//  R3 Visitor Footfall is the aggregated GatePassService.VisitorFootfall
//  entity — a genuine count/average by plant, area, purpose and month,
//  not a flat list — and lives in its own small app (app/footfall),
//  since a Fiori Elements List Report is bound to one entity set and
//  VisitorFootfall is a different one from VisitorPasses.
// ════════════════════════════════════════════════════════════════════

annotate GatePassService.VisitorPasses with @(
    UI: {
        SelectionFields #Reports: [ plant_code, area_code, visitDate ],

        // ── R1: On Site Now — the muster list.  "Every ON_SITE pass
        //    grouped by plant and area: visitor, company, host, host
        //    mobile, badge, time in, minutes inside.  This report is
        //    the business case." ──
        LineItem #OnSiteNow: [
            { $Type: 'UI.DataField', Value: plant_code },
            { $Type: 'UI.DataField', Value: area_code },
            { $Type: 'UI.DataField', Value: visitorName },
            { $Type: 'UI.DataField', Value: visitorCompany },
            { $Type: 'UI.DataField', Value: host_ID },
            { $Type: 'UI.DataField', Value: badgeNo },
            { $Type: 'UI.DataField', Value: actualInAt },
            { $Type: 'UI.DataField', Value: durationMinutes }
        ],
        SelectionPresentationVariant #OnSiteNow: {
            Text: '{i18n>OnSiteNow}',
            SelectionVariant: {
                SelectOptions: [
                    { $Type: 'UI.SelectOptionType', PropertyName: status_code, Ranges: [ { Sign: #I, Option: #EQ, Low: 'ON_SITE' } ] }
                ]
            },
            PresentationVariant: {
                SortOrder: [
                    { Property: plant_code, Descending: false },
                    { Property: area_code, Descending: false },
                    { Property: actualInAt, Descending: false }
                ],
                Visualizations: [ '@UI.LineItem#OnSiteNow' ]
            }
        },

        // ── R2: Overstay — "ON_SITE passes past validTo, longest over
        //    first.  Also the output of the day-end job." ──
        LineItem #Overstay: [
            { $Type: 'UI.DataField', Value: plant_code },
            { $Type: 'UI.DataField', Value: area_code },
            { $Type: 'UI.DataField', Value: visitorName },
            { $Type: 'UI.DataField', Value: host_ID },
            { $Type: 'UI.DataField', Value: badgeNo },
            { $Type: 'UI.DataField', Value: validTo },
            { $Type: 'UI.DataField', Value: actualInAt },
            {
                $Type: 'UI.DataField',
                Value: isOverstay,
                Criticality: #Negative,
                CriticalityRepresentation: #WithoutIcon
            }
        ],
        SelectionPresentationVariant #Overstay: {
            Text: '{i18n>OverstayReport}',
            SelectionVariant: {
                SelectOptions: [
                    { $Type: 'UI.SelectOptionType', PropertyName: status_code, Ranges: [ { Sign: #I, Option: #EQ, Low: 'ON_SITE' } ] },
                    { $Type: 'UI.SelectOptionType', PropertyName: isOverstay,  Ranges: [ { Sign: #I, Option: #EQ, Low: true } ] }
                ]
            },
            PresentationVariant: {
                SortOrder: [ { Property: actualInAt, Descending: false } ],  // earliest arrival = longest overstay
                Visualizations: [ '@UI.LineItem#Overstay' ]
            }
        }
    }
);
