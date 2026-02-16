create table if not exists refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists refresh_tokens_user_id_idx on refresh_tokens(user_id);
create index if not exists refresh_tokens_token_hash_idx on refresh_tokens(token_hash);
create index if not exists refresh_tokens_expires_at_idx on refresh_tokens(expires_at);
