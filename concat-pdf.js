#!/usr/bin/env node
/**
 * Concatène les A4 de out/ en un seul PDF pour l'impression.
 *   node concat-pdf.js                       -> out/affiches-camion-<AAAA-MM-JJ>.pdf, toutes les *_a4.pdf
 *   node concat-pdf.js liste.txt             -> ordre donné par un fichier (un slug par ligne)
 */
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

(async () => {
  const OUT = path.join(__dirname, 'out');
  let slugs;
  if (process.argv[2]) slugs = fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  else slugs = fs.readdirSync(OUT).filter(f => f.endsWith('_a4.pdf')).map(f => f.replace(/_a4\.pdf$/, '')).sort();

  const doc = await PDFDocument.create();
  for (const slug of slugs) {
    const file = path.join(OUT, `${slug}_a4.pdf`);
    if (!fs.existsSync(file)) { console.error(`manquant : ${file}`); process.exitCode = 1; continue; }
    const src = await PDFDocument.load(fs.readFileSync(file));
    const pages = await doc.copyPages(src, src.getPageIndices());
    pages.forEach(p => doc.addPage(p));
  }
  const date = new Date().toISOString().slice(0, 10);
  const target = path.join(OUT, `affiches-camion-${date}.pdf`);
  fs.writeFileSync(target, await doc.save());
  console.log(`${path.relative(__dirname, target)} : ${doc.getPageCount()} pages`);
})();
