// 从 zip 的 HTML 里取校徽（Ohio 由 getDefaultOhioLogoSVG() 现算，其余在 OFFICIAL_LOGOS_B64 里），
// 用 CDP 在无头 Chrome 里栅格化成带透明通道的 PNG，供 us-transcript-pdf.cjs 嵌进 PDF。
//
// 用法: node svg2png.cjs <key> <out.png> [width=520] [height=224] [scale=2]
//   key ∈ ohio | psu | purdue | ufl | umich | uw | marshall
'use strict';

const { spawn } = require('node:child_process');
const { readFile, writeFile, mkdir } = require('node:fs/promises');
const { dirname, join, resolve } = require('node:path');
const vm = require('node:vm');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const [key = 'ohio', out = 'assets/ohio.png', w = '520', h = '224', scale = '2'] = process.argv.slice(2);
const SOURCE = join(__dirname, 'official_transcript_generator.html');

const WIDTH = Number(w), HEIGHT = Number(h), SCALE = Number(scale);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function braced(source, from) {
  const start = source.indexOf('{', from);
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') { depth--; if (!depth) return source.slice(start, i + 1); }
  }
  throw new Error('花括号未闭合');
}

async function svgFor(key, html) {
  const sandbox = { Math, console };
  vm.createContext(sandbox);
  const logosAt = html.indexOf('const OFFICIAL_LOGOS_B64 =');
  vm.runInContext(`globalThis.L = ${braced(html, logosAt)};`, sandbox);
  const dataUrl = sandbox.L[key];
  if (dataUrl) {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return Buffer.from(base64, 'base64').toString('utf8');
  }
  // Ohio 没有 B64 条目，是 getDefaultOhioLogoSVG() 现算的
  const fnAt = html.indexOf('function getDefaultOhioLogoSVG');
  if (fnAt < 0) throw new Error(`既没有 ${key} 的 data URL，也没有 getDefaultOhioLogoSVG`);
  vm.runInContext(`globalThis.F = ${braced(html, fnAt).replace(/^\{/, 'function g(isWatermark = false) {')};`, sandbox);
  return vm.runInContext('globalThis.G = F(false); G;', sandbox);
}

async function main() {
  const html = await readFile(SOURCE, 'utf8');
  const svg = await svgFor(key, html);
  const page = `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:transparent}
    svg{display:block;width:100%;height:100%}
  </style>${svg}`;
  const dataUrl = 'data:text/html;base64,' + Buffer.from(page, 'utf8').toString('base64');
  const target = resolve(out);
  await mkdir(dirname(target), { recursive: true });

  const ud = `${process.env.PI_SCRATCH_DIR}\\svg2png-${Date.now()}`;
  const child = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${ud}`, `--window-size=${WIDTH},${HEIGHT}`, 'about:blank',
  ], { stdio: 'ignore' });

  let port;
  for (let i = 0; i < 150 && !port; i++) {
    try {
      const text = await readFile(`${ud}\\DevToolsActivePort`, 'utf8');
      const first = text.split(/\r?\n/)[0].trim();
      if (/^\d+$/.test(first)) port = Number(first);
    } catch { await sleep(100); }
  }
  if (!port) throw new Error('DevToolsActivePort 没出现');

  const pageInfo = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(pageInfo.webSocketDebuggerUrl);
  const waiting = new Map();
  let seq = 0;
  ws.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.id && waiting.has(msg.id)) {
      const { resolve: ok, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : ok(msg.result);
    }
  });
  await new Promise((ok, bad) => { ws.addEventListener('open', ok); ws.addEventListener('error', bad); });
  const send = (method, params = {}) => new Promise((ok, bad) => {
    const id = ++seq;
    waiting.set(id, { resolve: ok, reject: bad });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE, mobile: false });
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  await send('Page.navigate', { url: dataUrl });
  await sleep(1200);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const bytes = Buffer.from(shot.data, 'base64');
  await writeFile(target, bytes);

  ws.close();
  child.kill();
  console.log(JSON.stringify({
    key, out: target, bytes: bytes.length,
    viewport: `${WIDTH}x${HEIGHT}`, scale: SCALE,
    svgLength: svg.length, svgHead: svg.slice(0, 60).replace(/\s+/g, ' ').trim(),
  }, null, 2));
}

main().catch(error => { console.error(error); process.exit(1); });
