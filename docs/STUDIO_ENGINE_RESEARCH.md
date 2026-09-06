# Engine decisions — primary sources checked 2026-09-06

- [CIP-25](https://cips.cardano.org/cip/CIP-0025): image is required; optional
  `files` carries mediaType and src. V1 policy/name map keys are text. Use exact
  data URIs and ledger-sized text chunks. NFT-mode cover enforcement and generic
  attachment metadata follow these constraints; playback support is not mandated.
- [CIP-30](https://cips.cardano.org/cip/CIP-0030): wallet `signTx` returns signed
  witness material; `submitTx` returns a transaction hash. The application merges
  and checks signatures without altering committed bytes and separately observes
  inclusion. Wallet consent is required for every signing call.
- [CIP-10 registry](https://raw.githubusercontent.com/cardano-foundation/CIPs/master/CIP-0010/registry.json):
  no entry for 1313231955 when inspected. NFT Studio uses an explicitly namespaced
  application schema at that unregistered label; no standards registration claim.
- [Koios tx_status implementation](https://raw.githubusercontent.com/cardano-community/koios-artifacts/main/files/grest/rpc/transactions/tx_status.sql):
  its count is current block minus inclusion block; zero is observed inclusion,
  null is absence. Avoid treating zero as pending or null as failure.
- [Koios tx_metadata implementation](https://raw.githubusercontent.com/cardano-community/koios-artifacts/main/files/grest/rpc/transactions/tx_metadata.sql):
  responses bind the requested tx_hash to a metadata-label map. Reject hash
  mismatches and recover only the known payload schema with its hashes checked.
- [MDN iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe):
  omitting allow-same-origin isolates the frame from host origin; sandbox without
  allow-scripts blocks execution. Same-origin plus scripts undermines isolation.
  Untrusted content must stay inside the frame.

Design inference: arbitrary imported JavaScript cannot be safely given the same
capabilities as authored templates while promising that it cannot initiate any
network navigation. Therefore generic imports use a static inert preview; exact
original files remain available for mint and download. Trusted catalog originals
retain their established executable sandbox after content-hash verification.

Policy semantics and transaction-selection/signing rules were checked against the
maintained BMKR implementation and its synthetic suite. No new validator or
consumed-state capability is claimed by the generic native-policy extension.
