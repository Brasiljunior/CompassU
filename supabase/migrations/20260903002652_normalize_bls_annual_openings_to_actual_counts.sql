update public.occupations
set annual_openings = annual_openings * 1000
where annual_openings is not null
  and projection_start_year = 2025
  and projection_end_year = 2035
  and annual_openings < 1000;;

