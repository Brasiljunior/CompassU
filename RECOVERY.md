# CompassU Production Recovery

## Verified production baseline

- Vercel project: `compassu`
- Framework: Next.js
- Node.js: 24.x
- Verified deployed Next.js version: 15.5.24
- Package version: `compassu@0.3.0`
- Production deployment was READY before recovery work began.
- Vercel reported only five deployment input files for the production build.
- The Vercel project was not linked to GitHub when recovery began.

## Recovered capabilities

The readable source in this branch reconstructs the behavior observed in the verified production bundle:

- landing page and authentication UI
- Supabase email/password signup and login
- persistent browser session
- 80-question assessment with autosaved responses
- assessment finalization through `finalize_assessment`
- top major matches and match percentages
- trait-based major explanations
- Career Explorer using occupation data
- College Finder using institution/program data
- saved/favorite majors
- compare up to three majors
- results email via the `send-results-email` Supabase Edge Function
- downloadable jsPDF assessment report
- responsive and print styling

## Configuration

The recovered source expects these public browser runtime variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Values are intentionally not stored in Git. Configure them in Vercel before deploying this branch from GitHub.

Server-side secrets used by the Supabase Edge Function, including email-provider credentials, remain outside this repository.

## Safety status

No production deployment was modified as part of this recovery. Do not connect the production Vercel project to GitHub until this branch has passed a clean preview build and functional smoke test.

## Validation checklist

1. Install dependencies.
2. Run `npm run build` with the two public Supabase variables configured.
3. Deploy the recovery branch to a preview environment.
4. Verify landing page, authentication, saved session, dashboard and assessment navigation.
5. Use a test account to verify autosave, final scoring, major details, favorites, comparison, college filtering, results email and PDF export.
6. Only after preview validation, merge to `main` and connect the Vercel production project to GitHub.
