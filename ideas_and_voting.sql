-- Ideas & Voting feature — run this once in Supabase SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run)

create table public.feature_ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.feature_idea_votes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.feature_ideas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (idea_id, user_id)
);

-- View computes live score from votes, so we never maintain a stale counter
create view public.feature_ideas_with_votes as
  select fi.id, fi.title, fi.description, fi.created_at,
         coalesce(sum(fiv.vote), 0) as score
  from public.feature_ideas fi
  left join public.feature_idea_votes fiv on fiv.idea_id = fi.id
  group by fi.id;

alter table public.feature_ideas enable row level security;
alter table public.feature_idea_votes enable row level security;

create policy "Anyone can read ideas" on public.feature_ideas
  for select using (true);

create policy "Anyone can read votes" on public.feature_idea_votes
  for select using (true);

create policy "Signed-in users can cast a vote" on public.feature_idea_votes
  for insert with check (auth.uid() = user_id);

create policy "Signed-in users can change their vote" on public.feature_idea_votes
  for update using (auth.uid() = user_id);

create policy "Signed-in users can remove their vote" on public.feature_idea_votes
  for delete using (auth.uid() = user_id);

-- Seed with the 6 proposed features already listed in SAVETHEHIVES_SPEC.md
insert into public.feature_ideas (title, description) values
  ('Survivor tagging', 'Hives confirmed active 3+ winters get a "Genetic Goldmine" badge.'),
  ('DCA heatmap', 'Overlapping 3-mile radii show predicted drone congregation areas.'),
  ('Ghost/collapse reporting', 'Log dead hives for early warning on regional collapse trends.'),
  ('Year filter', 'Slider to show hives by observation year.'),
  ('Photo re-upload', 'Bring back photo uploads for new hive submissions (deferred in v2.3).'),
  ('Guardian Network accounts', 'Commercial beekeepers register protected zones with hex-masked privacy.');
