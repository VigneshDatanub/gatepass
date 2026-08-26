using GatePassService from '../../srv/gatepass-service';
using from '../common';

// ════════════════════════════════════════════════════════════════════
//  REPORTS (R1, R2, R3)
// ════════════════════════════════════════════════════════════════════

annotate GatePassService.VisitorPasses with @(
    UI: {
        // R1: On Site Now
        SelectionVariant #OnSiteNow: {
            Text: '{i18n>OnSiteNow}',
            SelectOptions: [
                {
                    $Type: 'UI.SelectOptionType',
                    PropertyName: status_code,
                    Ranges: [{ Sign: #I, Option: #EQ, Low: 'ON_SITE' }]
                }
            ]
        },

        // R2: Overstay Report
        SelectionVariant #Overstay: {
            Text: '{i18n>OverstayReport}',
            SelectOptions: [
                {
                    $Type: 'UI.SelectOptionType',
                    PropertyName: isOverstay,
                    Ranges: [{ Sign: #I, Option: #EQ, Low: true }]
                }
            ]
        },

        // R3: Daily Footfall
        // A generic view sorted by Visit Date and Time for auditing.
        PresentationVariant #DailyFootfall: {
            Text: '{i18n>DailyFootfall}',
            SortOrder: [
                { Property: visitDate, Descending: true },
                { Property: actualInAt, Descending: true }
            ],
            Visualizations: ['@UI.LineItem#DailyFootfall']
        },

        // Line Item Layout for Reports
        LineItem #DailyFootfall: [
            { $Type: 'UI.DataField', Value: visitDate },
            { $Type: 'UI.DataField', Value: passNo },
            { $Type: 'UI.DataField', Value: visitorName },
            { $Type: 'UI.DataField', Value: plant_code },
            { $Type: 'UI.DataField', Value: actualInAt },
            { $Type: 'UI.DataField', Value: actualOutAt },
            { $Type: 'UI.DataField', Value: durationMinutes },
            {
                $Type: 'UI.DataField',
                Value: isOverstay
            }
        ]
    }
);
