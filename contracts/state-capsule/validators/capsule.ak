//// Experimental contract. Not audited; issuance has independent node evaluation evidence.
//// Spending still has local compiled-test evidence only.
//// Both handlers compile to IDENTICAL bytes: policy ID = spending script hash.
//// Never split these handlers or deploy a blueprint without checking that equality.

use aiken/cbor
use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{blake2b_256}
use aiken/fuzz
use aiken/primitive/bytearray
use capsule/fixtures as f
use capsule/types.{Action, CapsuleDatum, CapsuleState, Evolve, Freeze}
use cardano/address.{Address, Inline, Script, VerificationKey}
use cardano/assets.{PolicyId}
use cardano/transaction.{
  DatumHash, InlineDatum, Input, NoDatum, Output, OutputReference, Transaction,
}

pub const max_sequence = 9_223_372_036_854_775_807

pub fn reference_name(base_name: ByteArray) -> ByteArray {
  bytearray.concat(#"000643b0", base_name)
}

pub fn user_name(base_name: ByteArray) -> ByteArray {
  bytearray.concat(#"000de140", base_name)
}

/// The fixed envelope and core display fields are checked on-chain. Extra metadata
/// fields are opaque public Plutus data; the off-chain codec accepts CIP-68 values.
pub fn valid_datum(datum: CapsuleDatum) -> Bool {
  expect datum.version == 1
  expect datum.extra.schema == 1
  expect datum.extra.sequence >= 0 && datum.extra.sequence <= max_sequence
  expect
    bytearray.length(datum.extra.previous_datum_hash) == if datum.extra.sequence == 0 {
      0
    } else {
      32
    }
  expect bytearray.length(cbor.serialise(datum)) <= 4_096
  let metadata = dict.from_ascending_pairs(datum.metadata)
  expect Some(name_data) = dict.get(metadata, "name")
  expect name: ByteArray = name_data
  expect bytearray.length(name) >= 1 && bytearray.length(name) <= 64
  expect Some(image_data) = dict.get(metadata, "image")
  expect chunks: List<ByteArray> = image_data
  expect list.length(chunks) >= 1 && list.length(chunks) <= 48
  list.all(
    chunks,
    fn(chunk) { bytearray.length(chunk) >= 1 && bytearray.length(chunk) <= 64 },
  )
}

fn reference_output(
  outputs: List<Output>,
  policy: PolicyId,
  name: ByteArray,
) -> Output {
  expect [output] = list.filter(
    outputs,
    fn(o) { assets.quantity_of(o.value, policy, name) != 0 },
  )
  expect
    assets.without_lovelace(output.value) == assets.from_asset(policy, name, 1)
  expect InlineDatum(_) = output.datum
  expect output.reference_script == None
  output
}

fn retained_user(
  outputs: List<Output>,
  policy: PolicyId,
  name: ByteArray,
  holder: Address,
) -> Bool {
  expect [output] = list.filter(
    outputs,
    fn(o) { assets.quantity_of(o.value, policy, name) != 0 },
  )
  and {
    output.address == holder,
    assets.quantity_of(output.value, policy, name) == 1,
  }
}

validator capsule(seed: OutputReference, base_name: ByteArray) {
  mint(_redeemer: Void, own_policy: PolicyId, self: Transaction) {
    expect bytearray.length(seed.transaction_id) == 32 && seed.output_index >= 0
    expect bytearray.length(base_name) >= 1 && bytearray.length(base_name) <= 28
    let reference = reference_name(base_name)
    let user = user_name(base_name)
    expect
      dict.to_pairs(assets.tokens(self.mint, own_policy)) == [
        Pair(reference, 1), Pair(user, 1),
      ]
    expect [seed_input] = list.filter(
      self.inputs,
      fn(i) { i.output_reference == seed },
    )
    expect VerificationKey(issuer) = seed_input.output.address.payment_credential
    expect list.has(self.extra_signatories, issuer)
    // No pre-existing token can be laundered through the issuance path.
    expect
      list.all(
        self.inputs,
        fn(i) { dict.is_empty(assets.tokens(i.output.value, own_policy)) },
      )
    let output = reference_output(self.outputs, own_policy, reference)
    expect
      output.address == Address {
        payment_credential: Script(own_policy),
        stake_credential: None,
      }
    expect InlineDatum(raw) = output.datum
    expect datum: CapsuleDatum = raw
    and {
      valid_datum(datum),
      datum.extra.sequence == 0,
      !datum.extra.frozen,
      retained_user(self.outputs, own_policy, user, seed_input.output.address),
    }
  }

  spend(
    datum: Option<CapsuleDatum>,
    action: Action,
    own_ref: OutputReference,
    self: Transaction,
  ) {
    expect Some(old) = datum
    expect valid_datum(old)
    expect !old.extra.frozen
    expect old.extra.sequence < max_sequence
    expect [own_input] = list.filter(
      self.inputs,
      fn(i) { i.output_reference == own_ref },
    )
    expect InlineDatum(raw_old) = own_input.output.datum
    let expected_old: Data = old
    expect raw_old == expected_old
    expect Script(own_policy) = own_input.output.address.payment_credential
    let reference = reference_name(base_name)
    let user = user_name(base_name)
    expect
      assets.without_lovelace(own_input.output.value) == assets.from_asset(
        own_policy,
        reference,
        1,
      )
    expect [state_input] = list.filter(
      self.inputs,
      fn(i) { assets.quantity_of(i.output.value, own_policy, reference) != 0 },
    )
    expect state_input.output_reference == own_ref
    expect dict.is_empty(assets.tokens(self.mint, own_policy))
    // Reference inputs are deliberately excluded. Script custody is also excluded.
    expect [holder_input] = list.filter(
      self.inputs,
      fn(i) { assets.quantity_of(i.output.value, own_policy, user) != 0 },
    )
    expect assets.quantity_of(holder_input.output.value, own_policy, user) == 1
    expect VerificationKey(holder) = holder_input.output.address.payment_credential
    expect list.has(self.extra_signatories, holder)
    expect
      retained_user(self.outputs, own_policy, user, holder_input.output.address)
    let next_output = reference_output(self.outputs, own_policy, reference)
    expect next_output.address == own_input.output.address
    // The state cannot be drained to finance fees; additions accommodate min-ADA increases.
    expect
      assets.lovelace_of(next_output.value) >= assets.lovelace_of(
        own_input.output.value,
      )
    expect InlineDatum(raw_next) = next_output.datum
    expect next: CapsuleDatum = raw_next
    and {
      valid_datum(next),
      next.extra.sequence == old.extra.sequence + 1,
      next.extra.previous_datum_hash == blake2b_256(cbor.serialise(raw_old)),
      when action is {
        Evolve -> !next.extra.frozen
        // Sealing is a distinct action. The image/metadata cannot change at the same time.
        Freeze -> next.extra.frozen && next.metadata == old.metadata
      },
    }
  }

  else(_) {
    fail
  }
}

// Synthetic script-context tests. Ledger phase-1 validation is separate.
fn mint(tx: Transaction) -> Bool {
  capsule.mint(f.reference(0), f.base, Void, f.policy, tx)
}

fn evolve(old: CapsuleDatum, tx: Transaction) -> Bool {
  capsule.spend(f.reference(0), f.base, Some(old), Evolve, f.reference(1), tx)
}

fn freeze(old: CapsuleDatum, tx: Transaction) -> Bool {
  capsule.spend(f.reference(0), f.base, Some(old), Freeze, f.reference(1), tx)
}

fn update() -> Transaction {
  f.update_tx(f.genesis(), f.advance(f.genesis(), False))
}

fn next() -> CapsuleDatum {
  f.advance(f.genesis(), False)
}

fn replacing_next(datum: CapsuleDatum) -> Transaction {
  Transaction { ..update(), outputs: [f.state_output(datum), f.user_output()] }
}

test mint_pair() {
  mint(f.mint_tx())
}

test evolve_valid() {
  evolve(f.genesis(), update())
}

test freeze_valid() {
  freeze(f.genesis(), f.update_tx(f.genesis(), f.advance(f.genesis(), True)))
}

test mint_fails_reference_only_seed() fail {
  mint(
    Transaction {
      ..f.mint_tx(),
      inputs: [],
      reference_inputs: [f.seed_input()],
    },
  )
}

test mint_fails_wrong_seed() fail {
  let seed = Input { ..f.seed_input(), output_reference: f.reference(7) }
  mint(Transaction { ..f.mint_tx(), inputs: [seed] })
}

test mint_fails_missing_signer() fail {
  mint(Transaction { ..f.mint_tx(), extra_signatories: [] })
}

test mint_fails_wrong_signer() fail {
  mint(Transaction { ..f.mint_tx(), extra_signatories: [f.stranger] })
}

test mint_fails_script_seed() fail {
  let seed = Input {
    ..f.seed_input(),
    output: Output { ..f.seed_input().output, address: f.state_address() },
  }
  mint(Transaction { ..f.mint_tx(), inputs: [seed] })
}

test mint_fails_inflation() fail {
  mint(
    Transaction {
      ..f.mint_tx(),
      mint: assets.add(f.mint_tx().mint, f.policy, f.usr_name, 1),
    },
  )
}

test mint_fails_only_user_token() fail {
  mint(
    Transaction {
      ..f.mint_tx(),
      mint: assets.from_asset(f.policy, f.usr_name, 1),
    },
  )
}

test mint_fails_wrong_names() fail {
  mint(
    Transaction {
      ..f.mint_tx(),
      mint: assets.from_asset(f.policy, "FAKE", 1)
        |> assets.merge(assets.from_asset(f.policy, f.ref_name, 1)),
    },
  )
}

test mint_fails_third_token() fail {
  mint(
    Transaction {
      ..f.mint_tx(),
      mint: assets.add(f.mint_tx().mint, f.policy, "EXTRA", 1),
    },
  )
}

test mint_fails_burn() fail {
  mint(Transaction { ..f.mint_tx(), mint: assets.negate(f.mint_tx().mint) })
}

test mint_fails_reference_escape() fail {
  let state = Output { ..f.state_output(f.genesis()), address: f.holder() }
  mint(Transaction { ..f.mint_tx(), outputs: [state, f.user_output()] })
}

test mint_fails_holder_escape() fail {
  let user = Output {
    ..f.user_output(),
    address: Address {
      payment_credential: VerificationKey(f.stranger),
      stake_credential: None,
    },
  }
  mint(
    Transaction { ..f.mint_tx(), outputs: [f.state_output(f.genesis()), user] },
  )
}

test mint_fails_genesis_sequence() fail {
  mint(
    Transaction {
      ..f.mint_tx(),
      outputs: [f.state_output(next()), f.user_output()],
    },
  )
}

test mint_fails_genesis_frozen() fail {
  let old = f.genesis()
  let frozen = CapsuleDatum {
    ..old,
    extra: CapsuleState { ..old.extra, frozen: True },
  }
  mint(
    Transaction {
      ..f.mint_tx(),
      outputs: [f.state_output(frozen), f.user_output()],
    },
  )
}

test mint_fails_genesis_hash() fail {
  let old = f.genesis()
  let bad = CapsuleDatum {
    ..old,
    extra: CapsuleState { ..old.extra, previous_datum_hash: #"01" },
  }
  mint(
    Transaction {
      ..f.mint_tx(),
      outputs: [f.state_output(bad), f.user_output()],
    },
  )
}

test mint_fails_reissuance_existing_pair() fail {
  mint(
    Transaction { ..f.mint_tx(), inputs: [f.seed_input(), f.holder_input()] },
  )
}

test mint_fails_empty_base() fail {
  capsule.mint(f.reference(0), #"", Void, f.policy, f.mint_tx())
}

test mint_fails_long_base() fail {
  capsule.mint(
    f.reference(0),
    "12345678901234567890123456789",
    Void,
    f.policy,
    f.mint_tx(),
  )
}

test update_fails_reference_only_holder() fail {
  evolve(
    f.genesis(),
    Transaction {
      ..update(),
      inputs: [f.state_input(f.genesis())],
      reference_inputs: [f.holder_input()],
    },
  )
}

test update_fails_missing_signer() fail {
  evolve(f.genesis(), Transaction { ..update(), extra_signatories: [] })
}

test update_fails_wrong_signer() fail {
  evolve(
    f.genesis(),
    Transaction { ..update(), extra_signatories: [f.stranger] },
  )
}

test update_fails_script_holder() fail {
  let held = Input {
    ..f.holder_input(),
    output: Output { ..f.user_output(), address: f.state_address() },
  }
  evolve(
    f.genesis(),
    Transaction { ..update(), inputs: [f.state_input(f.genesis()), held] },
  )
}

test update_fails_wrong_policy() fail {
  let held = Input {
    ..f.holder_input(),
    output: Output {
      ..f.user_output(),
      value: assets.from_asset(f.stranger, f.usr_name, 1),
    },
  }
  evolve(
    f.genesis(),
    Transaction { ..update(), inputs: [f.state_input(f.genesis()), held] },
  )
}

test update_fails_wrong_user_name() fail {
  let held = Input {
    ..f.holder_input(),
    output: Output {
      ..f.user_output(),
      value: assets.from_asset(f.policy, "CAPSULE", 1),
    },
  }
  evolve(
    f.genesis(),
    Transaction { ..update(), inputs: [f.state_input(f.genesis()), held] },
  )
}

test update_fails_user_quantity_two() fail {
  let held = Input {
    ..f.holder_input(),
    output: Output {
      ..f.user_output(),
      value: assets.from_asset(f.policy, f.usr_name, 2),
    },
  }
  evolve(
    f.genesis(),
    Transaction { ..update(), inputs: [f.state_input(f.genesis()), held] },
  )
}

test update_fails_duplicate_holder_input() fail {
  let held = Input { ..f.holder_input(), output_reference: f.reference(8) }
  evolve(
    f.genesis(),
    Transaction {
      ..update(),
      inputs: [f.state_input(f.genesis()), f.holder_input(), held],
    },
  )
}

test update_fails_user_not_returned() fail {
  evolve(
    f.genesis(),
    Transaction { ..update(), outputs: [f.state_output(next())] },
  )
}

test update_fails_user_returned_to_stranger() fail {
  let user = Output {
    ..f.user_output(),
    address: Address {
      payment_credential: VerificationKey(f.stranger),
      stake_credential: None,
    },
  }
  evolve(
    f.genesis(),
    Transaction { ..update(), outputs: [f.state_output(next()), user] },
  )
}

test update_fails_duplicate_user_output() fail {
  evolve(
    f.genesis(),
    Transaction {
      ..update(),
      outputs: [f.state_output(next()), f.user_output(), f.user_output()],
    },
  )
}

test update_fails_user_return_quantity_two() fail {
  let user = Output {
    ..f.user_output(),
    value: assets.from_asset(f.policy, f.usr_name, 2),
  }
  evolve(
    f.genesis(),
    Transaction { ..update(), outputs: [f.state_output(next()), user] },
  )
}

test update_fails_same_payment_different_stake() fail {
  let user = Output {
    ..f.user_output(),
    address: Address {
      ..f.holder(),
      stake_credential: Some(Inline(VerificationKey(f.stranger))),
    },
  }
  evolve(
    f.genesis(),
    Transaction { ..update(), outputs: [f.state_output(next()), user] },
  )
}

test update_fails_state_not_continued() fail {
  evolve(f.genesis(), Transaction { ..update(), outputs: [f.user_output()] })
}

test update_fails_reference_escape() fail {
  let state = Output { ..f.state_output(next()), address: f.holder() }
  evolve(
    f.genesis(),
    Transaction { ..update(), outputs: [state, f.user_output()] },
  )
}

test update_fails_duplicate_state_output() fail {
  evolve(
    f.genesis(),
    Transaction {
      ..update(),
      outputs: [f.state_output(next()), f.state_output(next()), f.user_output()],
    },
  )
}

test update_fails_duplicate_state_input() fail {
  let state = Input {
    ..f.state_input(f.genesis()),
    output_reference: f.reference(8),
  }
  evolve(
    f.genesis(),
    Transaction {
      ..update(),
      inputs: [f.state_input(f.genesis()), state, f.holder_input()],
    },
  )
}

test update_fails_wrong_state_quantity() fail {
  let state = Output {
    ..f.state_output(next()),
    value: assets.from_asset(f.policy, f.ref_name, 2),
  }
  evolve(
    f.genesis(),
    Transaction { ..update(), outputs: [state, f.user_output()] },
  )
}

test update_fails_state_drain() fail {
  let state = Output {
    ..f.state_output(next()),
    value: assets.add(f.state_output(next()).value, #"", #"", -1),
  }
  evolve(
    f.genesis(),
    Transaction { ..update(), outputs: [state, f.user_output()] },
  )
}

test update_can_add_lovelace() {
  let state = Output {
    ..f.state_output(next()),
    value: assets.add(f.state_output(next()).value, #"", #"", 1_000_000),
  }
  evolve(
    f.genesis(),
    Transaction { ..update(), outputs: [state, f.user_output()] },
  )
}

test update_fails_foreign_token_in_state() fail {
  let state = Output {
    ..f.state_output(next()),
    value: assets.add(f.state_output(next()).value, f.stranger, "junk", 1),
  }
  evolve(
    f.genesis(),
    Transaction { ..update(), outputs: [state, f.user_output()] },
  )
}

test update_fails_inline_datum_removed() fail {
  let state = Output { ..f.state_output(next()), datum: NoDatum }
  evolve(
    f.genesis(),
    Transaction { ..update(), outputs: [state, f.user_output()] },
  )
}

test update_fails_hash_datum() fail {
  let state = Output {
    ..f.state_output(next()),
    datum: DatumHash(next().extra.previous_datum_hash),
  }
  evolve(
    f.genesis(),
    Transaction { ..update(), outputs: [state, f.user_output()] },
  )
}

test update_fails_reference_script_added() fail {
  let state = Output {
    ..f.state_output(next()),
    reference_script: Some(f.stranger),
  }
  evolve(
    f.genesis(),
    Transaction { ..update(), outputs: [state, f.user_output()] },
  )
}

test update_fails_state_version_change() fail {
  evolve(f.genesis(), replacing_next(CapsuleDatum { ..next(), version: 2 }))
}

test update_fails_schema_change() fail {
  evolve(
    f.genesis(),
    replacing_next(
      CapsuleDatum {
        ..next(),
        extra: CapsuleState { ..next().extra, schema: 2 },
      },
    ),
  )
}

test update_fails_sequence_replay() fail {
  evolve(next(), f.update_tx(next(), next()))
}

test update_fails_sequence_skip() fail {
  evolve(
    f.genesis(),
    replacing_next(
      CapsuleDatum {
        ..next(),
        extra: CapsuleState { ..next().extra, sequence: 2 },
      },
    ),
  )
}

test update_fails_wrong_prior_hash() fail {
  evolve(
    f.genesis(),
    replacing_next(
      CapsuleDatum {
        ..next(),
        extra: CapsuleState {
          ..next().extra,
          previous_datum_hash: f.reference(0).transaction_id,
        },
      },
    ),
  )
}

test update_fails_zero_prior_hash() fail {
  evolve(
    f.genesis(),
    replacing_next(
      CapsuleDatum {
        ..next(),
        extra: CapsuleState { ..next().extra, previous_datum_hash: #"" },
      },
    ),
  )
}

test update_fails_burn_user() fail {
  evolve(
    f.genesis(),
    Transaction {
      ..update(),
      mint: assets.from_asset(f.policy, f.usr_name, -1),
    },
  )
}

test update_fails_burn_reference() fail {
  evolve(
    f.genesis(),
    Transaction {
      ..update(),
      mint: assets.from_asset(f.policy, f.ref_name, -1),
    },
  )
}

test update_fails_mint_another() fail {
  evolve(
    f.genesis(),
    Transaction { ..update(), mint: assets.from_asset(f.policy, "extra", 1) },
  )
}

test frozen_fails_evolve() fail {
  let frozen = f.advance(f.genesis(), True)
  evolve(frozen, f.update_tx(frozen, f.advance(frozen, False)))
}

test frozen_fails_freeze_again() fail {
  let frozen = f.advance(f.genesis(), True)
  freeze(frozen, f.update_tx(frozen, f.advance(frozen, True)))
}

test evolve_fails_sneaky_freeze() fail {
  evolve(f.genesis(), f.update_tx(f.genesis(), f.advance(f.genesis(), True)))
}

test freeze_fails_mutable_successor() fail {
  freeze(f.genesis(), update())
}

test freeze_fails_metadata_change() fail {
  let name: Data = "changed while sealing"
  let image: Data = ["data:image/svg+xml,<svg/>"]
  let updated = CapsuleDatum {
    ..f.advance(f.genesis(), True),
    metadata: [Pair("image", image), Pair("name", name)],
  }
  freeze(f.genesis(), replacing_next(updated))
}

test datum_fails_duplicate_keys() fail {
  let name: Data = "ambiguous"
  valid_datum(
    CapsuleDatum {
      ..f.genesis(),
      metadata: list.concat(f.genesis().metadata, [Pair("name", name)]),
    },
  )
}

test datum_fails_unsorted_keys() fail {
  valid_datum(
    CapsuleDatum { ..f.genesis(), metadata: list.reverse(f.genesis().metadata) },
  )
}

test datum_fails_missing_name() fail {
  let image: Data = ["ipfs://a"]
  valid_datum(CapsuleDatum { ..f.genesis(), metadata: [Pair("image", image)] })
}

test datum_fails_missing_image() fail {
  let name: Data = "empty"
  valid_datum(CapsuleDatum { ..f.genesis(), metadata: [Pair("name", name)] })
}

test datum_fails_name_type() fail {
  let image: Data = ["ipfs://a"]
  let name: Data = 12
  valid_datum(
    CapsuleDatum {
      ..f.genesis(),
      metadata: [Pair("image", image), Pair("name", name)],
    },
  )
}

test datum_fails_name_too_long() fail {
  let image: Data = ["ipfs://a"]
  let name: Data = "12345678901234567890123456789012345678901234567890123456789012345"
  valid_datum(
    CapsuleDatum {
      ..f.genesis(),
      metadata: [Pair("image", image), Pair("name", name)],
    },
  )
}

test datum_fails_empty_image() fail {
  let image: Data = []
  let name: Data = "empty"
  valid_datum(
    CapsuleDatum {
      ..f.genesis(),
      metadata: [Pair("image", image), Pair("name", name)],
    },
  )
}

test datum_fails_many_image_chunks() fail {
  let image: Data = list.repeat("a", 49)
  let name: Data = "overflow"
  valid_datum(
    CapsuleDatum {
      ..f.genesis(),
      metadata: [Pair("image", image), Pair("name", name)],
    },
  )
}

test datum_fails_large_image_chunk() fail {
  let image: Data = [
    "12345678901234567890123456789012345678901234567890123456789012345",
  ]
  let name: Data = "overflow"
  valid_datum(
    CapsuleDatum {
      ..f.genesis(),
      metadata: [Pair("image", image), Pair("name", name)],
    },
  )
}

test datum_fails_serialized_size() fail {
  let filler: Data = list.repeat(
    "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    65,
  )
  valid_datum(
    CapsuleDatum {
      ..f.genesis(),
      metadata: [Pair("filler", filler), ..f.genesis().metadata],
    },
  )
}

test datum_fails_negative_sequence() fail {
  valid_datum(
    CapsuleDatum {
      ..f.genesis(),
      extra: CapsuleState { ..f.genesis().extra, sequence: -1 },
    },
  )
}

test datum_fails_sequence_overflow() fail {
  valid_datum(
    CapsuleDatum {
      ..next(),
      extra: CapsuleState { ..next().extra, sequence: max_sequence + 1 },
    },
  )
}

test max_sequence_cannot_advance() fail {
  let old = CapsuleDatum {
    ..next(),
    extra: CapsuleState { ..next().extra, sequence: max_sequence },
  }
  evolve(old, f.update_tx(old, f.advance(old, False)))
}

test property_accepts_each_valid_sequence(
  sequence via fuzz.int_between(1, 1_000_000),
) {
  let old = CapsuleDatum {
    ..next(),
    extra: CapsuleState { ..next().extra, sequence },
  }
  evolve(old, f.update_tx(old, f.advance(old, False)))
}

fn bad_quantity() {
  fuzz.such_that(fuzz.int_between(-1_000, 1_000), fn(q) { q != 1 })
}

test property_rejects_every_quantity_except_one(
  quantity via bad_quantity(),
) fail {
  let user = Output {
    ..f.user_output(),
    value: assets.from_asset(f.policy, f.usr_name, quantity),
  }
  evolve(
    f.genesis(),
    Transaction { ..update(), outputs: [f.state_output(next()), user] },
  )
}

test serialise_genesis_golden() {
  cbor.serialise(f.genesis()) == #"d8799fa245696d6167659f5819646174613a696d6167652f7376672b786d6c2c3c7376672f3eff446e616d6553424541434e2053746174652043617073756c6501d8799f0100d8798040ffff"
}

test hash_genesis_golden() {
  blake2b_256(cbor.serialise(f.genesis())) == #"b8ecd637e8cc8f5bddbf3d288517880a397166aa3e39670520c7beb408fb273a"
}

test metadata_really_can_evolve() {
  let image: Data = ["data:image/svg+xml,<svg><text>grown</text></svg>"]
  let name: Data = "BEACN Grown Capsule"
  let changed = CapsuleDatum {
    ..next(),
    metadata: [Pair("image", image), Pair("name", name)],
  }
  evolve(f.genesis(), replacing_next(changed))
}

fn transferred_tx() -> Transaction {
  let address = Address {
    payment_credential: VerificationKey(f.stranger),
    stake_credential: None,
  }
  let user = Output { ..f.user_output(), address }
  let holder = Input { ..f.holder_input(), output: user }
  Transaction {
    ..update(),
    inputs: [f.state_input(f.genesis()), holder],
    outputs: [f.state_output(next()), user],
    extra_signatories: [f.stranger],
  }
}

test new_holder_can_evolve_after_ordinary_token_transfer() {
  evolve(f.genesis(), transferred_tx())
}

test former_holder_cannot_evolve_after_transfer() fail {
  evolve(
    f.genesis(),
    Transaction { ..transferred_tx(), extra_signatories: [f.owner] },
  )
}

test wrong_supplied_old_datum_rejected() fail {
  evolve(next(), update())
}

test caller_without_state_token_rejected() fail {
  let state = Input {
    ..f.state_input(f.genesis()),
    output: Output {
      ..f.state_output(f.genesis()),
      value: assets.from_lovelace(3_000_000),
    },
  }
  evolve(
    f.genesis(),
    Transaction { ..update(), inputs: [state, f.holder_input()] },
  )
}
