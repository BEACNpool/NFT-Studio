// The build extracts this exact pinned WASM module; runtime byte compilation is forbidden.
import wasmModule from './cardano_serialization_lib_bg.wasm';
import * as glue from '@emurgo/cardano-serialization-lib-browser-inlined/cardano_serialization_lib_bg.js';
const wasm = new WebAssembly.Instance(wasmModule, {'./cardano_serialization_lib_bg.js':glue}).exports;
glue.__wbg_set_wasm(wasm);
wasm.__wbindgen_start();
export * from '@emurgo/cardano-serialization-lib-browser-inlined/cardano_serialization_lib_bg.js';
