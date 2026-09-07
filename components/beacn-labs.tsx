'use client';
import { useState } from 'react';
import { ArrowLeft, FlaskConical, ExternalLink } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { AgentMintPanel } from './agent-mint-panel';
import { AssetInspector } from './asset-inspector';
import { KnowledgePanel } from './knowledge-panel';
import { StateCapsuleLab } from './state-capsule-lab';
import { ProofOfExistenceLab } from './proof-of-existence-lab';
import { ArtifactPassportLab } from './artifact-passport-lab';
export function BeacnLabs({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState(() => {
    const requested =
      typeof location !== 'undefined'
        ? new URLSearchParams(location.search).get('lab')
        : '';
    return [
      'agents',
      'identity',
      'knowledge',
      'capsule',
      'proof',
      'passport',
    ].includes(requested || '')
      ? requested!
      : 'capsule';
  });
  return (
    <section className="ns-labs">
      <button className="ns-back" onClick={onBack}>
        <ArrowLeft size={18} /> Back to Studio
      </button>
      <div className="ns-lab-heading">
        <div>
          <h1>
            <FlaskConical size={28} /> BEACN Labs
          </h1>
        </div>
        <a
          className="ns-text-link"
          href="https://github.com/BEACNpool/NFT-Studio"
          target="_blank"
          rel="noreferrer"
        >
          Open source <ExternalLink size={16} />
        </a>
      </div>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          const url = new URL(location.href);
          url.searchParams.set('lab', value);
          history.replaceState(history.state, '', url);
        }}
        className="ns-lab-tabs"
      >
        <TabsList className="ns-lab-tablist">
          <TabsTrigger value="capsule">State capsule</TabsTrigger>
          <TabsTrigger value="proof">Proof of existence</TabsTrigger>
          <TabsTrigger value="passport">Artifact passport</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
          <TabsTrigger value="identity">Asset inspector</TabsTrigger>
          <TabsTrigger value="agents">Agent minting</TabsTrigger>
        </TabsList>
        <TabsContent value="capsule" keepMounted>
          <StateCapsuleLab />
        </TabsContent>
        <TabsContent value="proof" keepMounted>
          <ProofOfExistenceLab />
        </TabsContent>
        <TabsContent value="passport" keepMounted>
          <ArtifactPassportLab />
        </TabsContent>
        <TabsContent value="knowledge" keepMounted>
          <KnowledgePanel />
        </TabsContent>
        <TabsContent value="identity" keepMounted>
          <AssetInspector />
        </TabsContent>
        <TabsContent value="agents">
          <AgentMintPanel />
        </TabsContent>
      </Tabs>
    </section>
  );
}
