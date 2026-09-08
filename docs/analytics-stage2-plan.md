# CompassU Advanced Institutional Analytics — Stage 2

## Objective
Extend the validated institutional analytics release with filterable and comparative institutional intelligence while preserving aggregate privacy safeguards and the existing recommendation engine.

## Delivery sequence
1. Reporting-period controls and date-range filtering.
2. Cohort-ready data model and filters only for fields CompassU actually captures.
3. Comparative institution analytics for master administrators.
4. Trend reporting as sufficient historical data accumulates.
5. Executive institutional insights and report enhancements.
6. District/system rollups after customer hierarchy and permissions are implemented.

## Stage 2A — Reporting period
The first implementation target is a date-range filter based on the completion date of each student's latest completed assessment. The server-side analytics RPC will accept optional start and end dates and apply them before aggregate calculations. The administrator dashboard and PDF report will display the selected reporting period.

### Privacy and scoring constraints
- Continue using each student's latest completed assessment only.
- Continue small-cell suppression (current threshold: fewer than 5 students).
- Do not expose student-level PII in institutional analytics or exports.
- Do not alter `finalize_assessment`, `score_assessment`, recommendation weights, major rankings, or career mappings.
- Do not invent cohort attributes that are not captured in the current schema.

## Later Stage 2 capabilities
- Institution-to-institution comparison for authorized master administrators.
- Academic-year and year-over-year trend views when the dataset supports meaningful comparison.
- Customer/district/system rollups after stable customer and institution identifiers are introduced.
- Executive insights that summarize observable aggregate patterns without overstating causality.
