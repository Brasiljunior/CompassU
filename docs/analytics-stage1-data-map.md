# CompassU Institutional Analytics — Stage 1 Data Map

Status: implementation planning / schema validation

## Objective

Stage 1 establishes the secure data foundation required for institution-level analytics before any new dashboard charts or PDF institutional reports are built.

The initial analytics scope is:

- account participation
- assessment starts/completions
- completion rate
- career-cluster distribution
- top recommended majors
- top recommended careers/occupations
- aggregate six-dimension student profile
- institution filtering
- reporting-period filtering where supported
- small-cell suppression for privacy

## Confirmed production data paths from the current CompassU application

The current application source confirms these database objects and fields are already used by CompassU.

### `assessment_questions`

Current client query:

```text
/rest/v1/assessment_questions?is_active=eq.true&select=id,question_number,dimension,question_text&order=question_number.asc
```

Known fields used by the application or assessment export:

- `id`
- `question_number`
- `dimension`
- `question_text`
- `response_type`
- `scoring_key`
- `is_active`

The current documented instrument contains 80 active questions across:

- Interests — 20
- Strengths — 15
- Personality — 15
- Values — 10
- Work Environment — 10
- Academic Preferences — 10

### `assessment_attempts`

Known fields used by the application:

- `id`
- `user_id`
- `status`
- `started_at`
- `completed_at`

Known statuses used by the product include `in_progress` and `completed`.

### `assessment_responses`

Known fields used by the application:

- `attempt_id`
- `user_id`
- `question_id`
- `response_value`

Current responses are written as JSON containing a numeric `value`.

### `major_matches`

Known fields used by the application:

- `attempt_id`
- `major_id`
- `match_score`
- `rank`

### `majors`

Known fields from current application/export:

- `id`
- `name`

### `major_occupations`

Known fields from current application/export:

- `major_id`
- `occupation_id`
- `relevance_weight`

### `occupations`

Known fields from current application/export:

- `id`
- `name`
- `soc_code`
- `median_salary`
- `salary_year`
- `outlook_percent`
- `typical_education`
- `annual_openings`
- `projection_start_year`
- `projection_end_year`
- `work_experience`
- `on_the_job_training`

### `profiles`

The current signup flow writes:

- `id`
- `first_name`
- `last_name`

Additional profile fields may exist and must be schema-validated before analytics rely on them.

### `account_institutions`

This table was added for persistent institution assignment. Current confirmed fields are:

- `email` — primary key
- `institution`
- `created_at`
- `created_by`
- `updated_at`

Current institution assignment is email-based. For long-term analytics architecture, a stable user-id relationship is preferable because email addresses can change.

## Existing administrator metrics

The current `admin-console` overview already supplies:

- total accounts
- completed surveys
- accounts with completed survey
- completion rate
- surveys in progress
- suspended accounts
- 30-day new-account trend
- 30-day completed-assessment trend
- per-user completed/in-progress survey status

Stage 1 should preserve these metrics and extend them to institution-scoped aggregation.

## Proposed Stage 1 analytical model

### 1. Participation metrics

For a selected institution and period:

- total licensed/known accounts
- accounts with assessment started
- accounts with completed assessment
- completion rate
- in-progress accounts
- not-started accounts
- completed attempts
- average completed attempts per completing student

### 2. Major analytics

Based on completed attempts and `major_matches`:

- top recommended majors by number of students receiving the major in Top 1, Top 3, Top 5, and Top 10
- percentage of completed students represented by each major
- average match score per major
- median match score per major, if PostgreSQL schema/data types support it

Default customer-facing report should use each student’s latest completed attempt unless explicitly configured otherwise. This avoids one student with repeated reassessments disproportionately affecting institutional results.

### 3. Career/occupation analytics

Current CompassU stores major-to-occupation relevance, not a confirmed attempt-level occupation-match table. Stage 1 therefore should not label occupations as direct student career scores unless a database object supporting that claim is verified.

Safe first calculation:

- take each student’s ranked major recommendations
- join each major to `major_occupations`
- aggregate occupation relevance using the major match and occupation relevance weights
- clearly label this as **career alignment derived from major recommendations**

If a direct career-score table/function exists in Supabase, it should supersede this derived method after verification.

### 4. Six-dimension profile analytics

For each student’s latest completed attempt:

- join `assessment_responses` to `assessment_questions`
- extract the numeric response value
- group by `dimension`
- calculate aggregate mean and normalized score

Because exact interpretation of a dimension score depends on scoring semantics, no customer-facing label such as “high personality” or “strong values” should be introduced. Reports should use descriptive phrasing such as “average response profile by assessment dimension.”

### 5. Career-cluster analytics

The assessment export confirms question-level scoring keys associate questions with career clusters and weight/direction values. The exact JSON shape must be validated against the live database before a production RPC is written.

Target output:

- cluster identifier/name
- student count
- percentage of completed students
- average normalized cluster score
- optional rank distribution

No production calculation should be deployed until the live `scoring_key` structure and `finalize_assessment` scoring behavior are confirmed.

## Privacy controls

Stage 1 server-side analytics should enforce:

- administrator authorization before returning any institutional aggregate
- institution scoping on the server, not only in browser JavaScript
- aggregate results by default
- no names/emails in generated institutional reports unless an explicit operational table is requested
- minimum-cell suppression for sensitive cross-tabs; initial engineering default: suppress cells with fewer than 5 students
- latest-completed-attempt default for student outcome aggregation
- no browser exposure of raw response records for institution-level reporting

## Required server contract

The preferred architecture is a security-definer PostgreSQL RPC or protected Supabase Edge Function that returns a structured payload such as:

```json
{
  "scope": {
    "institution": "Example High School",
    "start_date": null,
    "end_date": null,
    "generated_at": "..."
  },
  "participation": {},
  "dimensions": [],
  "clusters": [],
  "majors": [],
  "careers": [],
  "privacy": {
    "small_cell_threshold": 5
  }
}
```

The browser should receive aggregate values only.

## Schema decisions still requiring live Supabase validation

1. Exact column types and constraints for `assessment_attempts`, `assessment_responses`, `major_matches`, and `profiles`.
2. Exact JSON structure of `assessment_questions.scoring_key`.
3. Full definition of `finalize_assessment` and any related scoring functions.
4. Whether a direct career/occupation score table exists.
5. Whether an institution identifier exists anywhere besides `account_institutions.email`.
6. Current RLS policies on all analytics-source tables.
7. Whether the admin Edge Function already joins `auth.users`, profiles, attempts, and institution data in a reusable way.
8. Data volume and relevant indexes before implementing large institution/system reports.

## Stage 1 exit criteria

Stage 1 is complete when:

- the live schema has been inventoried
- institution-to-user linkage has been finalized
- exact scoring-key and recommendation functions have been inspected
- the latest-attempt rule has been approved
- privacy suppression has been implemented server-side
- a secure aggregate analytics function/endpoint returns validated results for one institution and all institutions
- sample output has been reconciled against known student records before the dashboard is built
