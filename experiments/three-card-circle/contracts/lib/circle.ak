use aiken/collection/dict
use aiken/collection/list
use aiken/primitive/bytearray
use cardano/address.{Credential, Inline, Script, VerificationKey}
use cardano/assets.{PolicyId}
use cardano/transaction.{InlineDatum, NoDatum, Output, Transaction}

pub const names = ["CARD01", "CARD02", "CARD03"]

pub const state_name = "CIRCLE_STATE"

// Fixed policy/module identity, a bounded three-owner vector and a revision.
// History is the chain of consumed state outputs, not an unbounded datum.
pub type State {
  version: Int,
  token_policy: PolicyId,
  transfer_hash: ByteArray,
  owners: List<ByteArray>,
  active: Bool,
  revision: Int,
}

pub fn at(output: Output, state: PolicyId) -> State {
  expect output.address.payment_credential == Script(state)
  expect output.address.stake_credential == None
  expect assets.without_lovelace(output.value) == assets.from_asset(state, state_name, 1)
  expect output.reference_script == None
  expect InlineDatum(raw) = output.datum
  expect value: State = raw
  expect value.version == 1 && value.revision >= 0
  expect bytearray.length(value.token_policy) == 28
  expect bytearray.length(value.transfer_hash) == 28
  expect list.length(value.owners) == 3
  expect list.all(value.owners, fn(k) { bytearray.length(k) == 28 })
  value
}

pub fn from_inputs(tx: Transaction, state: PolicyId) -> State {
  expect [input] = list.filter(tx.inputs, fn(i) {
    assets.quantity_of(i.output.value, state, state_name) != 0
  })
  at(input.output, state)
}

pub fn from_refs(tx: Transaction, state: PolicyId) -> State {
  expect [input] = list.filter(tx.reference_inputs, fn(i) {
    assets.quantity_of(i.output.value, state, state_name) != 0
  })
  at(input.output, state)
}

pub fn token_outputs(outputs: List<Output>, policy: PolicyId) -> List<Output> {
  list.filter(outputs, fn(o) { !dict.is_empty(assets.tokens(o.value, policy)) })
}

pub fn card(output: Output, plb: Credential, policy: PolicyId, name: ByteArray) -> ByteArray {
  expect output.address.payment_credential == plb
  expect Some(Inline(VerificationKey(owner))) = output.address.stake_credential
  expect bytearray.length(owner) == 28
  expect assets.without_lovelace(output.value) == assets.from_asset(policy, name, 1)
  expect list.has(names, name)
  expect output.datum == NoDatum && output.reference_script == None
  owner
}

pub fn eligible(before: List<ByteArray>, sender: ByteArray, recipient: ByteArray) -> Bool {
  list.has(before, recipient) || list.all(before, fn(owner) { owner == sender })
}

pub fn transition(tx: Transaction, before: State, after: State, plb: Credential, home: ByteArray) -> Bool {
  expect before.version == after.version
  expect before.token_policy == after.token_policy
  expect before.transfer_hash == after.transfer_hash
  expect after.active && after.revision == before.revision + 1
  let policy = before.token_policy
  let ins = token_outputs(list.map(tx.inputs, fn(i) { i.output }), policy)
  let outs = token_outputs(tx.outputs, policy)
  if !before.active {
    expect list.has(tx.extra_signatories, home)
    expect ins == [] && list.length(outs) == 3
    expect before.owners == [home, home, home] && after.owners == before.owners
    expect dict.to_pairs(assets.tokens(tx.mint, policy)) == [Pair("CARD01", 1), Pair("CARD02", 1), Pair("CARD03", 1)]
    list.all(names, fn(name) {
      expect [output] = list.filter(outs, fn(o) { assets.quantity_of(o.value, policy, name) != 0 })
      card(output, plb, policy, name) == home
    })
  } else {
    expect dict.is_empty(assets.tokens(tx.mint, policy))
    expect list.length(ins) > 0 && list.length(ins) <= 3 && list.length(ins) == list.length(outs)
    // Every token-bearing input/output is canonical, including ones not named
    // by a proposed update. No unknown names, mixed assets or grouped copies.
    expect list.all(list.concat(ins, outs), fn(o) {
      expect [Pair(name, _)] = dict.to_pairs(assets.tokens(o.value, policy))
      expect _ = card(o, plb, policy, name)
      True
    })
    list.all(list.indexed_map(names, fn(index, name) { (index, name) }), fn(entry) {
      let (index, name) = entry
      let sender = list.expect_at(before.owners, index)
      let recipient = list.expect_at(after.owners, index)
      let spent = list.filter(ins, fn(o) { assets.quantity_of(o.value, policy, name) != 0 })
      let received = list.filter(outs, fn(o) { assets.quantity_of(o.value, policy, name) != 0 })
      when spent is {
        [] -> received == [] && sender == recipient
        [input] -> {
          expect [output] = received
          and {
            card(input, plb, policy, name) == sender,
            card(output, plb, policy, name) == recipient,
            list.has(tx.extra_signatories, sender),
            eligible(before.owners, sender, recipient),
            assets.lovelace_of(output.value) >= assets.lovelace_of(input.value),
          }
        }
        _ -> False
      }
    })
  }
}
