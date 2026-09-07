/** Fixed implementation observations beside research, never a mutation or admission step. */
import catalog from '@knowledge/catalog.json';
import rawRegister from '@knowledge/implementations.json';
import {validateImplementations,implementationsForEntry} from '@knowledge/implementations.mjs';
export const IMPLEMENTATIONS_URI='nft-studio://implementations';
export const implementationRegister=validateImplementations(rawRegister,catalog.entries.map(entry=>entry.id));
export function implementationLinks(entryId){
  return {resourceUri:IMPLEMENTATIONS_URI,recordIds:implementationsForEntry(implementationRegister,entryId).map(record=>record.id)};
}
