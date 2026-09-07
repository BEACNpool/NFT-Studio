export type MetadataValue = string | number | MetadataValue[] | { [key: string]: MetadataValue };
export type CapsuleMetadata = { name: string; image: string; [key: string]: MetadataValue };
export type PlutusData = { bytes: string } | { int: number } | { list: PlutusData[] } | { map: { k: PlutusData; v: PlutusData }[] } | { constructor: number; fields: PlutusData[] };
export interface CapsuleState {
  schema: 'beacn.state-capsule.v1';
  metadata: CapsuleMetadata;
  sequence: number;
  frozen: boolean;
  previousDatumHash: string;
  datum: PlutusData;
  datumCborHex: string;
  datumHash: string;
  datumBytes: number;
}
export const CAPSULE_SCHEMA: 'beacn.state-capsule.v1';
export const MAX_DATUM_BYTES: 4096;
export const MAX_SEQUENCE: number;
export const REDEEMERS: Readonly<{ mint: 'd87980'; evolve: 'd87980'; freeze: 'd87a80' }>;
export function toHex(bytes: Uint8Array): string;
export function fromHex(hex: string): Uint8Array;
export function utf8Chunks(value: string, max?: number): string[];
export function serialiseData(data: PlutusData): Uint8Array;
export function assetNames(baseName: string): { baseNameHex: string; referenceAssetNameHex: string; userAssetNameHex: string };
export function buildDatum(options: { metadata: CapsuleMetadata; sequence?: number; frozen?: boolean; previousDatumHash?: string }): CapsuleState;
export function verifyState(state: unknown): CapsuleState;
export function transition(previous: CapsuleState, options?: { action?: 'evolve' | 'freeze'; metadata?: CapsuleMetadata }): CapsuleState;
export function verifyHistory(states: CapsuleState[]): { valid: true; states: number; tipHash: string; frozen: boolean; evidence: 'local-data-only' };
