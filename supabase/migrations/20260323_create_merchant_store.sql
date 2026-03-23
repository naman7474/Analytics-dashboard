create table if not exists public.merchant_configs (
  id text primary key,
  name text not null,
  domain text not null,
  store_domain text not null,
  shopify_shop text not null,
  posthog_project_id text not null,
  gokwik_merchant_mid text not null,
  ratio_tag text not null default 'primathon',
  viewer_emails text[] not null default '{}'::text[],
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.merchant_secrets (
  merchant_id text primary key references public.merchant_configs (id) on delete cascade,
  shopify_access_token text not null default '',
  posthog_api_key text not null default '',
  gokwik_cookie text not null default ''
);

create index if not exists merchant_configs_name_idx
  on public.merchant_configs (name);

create index if not exists merchant_configs_viewer_emails_idx
  on public.merchant_configs
  using gin (viewer_emails);

alter table public.merchant_configs enable row level security;
alter table public.merchant_secrets enable row level security;
