/// CIP-68's mandatory constructor-0, three-field envelope.
pub type CapsuleDatum {
  metadata: Pairs<ByteArray, Data>,
  version: Int,
  extra: CapsuleState,
}

/// Application schema version is separate from the CIP-68 metadata version.
pub type CapsuleState {
  schema: Int,
  sequence: Int,
  frozen: Bool,
  previous_datum_hash: ByteArray,
}

pub type Action {
  Evolve
  Freeze
}
