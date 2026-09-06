#!/usr/bin/env node
'use strict';
// Read-only audit against the live checkout. No wallet calls, network, or writes to it.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = process.argv[2] || process.cwd();
const read = name => fs.readFileSync(path.join(root,'public/tools/ledger',name),'utf8');
const helper = read('studio-wallet.js');
const scroll = read('calculator.html');
const book = read('ledger-book.html');
const slice = (text, start, end) => {
 const a=text.indexOf(start), b=text.indexOf(end,a);
 assert(a>=0 && b>a,'Expected source boundaries for '+start);
 return text.slice(a,b);
};
const list = slice(scroll,'function listWallets(){','function noWalletHelpHTML(){');
const pick = slice(book,'function pickWallet(){','async function connectWallet(){');
const calls = {enable:0,sign:0,submit:0};
const provider = (name,mark) => ({name,mark,apiVersion:'1.0.0',enable(){calls.enable++;return {signTx(){calls.sign++;},submitTx(){calls.submit++;}}},signTx(){calls.sign++;},submitTx(){calls.submit++;}});
let groups=0;
function check(name, fn) {fn();groups++;console.log('PASS '+name);}
function ctx({local, parent, search='', origin='https://studio.example',self=false}) {
 const window = {cardano:local};
 window.parent = self ? window : parent;
 return vm.createContext({window,location:{search,origin},URLSearchParams});
}
function run(config) {
 const context=ctx(config);
 vm.runInContext(helper+'\n'+list+'\n'+pick,context);
 return {context,providers:vm.runInContext('studioWalletProviders()',context),wallets:vm.runInContext('listWallets()',context),chosen:vm.runInContext('pickWallet()',context)};
}
const localV = provider('VESPR','local');
const parentV = provider('VESPR','parent');
const eternl = provider('Eternl','eternl');
const parent = {location:{origin:'https://studio.example'},cardano:{vespr:parentV}};
check('local VESPR discovered by Scroll and Book',()=>{
 const r=run({local:{vespr:localV},self:true});
 assert.equal(r.providers.vespr,localV);assert.equal(r.wallets[0].key,'vespr');assert.equal(r.chosen,localV);
});
check('parent-only VESPR allowed for same-origin studio=1',()=>{
 const r=run({parent,search:'?studio=1'});
 assert.equal(r.providers.vespr,parentV);assert.equal(r.wallets[0].key,'vespr');assert.equal(r.chosen,parentV);
});
check('parent unavailable without studio=1, even same-origin',()=>{
 for(const search of ['', '?studio=0','?studio=true']) {
  const r=run({parent,search});assert.equal(r.wallets.length,0);assert.equal(r.chosen,null);
 }
});
check('cross-origin parent explicitly rejected',()=>{
 const r=run({parent:{location:{origin:'https://other.example'},cardano:{vespr:parentV}},search:'?studio=1'});
 assert.equal(r.wallets.length,0);assert.equal(r.chosen,null);
});
check('browser SecurityError accessing cross-origin parent safely rejected',()=>{
 const locked={};Object.defineProperty(locked,'location',{get(){throw new Error('SecurityError');}});
 const r=run({parent:locked,search:'?studio=1',local:{vespr:localV}});
 assert.equal(r.providers.vespr,localV);assert.equal(r.chosen,localV);
});
check('local provider wins duplicate key without mutating either registry',()=>{
 const local={vespr:localV};const r=run({parent,local,search:'?studio=1'});
 assert.equal(r.providers.vespr,localV);assert.equal(local.vespr,localV);assert.equal(parent.cardano.vespr,parentV);
 assert.notEqual(r.providers,local);assert.notEqual(r.providers,parent.cardano);
});
check('local and parent distinct providers retained; VESPR preferred',()=>{
 const r=run({parent,local:{eternl},search:'?studio=1'});
 assert.equal(r.wallets.length,2);assert.equal(r.wallets[0].key,'vespr');assert.equal(r.chosen,parentV);
});
check('late injected parent provider discovered on next call',()=>{
 const late={location:{origin:'https://studio.example'},cardano:{}};
 const r=run({parent:late,search:'?studio=1'});assert.equal(r.wallets.length,0);
 late.cardano.vespr=parentV;
 assert.equal(vm.runInContext('pickWallet()',r.context),parentV);
 assert.equal(vm.runInContext('listWallets()[0].key',r.context),'vespr');
});
check('invalid provider entries do not appear as wallets',()=>{
 const r=run({self:true,local:{broken:null,missing:{name:'Missing'},vespr:localV}});
 assert.equal(r.wallets.length,1);assert.equal(r.chosen,localV);
});
check('discovery never calls enable, signTx, or submitTx',()=>assert.deepEqual(calls,{enable:0,sign:0,submit:0}));
check('helper loads before creator inline JS; no direct window.cardano reads remain',()=>{
 for(const [name,html] of [['Scroll',scroll],['Book',book]]) {
  const helperIndex=html.indexOf('<script src="studio-wallet.js"></script>');
  assert(helperIndex>=0,name+' helper missing');
  assert(helperIndex<html.indexOf('function '+(name==='Scroll'?'listWallets':'pickWallet')),name+' helper too late');
  assert(!/window\s*\.\s*cardano/.test(html),name+' bypasses resolver');
 }
});
check('every copied Scroll/Book inline script parses after replacements',()=>{
 for(const [name,html] of [['Scroll',scroll],['Book',book]]) {
  let count=0;
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
   if(/\bsrc\s*=/.test(m[1])||/application\/ld\+json|application\/json/.test(m[1]))continue;
   new vm.Script(m[2],{filename:name+'-inline-'+(++count)});
  }
  assert(count>0,name+' no scripts inspected');
 }
});
console.log(JSON.stringify({result:'passed',groups,calls,scope:'Synthetic provider resolution and source syntax; no real wallet or mainnet transaction'}));
