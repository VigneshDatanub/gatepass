using GatePassService from '../../srv/gatepass-service';
using from '../common';

// ════════════════════════════════════════════════════════════════════
//  R3: VISITOR FOOTFALL (Section 10)
//
//  "Count of passes and average duration by plant, area, purpose and
//  month, over CHECKED_OUT passes."  This is the aggregate
//  GatePassService.VisitorFootfall (srv/gatepass-service.cds) — counted
//  and averaged by the database, not assembled in the browser from a
//  flat list.  List Report only: an aggregate row has no lifecycle to
//  drill into.
// ════════════════════════════════════════════════════════════════════

annotate GatePassService.VisitorFootfall with {
    plant       @title: '{i18n>Plant}';
    area        @title: '{i18n>Area}';
    purpose     @title: '{i18n>Purpose}';
    visitYear   @title: '{i18n>VisitYear}';
    visitMonth  @title: '{i18n>VisitMonth}';
    passCount    @title: '{i18n>PassCount}';
    avgDuration  @title: '{i18n>AvgDuration}';
    totalMinutes @title: '{i18n>TotalMinutes}';
};

annotate GatePassService.VisitorFootfall with @(
    UI: {
        SelectionFields: [ plant, area, purpose, visitYear, visitMonth ],
        LineItem: [
            { $Type: 'UI.DataField', Value: visitYear, ![@HTML5.CssDefaults]: { width: '6rem' } },
            { $Type: 'UI.DataField', Value: visitMonth, ![@HTML5.CssDefaults]: { width: '6rem' } },
            { $Type: 'UI.DataField', Value: plant, ![@HTML5.CssDefaults]: { width: '7rem' } },
            { $Type: 'UI.DataField', Value: area, ![@HTML5.CssDefaults]: { width: '9rem' } },
            { $Type: 'UI.DataField', Value: purpose, ![@HTML5.CssDefaults]: { width: '8rem' } },
            { $Type: 'UI.DataField', Value: passCount, ![@HTML5.CssDefaults]: { width: '7rem' } },
            { $Type: 'UI.DataField', Value: avgDuration, ![@HTML5.CssDefaults]: { width: '8rem' } }
        ],
        PresentationVariant: {
            SortOrder: [
                { Property: visitYear, Descending: true },
                { Property: visitMonth, Descending: true },
                { Property: plant, Descending: false }
            ],
            Visualizations: [ '@UI.LineItem' ]
        }
    }
);
