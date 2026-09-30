use aiken/collection/list
use cardano/address.{Address, Inline, Script, VerificationKey}
use cardano/assets
use cardano/transaction.{InlineDatum, Input, NoDatum, Output, OutputReference, Transaction}
use circle.{State, state_name}
use circle_scripts as validators
const home = #"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
const alice = #"11111111111111111111111111111111111111111111111111111111"
const bob = #"22222222222222222222222222222222222222222222222222222222"
const eve = #"33333333333333333333333333333333333333333333333333333333"
const state = #"44444444444444444444444444444444444444444444444444444444"
const policy = #"55555555555555555555555555555555555555555555555555555555"
const logic = #"66666666666666666666666666666666666666666666666666666666"
const plb_hash = #"88888888888888888888888888888888888888888888888888888888"

const plb = Script(plb_hash)
fn ref(n: Int) -> OutputReference { OutputReference { transaction_id: #"abababababababababababababababababababababababababababababababab", output_index: n } }
fn record(owners: List<ByteArray>, revision: Int) -> State { State { version: 1, token_policy: policy, transfer_hash: logic, owners, active: True, revision } }
fn state_out(value: State) -> Output { Output { address: Address { payment_credential: Script(state), stake_credential: None }, value: assets.from_lovelace(3_000_000) |> assets.add(state, state_name, 1), datum: InlineDatum(value), reference_script: None } }
fn card(name: ByteArray, owner: ByteArray) -> Output { Output { address: Address { payment_credential: plb, stake_credential: Some(Inline(VerificationKey(owner))) }, value: assets.from_lovelace(2_000_000) |> assets.add(policy, name, 1), datum: NoDatum, reference_script: None } }
fn tx(before: List<ByteArray>, after: List<ByteArray>, selected: List<Int>, signers: List<ByteArray>) -> Transaction {
 Transaction { ..transaction.placeholder,
 inputs: [Input { output_reference: ref(0), output: state_out(record(before,0)) }, ..list.map(selected, fn(i) { Input { output_reference: ref(i+1), output: card(list.expect_at(circle.names,i), list.expect_at(before,i)) } })],
 outputs: [state_out(record(after,1)), ..list.map(selected, fn(i) { card(list.expect_at(circle.names,i), list.expect_at(after,i)) })], extra_signatories: signers }
}
fn check(t: Transaction) -> Bool {
 expect [input, ..] = t.inputs
 expect InlineDatum(raw) = input.output.datum
 expect before: State = raw
 validators.state.spend(ref(9), home, plb, Some(before), #"", ref(0), t) && validators.transfer.withdraw(state, #"", Script(logic), t)
}
test one_cannot_send_to_outsider() fail { check(tx([alice,bob,bob],[eve,bob,bob],[0],[alice])) }
test two_cannot_send_to_outsider() fail { check(tx([alice,alice,bob],[eve,alice,bob],[0],[alice])) }
test one_to_holder_of_two() { check(tx([alice,bob,bob],[bob,bob,bob],[0],[alice])) }
test two_to_holder_of_one() { check(tx([alice,alice,bob],[bob,alice,bob],[0],[alice])) }
test all_three_can_invite() { check(tx([alice,alice,alice],[eve,alice,alice],[0],[alice])) }
test all_three_multi_output_invitation() { check(tx([alice,alice,alice],[bob,eve,home],[0,1,2],[alice])) }
test all_three_can_move_whole_set() { check(tx([alice,alice,alice],[bob,bob,bob],[0,1,2],[alice])) }
test cannot_use_newly_received_third() fail { check(tx([alice,alice,bob],[eve,alice,alice],[0,2],[alice,bob])) }
test cannot_introduce_then_send_to_new_holder() fail { check(tx([alice,alice,bob],[eve,eve,bob],[0,1],[alice])) }
test self_send() { check(tx([alice,bob,bob],[alice,bob,bob],[0],[alice])) }
test no_sender_signature() fail { check(tx([alice,bob,bob],[bob,bob,bob],[0],[bob])) }
test admin_cannot_move_another_holders_card() fail { check(tx([alice,bob,bob],[bob,bob,bob],[0],[home])) }
test cannot_change_unspent_owner_record() fail { check(tx([alice,bob,bob],[bob,alice,bob],[0],[alice])) }
test state_only_update_denied() fail { check(tx([alice,bob,bob],[alice,bob,bob],[],[alice])) }
test two_senders_both_must_sign() fail { check(tx([alice,bob,bob],[bob,alice,bob],[0,1],[alice])) }
test two_senders_can_swap() { check(tx([alice,bob,bob],[bob,alice,bob],[0,1],[alice,bob])) }

fn good() -> Transaction { tx([alice,alice,alice],[bob,alice,alice],[0],[alice]) }
test cannot_escape_programmable_address() fail { let t = good() expect [r,o] = t.outputs check(Transaction { ..t, outputs: [r, Output { ..o, address: Address { payment_credential: VerificationKey(bob), stake_credential: None } }] }) }
test cannot_spoof_after_owners() fail { let t = good() expect [r,_] = t.outputs check(Transaction { ..t, outputs: [r,card("CARD01",eve)] }) }
test cannot_drop_record() fail { let t = good() expect [_,o] = t.outputs check(Transaction { ..t, outputs: [o] }) }
test cannot_duplicate_record() fail { let t = good() expect [r,o] = t.outputs check(Transaction { ..t, outputs: [r,r,o] }) }
test cannot_reduce_card_backing() fail { let t = good() expect [r,o] = t.outputs check(Transaction { ..t, outputs: [r,Output { ..o, value: assets.from_lovelace(1_000_000) |> assets.add(policy,"CARD01",1) }] }) }
test cannot_reduce_state_backing() fail { let t = good() expect [r,o] = t.outputs check(Transaction { ..t, outputs: [Output { ..r, value: assets.from_lovelace(2_000_000) |> assets.add(state,state_name,1) },o] }) }
test cannot_burn_card() fail { let t = good() check(Transaction { ..t, mint: assets.from_asset(policy,"CARD01",-1) }) }
test cannot_mint_another_card() fail { let t = good() check(Transaction { ..t, mint: assets.from_asset(policy,"CARD04",1) }) }
test revision_must_increment() fail { let t = good() expect [_,o] = t.outputs check(Transaction { ..t, outputs: [state_out(record([bob,alice,alice],0)),o] }) }
test transfer_cannot_reference_instead_of_spend_record() fail { let t = good() expect [r,i] = t.inputs validators.transfer.withdraw(state,#"",Script(logic),Transaction { ..t, inputs:[i], reference_inputs:[r] }) }
test wrong_transfer_module_rejected() fail { validators.transfer.withdraw(state,#"",Script(eve),good()) }
