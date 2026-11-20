#!/usr/bin/env node
// scripts/recon-dump-dom.mjs
// Dump raw DOM: --anon (before auth), --profile (after auth), --stream (during response).
// Usage:
//   node scripts/recon-dump-dom.mjs --provider gigachat --anon
//   node scripts/recon-dump-dom.mjs --provider gigachat --profile "GigaChat 1"
//   node scripts/recon-dump-dom.mjs --provider gigachat --profile "GigaChat 1" --stream

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROVIDERS = {
  gigachat: { name: 'GigaChat', url: 'https://giga.chat', inputSel: 'textarea#chat-input-textarea' },
  alisa:    { name: 'Алиса AI', url: 'https://alice.yandex.ru', inputSel: 'textarea' },
};
const PROFILES_ROOT_CANDIDATES = [
  path.join(os.homedir(), '.config/wetothemoon-electron/profiles'),
];
const REGISTRY_CANDIDATES = ['gateway-profiles.json', 'profiles.json', 'registry.json'];

function die(m){console.error('❌ '+m);process.exit(1);}
function findProfilesRoot(explicit){
  if (explicit) { if(!fs.existsSync(explicit)) die('no profilesRoot '+explicit); return explicit; }
  for (const c of PROFILES_ROOT_CANDIDATES) if (fs.existsSync(c)) return c;
  die('profilesRoot not found');
}
function readRegistry(root){
  const parent = path.dirname(root);
  for (const name of REGISTRY_CANDIDATES){
    const p = path.join(parent, name);
    if (fs.existsSync(p)) return { path: p, data: JSON.parse(fs.readFileSync(p,'utf8')) };
  }
  die('registry not found in '+parent);
}
function findProfile(reg, wanted){
  return (reg.data.profiles||[]).find(p=>p.id===wanted||p.name===wanted||p.dirName===wanted);
}
function profileDir(p, root){
  const kind = p.browserKind==='chrome'?'chrome':'yandex';
  return path.join(root, p.dirName, kind==='chrome'?'chrome-profile':'yandex-profile');
}

async function dump(page, label, outDir){
  const html = await page.content();
  fs.writeFileSync(path.join(outDir, label+'.html'), html);
  const data = await page.evaluate(() => {
    const info = (el, full) => ({
      tag: el.tagName.toLowerCase(),
      id: el.id||null,
      class: (el.className||'').toString().slice(0,120)||null,
      ariaLabel: el.getAttribute('aria-label'),
      title: el.getAttribute('title'),
      dataTestId: el.getAttribute('data-testid'),
      type: el.getAttribute('type'),
      role: el.getAttribute('role'),
      text: full ? (el.textContent||'').trim().slice(0,80) : null,
      hasSvg: !!el.querySelector('svg'),
      svgPaths: el.querySelectorAll('svg path').length,
      visible: !!(el.offsetWidth||el.offsetHeight),
    });
    const allBtns = [...document.querySelectorAll('button, [role="button"]')].map(e=>info(e,true)).filter(b=>b.visible);
    const streamCand = [...document.querySelectorAll('[class*="stream"], [class*="typing"], [class*="blink"], [class*="cursor"], [class*="loading"], [aria-busy="true"]')].map(e=>info(e,false));
    const messages = [...document.querySelectorAll('[class*="message"], [class*="Message"], [data-message-id]')].slice(-5).map(e=>({
      tag: e.tagName.toLowerCase(), class: (e.className||'').toString().slice(0,120),
      role: e.getAttribute('role'),
      dataAttrs: [...e.attributes].filter(a=>a.name.startsWith('data-')).map(a=>`${a.name}=${a.value.slice(0,50)}`),
      textPreview: (e.textContent||'').slice(0,100),
    }));
    return {
      url: location.href, title: document.title,
      allButtons: allBtns, streamingCandidates: streamCand, lastMessages: messages,
      localStorageKeys: Object.keys(localStorage),
      sessionStorageKeys: Object.keys(sessionStorage),
    };
  });
  fs.writeFileSync(path.join(outDir, label+'.json'), JSON.stringify(data,null,2));
  console.log(`  ${label}: buttons=${data.allButtons.length} stream=${data.streamingCandidates.length} msgs=${data.lastMessages.length}`);
}

async function anonMode(chromium, provider, outDir){
  const anonDir = path.join(process.env.HOME || os.homedir(), '.config/wetothemoon-electron/profiles', '_gigachat-anon');
  fs.mkdirSync(anonDir, {recursive:true});
  const ctx = await chromium.launchPersistentContext(anonDir, {headless:false, channel:'chrome'});
  try {
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(provider.url, {waitUntil:'domcontentloaded', timeout:60000});
    await page.waitForTimeout(4000);
    await dump(page, 'anon-initial', outDir);
    console.log('✅ anon dump done');
  } finally { await browser.close(); }
}

async function profileMode(chromium, provider, profile, profilesRoot, outDir, stream){
  const pdir = profileDir(profile, profilesRoot);
  if (!fs.existsSync(pdir)) die('profile dir missing: '+pdir);
  try {
    const pids = execSync(`pgrep -f "user-data-dir=${pdir}"`,{stdio:['ignore','pipe','ignore']}).toString().trim();
    if (pids) die(`Chrome already running (pids=${pids.split('\n').join(',')}). Close UI browser.`);
  } catch {}
  const opts = {headless:false};
  if ((profile.browserKind||'yandex')==='chrome') opts.channel='chrome';
  const ctx = await chromium.launchPersistentContext(pdir, opts);
  try {
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(provider.url, {waitUntil:'domcontentloaded', timeout:60000});
    await page.waitForTimeout(4000);
    await dump(page, 'auth-initial', outDir);
    if (stream) {
      const ta = await page.$(provider.inputSel) || await page.$('textarea');
      if (!ta) die('textarea not found');
      await ta.click();
      await ta.type('recon test '+Date.now());
      await page.waitForTimeout(500);
      await dump(page, 'auth-typed', outDir);
      await page.keyboard.press('Enter');
      for (let i=0; i<20; i++){
        await page.waitForTimeout(400);
        await dump(page, `stream-${String(i).padStart(2,'0')}`, outDir);
      }
      await page.waitForTimeout(3000);
      await dump(page, 'auth-after-response', outDir);
    }
    console.log('✅ profile dump done');
  } finally { await ctx.close(); }
}

async function main(){
  const args = process.argv.slice(2);
  const g = (k)=>{const i=args.indexOf(k);return i!==-1?args[i+1]:null;};
  const providerKey = g('--provider');
  if (!providerKey || !PROVIDERS[providerKey]) die('--provider: '+Object.keys(PROVIDERS).join('|'));
  const provider = PROVIDERS[providerKey];
  const profilesRoot = findProfilesRoot(g('--profiles-root'));
  const mode = args.includes('--anon') ? 'anon' : 'profile';
  const ts = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  const outDir = path.join(__dirname, 'dumps', `${providerKey}-${mode}-${ts}`);
  fs.mkdirSync(outDir, {recursive:true});
  console.log(`📁 ${outDir}`);

  const pw = await import('patchright');
  const chromium = pw.chromium || pw.default?.chromium;
  if (!chromium) die('patchright missing');

  if (mode === 'anon') {
    await anonMode(chromium, provider, outDir);
  } else {
    const wanted = g('--profile');
    if (!wanted) die('--profile required for profile mode');
    const reg = readRegistry(profilesRoot);
    const profile = findProfile(reg, wanted);
    if (!profile) die('profile not found: '+wanted);
    await profileMode(chromium, provider, profile, profilesRoot, outDir, args.includes('--stream'));
  }
}
main().catch(e=>die(e.stack||String(e)));