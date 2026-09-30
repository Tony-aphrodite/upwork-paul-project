/**
 * Database migrations, in order. Each runs once, inside a transaction, and is recorded in schema_migrations.
 * They are TypeScript strings rather than .sql files so the same list is available to the migrate script, the local
 * database and the tests without reading files at runtime. Never edit a migration that has run in production: add one.
 *
 * Row-level security is switched on for every table with no policies. The app connects as the table owner, which
 * is not affected; the hosting provider's public API roles can then read nothing.
 */
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "001_init",
    sql: `
create table navigators (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  password_hash text,
  setup_token_hash text unique,
  setup_expires_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

create table cases (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'released', 'closed')),
  version integer not null default 1,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  released_at timestamptz,
  closed_at timestamptz,
  retain_until timestamptz not null,
  questionnaire_version text not null,
  content_version text not null,
  consent_at timestamptz not null,
  marketing_consent boolean not null default false,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  person_first_name text not null,
  person_preferred_name text,
  answers jsonb not null,
  urgent boolean not null default false,
  pathways jsonb not null default '[]',
  referral text,
  generated_plan jsonb not null,
  working_plan jsonb not null,
  released_plan jsonb,
  reviewed_by uuid references navigators(id) on delete set null,
  released_by uuid references navigators(id) on delete set null,
  navigator_note text not null default '',
  release_email_status text check (release_email_status in ('sent', 'failed')),
  feedback jsonb,
  feedback_at timestamptz,
  updated_at timestamptz not null default now()
);
create index cases_status_idx on cases (status, submitted_at desc);
create index cases_retain_idx on cases (retain_until);

create table family_links (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_viewed_at timestamptz
);
create index family_links_case_idx on family_links (case_id);

create table implementation_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  created_at timestamptz not null default now(),
  services jsonb not null default '[]',
  contact_method text not null check (contact_method in ('phone', 'email')),
  phone text,
  best_time text not null default '',
  message text not null default '',
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  updated_at timestamptz not null default now()
);
create index implementation_requests_case_idx on implementation_requests (case_id);

-- Anonymous history: survives deletion of the case (case_id becomes null), holds no personal data.
create table events (
  id bigserial primary key,
  case_id uuid references cases(id) on delete set null,
  at timestamptz not null default now(),
  actor text not null,
  type text not null
);
create index events_case_idx on events (case_id);

create table rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null
);

alter table navigators enable row level security;
alter table cases enable row level security;
alter table family_links enable row level security;
alter table implementation_requests enable row level security;
alter table events enable row level security;
alter table rate_limits enable row level security;
`,
  },
];
