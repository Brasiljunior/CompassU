import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1?target=deno";
// The test Edge Function now generates a five-page CompassU PDF server-side and sends it as a Resend attachment.
// Source of truth for the deployed test implementation: Supabase send-results-email v2.
// Production deployment remains intentionally on hold pending end-to-end email attachment validation.

const attachmentFilename = 'CompassU-Personalized-Career-Pathway-Results.pdf';

// NOTE: Keep this file version marker synchronized with the validated test Edge Function before production promotion.
export const RESULTS_EMAIL_PDF_ATTACHMENT_VERSION = 2;
export { PDFDocument, StandardFonts, rgb };
