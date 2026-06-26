/**
 * Génère _build_output/pdf/index.html — landing page unifiée de tous les PDFs.
 *
 * Variables d'environnement :
 *   PDF_ROOT  - racine des PDFs (défaut: _build_output/pdf)
 *   SRC_DIR   - dossier Presentations pour lire les métadonnées du module
 *   ICT_MODULE - numéro du module (optionnel)
 *
 * Structure attendue sous PDF_ROOT :
 *   presentations/
 *   support_de_cours/
 *   exercices/exercices/
 *   exercices/solutions/
 *   exercices/cards/
 */

import { promises as fs } from 'fs';
import path from 'path';
import YAML from 'yaml';

const PDF_ROOT   = process.env.PDF_ROOT   ?? '_build_output/pdf';
const SRC_DIR    = process.env.SRC_DIR    ?? null;
const ICT_MODULE = process.env.ICT_MODULE ?? null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])
  );
}

const stripBOM = s => s.replace(/^﻿/, '');

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

// ── Métadonnées module ────────────────────────────────────────────────────────

async function loadModuleMeta() {
  if (!SRC_DIR) return null;
  const candidate = path.resolve(SRC_DIR, '..', 'Support', 'legal', 'index.md');
  try {
    const raw = stripBOM(await fs.readFile(candidate, 'utf8'));
    const m = raw.match(/^---\s*\n([\s\S]*?)\n(?:---|\.\.\.)/);
    if (!m) return null;
    const data = YAML.parse(m[1]) ?? {};
    if (data.type !== 'legal') return null;
    return { module: data.module ?? null, title: data.title ?? null };
  } catch { return null; }
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
    <section class="pdf-section">
      <h2 class="section-heading">
        <span class="section-badge">${escapeHtml(badge)}</span>
        ${escapeHtml(label)}
      </h2>
      <ul class="pdf-list">${items}
      </ul>
    </section>`;
}

function buildPage(sections, headerTitle, headerSubtitle) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(headerTitle)} — PDFs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --brand:      #1e81b0;
      --brand-dark: #155f80;
      --accent:     #e28743;
      --bg:         #f7f9fc;
      --fg:         #0f172a;
      --muted:      #4b5563;
      --bd:         #bde0f0;
      --card-bg:    #ffffff;
      --radius:     10px;
      --shadow:     0 4px 6px -1px rgba(0,0,0,.10);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, "Helvetica Neue", Arial, sans-serif;
      background: var(--bg);
      color: var(--fg);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ── */
    .site-header {
      background: linear-gradient(135deg, var(--brand-dark) 0%, var(--brand) 100%);
      color: #fff;
      box-shadow: 0 2px 10px rgba(0,21,51,.15);
    }
    .site-header .inner { width: min(95vw, 1400px); margin: 0 auto; padding: 18px 20px; }
    .site-title { margin: 0; font-size: 1.4rem; line-height: 1.2; }
    .site-subtitle { margin: 4px 0 0; opacity: .88; font-size: .95rem; }

    /* ── Main ── */
    .wrap { width: min(95vw, 860px); margin: 28px auto; padding: 0 0 48px; flex: 1; }

    /* ── Section ── */
    .pdf-section { margin-bottom: 2.5rem; }
    .section-heading {
      display: flex; align-items: center; gap: .65rem;
      font-size: 1.1rem; font-weight: 700;
      color: var(--brand-dark);
      margin-bottom: 1rem;
      padding-bottom: .5rem;
      border-bottom: 2px solid var(--bd);
    }
    .section-badge {
      display: inline-block;
      background: var(--brand);
      color: #fff;
      font-size: .7rem; font-weight: 700;
      padding: 2px 9px;
      border-radius: 999px;
      letter-spacing: .05em;
    }

    /* ── Liste ── */
    .pdf-list { list-style: none; display: flex; flex-direction: column; gap: .4rem; }
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
      border-color: var(--accent);
      color: var(--brand-dark);
    }
    .pdf-badge {
      flex-shrink: 0;
      background: var(--brand);
      color: #fff;
      font-size: .65rem; font-weight: 700;
      padding: 2px 7px;
      border-radius: 4px;
      letter-spacing: .05em;
    }
    .pdf-name { font-size: .9rem; font-weight: 500; }

    /* ── Footer ── */
    .site-footer {
      background: var(--brand-dark); color: rgba(255,255,255,.7);
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
    ${sections || '<p style="padding:2rem;color:var(--muted)">Aucun PDF disponible.</p>'}
  </main>

  <footer class="site-footer">
    <p>TARDIS — Teaching And Resources Development for Integrated Sequences</p>
  </footer>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  const rootStat = await fs.stat(PDF_ROOT).catch(() => null);
  if (!rootStat?.isDirectory()) {
    console.error(`Dossier introuvable: ${PDF_ROOT}`);
    process.exit(1);
  }

  const [supportPdfs, presPdfs, exoPdfs, solPdfs, cardsPdfs, moduleMeta] = await Promise.all([
    listPdfs(path.join(PDF_ROOT, 'support_de_cours')),
    listPdfs(path.join(PDF_ROOT, 'presentations')),
    listPdfs(path.join(PDF_ROOT, 'exercices', 'exercices')),
    listPdfs(path.join(PDF_ROOT, 'exercices', 'solutions')),
    listPdfs(path.join(PDF_ROOT, 'exercices', 'cards')),
    loadModuleMeta(),
  ]);

  const modNum = ICT_MODULE ?? moduleMeta?.module ?? null;
  const headerTitle    = modNum ? `Module ${modNum} — PDFs` : 'TARDIS — PDFs';
  const headerSubtitle = moduleMeta?.title ?? 'Support de cours, présentations et exercices';

  const sections = [
    renderSection('Support de cours', 'PDF',   'support_de_cours/',       supportPdfs),
    renderSection('Présentations',    'SLIDE',  'presentations/',           presPdfs),
    renderSection('Exercices',        'EXO',    'exercices/exercices/',     exoPdfs),
    renderSection('Solutions',        'SOL',    'exercices/solutions/',     solPdfs),
    renderSection('Cartes',           'CARTE',  'exercices/cards/',         cardsPdfs),
  ].join('');

  const html = buildPage(sections, headerTitle, headerSubtitle);
  await fs.writeFile(path.join(PDF_ROOT, 'index.html'), html, 'utf8');
  console.log(`✅ index.html généré dans ${PDF_ROOT}/`);
})();
