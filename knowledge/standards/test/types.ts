import { createStandardsCorpus } from '../lib.mjs';
async function verifyTypes(indexJson: string, documents: Record<string,string>) {
  const corpus = await createStandardsCorpus({indexJson,documents});
  const chunk = corpus.getChunk({id:'CIP-0026',offsetBytes:0,limitBytes:8192});
  const next:number|null = chunk.nextOffsetBytes;
  const original = corpus.getDocument({id:'CIP-0026'});
  const complete:true = original.complete;
  const count:number = corpus.search({query:'music',limit:12}).totalMatches;
  // @ts-expect-error No caller URL input.
  corpus.getChunk({id:'CIP-0026',url:'https://example.com'});
  // @ts-expect-error Offsets are numbers, never coercible strings.
  corpus.getChunk({id:'CIP-0026',offsetBytes:'0'});
  // @ts-expect-error Returned state is readonly.
  corpus.index.entries[0].title='mutable';
  return {next,complete,count};
}
void verifyTypes;
