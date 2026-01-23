do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'accounts' and column_name = 'domain'
  ) then
    alter table accounts rename column domain to url;
  end if;
end $$;
