#!/usr/bin/env node
/**
 * Rendu des affiches ZN Airsoft.
 *   node export.js                 -> toutes les fiches data/*.json, insta + A4
 *   node export.js <slug>          -> une fiche, insta + A4
 *   node export.js <slug> 4k       -> une fiche, PNG 4320×5400 (A3 / 4K)
 *   node export.js all 4k          -> toutes en 4K
 * Sorties dans out/<slug>_insta.png, out/<slug>_a4.pdf, out/<slug>_4k.png
 */
const fs = require('fs');
const path = require('path');
process.env.NODE_PATH = process.env.NODE_PATH || '/opt/node22/lib/node_modules';
require('module').Module._initPaths();
const { chromium } = require('playwright');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'out');
const INSTA = { w: 1080, h: 1350 };
const A4 = { w: 1080, h: 1527 };            // même largeur, ratio 210×297
const A4_SCALE = (210 / 25.4 * 96) / A4.w;  // px CSS -> 210 mm

function loadData(slug) {
  const file = path.join(ROOT, 'data', `${slug}.json`);
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  d.slug = d.slug || slug;
  for (const k of ['image', 'logo', 'background']) if (d[k] && !/^https?:|^data:/.test(d[k])) d[k] = toFileUrl(d[k]);
  for (const a of d.accessories || []) if (a.image && !/^https?:|^data:/.test(a.image)) a.image = toFileUrl(a.image);
  return d;
}
function toFileUrl(p) { return 'file://' + path.resolve(ROOT, p); }

async function renderOne(browser, d, mode) {
  const page = await browser.newPage({ viewport: { width: INSTA.w, height: INSTA.h }, deviceScaleFactor: mode === '4k' ? 4 : 1 });
  page.on('console', m => { if (m.type() === 'error') console.error('  [page]', m.text()); });
  page.on('requestfailed', r => console.error('  [asset manquant]', r.url()));
  const outputs = [];

  const render = async (size) => {
    await page.setViewportSize({ width: size.w, height: size.h });
    await page.goto(toFileUrl('template.html'), { waitUntil: 'load' });
    await page.evaluate((data) => window.renderPoster(data), { ...d, _width: size.w, _height: size.h });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].filter(i => i.src).map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; }))));
  };

  if (mode === '4k') {
    await render(INSTA);
    const f = path.join(OUT, `${d.slug}_4k.png`);
    await page.screenshot({ path: f, type: 'png' });
    outputs.push(f);
  } else {
    await render(INSTA);
    const png = path.join(OUT, `${d.slug}_insta.png`);
    await page.screenshot({ path: png, type: 'png' });
    outputs.push(png);

    await render(A4);
    const pdf = path.join(OUT, `${d.slug}_a4.pdf`);
    await page.pdf({ path: pdf, width: '210mm', height: '297mm', printBackground: true, scale: A4_SCALE, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    outputs.push(pdf);
  }
  await page.close();
  return outputs;
}

(async () => {
  const [arg, mode] = process.argv.slice(2);
  fs.mkdirSync(OUT, { recursive: true });
  const slugs = (!arg || arg === 'all')
    ? fs.readdirSync(path.join(ROOT, 'data')).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort()
    : [arg];
  const browser = await chromium.launch();
  let failed = 0;
  for (const slug of slugs) {
    try {
      const outs = await renderOne(browser, loadData(slug), mode);
      console.log(`${slug}: ${outs.map(o => path.relative(ROOT, o)).join(', ')}`);
    } catch (e) { failed++; console.error(`${slug}: ERREUR ${e.message}`); }
  }
  await browser.close();
  console.log(`${slugs.length - failed}/${slugs.length} affiches rendues`);
  process.exit(failed ? 1 : 0);
})();
