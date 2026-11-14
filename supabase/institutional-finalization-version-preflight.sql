-- Read-only preflight for institutional finalization staging.
-- Check version drift before attempting synthetic 80-response completion.
select
  (select count(*) from public.assessment_questions where is_active) as active_questions,
  (select count(*) from public.question_trait_weights) as question_trait_weights,
  (select count(*) from public.majors where active) as active_majors,
  (select count(*) from public.institution_student_assignments) as verified_assignment_rows,
  (select count(*) from public.institution_assessment_affiliations) as affiliation_snapshot_rows,
  (select prosecdef from pg_proc where oid=to_regprocedure('public.finalize_assessment(uuid)')) as finalization_is_definer,
  has_column_privilege('authenticated','public.assessment_attempts','status','UPDATE') as client_can_update_completion;
