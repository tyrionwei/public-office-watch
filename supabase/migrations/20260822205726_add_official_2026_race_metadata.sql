do $$
begin
  alter table public.races
    add column if not exists district_scope text,
    add column if not exists seat_count integer check (seat_count >= 0),
    add column if not exists reserved_women_seat_count integer check (reserved_women_seat_count >= 0),
    add column if not exists campaign_expense_limit bigint check (campaign_expense_limit >= 0);

  comment on column public.races.district_scope is 'Official geographic scope published for the election district.';
  comment on column public.races.seat_count is 'Official number of seats for the election district.';
  comment on column public.races.reserved_women_seat_count is 'Official number of seats reserved for women.';
  comment on column public.races.campaign_expense_limit is 'Official campaign expense limit in New Taiwan dollars.';
end
$$;