/**
 * Génère un PDF de cartes par fichier .md contenant des directives {card}.
 *
 * Variables d'environnement :
 *   CARDS_SRC_DIR  - dossier racine à scanner (défaut: ../b-UnitesEnseignement)
 *   CARDS_OUT_DIR  - dossier de sortie des PDFs (défaut: ../_build_local/Support_PDF/cards)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { parseCardsFromMarkdown, mdHasCards } from './cardParser.mjs';
import { generateCardsPdf } from './cardRenderer.mjs';

const SRC_DIR = process.env.CARDS_SRC_DIR ?? '../b-UnitesEnseignement';
const OUT_DIR = process.env.CARDS_OUT_DIR ?? '../_build_local/Support_PDF/cards';

async function* walkMd(dir) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) yield* walkMd(full);
    else if (e.isFile() && e.name.endsWith('.md')) yield full;
  }
}

async function findBackAsync(mdPath) {
  const dir = path.dirname(mdPath);
  for (const name of ['back.png', 'back.jpg', 'verso.png', 'verso.jpg']) {
    const candidate = path.join(dir, name);
    try { await fs.access(candidate); return candidate; } catch { /* not found */ }
  }
  return null;
}

async function main() {
  const srcStat = await fs.stat(SRC_DIR).catch(() => null);
  if (!srcStat?.isDirectory()) {
    console.log(`Dossier source introuvable: ${SRC_DIR}`);
    return;
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  let made = 0;
  let skipped = 0;

  for await (const mdPath of walkMd(SRC_DIR)) {
    const content = await fs.readFile(mdPath, 'utf8').catch(() => null);
    if (!content || !mdHasCards(content)) { skipped++; continue; }

    const cards = parseCardsFromMarkdown(content);
    if (!cards.length) { skipped++; continue; }

    const baseName = path.basename(mdPath, '.md');
    const outPath  = path.join(OUT_DIR, `${baseName}.pdf`);
    const baseDir  = path.resolve(path.dirname(mdPath));
    const backPath = await findBackAsync(mdPath);

    try {
      const pdfBuffer = await generateCardsPdf(cards, baseDir, backPath);
      await fs.writeFile(outPath, pdfBuffer);
      const rel = path.relative(process.cwd(), outPath);
      console.log(`✓ ${cards.length} cartes → ${rel}${backPath ? ' (avec verso)' : ''}`);
      made++;
    } catch (e) {
      console.error(`✗ Erreur pour ${mdPath}: ${e.message}`);
    }
  }

  console.log(`\nTerminé: ${made} PDF(s) généré(s), ${skipped} fichier(s) ignoré(s).`);
}

main().catch(e => { console.error('Erreur fatale:', e.message); process.exit(1); });
