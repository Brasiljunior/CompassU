# CompassU Production Subprocessor Disclosure

**Status:** Draft; production services must be verified before publication

CompassU uses third-party infrastructure/services to operate the platform. Only vendors confirmed to process production CompassU data should appear on the public list.

| Provider | Purpose | Expected data categories | Status |
|---|---|---|---|
| Supabase | Database, authentication, server/Edge Function infrastructure and related backend services | Account identifiers, authentication data, student/profile data, assessment data, derived recommendations, institution/admin/operational records | Confirmed production service |
| Vercel | Hosting and delivery of CompassU web application and server-side web functions | Network/request metadata and application data processed by deployed functions as applicable | Confirmed production service |
| Resend | Transactional email delivery | Recipient email, message content such as invitations/results/report delivery, delivery metadata | Confirmed production service |

## Publication rule

Before publishing this list, CompassU must verify each provider's current legal entity, service role, processing location/data-transfer terms where relevant, DPA availability, and any provider-specific subprocessors that institutional customers reasonably require.

A vendor should not be listed merely because CompassU has an account with it; it should be listed when it actually processes CompassU production personal information for the service.

## Changes

CompassU may update subprocessors as infrastructure evolves. Institution-specific agreements may provide advance notice or objection procedures for material new subprocessors.