# Desktop creation → mobile wallet

Open an MCP mint review in Studio, choose **Continue on phone**, then **Create QR code**.
Scan with Android's camera. Studio opens and verifies the same files. Choose **Open in
wallet browser**, select VESPR if Android asks, then use the normal wallet review.
If Android does not route the browser link, **Copy creation link** and paste it into
VESPR's in-app browser. A generic mobile browser does not itself provide wallet signing.

The app remains at `https://beacnpool.github.io/NFT-Studio/`. The short QR contains a
random transfer ID and a fresh AES-256-GCM key in its URL fragment. Studio clears the
fragment before fetching. Its relay at `https://handoff.beacnpool.org/api/handoffs`
receives only bounded ciphertext and a fresh nonce. It never receives the decryption
key, wallet addresses, signing keys, wallet snapshots or transaction witnesses.

The receiving browser verifies authenticated encryption, the intent schema and every
file hash. Hashes establish content identity, not authorship or trust. The link is a
bearer capability: anyone with the full link can open the request until expiry. Share
it only with intended reviewers. The key appears in the QR, clipboard when copied,
and the receiving tab's session storage, so that a reload can re-fetch and verify it.
Clearing the request clears that tab's saved transfer. No persistent local draft is
silently created.

Access expires after 15 minutes. Reads are repeatable so the Android camera browser
can hand the same request to VESPR's separate WebView. **End transfer** clears the
stored ciphertext using a separate creator token. It cannot erase copies already
opened or saved. Expired rows are inaccessible and purged on the next creation;
database backups may retain encrypted bytes. No automatic wallet access, signing,
submission, remote-control session or mint-confirmation callback is provided.

The server admits at most 300 unexpired requests globally and 20 per client in a
15-minute window. A daily rotating IP hash supports this admission limit; it is not
an anonymity guarantee. Revocation retains the admission record until expiry. Requests
are capped at 80,000 plaintext bytes plus the authentication tag. CORS permits the
public Studio and branded handoff origin; CORS is not authentication. Responses are
`no-store`, queryable only by unpredictable IDs, and do not expose creator tokens or
rate identifiers. This is a small transfer service, not permanent NFT hosting.

`Save request` remains the offline fallback: move the JSON file to the phone and
import it into Studio from the wallet browser.

## Runtime and checks

The transfer route uses a D1 binding named `DB`. `db/schema.ts` defines its only table;
Drizzle migrations in `drizzle/` own schema changes. Apply migrations before routing
requests; runtime code never creates tables. Keep the project hosting manifest private.

For the existing Sites release: stage the normal app/MCP wrapper, run
`node scripts/stage-handoff.mjs /path/to/staged/dist`, and package that exact build with
the Sites packaging helper. Preserve `/api/mcp` and the existing application route.
The public Pages bundle contains only the fixed branded relay URL, never a personal
hosting namespace or a private hosting manifest.

`npm run verify:handoff` exercises encryption/tampering, an independent QR decoder,
real Workerd/D1 storage, repeat retrieval, revocation, expiry, CORS, size and concurrent
admission limits. Browser capture checks must also cover two separate contexts,
fragment clearing, reload, the exact CIP-158 navigation link and clear-request behavior.
Synthetic provider tests do not establish a real Android/VESPR signature. Record the
actual device result separately before advertising end-to-end mobile mint completion.
