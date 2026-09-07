import * as z from "zod/v4";
import { canonicalPassportJson } from "@studio/artifact-passport.ts";
import { preparePayloadBundle } from "@studio/studio-payload.ts";
import {
  createMusicRelease,
  parseMusicRelease,
  musicReleaseBytes,
  musicReleaseBudget,
  MUSIC_RELEASE_SCHEMA,
  MUSIC_RELEASE_PROFILE,
  MUSIC_LIMITS,
} from "@studio/music-release.ts";
import { payloadSchema, fileSchema, decodeFiles } from "./schemas.mjs";

export const MUSIC_REVIEW_URL = "https://beacnpool.github.io/NFT-Studio/?view=labs&lab=music";
export const MUSIC_MCP_LIMITS = Object.freeze({
  argumentJsonBytes: 80 * 1024,
  packageJsonBytes: MUSIC_LIMITS.packageBytes,
  rawFileBytes: 12000,
  files: 8,
  musicJsonBytes: MUSIC_LIMITS.musicJsonBytes,
  metadataCborBytes: MUSIC_LIMITS.metadataCborBytes,
});
export const MUSIC_MCP_CAPABILITIES = Object.freeze({
  schema: MUSIC_RELEASE_SCHEMA,
  profile: MUSIC_RELEASE_PROFILE,
  status: "CIP-60-aligned Studio exact-file extension; not strict v3 CDDL conformance",
  limits: MUSIC_MCP_LIMITS,
  reviewUrl: MUSIC_REVIEW_URL,
  tools: Object.freeze(["create_music_release", "verify_music_release"]),
  transactionPreparation: false,
  signing: false,
  submission: false,
  chainVerification: false,
  rightsVerification: false,
  remoteServerReceivesSuppliedFileBytes: true,
  links: "Artist, contributor and lyrics links are inert declarations; never fetched.",
});

// Discovery describes the complete supported field shape. The shared codec is
// authoritative for UTF-8 byte limits, syntax, dates, shares and cross-file rules.
const text = z.string().min(1).max(64);
const links = z
  .record(z.string().regex(/^[a-z][a-z0-9_]{0,23}$/), text)
  .refine(
    (value) => Object.keys(value).length >= 1 && Object.keys(value).length <= 3,
    "Include one to three labeled HTTPS links.",
  );
const artist = z.strictObject({ name: text, isni: text.optional(), links: links.optional() });
const contributor = z.strictObject({
  name: text,
  ipi: text.optional(),
  ipn: text.optional(),
  role: z.array(text).min(1).max(4).optional(),
  links: links.optional(),
});
const author = z.strictObject({ name: text, share: text, ipi: text.optional() });
export const musicReleaseSchema = z.strictObject({
  release_type: z.enum(["Single", "Multiple"]),
  release_title: text,
  distributor: text.optional(),
  visual_artist: text.optional(),
  release_date: text.optional(),
  publication_date: text.optional(),
  catalog_number: text.optional(),
  series: text.optional(),
  collection: text.optional(),
});
export const musicSongSchema = z.strictObject({
  song_title: z.string().min(1).max(192),
  song_duration: text,
  track_number: z.number().int().min(1).max(999),
  artists: z.array(artist).min(1).max(4),
  copyright: z.strictObject({ master: text, composition: text }),
  genres: z.array(text).min(1).max(3),
  featured_artists: z.array(artist).min(1).max(4).optional(),
  contributing_artists: z.array(contributor).min(1).max(8).optional(),
  authors: z.array(author).min(1).max(8).optional(),
  mood: text.optional(),
  set: text.optional(),
  lyrics: text.optional(),
  special_thanks: z.array(text).min(1).max(8).optional(),
  bitrate: text.optional(),
  bpm: text.optional(),
  mix_engineer: text.optional(),
  mastering_engineer: text.optional(),
  producer: text.optional(),
  co_producer: text.optional(),
  recording_engineer: text.optional(),
  isrc: text.optional(),
  iswc: text.optional(),
  metadata_language: text.optional(),
  country_of_origin: text.optional(),
  language: text.optional(),
  derived_from: text.optional(),
});
export const musicCreateSchema = payloadSchema.extend({
  files: z.array(fileSchema).min(2).max(8),
  release: musicReleaseSchema,
  tracks: z
    .array(z.strictObject({ fileName: text, song: musicSongSchema }))
    .min(1)
    .max(7),
});
export const musicVerifySchema = z.strictObject({
  packetJson: z.string().min(1).max(MUSIC_LIMITS.packageBytes),
});
function argumentsFor(schema, input) {
  // Avoid getters, custom objects, sparse arrays and mutation across async work.
  const snapshot = canonicalPassportJson(input, MUSIC_MCP_LIMITS.argumentJsonBytes);
  return schema.parse(JSON.parse(snapshot));
}
async function packageResult(musicRelease, verified) {
  const packetJson = new TextDecoder().decode(await musicReleaseBytes(musicRelease));
  return {
    schema: "nft-studio.music-package-result.v1",
    valid: true,
    operation: verified ? "verified" : "created",
    musicRelease,
    packageHash: musicRelease.packageHash,
    filename: `nft-studio-${musicRelease.packageHash.slice(0, 12)}.music-release.json`,
    packetJson,
    packageJsonBytes: new TextEncoder().encode(packetJson).length,
    budget: await musicReleaseBudget(musicRelease),
    review: {
      url: MUSIC_REVIEW_URL,
      action:
        "Save packetJson exactly as filename. Open Labs → Music releases, import that file, review exact files and every credit, then explicitly continue to browser wallet review.",
    },
    status: "package-only; no transaction prepared",
    processing: {
      inputBytesReceivedByThisServer: true,
      networkRequestsByTool: false,
      inputBytesPersistedByTool: false,
      declaredLinksFetched: false,
    },
    checks: {
      exactFilesAndCredits: true,
      completeTransactionFit: false,
      transactionPrepared: false,
      signed: false,
      submitted: false,
      chainInclusion: false,
      authorship: false,
      rights: false,
    },
  };
}
export async function createMusicPackage(input) {
  const args = argumentsFor(musicCreateSchema, input);
  const { release, tracks, ...payload } = args;
  const bundle = await preparePayloadBundle({ ...payload, files: decodeFiles(payload.files) });
  return packageResult(await createMusicRelease(bundle, { release, tracks }), false);
}
export async function verifyMusicPackage(input) {
  const args = argumentsFor(musicVerifySchema, input);
  return packageResult(await parseMusicRelease(args.packetJson), true);
}
export function registerMusicTools(register) {
  register(
    "create_music_release",
    "Create a canonical Studio music package from explicit base64 cover/audio bytes, release details and exact credits. Returns packetJson, packageHash, metadata-only budget and a fixed Music Lab link for human import and wallet review. Links in credits are inert data. No media retrieval, wallet data, unsigned transaction, signing, submission or rights verification. Up to 12 KB raw files, 7 tracks and 6 KB music metadata JSON.",
    musicCreateSchema,
    createMusicPackage,
  );
  register(
    "verify_music_release",
    "Verify canonical packetJson from a Studio .music-release.json export using the shared exact-file/credit codec. Rejects changed bytes, hashes, fields and noncanonical JSON presentation, then returns the canonical package and fixed Music Lab review link. Does not establish transaction fit, chain inclusion, authorship or rights. Maximum package JSON 80,000 UTF-8 bytes and wrapped arguments 80 KiB.",
    musicVerifySchema,
    verifyMusicPackage,
  );
}
