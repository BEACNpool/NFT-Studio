export type ImplementationPublication = 'published' | 'candidate';
export type ImplementationEnvironment =
  | 'browser-local'
  | 'node-local'
  | 'independent-node-evaluation'
  | 'public-mcp'
  | 'offline-candidate'
  | 'repository-tooling';
export type ImplementationEvidenceKind =
  | 'source'
  | 'documentation'
  | 'local-test'
  | 'synthetic-transaction-test'
  | 'independent-node-evaluation'
  | 'live-service-check'
  | 'upstream-source-check';
export interface ImplementationArtifact {
  /** Repository-relative path. With a null commit this is a planned publication path. */
  path: string;
  sha256: string;
  commit: string | null;
  url: string | null;
}
export interface ImplementationEvidence {
  id: string;
  kind: ImplementationEvidenceKind;
  /** Source receipt time when available; otherwise the date of the developer observation. */
  observedAt: string | null;
  description: string;
  artifact: ImplementationArtifact;
}
export interface ImplementationCapability {
  id: string;
  title: string;
  environment: ImplementationEnvironment;
  description: string;
  evidenceIds: string[];
}
export interface ImplementationRecord {
  id: string;
  entryIds: string[];
  title: string;
  /** Source availability, not production maturity or chain inclusion. */
  publication: ImplementationPublication;
  summary: string;
  capabilities: ImplementationCapability[];
  evidence: ImplementationEvidence[];
  limits: string[];
  nextEvidence: string[];
}
export interface ImplementationRegister {
  schemaVersion: 1;
  kind: 'beacn.implementation-register';
  asOf: string;
  repository: 'https://github.com/BEACNpool/NFT-Studio';
  sourceCatalog: { path: 'knowledge/catalog.json'; sha256: string };
  description: string;
  records: ImplementationRecord[];
}
export const IMPLEMENTATION_LIMITS: Readonly<{
  bytes: 65536;
  records: 5;
  evidencePerRecord: 12;
  capabilitiesPerRecord: 8;
  depth: 10;
  nodes: 4096;
}>;
export function validateImplementations(
  input: unknown,
  knownEntryIds?: readonly string[],
): ImplementationRegister;
export function parseImplementations(
  jsonText: string,
  knownEntryIds?: readonly string[],
): ImplementationRegister;
/** Lookup helpers require an already validated register. */
export function getImplementation(
  register: ImplementationRegister,
  implementationId: string,
): ImplementationRecord | null;
export function implementationsForEntry(
  register: ImplementationRegister,
  entryId: string,
): ImplementationRecord[];
export function listImplementations(
  register: ImplementationRegister,
  options?: {
    publication?: ImplementationPublication;
    entryId?: string;
    limit?: number;
  },
): ImplementationRecord[];
