/** Render only a checked native handoff. No network access or wallet operations. */
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import {createHash} from 'node:crypto';
const copyScript=`document.getElementById('copy-url').addEventListener('click',async()=>{const field=document.getElementById('creation-url'),status=document.getElementById('copy-status');try{await navigator.clipboard.writeText(field.value);status.textContent='URL copied. Paste this into VESPR’s dApp browser.';}catch{field.focus();field.select();status.textContent='Copy the selected URL, then paste it into VESPR’s dApp browser.';}});`;
const copyHash=createHash('sha256').update(copyScript).digest('base64');
import {renderTerminalQr} from './terminal-qr.mjs';
const STUDIO='https://beacnpool.github.io/NFT-Studio/?view=labs&lab=agents';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export async function mobileExport(mobile,intent) {
  const {parsePhoneTransferFragment}=await import('./dist/mobile-tools.mjs');
  assert.equal(mobile.schema,'nft-studio.mobile-handoff.v1');
  assert.equal(mobile.intentHash,intent.intentHash);
  assert.equal(mobile.bundleHash,intent.bundle.sha256);
  assert.equal(mobile.rawBytes,intent.bundle.bytes);
  assert.deepEqual(mobile.checks,{exactIntentReadBack:true,walletConnected:false,signed:false,submitted:false});
  const url=new URL(mobile.url),parsed=parsePhoneTransferFragment(url.hash);
  assert.equal(mobile.url,STUDIO+url.hash);
  assert(Number.isSafeInteger(mobile.expiresAt)&&mobile.expiresAt>Date.now()&&mobile.expiresAt<=Date.now()+930000);
  assert.equal(mobile.expiresAtIso,new Date(mobile.expiresAt).toISOString());
  assert.equal(mobile.endTransfer?.tool,'revoke_mobile_handoff');
  assert.equal(mobile.endTransfer.arguments.id,parsed.id);
  assert.match(mobile.endTransfer.arguments.revokeToken,/^[A-Za-z0-9_-]{43}$/);
  // Re-render the checked URL locally; never embed SVG supplied by a tool result.
  const options={errorCorrectionLevel:'M',margin:4,width:528,color:{dark:'#11111b',light:'#ffffff'}};
  const png=await QRCode.toBuffer(mobile.url,{...options,type:'png'});
  const svg=await QRCode.toString(mobile.url,{...options,type:'svg'});
  const terminal=renderTerminalQr(mobile.url);
  if(mobile.qr?.terminalText!==undefined)for(const field of Object.keys(terminal))assert.equal(mobile.qr[field],terminal[field],'Terminal QR differs from the verified phone link.');
  const expiryLabel=new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(mobile.expiresAt))+' UTC';
  const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${copyHash}'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Send to mobile — NFT-Studio</title><style>body{margin:0;background:#17111e;color:#f3eaf9;font:16px/1.6 system-ui,sans-serif}main{max-width:600px;margin:auto;padding:32px 20px}h1{font-size:30px;line-height:1.2}img{display:block;width:min(100%,360px);height:auto;background:white;border-radius:12px;margin:24px 0}a{color:#d8b9f6;overflow-wrap:anywhere}.button{display:inline-block;padding:12px 18px;border:1px solid #d8b9f6;border-radius:8px;text-decoration:none}button,textarea{font:inherit}button{background:transparent;color:inherit;cursor:pointer}textarea{box-sizing:border-box;width:100%;min-height:110px;background:#241a2d;color:#f3eaf9;border:1px solid #d8b9f6;border-radius:8px;padding:10px}a:focus-visible,button:focus-visible,textarea:focus-visible{outline:3px solid #e4cafa;outline-offset:4px}.button:hover{background:#35273f}small{display:block;color:#c9b9d5;margin-top:24px}</style><main><p>NFT-STUDIO · SEND TO MOBILE</p><h1>${escape(intent.bundle.name)}</h1><p>Scan with your phone camera to open this exact creation in NFT-Studio.</p><img src="data:image/png;base64,${png.toString('base64')}" width="528" height="528" alt="QR code to open this creation on your phone"><p><a class="button" href="${escape(mobile.url)}" rel="noreferrer">Open on this phone</a></p><p>Expires <time datetime="${escape(mobile.expiresAtIso)}">${escape(expiryLabel)}</time>. After expiry, request a fresh QR.</p><h2>Paste this into a dApp browser</h2><p>Scan the QR, then copy the creation URL and paste it into VESPR’s Discover / dApp browser. Connect your wallet there, review the mint, and approve only when ready.</p><p><button id="copy-url" class="button" type="button">Copy URL</button> <a class="button" href="${escape('web+cardano://browse/v1?uri='+encodeURIComponent(mobile.url))}">Open in wallet browser</a></p><label for="creation-url">Creation URL — select and copy if needed</label><textarea id="creation-url" readonly spellcheck="false">${escape(mobile.url)}</textarea><p id="copy-status" role="status" aria-live="polite"></p><p>This QR opens a mint request. It does not transfer an already minted NFT. Opening it grants no wallet permission.</p><p><a href="review.html">Review on this computer</a> · <a href="intent.json" download>Save request</a></p><small>Anyone with the complete phone link can view this creation until expiry. Share the QR only with intended reviewers. No wallet is connected; nothing is signed, submitted or minted.</small></main><script>${copyScript}</script></html>\n`;
  return {'mobile-qr.txt':terminal.terminalText+'\n','mobile-qr.png':png,'mobile-qr.svg':svg,'mobile-url.txt':mobile.url+'\n','mobile.html':html,'mobile-transfer.private.json':JSON.stringify({schema:mobile.schema,intentHash:mobile.intentHash,url:mobile.url,expiresAt:mobile.expiresAt,endTransfer:mobile.endTransfer},null,2)+'\n'};
}
