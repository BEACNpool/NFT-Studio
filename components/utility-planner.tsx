'use client';
import { useState } from 'react';
import { Download, Plus, Check, ArrowUpRight } from 'lucide-react';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { UTILITIES } from '@/lib/utility';
import type { Artwork, Utility } from '@/lib/art';
import { download, filename, jsonBlob, utilityPlan } from '@/lib/export';
import { assetPath } from '@/lib/paths';
export function UtilityPlanner({
  art,
  onChange,
}: {
  art: Artwork;
  onChange: (art: Artwork) => void;
}) {
  const [active, setActive] = useState('membership');
  const entry = UTILITIES.find((u) => u.id === active)!;
  const selected = art.utilities.find((u) => u.id === active);
  const toggle = () =>
    onChange({
      ...art,
      utilities: selected
        ? art.utilities.filter((u) => u.id !== active)
        : [
            ...art.utilities,
            {
              id: active,
              benefit: entry.benefit,
              terms: entry.terms,
              destination: '',
              eligibility: 'Current holder',
              starts: '',
              ends: '',
            },
          ],
    });
  const patch = (value: Partial<Utility>) =>
    onChange({
      ...art,
      utilities: art.utilities.map((u) =>
        u.id === active ? { ...u, ...value } : u,
      ),
    });
  return (
    <section className="ns-utility-planner">
      <div className="ns-tool-intro">
        <p className="ns-eyebrow">DESIGN A BENEFIT · IMPLEMENTATION REQUIRED</p>
        <h2>Make the promise precise.</h2>
        <p>
          Plan membership, content, events, redemption, evolving art and
          community benefits. These records describe a plan; they do not
          activate access, track a claim or enforce a contract.
        </p>
      </div>
      <div className="ns-planner-grid">
        <div className="ns-panel">
          <label className="ns-field" htmlFor="benefit-type">
            Benefit type
            <Select value={active} onValueChange={(v) => v && setActive(v)}>
              <SelectTrigger id="benefit-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UTILITIES.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                    {art.utilities.some((s) => s.id === u.id)
                      ? ' · included'
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <h2>{entry.name}</h2>
          <p className="ns-fineprint">{entry.example}</p>
          <Button variant="outline" onClick={toggle}>
            {selected ? <Check size={16} /> : <Plus size={16} />}{' '}
            {selected ? 'Remove from plan' : 'Add to plan'}
          </Button>
          <div className="ns-inline-note">
            <p>
              <strong>To make this work:</strong>
              <br />
              {entry.needs}
            </p>
          </div>
        </div>
        <div className="ns-panel">
          {selected ? (
            <>
              <label className="ns-field">
                What does the holder receive?
                <textarea
                  rows={3}
                  maxLength={500}
                  value={selected.benefit}
                  onChange={(e) => patch({ benefit: e.target.value })}
                />
              </label>
              <label className="ns-field">
                Who is eligible?
                <input
                  maxLength={200}
                  value={selected.eligibility}
                  onChange={(e) => patch({ eligibility: e.target.value })}
                />
              </label>
              <label className="ns-field">
                Public service link
                <input
                  type="url"
                  maxLength={500}
                  placeholder="https://your-service.example"
                  value={selected.destination}
                  onChange={(e) => patch({ destination: e.target.value })}
                />
              </label>
              <label className="ns-field">
                Terms and limits
                <textarea
                  rows={4}
                  maxLength={1000}
                  value={selected.terms}
                  onChange={(e) => patch({ terms: e.target.value })}
                />
              </label>
              <div className="ns-plan-dates">
                <label className="ns-field">
                  Starts
                  <input
                    type="date"
                    value={selected.starts}
                    onChange={(e) => patch({ starts: e.target.value })}
                  />
                </label>
                <label className="ns-field">
                  Ends
                  <input
                    type="date"
                    value={selected.ends}
                    onChange={(e) => patch({ ends: e.target.value })}
                  />
                </label>
              </div>
            </>
          ) : (
            <div className="ns-preview-empty">
              <h3>Start with one clear benefit.</h3>
              <p>
                Add it to your plan, then describe exactly what a collector can
                expect.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="ns-button-row">
        <Button
          variant="outline"
          disabled={!art.utilities.length}
          onClick={() =>
            download(
              jsonBlob(utilityPlan(art)),
              filename(art.name) + '.utility-plan.json',
            )
          }
        >
          <Download size={16} />
          Export {art.utilities.length || ''} benefit plan
          {art.utilities.length === 1 ? '' : 's'}
        </Button>
        <a
          className="ns-text-link"
          href={assetPath('/legacy/oligarCH/make/index.html')}
          target="_blank"
          rel="noreferrer"
        >
          Open the existing oligarCH holder-gated maker
          <ArrowUpRight size={16} />
        </a>
      </div>
      <p className="ns-fineprint">
        The oligarCH maker is a separate, fixed collection policy. Its existing
        eligible holders can use it; it is not a general-purpose gate for new
        collections.
      </p>
    </section>
  );
}
