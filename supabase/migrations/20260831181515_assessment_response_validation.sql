alter table public.assessment_responses
add constraint assessment_response_likert_value_check
check (
  jsonb_typeof(response_value) = 'object'
  and response_value ? 'value'
  and (response_value->>'value') ~ '^[1-5]$'
);;

