# CompassU Production Recovery

## Verified production deployment

- Vercel project: `compassu`
- Framework: Next.js
- Node.js: 24.x
- Production deployment inspected: `dpl_Fsc3E4UBAN8mjjJf9Tn1srVs8oxw`
- Deployment status: READY
- Production alias: `compassu.vercel.app`
- Build identified Next.js 15.5.24 and package version 0.3.0.
- Vercel reported only five deployment input files for the production build.
- The Vercel project was not Git-linked when inspected.

## Functionality verified from the deployed application

The production client implements:

- CompassU landing page and authentication UI
- Supabase email/password signup and login
- User profiles and saved sessions
- 80-question assessment with autosaved responses
- Assessment finalization through a Supabase RPC
- Top major matches and match percentages
- Trait-based major explanations
- Career Explorer using occupation data
- College Finder using institution/program data
- Saved/favorite majors
- Up-to-three-major comparison
- Results email through the `send-results-email` Supabase Edge Function
- Downloadable PDF report using jsPDF
- Responsive and print layouts

## Security note

No private API keys, Resend secrets, service-role keys, or Vercel environment-variable values should be committed to this repository. The production JavaScript contains only the Supabase publishable/anonymous browser credential expected for client-side use. Environment-specific configuration should be migrated to `NEXT_PUBLIC_*` variables where appropriate.

## Recovery approach

This branch is intentionally isolated from `main`. It establishes source control metadata and documents the verified production baseline before reconstructed source files are reviewed and merged. The live Vercel deployment is not modified by this branch.
