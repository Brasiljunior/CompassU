# CompassU Production Subprocessor Disclosure

**Status:** Verified production-service baseline; counsel review still recommended before contractual publication

CompassU uses the following third-party infrastructure/services to operate the production platform. This list is limited to vendors confirmed to process CompassU production data directly for CompassU.

| Provider / legal entity | Purpose | Expected data categories | Current processing context | DPA / contractual data-protection status |
|---|---|---|---|---|
| Supabase, Inc. | Database, authentication, server/Edge Function infrastructure and related backend services | Account identifiers, authentication data, student/profile data, assessment data, derived recommendations, institution/admin/operational records | CompassU production project is hosted in Supabase region `us-east-1` | Supabase publishes a Data Processing Addendum covering customer data and identifies downstream subprocessors used to provide the service |
| Vercel Inc. | Hosting and delivery of the CompassU web application and server-side web functions | Network/request metadata and application data processed by deployed functions as applicable | CompassU production/preview deployments currently execute in Vercel's `iad1` region unless otherwise configured by the platform | Vercel's current DPA applies to Pro and Enterprise customers and includes subprocessor, security, deletion/return, and international-transfer terms |
| Plus Five Five, Inc. d/b/a Resend | Transactional email delivery | Recipient email, message content such as invitations/results/report delivery, and delivery metadata | Used by CompassU Edge Functions for transactional email delivery | Resend publishes a current DPA and a maintained list of authorized subprocessors |

## Important distinction: CompassU subprocessors vs. vendor subprocessors

The table above identifies vendors CompassU directly engages to process production personal information. Each of those vendors may in turn use its own subprocessors. Those downstream vendor subprocessors are governed by the applicable vendor DPA and subprocessor terms and should not be represented as direct CompassU vendors unless CompassU separately engages them.

For example, a vendor's own subprocessor list may include cloud hosting, monitoring, analytics, support, or artificial-intelligence providers. Their appearance on a vendor's list does not mean CompassU itself sends student information directly to that provider.

## Current application verification

The current CompassU application dependency manifest contains Next.js/React, Supabase, jsPDF, and SheetJS dependencies and does not include a direct OpenAI, Anthropic, advertising, or product-analytics SDK. Production Supabase Edge Functions currently use Resend for transactional email delivery. If a future release adds another service that receives production personal information, this disclosure must be updated before or at deployment.

## Data-location caution

The region values above describe the currently observed CompassU project/deployment locations. They must not be described as an absolute guarantee that all vendor operational metadata, support data, backups, logs, or downstream subprocessor activity remain exclusively in that location. Vendor DPAs and published subprocessor documentation control those broader processing details.

## Change management

CompassU should review this disclosure at least quarterly and whenever a new vendor, SDK, hosting component, analytics service, AI service, email provider, support platform, or other processor is introduced. Institution-specific agreements may provide notice or objection procedures for material new subprocessors.
