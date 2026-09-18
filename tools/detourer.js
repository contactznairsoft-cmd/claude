#!/usr/bin/env node
/**
 * Détourage sans IA : rend transparent le fond clair uni connecté aux bords de l'image
 * (remplissage par diffusion depuis les bords, tolérance sur la luminance). Les zones claires
 * à l'intérieur du produit ne sont pas touchées. Le produit n'est jamais redessiné.
 *   node tools/detourer.js <entrée.jpg|png> <sortie.png> [tolerance=28]
 *   node tools/detourer.js --all assets/<slug>        (traite cover/acc*.jpg|png en place -> .png)
 */
const fs = require('fs');
const path = require('path');
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));

async function knockout(input, output, tol = 28) {
  const img = sharp(input).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const px = (x, y) => (y * w + x) * 4;
  // couleur de fond estimée : médiane des pixels du bord
  const border = [];
  for (let x = 0; x < w; x += 2) { border.push(px(x, 0), px(x, h - 1)); }
  for (let y = 0; y < h; y += 2) { border.push(px(0, y), px(w - 1, y)); }
  const med = (i) => { const v = border.map(p => data[p + i]).sort((a, b) => a - b); return v[v.length >> 1]; };
  const bg = [med(0), med(1), med(2)];
  const close = (p) => Math.abs(data[p] - bg[0]) + Math.abs(data[p + 1] - bg[1]) + Math.abs(data[p + 2] - bg[2]) <= tol * 3;

  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) { stack.push(x, 0, x, h - 1); }
  for (let y = 0; y < h; y++) { stack.push(0, y, w - 1, y); }
  let removed = 0;
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const i = y * w + x;
    if (seen[i]) continue;
    seen[i] = 1;
    const p = i * 4;
    if (!close(p)) continue;
    data[p + 3] = 0; removed++;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  // Lissage du bord : les pixels opaques voisins d'un pixel transparent et proches du fond deviennent semi-transparents
  const out = Buffer.from(data);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = px(x, y);
    if (data[p + 3] === 0) continue;
    const n = [px(x - 1, y), px(x + 1, y), px(x, y - 1), px(x, y + 1)].filter(q => data[q + 3] === 0).length;
    if (n > 0) {
      const d = (Math.abs(data[p] - bg[0]) + Math.abs(data[p + 1] - bg[1]) + Math.abs(data[p + 2] - bg[2])) / 3;
      out[p + 3] = Math.min(255, Math.round(Math.min(1, d / (tol * 2)) * 255));
    }
  }
  // Rognage sur la zone opaque
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (out[px(x, y) + 3] > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  if (maxX <= minX || maxY <= minY) { minX = 0; minY = 0; maxX = w - 1; maxY = h - 1; }
  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png().toFile(output);
  return { removedPct: Math.round(100 * removed / (w * h)), bg, crop: [minX, minY, maxX - minX + 1, maxY - minY + 1] };
}

(async () => {
  const args = process.argv.slice(2);
  if (args[0] === '--all') {
    const dir = args[1];
    for (const f of fs.readdirSync(dir)) {
      if (!/^(cover|acc\d)\.(jpe?g|png)$/i.test(f)) continue;
      const src = path.join(dir, f), dst = path.join(dir, f.replace(/\.(jpe?g|png)$/i, '.png'));
      const tmp = dst + '.tmp.png';
      const r = await knockout(src, tmp, Number(args[2]) || 28);
      fs.renameSync(tmp, dst); if (src !== dst) fs.unlinkSync(src);
      console.log(`${dst}: fond ${r.removedPct}% retiré, rognage ${r.crop.join('x')}`);
    }
  } else {
    const r = await knockout(args[0], args[1], Number(args[2]) || 28);
    console.log(`${args[1]}: fond ${r.removedPct}% retiré`);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
