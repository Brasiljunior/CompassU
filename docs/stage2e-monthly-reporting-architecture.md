# CompassU Stage 2E — Automated Monthly Institutional Reporting

## Product boundary
Stage 2E extends the centralized Master Administrator reporting model. Institutions, districts, counselors, and customers do not receive administrator access. CompassU generates and delivers institution-specific reports on their behalf.

## Monthly reporting package
For each active institutional reporting profile, CompassU will generate the selected reports for the previous completed calendar month:

1. Institutional Analytics PDF
2. Institutional Trends PDF
3. Executive Institutional Insights PDF

Default delivery date: the 5th day of each month. Profiles may use another day from 1–28.

## Reporting period
Automated reporting uses the complete prior calendar month. Example: a delivery on October 5 reports September 1 through September 30.

## Delivery workflow
1. Select active profiles due for delivery.
2. Resolve the previous completed calendar month.
3. Load institutional aggregate analytics for that institution and period.
4. Generate the enabled PDF attachments on the server.
5. Send one institutional reporting email to the configured recipients.
6. Record status in `institution_report_delivery_log` as scheduled, generating, sent, failed, or skipped.
7. Preserve provider message ID and any error message for Master Administrator review.

## Security requirements
- Master Administrator remains the only interactive administrator role.
- Scheduled execution uses server-side secrets only; no secret is exposed through `NEXT_PUBLIC_*` variables.
- Institutional reporting profiles and delivery logs remain protected from student/customer accounts.
- Reports remain aggregate-only and retain the Stage 2 small-cell suppression threshold.
- No names, student email addresses, authentication data, or other student PII are included in automated reports or report-delivery logs.
- The automation must never use customer credentials or delegated tenant roles.

## Email transport
The delivery service will use the existing CompassU transactional-email provider configuration. The application will call the provider from a server route and attach the generated PDF buffers. Provider credentials must remain server-side environment variables.

## Reliability
- A unique institution/reporting-period/attempt key prevents accidental duplicate attempt records.
- Failed runs remain visible and may be retried manually.
- A Master Administrator `Send Now` action will use the same generation/delivery path as the scheduled job.
- Production scheduling will not be enabled until server-side PDF generation, email delivery, duplicate protection, and delivery logging pass the test-environment validation sequence.

## Implementation sequence
- 2E-A: reporting profiles and delivery-log foundation — complete and interface-tested.
- 2E-B: server-side reporting period, report generation, and email-packet preparation — in progress.
- 2E-C: Resend delivery integration and delivery-log lifecycle.
- 2E-D: monthly scheduler, manual resend, failure handling, and end-to-end test.
- Production release only after user approval.
