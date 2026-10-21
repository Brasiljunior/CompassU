create unique index if not exists majors_cip_code_unique on public.majors(cip_code) where cip_code is not null;
create index if not exists assessment_responses_question_idx on public.assessment_responses(question_id);
create index if not exists institution_majors_major_idx on public.institution_majors(major_id);
create index if not exists major_cluster_weights_cluster_idx on public.major_cluster_weights(cluster_code);
create index if not exists major_matches_major_idx on public.major_matches(major_id);
create index if not exists major_occupations_occupation_idx on public.major_occupations(occupation_id);;

