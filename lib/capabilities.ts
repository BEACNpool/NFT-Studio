import inventory from './capability-catalog.json';
import presets from './interactive-presets.json';

// This describes existing evidence. Admission to a new mint route requires that
// route's actual transaction and viewer checks; a catalog row is not enforcement.
export const CAPABILITY_CATALOG = inventory;
export const INTERACTIVE_PRESETS = presets;
export type CapabilityKind =
  | 'configurable-creator'
  | 'fixed-original-copy'
  | 'fixed-original'
  | 'fixed-campaign'
  | 'frozen-scroll-original'
  | 'existing-specialty-creator'
  | 'attributed-demonstration'
  | 'service-or-contract-blueprint';

export function findCapability(id: string) {
  return [...inventory.creators, ...inventory.originals].find(item => item.id === id);
}

export function catalogMediaPath(path: string) {
  if (!path.startsWith('public/') || path.includes('..') || path.includes('\\'))
    throw new Error('Invalid catalog media path.');
  return path.slice('public'.length);
}
