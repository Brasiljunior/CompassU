# CompassU Item #7 — WCAG 2.2 AA & Device/Browser QA Baseline

**Status:** In progress  
**Branch:** `remediation-accessibility-wcag22`  
**Target:** WCAG 2.2 Level AA for core pilot workflows

## Scope

Core pilot workflows to validate:

1. Public landing page and navigation.
2. Account creation, login, forgotten-password and password-reset flows.
3. Assessment start/resume, all question interactions, autosave, progress and completion.
4. Student roadmap/results, major selection, favorites, comparison, career and college exploration, email results and PDF download.
5. Privacy and Terms pages.
6. Administrator authentication/MFA and account-management workflows.
7. Institutional analytics/reporting and administrator configuration screens.
8. Mobile, tablet and desktop responsive behavior.

## Initial code audit findings

The initial review identified accessibility gaps that are common blockers for WCAG 2.2 AA and keyboard/screen-reader use:

- Some SPA views rely on generic containers rather than explicit main/navigation landmarks.
- Dynamic form fields do not consistently expose explicit label-to-control associations.
- Dynamic error/success/notice messages are not consistently announced by assistive technology.
- Assessment progress is visual but does not consistently expose progressbar semantics.
- Assessment choices visually behave like a single-choice radio group but need corresponding programmatic semantics.
- Global visible keyboard focus treatment is inconsistent.
- Several compact controls fall below the WCAG 2.2 target-size expectation for common pointer/touch use.
- Motion/transition behavior does not yet honor `prefers-reduced-motion` globally.
- The single-page workflow needs a reliable skip-to-content mechanism and stable landmarks.
- Very narrow viewport/reflow behavior needs explicit testing below the current 600px breakpoint.

## Remediation batch 1

Implemented on the accessibility branch:

- Added a keyboard-visible **Skip to main content** link.
- Added an accessibility enhancement layer that establishes navigation/main landmarks where the current SPA markup lacks them.
- Added explicit label/control association for `.field` controls and useful autocomplete hints for common identity/password fields.
- Added `role=alert` / `role=status` and live-region behavior to error, success and notice messages.
- Added programmatic assessment progressbar semantics and percentage text.
- Added radio-group/radio semantics and selected-state exposure to assessment answer choices.
- Added missing button types to prevent accidental form submission behavior.
- Added safer accessible names for star/save icon controls and external-tab links.
- Added strong global `:focus-visible` treatment.
- Raised common interactive controls to at least 44px target height/width where applicable.
- Added reduced-motion handling.
- Added additional narrow-screen reflow rules at 400px.
- Converted legal links/footer and administrator launcher to reusable semantic/styled elements with visible focus support.

## Validation still required

Item #7 is not complete until the following are verified against the deployed preview:

- Full keyboard-only walkthrough with no keyboard trap and logical focus order.
- Screen-reader semantics for landing, auth, assessment and results.
- Contrast review for text, buttons, focus indicators, disabled states and data visualizations.
- 200% and 400% zoom/reflow validation.
- Portrait/landscape validation at representative phone/tablet sizes.
- Chrome, Edge, Safari and Firefox coverage appropriate to the pilot audience.
- Admin account-management table keyboard behavior, selection controls, bulk deletion and dialogs.
- MFA, password reset and invitation flows.
- Dynamic dashboard/results focus management after SPA view transitions.
- PDF/report accessibility limitations documented separately from web WCAG conformance.

## Device/browser matrix

Planned minimum matrix:

| Class | Representative viewport/browser | Status |
|---|---|---|
| Desktop | Chrome / 1440px | Pending |
| Desktop | Edge / 1440px | Pending |
| Desktop | Firefox / 1440px | Pending |
| macOS | Safari / desktop | Pending |
| Tablet | iPad/Safari-class viewport | Pending |
| Mobile | iPhone/Safari-class viewport | Pending |
| Mobile | Android/Chrome-class viewport | Pending |
| Reflow | 320px CSS viewport / 400% equivalent | Pending |

## Completion gate

Item #7 closes only when critical/serious accessibility defects in the core pilot workflows have been remediated or explicitly documented with an approved workaround, and the representative device/browser matrix has been exercised successfully.
