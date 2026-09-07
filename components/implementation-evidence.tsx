'use client';
import { Download } from 'lucide-react';
import { Button } from './ui/button';
import raw from '@/knowledge/implementations.json';
import research from '@/knowledge/catalog.json';
import {
  validateImplementations,
  implementationsForEntry,
  type ImplementationEnvironment,
} from '@/knowledge/implementations.mjs';
import { download, jsonBlob } from '@/lib/export';

const register = validateImplementations(
  raw,
  research.entries.map((entry) => entry.id),
);
const environment: Record<ImplementationEnvironment, string> = {
  'browser-local': 'In the browser',
  'node-local': 'Local runtime tests',
  'independent-node-evaluation': 'Independent node evaluation',
  'public-mcp': 'Public MCP observation',
  'offline-candidate': 'Experimental offline code',
  'repository-tooling': 'Repository tooling',
};
export function evidenceForEntry(entryId: string) {
  return implementationsForEntry(register, entryId);
}

export function ImplementationEvidence({ entryId }: { entryId: string }) {
  const records = evidenceForEntry(entryId);
  if (!records.length) return null;
  return (
    <section className="ns-kb-implementations" data-implementation-evidence>
      <h3>Built at BEACN</h3>
      <p className="ns-lab-muted">
        Implementation evidence recorded {register.asOf.slice(0, 10)}. Each
        capability has its own test environment and limits.
      </p>
      {records.map((record) => (
        <article key={record.id} data-implementation={record.id}>
          <div className="ns-kb-implementation-heading">
            <h4>{record.title}</h4>
            <span>
              {record.publication === 'published'
                ? 'Source published'
                : 'Unpublished candidate'}
            </span>
          </div>
          <p>{record.summary}</p>
          <ul className="ns-kb-capabilities">
            {record.capabilities.map((capability) => (
              <li key={capability.id}>
                <strong>{capability.title}</strong>
                <small>{environment[capability.environment]}</small>
                <p>{capability.description}</p>
              </li>
            ))}
          </ul>
          <details className="ns-kb-implementation-details">
            <summary>Evidence, limitations and next steps</summary>
            <h4>What supports these claims</h4>
            {record.evidence.map((item) => (
              <div key={item.id} className="ns-kb-artifact">
                {item.artifact.url ? (
                  <a href={item.artifact.url} target="_blank" rel="noreferrer">
                    {item.artifact.path}
                  </a>
                ) : (
                  <p>
                    Candidate source awaiting publication: {item.artifact.path}
                  </p>
                )}
                <p>{item.description}</p>
                {item.observedAt && (
                  <small>
                    Observed{' '}
                    {item.observedAt
                      .replace('T', ' ')
                      .replace('.000Z', ' UTC')
                      .replace('Z', ' UTC')}
                  </small>
                )}
                <code>SHA-256 {item.artifact.sha256}</code>
              </div>
            ))}
            <h4>Limitations</h4>
            <ul>
              {record.limits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h4>Next evidence needed</h4>
            <ul>
              {record.nextEvidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        </article>
      ))}
      <Button
        variant="outline"
        onClick={() =>
          download(
            jsonBlob({
              asOf: register.asOf,
              sourceCatalog: register.sourceCatalog,
              records,
            }),
            `${entryId}.implementation-evidence.json`,
          )
        }
      >
        <Download size={16} /> Export implementation evidence
      </Button>
    </section>
  );
}
