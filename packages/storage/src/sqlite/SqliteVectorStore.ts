import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  DocumentChunk,
  IngestionJob,
  RetrievedChunk,
  SearchOptions,
  SourceDocument,
  VectorStore,
} from "@agents-vault/core";
import { resolveDbPath } from "@agents-vault/shared";

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) {
    return -1;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }

  if (normA === 0 || normB === 0) {
    return -1;
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class SqliteVectorStore implements VectorStore {
  private readonly db: DatabaseSync;

  constructor(dbPath: string = resolveDbPath(process.cwd())) {
    const resolved = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      create table if not exists documents (
        id text primary key,
        project_id text not null,
        path text not null,
        file_type text not null,
        checksum text not null,
        title text,
        metadata text not null default '{}',
        created_at text not null,
        updated_at text not null,
        unique(project_id, path, checksum)
      );

      create table if not exists chunks (
        id text primary key,
        document_id text not null references documents(id) on delete cascade,
        chunk_index integer not null,
        modality text not null,
        content text not null,
        embedding text not null,
        embedding_model text not null,
        metadata text not null default '{}',
        created_at text not null default (datetime('now'))
      );

      create table if not exists ingestion_jobs (
        id text primary key,
        project_id text not null,
        source_path text not null,
        status text not null,
        stats text not null default '{}',
        started_at text not null,
        finished_at text
      );

      create index if not exists idx_documents_project_path on documents(project_id, path);
      create index if not exists idx_chunks_document_id on chunks(document_id);
      create index if not exists idx_jobs_project_status on ingestion_jobs(project_id, status);

      create virtual table if not exists chunks_fts using fts5(
        chunk_id unindexed,
        content,
        content='',
        tokenize='porter ascii'
      );
    `);
  }

  async upsertDocuments(docs: SourceDocument[]): Promise<void> {
    if (docs.length === 0) return;

    const statement = this.db.prepare(`
      insert into documents (id, project_id, path, file_type, checksum, title, metadata, created_at, updated_at)
      values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        project_id=excluded.project_id,
        path=excluded.path,
        file_type=excluded.file_type,
        checksum=excluded.checksum,
        title=excluded.title,
        metadata=excluded.metadata,
        created_at=excluded.created_at,
        updated_at=excluded.updated_at
    `);

    this.db.exec("BEGIN");
    try {
      for (const doc of docs) {
        statement.run(
          doc.id,
          doc.projectId,
          doc.path,
          doc.fileType,
          doc.checksum,
          doc.title ?? null,
          JSON.stringify(doc.metadata ?? {}),
          doc.createdAt,
          doc.updatedAt,
        );
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async upsertChunks(chunks: DocumentChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const statement = this.db.prepare(`
      insert into chunks (id, document_id, chunk_index, modality, content, embedding, embedding_model, metadata)
      values (?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(id) do update set
        document_id=excluded.document_id,
        chunk_index=excluded.chunk_index,
        modality=excluded.modality,
        content=excluded.content,
        embedding=excluded.embedding,
        embedding_model=excluded.embedding_model,
        metadata=excluded.metadata
    `);

    const ftsDelete = this.db.prepare(`delete from chunks_fts where chunk_id = ?`);
    const ftsInsert = this.db.prepare(`insert into chunks_fts (chunk_id, content) values (?, ?)`);

    this.db.exec("BEGIN");
    try {
      for (const chunk of chunks) {
        statement.run(
          chunk.id,
          chunk.documentId,
          chunk.chunkIndex,
          chunk.modality,
          chunk.content,
          JSON.stringify(chunk.embedding ?? []),
          chunk.embeddingModel,
          JSON.stringify(chunk.metadata ?? {}),
        );
        ftsDelete.run(chunk.id);
        ftsInsert.run(chunk.id, chunk.content);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async search(queryEmbedding: number[], opts: SearchOptions): Promise<RetrievedChunk[]> {
    const rows = this.db
      .prepare(`
        select
          c.id as chunk_id,
          c.document_id,
          d.path as document_path,
          c.chunk_index,
          c.modality,
          c.content,
          c.embedding,
          c.metadata
        from chunks c
        join documents d on d.id = c.document_id
        where d.project_id = ?
      `)
      .all(opts.projectId) as Array<{
      chunk_id: string;
      document_id: string;
      document_path: string;
      chunk_index: number;
      modality: "text" | "ocr-text" | "image-caption";
      content: string;
      embedding: string;
      metadata: string;
    }>;

    // --- Vector scoring ---
    const vectorScores = new Map<string, { score: number; row: (typeof rows)[number] }>();
    for (const row of rows) {
      const embedding = JSON.parse(row.embedding) as number[];
      const score = cosineSimilarity(queryEmbedding, embedding);
      if (score >= 0) {
        vectorScores.set(row.chunk_id, { score, row });
      }
    }

    // --- FTS5 / BM25 scoring ---
    const bm25Scores = new Map<string, number>();
    if (opts.query) {
      try {
        const ftsRows = this.db
          .prepare(
            `select chunk_id, rank
             from chunks_fts
             where chunks_fts match ?
             order by rank
             limit ?`,
          )
          .all(opts.query, opts.topK * 2) as Array<{ chunk_id: string; rank: number }>;

        if (ftsRows.length > 0) {
          const maxAbsRank = Math.max(...ftsRows.map((r) => Math.abs(r.rank)));
          for (const ftsRow of ftsRows) {
            bm25Scores.set(
              ftsRow.chunk_id,
              maxAbsRank > 0 ? Math.abs(ftsRow.rank) / maxAbsRank : 0,
            );
          }
        }
      } catch {
        // FTS table may not exist yet — fall back to vector-only
      }
    }

    // --- Union both result sets, store individual scores in metadata ---
    const allChunkIds = new Set([...vectorScores.keys(), ...bm25Scores.keys()]);
    const results: RetrievedChunk[] = [];

    for (const chunkId of allChunkIds) {
      const vectorEntry = vectorScores.get(chunkId);
      const bm25 = bm25Scores.get(chunkId);
      const vectorScore = vectorEntry?.score ?? 0;

      let row = vectorEntry?.row;
      if (!row) {
        row = rows.find((r) => r.chunk_id === chunkId);
        if (!row) continue;
      }

      const metadata = JSON.parse(row.metadata || "{}") as Record<string, unknown>;
      metadata.vectorScore = vectorScore;
      if (bm25 !== undefined) {
        metadata.bm25Score = bm25;
      }

      results.push({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        documentPath: row.document_path,
        chunkIndex: row.chunk_index,
        modality: row.modality,
        content: row.content,
        score: vectorScore,
        metadata,
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, opts.topK);
  }

  async deleteByProjectAndPath(projectId: string, docPath: string): Promise<void> {
    const rows = this.db
      .prepare(`select id from documents where project_id = ? and path = ?`)
      .all(projectId, docPath) as Array<{ id: string }>;

    const deleteChunks = this.db.prepare("delete from chunks where document_id = ?");
    const deleteDocument = this.db.prepare("delete from documents where id = ?");

    this.db.exec("BEGIN");
    try {
      for (const item of rows) {
        deleteChunks.run(item.id);
        deleteDocument.run(item.id);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async findByProjectAndPath(projectId: string, docPath: string): Promise<SourceDocument | null> {
    const row = this.db
      .prepare(`
        select * from documents
        where project_id = ? and path = ?
        order by updated_at desc
        limit 1
      `)
      .get(projectId, docPath) as
      | {
          id: string;
          project_id: string;
          path: string;
          file_type: SourceDocument["fileType"];
          checksum: string;
          title: string | null;
          metadata: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      projectId: row.project_id,
      path: row.path,
      fileType: row.file_type,
      checksum: row.checksum,
      title: row.title ?? undefined,
      metadata: JSON.parse(row.metadata || "{}"),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async createIngestionJob(job: IngestionJob): Promise<void> {
    this.db
      .prepare(`
        insert into ingestion_jobs (id, project_id, source_path, status, stats, started_at, finished_at)
        values (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        job.id,
        job.projectId,
        job.sourcePath,
        job.status,
        JSON.stringify(job.stats ?? {}),
        job.startedAt,
        job.finishedAt ?? null,
      );
  }

  async finishIngestionJob(
    jobId: string,
    status: "completed" | "failed",
    stats: Record<string, unknown>,
  ): Promise<void> {
    this.db
      .prepare(`
        update ingestion_jobs
        set status = ?, stats = ?, finished_at = ?
        where id = ?
      `)
      .run(status, JSON.stringify(stats ?? {}), new Date().toISOString(), jobId);
  }

  async getProjectStats(projectId?: string): Promise<{
    documents: number;
    chunks: number;
    lastIngestionAt: string | null;
  }> {
    const documents = projectId
      ? (this.db
          .prepare("select count(*) as count from documents where project_id = ?")
          .get(projectId) as { count: number })
      : (this.db.prepare("select count(*) as count from documents").get() as { count: number });

    const chunks = projectId
      ? (this.db
          .prepare(
            `
              select count(*) as count
              from chunks c
              join documents d on d.id = c.document_id
              where d.project_id = ?
            `,
          )
          .get(projectId) as { count: number })
      : (this.db.prepare("select count(*) as count from chunks").get() as { count: number });

    const last = projectId
      ? (this.db
          .prepare(
            `
              select finished_at from ingestion_jobs
              where status = 'completed' and project_id = ?
              order by finished_at desc
              limit 1
            `,
          )
          .get(projectId) as { finished_at: string | null } | undefined)
      : (this.db
          .prepare(
            `
              select finished_at from ingestion_jobs
              where status = 'completed'
              order by finished_at desc
              limit 1
            `,
          )
          .get() as { finished_at: string | null } | undefined);

    return {
      documents: documents.count ?? 0,
      chunks: chunks.count ?? 0,
      lastIngestionAt: last?.finished_at ?? null,
    };
  }

  async listProjects(): Promise<Array<{ projectId: string; documents: number; chunks: number }>> {
    const rows = this.db
      .prepare(`
        select
          d.project_id,
          count(distinct d.id) as documents,
          count(c.id) as chunks
        from documents d
        left join chunks c on c.document_id = d.id
        group by d.project_id
        order by d.project_id
      `)
      .all() as Array<{ project_id: string; documents: number; chunks: number }>;

    return rows.map((row) => ({
      projectId: row.project_id,
      documents: row.documents,
      chunks: row.chunks,
    }));
  }

  async healthCheck(): Promise<{ ok: boolean; detail: string }> {
    try {
      this.db.prepare("select 1").get();
      return { ok: true, detail: "SQLite reachable" };
    } catch (error) {
      return {
        ok: false,
        detail: error instanceof Error ? error.message : "Unknown SQLite error",
      };
    }
  }
}
