#!/usr/bin/env node
/**
 * Fusionne les PDFs individuels de slides (déjà générés) en un seul PDF combiné,
 * dans l'ordre d'apparition des présentations dans les séquences de cours.
 *
 * L'ordre est déterminé en lisant le front matter YAML des .md sources
 * (champs seq / order), identique à la logique de build-manifest.mjs.
 *
 * Variables d'environnement:
 *   SLIDES_SRC_DIR   répertoire des .md sources (pour lire l'ordre seq/order)
 *   SLIDES_PDF_DIR   répertoire contenant les PDFs individuels déjà générés
 *   SLIDES_OUT_PDF   chemin complet du PDF combiné en sortie
 */
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import YAML from 'yaml';
import { execSync } from 'child_process';

const SRC_DIR  = process.env.SLIDES_SRC_DIR  || 'caller/b-UnitesEnseignement/Presentations';
const PDF_DIR  = process.env.SLIDES_PDF_DIR  || path.join(SRC_DIR, 'dist/pdf');
const OUT_PDF  = process.env.SLIDES_OUT_PDF   || 'slides-combined.pdf';

const stripBOM  = s => s.replace(/^﻿/, '');
const extractFM = md => { const m = md.match(/^---\s*\n([\s\S]*?)\n(?:---|\.\.\.)/); return m ? m[1] : null; };
const seqKey    = seq => {
  const m = /^SEQ-(\d+)$/.exec((seq || '').trim());
  return m ? [0, Number(m[1])] : [1, (seq || '').toLowerCase()];
};

(async () => {
  // Lire les .md pour déterminer l'ordre
  const mdFiles = await glob(SRC_DIR + '/**/*.md', {
    nodir: true,
    ignore: [SRC_DIR + '/dist/**'],
  });

  if (mdFiles.length === 0) {
    console.warn('⚠️  Aucun fichier .md trouvé dans', SRC_DIR);
    process.exit(0);
  }

  const slides = [];
  for (const f of mdFiles) {
    let raw;
    try { raw = stripBOM(await fs.readFile(f, 'utf8')); } catch { continue; }

    let seq = null;
    let order = 9999;
    const fm = extractFM(raw);
    if (fm) {
      try {
        const data = YAML.parse(fm) || {};
        seq   = data.seq   || null;
        order = Number.isFinite(Number(data.order)) ? Number(data.order) : 9999;
      } catch { /* front matter invalide, valeurs par défaut */ }
    }

    // PDF correspondant : même nom que le .md mais avec extension .pdf, dans PDF_DIR
    const basename = path.basename(f, '.md') + '.pdf';
    const pdfPath  = path.join(PDF_DIR, basename);

    try { await fs.access(pdfPath); } catch {
      console.warn(`⚠️  PDF introuvable (skippé): ${pdfPath}`);
      continue;
    }

    slides.push({ pdfPath, seq, order });
  }

  if (slides.length === 0) {
    console.warn('⚠️  Aucun PDF trouvé dans', PDF_DIR, '— les slides ont-elles été exportées en PDF ?');
    process.exit(0);
  }

  slides.sort((a, b) => {
    const ka = seqKey(a.seq);
    const kb = seqKey(b.seq);
    const cmpType = ka[0] - kb[0];
    if (cmpType !== 0) return cmpType;
    const cmpSeq = typeof ka[1] === 'number'
      ? ka[1] - kb[1]
      : String(ka[1]).localeCompare(String(kb[1]));
    if (cmpSeq !== 0) return cmpSeq;
    return a.order - b.order;
  });

  console.log(`📑 Fusion de ${slides.length} PDF (triés par séquence)`);
  slides.forEach((s, i) => console.log(`  [${i + 1}] ${path.basename(s.pdfPath)}`));

  await fs.mkdir(path.dirname(path.resolve(OUT_PDF)), { recursive: true });
  execSync(
    `pdfunite ${slides.map(s => `"${s.pdfPath}"`).join(' ')} "${OUT_PDF}"`,
    { stdio: 'inherit' }
  );
  console.log(`✅ PDF combiné: ${OUT_PDF}`);
})().catch(e => {
  console.error('❌', e.message);
  process.exit(1);
});
