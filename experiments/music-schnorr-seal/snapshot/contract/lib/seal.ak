use aiken/builtin

pub fn message_digest(package_hash: ByteArray) -> ByteArray {
  expect builtin.length_of_bytearray(package_hash) == 32
  builtin.sha2_256(builtin.append_bytearray(#"424541434e204c616273006d757369632d72656c656173652d656e646f7273656d656e7400626561636e2e6d757369632d7363686e6f72722d7365616c2e763100", package_hash))
}

pub fn verify_release(package_hash: ByteArray, public_key: ByteArray, signature: ByteArray) -> Bool {
  expect builtin.length_of_bytearray(public_key) == 32
  expect builtin.length_of_bytearray(signature) == 64
  expect builtin.slice_bytearray(0, 32, signature) != #"0000000000000000000000000000000000000000000000000000000000000000"
  expect builtin.slice_bytearray(32, 32, signature) != #"0000000000000000000000000000000000000000000000000000000000000000"
  builtin.verify_schnorr_secp256k1_signature(public_key, message_digest(package_hash), signature)
}
