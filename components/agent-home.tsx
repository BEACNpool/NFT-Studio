'use client';
import { lazy, Suspense, useEffect, useState } from 'react';
import { AgentLanding } from './agent-landing';
const LegacyStudio = lazy(() =>
  import('./studio-shell').then((m) => ({ default: m.NFTStudio })),
);

// Keep already-shared wallet, lab, recovery and creation links intact. The new
// public front door never asks visitors to operate the historical editor.
export function AgentHome() {
  const [review, setReview] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    setReview(
      query.has('view') ||
        query.has('create') ||
        /^#(?:mint|payload|transfer|handoff)=/.test(location.hash),
    );
  }, []);
  return review ? (
    <Suspense
      fallback={
        <main id="studio-main" className="al-review-loading">
          Opening your NFT review…
        </main>
      }
    >
      <LegacyStudio />
    </Suspense>
  ) : (
    <AgentLanding />
  );
}
