-- CompassU Stage 3B: tenant-aware authorization patch for Stage 2A analytics.
-- Preserves existing Master Administrator behavior while allowing institution-scoped
-- Stage 3B administrators to call get_institutional_analytics_v2 only for institutions
-- already authorized through tenant membership.

DO $$
DECLARE
  v_definition text;
  v_patched text;
BEGIN
  SELECT pg_get_functiondef('public.get_institutional_analytics_v2(text,date,date)'::regprocedure)
    INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'get_institutional_analytics_v2(text,date,date) was not found.';
  END IF;

  v_patched := regexp_replace(
    v_definition,
    'IF[[:space:]]+auth\.uid\(\)[[:space:]]+IS[[:space:]]+NULL[[:space:]]+OR[[:space:]]+NOT[[:space:]]+public\.is_compassu_admin\(\)[[:space:]]+THEN[[:space:]]+RAISE[[:space:]]+EXCEPTION[[:space:]]+''Administrator access required'';[[:space:]]+END[[:space:]]+IF;',
    $auth$
IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  IF NOT public.is_compassu_master_admin() THEN
    IF p_institution IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.tenant_institutions ti
      WHERE ti.active
        AND lower(trim(ti.name)) = lower(trim(p_institution))
        AND public.can_access_institution(ti.id)
    ) THEN
      RAISE EXCEPTION 'Administrator access required';
    END IF;
  END IF;$auth$,
    'i'
  );

  IF v_patched = v_definition THEN
    RAISE EXCEPTION 'Stage 3B analytics authorization patch could not locate the legacy admin gate. No changes were applied.';
  END IF;

  EXECUTE v_patched;
END;
$$;

revoke all on function public.get_institutional_analytics_v2(text,date,date) from public;
grant execute on function public.get_institutional_analytics_v2(text,date,date) to authenticated;

comment on function public.get_institutional_analytics_v2(text,date,date) is
  'CompassU Stage 2A analytics with Stage 3B tenant-aware authorization. Master admins retain platform scope; tenant admins require an authorized institution scope.';
