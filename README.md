# CompassU

CompassU is a Next.js college and career discovery application that turns student interests, strengths, personality, values, and preferences into personalized major, career, salary, and college recommendations.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Run `npm install`.
4. Run `npm run dev`.

## Production recovery

The initial source in this repository was reconstructed from the verified Vercel production deployment because that project was originally deployed without a Git integration. See `RECOVERY.md` for the verified baseline, safety constraints, and validation checklist.

## Deployment workflow

Use feature/recovery branches and pull requests. Validate changes in the isolated `compassu-test` Vercel project before promoting changes to the live `compassu` project.

The `compassu-test` project is the designated Git-connected validation environment for the recovered baseline. Git deployment validation was initiated after the repository connection was confirmed. The Vercel framework preset should remain set to Next.js. A clean deployment retest was triggered after verifying that all build overrides were disabled. A fresh staging rebuild was triggered after adding the Supabase public environment variables.

Never commit service-role credentials, Resend API keys, Vercel secrets, or `.env.local`.
