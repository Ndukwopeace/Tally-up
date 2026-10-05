-- -----------------------------------------------------------------------------
-- MVP write functions, part 1 of 4: read_lines(), the shared check of submitted lines.
--
-- WHY:  A collection, a hand-over and a count all arrive as a list of lines
--       (product or line, unit, quantity). The same checks apply to all three, so
--       they are written once and a bad request always fails the same way.
-- HOW:  Takes the JSON list and the name of the key that holds the id ("product_id"
--       or "item_id"), and returns one row per line. Raises INVALID_ITEMS (not a
--       list, empty, over 100 lines, or a line it cannot read), INVALID_QUANTITY
--       (not a whole number of at least `p_min`) or DUPLICATE_LINE (same id and
--       unit twice, COL-04). Nothing here touches a table.
-- WHEN: Run once per project, before parts 2 to 4. Called only by the functions
--       in those parts, never by the app.
-- SECURITY: No grant to any API role. Raw database messages never leave: a line
--       that cannot be read becomes the code INVALID_ITEMS.
-- -----------------------------------------------------------------------------
create function public.read_lines(p_items jsonb, p_key text, p_min integer)
returns table (line_ref uuid, line_unit public.product_unit, line_quantity integer)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_lines jsonb;
  v_unreadable integer;
  v_bad_quantity integer;
  v_duplicates integer;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'INVALID_ITEMS';
  end if;

  -- Only the three fields the function knows are kept; anything else in a line is ignored.
  select jsonb_agg(jsonb_build_object('ref', e ->> p_key, 'unit', e -> 'unit', 'quantity', e -> 'quantity'))
    into v_lines from jsonb_array_elements(p_items) as e;
  begin
    select count(*) filter (where x.ref is null or x.unit is null),
           count(*) filter (where x.quantity is null or x.quantity < p_min),
           count(*) - count(distinct (x.ref, x.unit))
      into v_unreadable, v_bad_quantity, v_duplicates
      from jsonb_to_recordset(v_lines) as x(ref uuid, unit public.product_unit, quantity integer);
  exception when invalid_text_representation or numeric_value_out_of_range
    or invalid_parameter_value or datatype_mismatch then
    raise exception 'INVALID_ITEMS';
  end;
  if v_unreadable > 0 then
    raise exception 'INVALID_ITEMS';
  elsif v_bad_quantity > 0 then
    raise exception 'INVALID_QUANTITY';
  elsif v_duplicates > 0 then
    raise exception 'DUPLICATE_LINE';
  end if;

  return query select x.ref, x.unit, x.quantity
    from jsonb_to_recordset(v_lines) as x(ref uuid, unit public.product_unit, quantity integer);
end
$$;
revoke all on function public.read_lines(jsonb, text, integer) from public, anon, authenticated;
