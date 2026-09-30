use aiken/collection/dict
use aiken/collection/list
use cardano/address.{Credential, Script}
use cardano/assets.{PolicyId}
use cardano/certificate.{Certificate, RegisterCredential}
use cardano/transaction.{InlineDatum, OutputReference, Transaction}
use circle.{State, state_name}
use registry_node.{RegistryNode, empty_vkey}

pub type IssueAction {
  Register
  Issue
}

validator state(seed: OutputReference, home: ByteArray, plb: Credential) {
  mint(_r: Data, own: PolicyId, tx: Transaction) {
    expect list.has(tx.extra_signatories, home)
    expect list.any(tx.inputs, fn(i) { i.output_reference == seed })
    expect dict.to_pairs(assets.tokens(tx.mint, own)) == [Pair(state_name, 1)]
    expect [output] = list.filter(tx.outputs, fn(o) { assets.quantity_of(o.value, own, state_name) != 0 })
    let initial = circle.at(output, own)
    !initial.active && initial.revision == 0 && initial.owners == [home, home, home]
  }

  spend(datum: Option<State>, _r: Data, own_ref: OutputReference, tx: Transaction) {
    expect Some(before) = datum
    expect Some(input) = list.find(tx.inputs, fn(i) { i.output_reference == own_ref })
    expect Script(own) = input.output.address.payment_credential
    expect before == circle.from_inputs(tx, own)
    expect dict.is_empty(assets.tokens(tx.mint, own))
    expect [output] = list.filter(tx.outputs, fn(o) { assets.quantity_of(o.value, own, state_name) != 0 })
    let after = circle.at(output, own)
    and {
      output.address == input.output.address,
      assets.lovelace_of(output.value) >= assets.lovelace_of(input.output.value),
      circle.transition(tx, before, after, plb, home),
    }
  }

  else(_) { fail }
}

fn node_matches(node: RegistryNode, c: State, account: Credential, state: PolicyId, denied: Credential) -> Bool {
  and {
    node.key == c.token_policy,
    node.minting_logic_script == account,
    node.transfer_logic_script == Script(c.transfer_hash),
    node.third_party_logic_script == denied,
    node.unfracking_logic_script == empty_vkey,
    node.global_state_cs == state,
  }
}

validator issue(seed: OutputReference, home: ByteArray, state: PolicyId, registry: PolicyId, denied: Credential) {
  withdraw(action: IssueAction, account: Credential, tx: Transaction) {
    when action is {
      Register -> {
        let c = circle.from_refs(tx, state)
        expect list.has(tx.extra_signatories, home) && !c.active
        expect list.any(tx.inputs, fn(i) { i.output_reference == seed })
        expect dict.is_empty(assets.tokens(tx.mint, c.token_policy))
        expect dict.to_pairs(assets.tokens(tx.mint, registry)) == [Pair(c.token_policy, 1)]
        expect [output] = list.filter(tx.outputs, fn(o) { assets.quantity_of(o.value, registry, c.token_policy) == 1 })
        expect output.address.payment_credential == Script(registry)
        expect InlineDatum(raw) = output.datum
        expect node: RegistryNode = raw
        node_matches(node, c, account, state, denied)
      }
      Issue -> {
        // Consuming the inactive record triggers the state validator, which
        // checks exact supply, initial owner and the one-way activation.
        let c = circle.from_inputs(tx, state)
        expect !c.active && list.has(tx.extra_signatories, home)
        expect dict.is_empty(assets.tokens(tx.mint, registry))
        expect !list.any(tx.inputs, fn(i) { assets.quantity_of(i.output.value, registry, c.token_policy) != 0 })
        expect [ref] = list.filter(tx.reference_inputs, fn(i) { assets.quantity_of(i.output.value, registry, c.token_policy) == 1 })
        expect ref.output.address.payment_credential == Script(registry)
        expect InlineDatum(raw) = ref.output.datum
        expect node: RegistryNode = raw
        node_matches(node, c, account, state, denied)
      }
    }
  }
  publish(_r: Data, c: Certificate, _tx: Transaction) {
    when c is { RegisterCredential { .. } -> True _ -> False }
  }
  else(_) { fail }
}

validator transfer(state: PolicyId) {
  withdraw(_r: Data, account: Credential, tx: Transaction) {
    let before = circle.from_inputs(tx, state)
    before.active && account == Script(before.transfer_hash) && dict.is_empty(assets.tokens(tx.mint, before.token_policy))
  }
  publish(_r: Data, c: Certificate, _tx: Transaction) {
    when c is { RegisterCredential { .. } -> True _ -> False }
  }
  else(_) { fail }
}

// No seizure path. Unfracking remains unset in the registry (denied by core).
validator denied {
  withdraw(_r: Data, _account: Credential, _tx: Transaction) { False }
  else(_) { fail }
}

// Genesis consumes this seed, permanently closing the protocol upgrade path.
validator bootstrap_only(seed: OutputReference) {
  withdraw(_r: Data, _account: Credential, tx: Transaction) {
    list.any(tx.inputs, fn(i) { i.output_reference == seed })
  }
  publish(_r: Data, c: Certificate, _tx: Transaction) {
    when c is { RegisterCredential { .. } -> True _ -> False }
  }
  else(_) { fail }
}
