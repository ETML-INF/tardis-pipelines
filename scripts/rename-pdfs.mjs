/**
 * Numérote les PDFs selon leur position absolue dans tardis.yml.
 *
 * E-117-CSR01-tri-taches.pdf → E-117-13-CSR01-tri-taches.pdf
 * X-117-CSR01-tri-taches.pdf → X-117-13-CSR01-tri-taches.pdf  (aligné sur son exercice)
 * F-117-architectures-reseau.pdf → F-117-02-architectures-reseau.pdf
 *
 * Env:
 *   TARDIS_MANIFEST  chemin vers tardis.yml généré
 *   PDF_DIR          racine des PDFs (contient presentations/, exercices/)
 */

import { promises as fs } from 'fs';
import path from 'path';
import YAML from 'yaml';

const MANIFEST = process.env.TARDIS_MANIFEST ?? '_build_local/tardis/manifests/tardis.yml';
const PDF_DIR  = process.env.PDF_DIR  ?? '_build_local/pdf';

// ── Parse manifest ────────────────────────────────────────────────────────────

const raw = await fs.readFile(MANIFEST, 'utf8').catch(() => {
  console.error(`❌ Manifest introuvable: ${MANIFEST}`);
  process.exit(1);
});
const manifest = YAML.parse(raw);

// ID pattern: {prefix}-{module}-{rest}  e.g.  E-117-CSR01-tri-taches
const ID_RE = /^([EXF])-(\d+)-(.+)$/;

// exoKey: "{module}-{rest}" → absolute exercise number (E- items only)
const exoByKey  = new Map();
// slideId: full id → absolute slide number (F- items with type=slides only)
const slideById = new Map();

let exoCount   = 0;
let slideCount = 0;

for (const seq of manifest.sequences ?? []) {
  for (const item of seq.items ?? []) {
    const m = ID_RE.exec(item.id ?? '');
    if (!m) continue;
    const [, prefix, module, rest] = m;

    if (prefix === 'E') {
      exoCount++;
      exoByKey.set(`${module}-${rest}`, exoCount);
    } else if (prefix === 'F' && item.type === 'slides') {
      slideCount++;
      slideById.set(item.id, slideCount);
    }
    // X- inherits from the matching E- at rename time
  }
}

console.log(`📊 ${exoCount} exercices, ${slideCount} présentations indexés`);

// ── Rename helpers ────────────────────────────────────────────────────────────

function insertNumber(base, num) {
  const m = ID_RE.exec(base);
  if (!m) return null;
  const [, prefix, module, rest] = m;
  return `${prefix}-${module}-${String(num).padStart(2, '0')}-${rest}`;
}

function resolveNum(base) {
  const m = ID_RE.exec(base);
  if (!m) return null;
  const [, prefix, module, rest] = m;
  if (prefix === 'E') return exoByKey.get(`${module}-${rest}`) ?? null;
  if (prefix === 'X') return exoByKey.get(`${module}-${rest}`) ?? null; // same key as E-
  if (prefix === 'F') return slideById.get(base) ?? null;
  return null;
}

async function renameDir(dir) {
  let files;
  try {
    files = await fs.readdir(dir);
  } catch {
    return; // dossier absent → silencieux
  }

  let renamed = 0;
  for (const file of files.filter(f => f.toLowerCase().endsWith('.pdf'))) {
    const base = file.slice(0, -4);
    const num  = resolveNum(base);

    if (num === null) {
      console.warn(`  ⚠ Pas de numéro pour ${file} (non dans le manifest?)`);
      continue;
    }

    const newBase = insertNumber(base, num);
    if (!newBase || newBase === base) continue;

    await fs.rename(path.join(dir, file), path.join(dir, newBase + '.pdf'));
    console.log(`  ✓ ${file} → ${newBase}.pdf`);
    renamed++;
  }
  if (renamed === 0) console.log(`  (aucun fichier à renommer dans ${path.relative('.', dir)})`);
}

// ── Apply ─────────────────────────────────────────────────────────────────────

console.log('\n📁 Exercices:');
await renameDir(path.join(PDF_DIR, 'exercices', 'exercices'));

console.log('\n📁 Solutions:');
await renameDir(path.join(PDF_DIR, 'exercices', 'solutions'));

console.log('\n📁 Présentations:');
await renameDir(path.join(PDF_DIR, 'presentations'));

console.log('\n✅ Numérotation terminée');
