create extension if not exists vector;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  path text not null,
  file_type text not null,
  checksum text not null,
  title text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, path, checksum)
);

create table if not exists chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,
  modality text not null,
  content text not null,
  embedding vector(3072),
  embedding_model text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  source_path text not null,
  status text not null,
  stats jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists idx_documents_project_path on documents(project_id, path);
create index if not exists idx_documents_metadata_gin on documents using gin(metadata);
create index if not exists idx_chunks_metadata_gin on chunks using gin(metadata);

-- NOTE:
-- ivfflat on pgvector has a dimension limit (commonly 2000), while
-- text-embedding-3-large uses 3072 dimensions. We intentionally skip
-- ivfflat here so schema bootstrap works with 3072-d vectors.
-- Retrieval still works via ORDER BY embedding <=> query_embedding.

create or replace function match_chunks(
  query_embedding vector(3072),
  match_count int,
  filter_project text
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_path text,
  chunk_index int,
  modality text,
  content text,
  score float,
  metadata jsonb
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    c.document_id,
    d.path as document_path,
    c.chunk_index,
    c.modality,
    c.content,
    1 - (c.embedding <=> query_embedding) as score,
    c.metadata
  from chunks c
  join documents d on d.id = c.document_id
  where d.project_id = filter_project
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
