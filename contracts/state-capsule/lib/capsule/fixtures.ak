use aiken/cbor
use aiken/crypto.{blake2b_256}
use capsule/types.{CapsuleDatum, CapsuleState}
use cardano/address.{Address, Script, VerificationKey}
use cardano/assets
use cardano/transaction.{
  InlineDatum, Input, NoDatum, Output, OutputReference, Transaction, placeholder,
}

pub const policy = #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

pub const owner = #"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

pub const stranger = #"cccccccccccccccccccccccccccccccccccccccccccccccccccccccc"

pub const base = "CAPSULE"

pub const ref_name = #"000643b043415053554c45"

pub const usr_name = #"000de14043415053554c45"

pub fn reference(index: Int) -> OutputReference {
  OutputReference {
    transaction_id: #"1111111111111111111111111111111111111111111111111111111111111111",
    output_index: index,
  }
}

pub fn holder() -> Address {
  Address { payment_credential: VerificationKey(owner), stake_credential: None }
}

pub fn state_address() -> Address {
  Address { payment_credential: Script(policy), stake_credential: None }
}

pub fn genesis() -> CapsuleDatum {
  let image: Data = ["data:image/svg+xml,<svg/>"]
  let name: Data = "BEACN State Capsule"
  CapsuleDatum {
    metadata: [Pair("image", image), Pair("name", name)],
    version: 1,
    extra: CapsuleState {
      schema: 1,
      sequence: 0,
      frozen: False,
      previous_datum_hash: #"",
    },
  }
}

pub fn advance(old: CapsuleDatum, frozen: Bool) -> CapsuleDatum {
  CapsuleDatum {
    ..old,
    extra: CapsuleState {
      schema: 1,
      sequence: old.extra.sequence + 1,
      frozen,
      previous_datum_hash: blake2b_256(cbor.serialise(old)),
    },
  }
}

pub fn state_output(datum: CapsuleDatum) -> Output {
  Output {
    address: state_address(),
    value: assets.from_lovelace(3_000_000)
      |> assets.merge(assets.from_asset(policy, ref_name, 1)),
    datum: InlineDatum(datum),
    reference_script: None,
  }
}

pub fn user_output() -> Output {
  Output {
    address: holder(),
    value: assets.from_lovelace(3_000_000)
      |> assets.merge(assets.from_asset(policy, usr_name, 1)),
    datum: NoDatum,
    reference_script: None,
  }
}

pub fn seed_input() -> Input {
  Input {
    output_reference: reference(0),
    output: Output { ..user_output(), value: assets.from_lovelace(20_000_000) },
  }
}

pub fn state_input(old: CapsuleDatum) -> Input {
  Input { output_reference: reference(1), output: state_output(old) }
}

pub fn holder_input() -> Input {
  Input { output_reference: reference(2), output: user_output() }
}

pub fn mint_tx() -> Transaction {
  Transaction {
    ..placeholder,
    inputs: [seed_input()],
    outputs: [state_output(genesis()), user_output()],
    mint: assets.from_asset(policy, ref_name, 1)
      |> assets.merge(assets.from_asset(policy, usr_name, 1)),
    extra_signatories: [owner],
  }
}

pub fn update_tx(old: CapsuleDatum, next: CapsuleDatum) -> Transaction {
  Transaction {
    ..placeholder,
    inputs: [state_input(old), holder_input()],
    outputs: [state_output(next), user_output()],
    extra_signatories: [owner],
  }
}
