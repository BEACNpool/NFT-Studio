/** Expected release surfaces; verify exact discovery names, then derive counts from them. */
export const PUBLIC_TOOL_NAMES=Object.freeze(['studio_capabilities','search_knowledge','read_knowledge','validate_payload','create_mint_intent','verify_mint_intent','create_proof_record','verify_proof_record','prepare_unsigned_transaction','apply_state_capsule_parameters','create_music_release','verify_music_release','prepare_unsigned_music_transaction'].sort());
export const NODE_TOOL_NAMES=Object.freeze([...PUBLIC_TOOL_NAMES,'validate_metadata','verify_signed_transaction'].sort());
