/**
 * Génère index.html pour la landing page des exercices PDF.
 * Style cohérent avec la landing des présentations Marp.
 *
 * Variables d'environnement :
 *   EXO_ROOT   - dossier _build_local/exercices (défaut: ../site-exo/exercices)
 *   SRC_DIR    - dossier source pour lire les métadonnées du module
 */

import { promises as fs } from 'fs';
import path from 'path';
import YAML from 'yaml';

const EXO_ROOT = process.env.EXO_ROOT ?? '../site-exo/exercices';
const SRC_DIR  = process.env.SRC_DIR  ?? null;

// ── Métadonnées module (même logique que generate-marp-index) ────────────────

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])
  );
}

const stripBOM = s => s.replace(/^﻿/, '');

function extractFM(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n(?:---|\.\.\.)/);
  return m ? m[1] : null;
}

async function loadModuleMeta() {
  if (!SRC_DIR) return null;
  const candidate = path.resolve(SRC_DIR, '..', 'Support', 'legal', 'index.md');
  try {
    const fmStr = extractFM(stripBOM(await fs.readFile(candidate, 'utf8')));
    if (!fmStr) return null;
    const data = YAML.parse(fmStr) ?? {};
    if (data.type !== 'legal') return null;
    return { module: data.module ?? null, title: data.title ?? null };
  } catch { return null; }
}

// ── Scan des PDFs ─────────────────────────────────────────────────────────────

async function listPdfs(dir) {
  try {
    const files = await fs.readdir(dir);
    return files
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  } catch { return []; }
}

function displayName(filename) {
  return filename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
}

// ── Rendu HTML ────────────────────────────────────────────────────────────────

function renderSection(label, badge, href, files) {
  if (!files.length) return '';
  const items = files.map(f => `
        <li class="pdf-item">
          <a class="pdf-link" href="${escapeHtml(href + encodeURIComponent(f))}" target="_blank" rel="noreferrer">
            <span class="pdf-badge">${escapeHtml(badge)}</span>
            <span class="pdf-name">${escapeHtml(displayName(f))}</span>
          </a>
        </li>`).join('');
  return `
    <section class="exo-section">
      <h2 class="section-heading">
        <span class="section-badge">${escapeHtml(badge)}</span>
        ${escapeHtml(label)}
      </h2>
      <ul class="pdf-list">${items}
      </ul>
    </section>`;
}

// ── Page complète ─────────────────────────────────────────────────────────────

function buildPage(sections, headerTitle, headerSubtitle) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Exercices — TARDIS</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --brand:      #004595;
      --brand-dark: #003366;
      --bg:         #f7f9fc;
      --fg:         #0f172a;
      --muted:      #4b5563;
      --bd:         #c4d7fb;
      --card-bg:    #ffffff;
      --radius:     10px;
      --shadow:     0 4px 6px -1px rgba(0,0,0,.10);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--fg);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ── */
    .site-header { background: var(--brand); color: #fff; box-shadow: 0 2px 10px rgba(0,21,51,.12); }
    .site-header .inner { width: min(95vw, 1400px); margin: 0 auto; padding: 16px; }
    .site-title { margin: 0; font-size: 1.35rem; line-height: 1.2; }
    .site-subtitle { margin: 4px 0 0; opacity: .9; font-size: .95rem; }

    /* ── Main ── */
    .wrap { width: min(95vw, 900px); margin: 24px auto; padding: 0 0 40px; flex: 1; }

    /* ── Section ── */
    .exo-section { margin-bottom: 2.5rem; }
    .section-heading {
      display: flex; align-items: center; gap: .6rem;
      font-size: 1.15rem; font-weight: 700;
      color: var(--brand-dark);
      margin-bottom: 1rem;
      padding-bottom: .5rem;
      border-bottom: 2px solid var(--bd);
    }
    .section-badge {
      display: inline-block;
      background: var(--brand);
      color: #fff;
      font-size: .75rem; font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      letter-spacing: .04em;
    }

    /* ── Liste ── */
    .pdf-list { list-style: none; display: flex; flex-direction: column; gap: .4rem; }
    .pdf-item {}
    .pdf-link {
      display: flex; align-items: center; gap: .75rem;
      background: var(--card-bg);
      border: 1px solid var(--bd);
      border-radius: var(--radius);
      padding: .65rem 1rem;
      text-decoration: none;
      color: var(--fg);
      box-shadow: var(--shadow);
      transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
    }
    .pdf-link:hover {
      transform: translateX(4px);
      box-shadow: 0 6px 14px -2px rgba(0,0,0,.13);
      border-color: var(--brand);
      color: var(--brand-dark);
    }
    .pdf-badge {
      flex-shrink: 0;
      background: var(--brand);
      color: #fff;
      font-size: .65rem; font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      letter-spacing: .04em;
    }
    .pdf-name { font-size: .9rem; font-weight: 500; }

    /* ── Empty ── */
    .empty-state {
      padding: 2rem;
      background: #e6eefb;
      border: 1px solid var(--bd);
      border-radius: var(--radius);
      color: var(--brand-dark);
    }

    /* ── Footer ── */
    .site-footer {
      background: var(--brand-dark); color: rgba(255,255,255,.75);
      font-size: .8rem; text-align: center; padding: 14px 16px;
    }
    .site-footer a { color: rgba(255,255,255,.85); text-decoration: none; }
    .site-footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="inner">
      <h1 class="site-title">${escapeHtml(headerTitle)}</h1>
      <p class="site-subtitle">${escapeHtml(headerSubtitle)}</p>
    </div>
  </header>

  <main class="wrap">
    ${sections || '<div class="empty-state"><p><strong>Aucun exercice PDF disponible.</strong></p></div>'}
  </main>

  <footer class="site-footer">
    <p>TARDIS — Teaching And Resources Development for Integrated Sequences &nbsp;|&nbsp; <a href="..">Retour à l'accueil</a></p>
  </footer>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const rootStat = await fs.stat(EXO_ROOT).catch(() => null);
  if (!rootStat?.isDirectory()) {
    console.error(`Dossier introuvable: ${EXO_ROOT}`);
    process.exit(1);
  }

  const [exoPdfs, solPdfs, cardsPdfs, moduleMeta] = await Promise.all([
    listPdfs(path.join(EXO_ROOT, 'exercices')),
    listPdfs(path.join(EXO_ROOT, 'solutions')),
    listPdfs(path.join(EXO_ROOT, 'cards')),
    loadModuleMeta(),
  ]);

  const headerTitle = moduleMeta?.module
    ? `Module ${moduleMeta.module} — Exercices`
    : 'TARDIS — Exercices';
  const headerSubtitle = moduleMeta?.title
    ? moduleMeta.title
    : 'Exercices et solutions en PDF';

  const sections = [
    renderSection('Exercices', 'EXO', 'exercices/', exoPdfs),
    renderSection('Solutions', 'SOL', 'solutions/', solPdfs),
    renderSection('Jeux de cartes', 'CARDS', 'cards/', cardsPdfs),
  ].join('');

  const html = buildPage(sections, headerTitle, headerSubtitle);
  await fs.writeFile(path.join(EXO_ROOT, 'index.html'), html, 'utf8');
  console.log(`✅ index.html généré dans ${EXO_ROOT}/`);
})();
