export interface KnowledgeSource {
  id: string; title: string; url: string; rawUrl: string; sourceCommit: string;
  sha256: string; accessedAt: string; declaredStatus: string; license: string;
  attribution: string; sourceType: string; created?: string;
  release?: { tag_name?: string; published_at?: string; html_url?: string; prerelease?: boolean; status?: string; reason?: string };
}
export interface KnowledgeEntry {
  id: string; title: string; kind: 'standard' | 'tool' | 'pattern'; summary: string;
  tags: string[]; sourceIds: string[]; facts: Array<{ text: string; sourceIds: string[] }>;
  designNotes: string[]; enforcement: { layer: string; guarantees: string[]; doesNotGuarantee: string[] };
  lifecycle: string[]; risks: string[]; interoperability: string[];
  maturity: { standardStatus: string; studioStatus: string; evidenceLevel: string; version: string };
  opportunities: string[]; relatedIds: string[];
}
export interface KnowledgeCatalog {
  schemaVersion: number; asOf: string; sourceRevision: string; description: string;
  sources: KnowledgeSource[]; entries: KnowledgeEntry[];
}
export function validateCatalog(catalog: unknown): KnowledgeCatalog;
export function getEntry(catalog: KnowledgeCatalog, id: string): KnowledgeEntry | null;
export function searchKnowledge(catalog: KnowledgeCatalog, query?: string, options?: {
  limit?: number; kind?: KnowledgeEntry['kind']; tag?: string; status?: string;
}): Array<KnowledgeEntry & { score: number }>;
