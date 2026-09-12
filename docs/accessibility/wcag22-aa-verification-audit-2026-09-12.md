# CompassU WCAG 2.2 Level AA Verification Audit

**Audit date:** 2026-09-12  
**Branch:** `remediation-accessibility-wcag22`  
**Target:** WCAG 2.2 Level AA  
**Scope:** CompassU core pilot web application, authentication and password recovery flows, 80-question assessment, student results/exploration workflows, privacy/terms pages, administrator authentication/MFA, account management, analytics/reporting, and responsive web presentation.

## Executive determination

This is a formal **engineering verification audit**, not a W3C certification and not a substitute for a third-party assistive-technology audit.

At the conclusion of this source/deployment review:

- **27 Level A/AA success criteria are verified in the implementation.**
- **16 criteria are not applicable to the current CompassU core web experience** based on the audited feature/content inventory.
- **12 criteria require manual rendered-browser and/or assistive-technology verification before a full WCAG 2.2 AA conformance claim is defensible.**
- **0 unresolved criteria are presently classified as a confirmed implementation failure after the audit remediations described below.**

Accordingly, CompassU is **not yet approved for an unqualified WCAG 2.2 AA conformance claim**. The remaining gate is the manual verification matrix at the end of this document.

## Remediation completed during this verification audit

The audit found and corrected several issues before recording the matrix:

1. **1.3.5 Identify Input Purpose** — password autocomplete purpose is now differentiated between account creation (`new-password`) and login (`current-password`), while name/email autocomplete purposes remain programmatically exposed.
2. **1.3.1 / 4.1.2 assessment relationships** — assessment answer radiogroups are now programmatically labelled by the current question and expose checked state.
3. **2.4.3 Focus Order / SPA view transitions** — the accessibility layer now moves focus to the newly rendered main application region when the SPA changes primary views, while avoiding an unsolicited focus move on initial page load.
4. **3.2.2 On Input** — CompassU now explicitly advises students before the answer controls that selecting an answer saves the response and automatically advances to the next question.
5. **1.4.11 Non-text Contrast** — low-contrast borders used to identify interactive controls were hardened to a color meeting the 3:1 non-text contrast target against white; admin controls received the same treatment.
6. **Admin accessibility** — existing admin skip navigation, focus visibility, target sizing, table semantics, status announcements, dialog keyboard handling, reduced-motion behavior, and responsive rules remain active.

## Status legend

- **PASS — Engineering verified:** source/deployment evidence supports the criterion for the audited scope.
- **MANUAL — Manual verification required:** implementation evidence is favorable, but WCAG conformance cannot be closed without rendered-browser, keyboard, zoom, or assistive-technology testing.
- **N/A — Not applicable:** the audited CompassU scope does not contain content/functionality to which the criterion applies.

## Criterion-by-criterion WCAG 2.2 A + AA matrix

| SC | Level | Success Criterion | Status | CompassU audit evidence / remaining action |
|---|---|---|---|---|
| 1.1.1 | A | Non-text Content | PASS | Decorative branding is CSS/SVG-based; functional MFA QR content has alternative text. Recheck any future uploaded/marketing imagery. |
| 1.2.1 | A | Audio-only and Video-only (Prerecorded) | N/A | No prerecorded audio-only/video-only media in audited core flows. |
| 1.2.2 | A | Captions (Prerecorded) | N/A | No prerecorded synchronized media in audited core flows. |
| 1.2.3 | A | Audio Description or Media Alternative (Prerecorded) | N/A | No prerecorded synchronized media in audited core flows. |
| 1.2.4 | AA | Captions (Live) | N/A | No live synchronized media. |
| 1.2.5 | AA | Audio Description (Prerecorded) | N/A | No prerecorded synchronized media. |
| 1.3.1 | A | Info and Relationships | PASS | Labels/control relationships, landmarks, table headers/scopes, assessment radio semantics and admin structures are programmatically exposed. |
| 1.3.2 | A | Meaningful Sequence | PASS | DOM sequence follows visual/task sequence in audited source; no CSS ordering mechanism establishes a conflicting reading order. |
| 1.3.3 | A | Sensory Characteristics | PASS | Core instructions do not rely solely on shape, color, size, location, orientation or sound. |
| 1.3.4 | AA | Orientation | PASS | Responsive CSS does not lock portrait/landscape orientation. |
| 1.3.5 | AA | Identify Input Purpose | PASS | Name/email/password purpose tokens are exposed; signup/login password autocomplete was corrected during this audit. |
| 1.4.1 | A | Use of Color | PASS | Statuses and selections include text/programmatic state in addition to color. |
| 1.4.2 | A | Audio Control | N/A | No automatically playing audio. |
| 1.4.3 | AA | Contrast (Minimum) | MANUAL | Core palette is generally favorable; final rendered-state contrast scan is required across text, disabled states, charts, legal pages and all admin panels. |
| 1.4.4 | AA | Resize Text | MANUAL | Responsive/rem-based presentation is favorable; verify at 200% browser text/zoom without loss of content/function. |
| 1.4.5 | AA | Images of Text | N/A | Audited UI does not rely on images of text for required information. |
| 1.4.10 | AA | Reflow | MANUAL | 400px/320px responsive rules exist; verify equivalent 320 CSS-pixel/400% reflow without two-dimensional scrolling except legitimate data tables. |
| 1.4.11 | AA | Non-text Contrast | MANUAL | Control-boundary contrast issue identified and remediated in this audit; final rendered-state validation is still required for controls, charts and focus indicators. |
| 1.4.12 | AA | Text Spacing | MANUAL | No fixed-height text containers are intended to clip content; test WCAG text-spacing overrides in rendered pages. |
| 1.4.13 | AA | Content on Hover or Focus | N/A | No required hover/focus-triggered popup content was found in audited core interactions. |
| 2.1.1 | A | Keyboard | MANUAL | Native buttons/links/inputs are used and dialog handling has been hardened; complete keyboard-only walkthrough of every core task. |
| 2.1.2 | A | No Keyboard Trap | MANUAL | No intentional traps identified; verify modal/dialog focus can be entered, cycled and exited as intended, including MFA/admin flows. |
| 2.1.4 | A | Character Key Shortcuts | N/A | No single-character application shortcuts identified. |
| 2.2.1 | A | Timing Adjustable | N/A | No author-controlled user task time limit identified in core flows; authentication/security token expiration is outside ordinary task timing. |
| 2.2.2 | A | Pause, Stop, Hide | N/A | No auto-moving/blinking/scrolling information lasting more than five seconds or auto-updating dashboard content requiring pause controls. |
| 2.3.1 | A | Three Flashes or Below Threshold | N/A | No flashing content identified. |
| 2.4.1 | A | Bypass Blocks | PASS | Public application and admin provide visible-on-focus skip links to main content. |
| 2.4.2 | A | Page Titled | PASS | Root/admin metadata provide descriptive titles; route-specific final rendered verification remains part of regression QA. |
| 2.4.3 | A | Focus Order | MANUAL | SPA main-view focus management was added during this audit; verify full keyboard order and focus restoration in dialogs/results transitions. |
| 2.4.4 | A | Link Purpose (In Context) | PASS | Functional links/buttons expose descriptive text or accessible names, including external-new-tab indication. |
| 2.4.5 | AA | Multiple Ways | MANUAL | Core product is primarily a task-oriented SPA; verify standalone routes/resources remain discoverable through navigation/footer/direct route patterns. |
| 2.4.6 | AA | Headings and Labels | PASS | Major regions, panels, controls and administrator functions use descriptive headings/labels or generated accessible names. |
| 2.4.7 | AA | Focus Visible | PASS | Strong `:focus-visible` treatment is defined globally and separately for administrator UI. |
| 2.4.11 | AA | Focus Not Obscured (Minimum) | MANUAL | Sticky navigation and fixed administrator launcher require actual keyboard/viewport testing to ensure focused controls are never fully hidden. |
| 2.5.1 | A | Pointer Gestures | N/A | No multipoint/path-based gestures required. |
| 2.5.2 | A | Pointer Cancellation | PASS | Core activation uses standard button/link click semantics rather than down-event-only actions. |
| 2.5.3 | A | Label in Name | PASS | Visible control/link text is retained in accessible names; supplemental external-tab text is appended rather than replacing visible labels. |
| 2.5.4 | A | Motion Actuation | N/A | Device-motion operation is not used. |
| 2.5.7 | AA | Dragging Movements | N/A | No application function requires dragging. |
| 2.5.8 | AA | Target Size (Minimum) | PASS | Common controls are hardened to at least 44px target dimensions; native inline-text link exceptions remain permitted. |
| 3.1.1 | A | Language of Page | PASS | Root document declares `lang="en"`. |
| 3.1.2 | AA | Language of Parts | PASS | Audited core UI content is English; no unmarked substantive foreign-language passages identified. |
| 3.2.1 | A | On Focus | PASS | Focus alone does not submit forms or trigger navigation/context changes. |
| 3.2.2 | A | On Input | PASS | Assessment answer selection auto-advance is now disclosed before the controls; other inputs do not unexpectedly change context. |
| 3.2.3 | AA | Consistent Navigation | PASS | Repeated primary/legal/admin navigation patterns are consistently located/identified within their applicable views. |
| 3.2.4 | AA | Consistent Identification | PASS | Repeated functions use consistent labels/names across audited workflows. |
| 3.2.6 | A | Consistent Help | N/A | No repeated general help mechanism is currently presented across the set of pages; password recovery is task-specific. Reassess if chat/help/contact widgets are added. |
| 3.3.1 | A | Error Identification | PASS | Error states are textual and announced through alert/live-region semantics. |
| 3.3.2 | A | Labels or Instructions | PASS | User inputs expose visible/programmatic labels; MFA and assessment interactions include instructions. |
| 3.3.3 | AA | Error Suggestion | MANUAL | Common errors display messages, but test invalid/empty values across auth, reset, admin reporting, invitation and filtering flows to confirm useful correction guidance wherever suggestions are known. |
| 3.3.4 | AA | Error Prevention (Legal, Financial, Data) | PASS | Destructive administrator account deletion uses explicit confirmation before irreversible data removal. |
| 3.3.7 | A | Redundant Entry | PASS | Audited multi-step workflows do not require unnecessary re-entry of previously supplied information in the same process. |
| 3.3.8 | AA | Accessible Authentication (Minimum) | MANUAL | Password/autocomplete, paste and `one-time-code` assistance are not blocked; verify password-manager, copy/paste and MFA behavior with actual browser/AT combinations. |
| 4.1.2 | A | Name, Role, Value | PASS | Native controls plus explicit roles/states expose names, roles and values; assessment radiogroup and admin dialogs/tables are enhanced programmatically. |
| 4.1.3 | AA | Status Messages | PASS | Error/success/notice states use alert/status live-region semantics without requiring focus. |

## Manual verification closure matrix

The following 12 criteria are the remaining conformance gate and must be exercised on the deployed accessibility build:

1. **1.4.3 Contrast (Minimum)** — rendered text/disabled/chart-state contrast measurement.
2. **1.4.4 Resize Text** — 200% zoom/text resize.
3. **1.4.10 Reflow** — 320 CSS px / 400% equivalent, including orientation changes.
4. **1.4.11 Non-text Contrast** — rendered control/state/focus/chart contrast after the remediation in this audit.
5. **1.4.12 Text Spacing** — WCAG prescribed text-spacing override.
6. **2.1.1 Keyboard** — full keyboard-only core journeys.
7. **2.1.2 No Keyboard Trap** — all dialogs, MFA, account management and dynamic panels.
8. **2.4.3 Focus Order** — SPA transitions, dialogs, result expansion and admin workflow order.
9. **2.4.5 Multiple Ways** — route/resource discoverability review.
10. **2.4.11 Focus Not Obscured (Minimum)** — sticky/fixed UI across desktop/mobile/reflow states.
11. **3.3.3 Error Suggestion** — invalid-entry correction quality across forms.
12. **3.3.8 Accessible Authentication (Minimum)** — password-manager/autofill/paste/one-time-code behavior with real browsers and assistive technology.

## Required device / assistive-technology acceptance matrix

Minimum closure matrix:

| Environment | Required verification |
|---|---|
| Windows + Chrome | Keyboard-only + 200%/400% zoom + form/error flows |
| Windows + Edge | Keyboard-only + zoom/reflow + authentication |
| Windows + Firefox + NVDA | Screen-reader labels, landmarks, assessment, results, admin data tables/dialogs |
| macOS + Safari + VoiceOver | Screen-reader navigation, forms, dynamic updates, focus order |
| iPhone + Safari + VoiceOver | Mobile reflow, touch targets, assessment/auth/results |
| Android + Chrome/TalkBack-class testing | Mobile reflow, controls and dynamic announcements |
| iPad/Safari-class viewport | Tablet orientation/reflow and keyboard/touch interaction |
| 320 CSS px / 400% equivalent | Reflow with no loss of content/functionality except legitimate table overflow |

## Conformance decision rule

CompassU may move from **auditor-ready** to a defensible **WCAG 2.2 Level AA conformance claim** only when all 12 MANUAL items pass for the representative scope and no new Level A/AA failures are introduced by the final production-equivalent build.

A W3C logo or conformance statement must not be described as W3C certification. W3C does not verify individual conformance claims; the content provider/evaluator remains responsible for the claim.

## Current decision

**Status: AUDITOR-READY / MANUAL VERIFICATION PENDING**

Engineering remediation is materially complete for the audited scope. The remaining work is a structured manual browser/assistive-technology verification pass, followed by any defect correction and re-test required by those results.
