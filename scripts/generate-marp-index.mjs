#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import YAML from 'yaml';

const OUT_DIR = process.env.OUT_DIR || '.';
const SRC_DIR = process.env.SRC_DIR || null;

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
}

const stripBOM = s => s.replace(/^﻿/, '');

function extractFM(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n(?:---|\.\.\.)/);
  return m ? m[1] : null;
}

async function buildMetaMap(srcDir) {
  const meta = new Map();
  if (!srcDir) return meta;
  try {
    const files = await glob(`${srcDir}/**/*.md`, { nodir: true });
    for (const f of files) {
      try {
        const fmStr = extractFM(stripBOM(await fs.readFile(f, 'utf8')));
        if (!fmStr) continue;
        const data = YAML.parse(fmStr) ?? {};
        const relHtml = path.relative(srcDir, f).replace(/\.md$/, '.html');
        meta.set(relHtml, { title: data.title ?? null, description: data.description ?? null });
      } catch { /* skip malformed files */ }
    }
  } catch { /* SRC_DIR unavailable */ }
  return meta;
}

async function collectPresentations(dir, metaMap, baseUrl = './', relBase = '') {
  const result = { slides: [], groups: {} };

  if (!await fs.stat(dir).catch(() => null)) return result;

  const items = (await fs.readdir(dir)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  const hasPreview = await fs.stat(path.join(dir, 'preview.png')).catch(() => null) !== null;
  const previewUrl = hasPreview ? baseUrl + 'preview.png' : null;

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      const subUrl = baseUrl + encodeURIComponent(item) + '/';
      const subRel = relBase ? `${relBase}/${item}` : item;
      const sub = await collectPresentations(fullPath, metaMap, subUrl, subRel);
      if (sub.slides.length > 0 || Object.keys(sub.groups).length > 0) {
        result.groups[item] = sub;
      }
    } else if (item.endsWith('.html') && item !== 'index.php') {
      // Skip root-level index.html — that's our generated file
      if (relBase === '' && item === 'index.html') continue;

      const relHtml = relBase ? `${relBase}/${item}` : item;
      const meta = metaMap.get(relHtml) ?? {};
      const defaultTitle = item === 'index.html' ? 'Présentation' : item.replace(/\.html$/, '');

      result.slides.push({
        title: meta.title ?? defaultTitle,
        description: meta.description ?? null,
        path: baseUrl + encodeURIComponent(item),
        previewUrl,
      });
    }
  }

  return result;
}

function flattenSlides(data) {
  const slides = [...data.slides];
  for (const sub of Object.values(data.groups)) {
    slides.push(...flattenSlides(sub));
  }
  return slides;
}

function renderTableRow(slide, index) {
  return `
    <tr>
      <td>${index + 1}</td>
      <td><a href="${escapeHtml(slide.path)}" target="_blank" rel="noreferrer" class="pres-link">${escapeHtml(slide.title)}</a></td>
      <td>${slide.description ? escapeHtml(slide.description) : '-'}</td>
    </tr>`;
}

(async () => {
  try {
    const metaMap = await buildMetaMap(SRC_DIR);
    const data = await collectPresentations(OUT_DIR, metaMap);
    const allSlides = flattenSlides(data);

    const mainContent = allSlides.length > 0
      ? `\n    <table class="pres-table">
      <thead>
        <tr>
          <th class="col-num">#</th>
          <th class="col-title">Présentation</th>
          <th class="col-desc">Description</th>
        </tr>
      </thead>
      <tbody>${allSlides.map((slide, idx) => renderTableRow(slide, idx)).join('')}
      </tbody>
    </table>`
      : `\n    <div class="empty-state">
      <p><strong>Aucune présentation trouvée.</strong> Les fichiers HTML générés par MARP apparaîtront ici.</p>
    </div>`;

    const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Présentations disponibles</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    :root {
      --primary:       #004595;
      --primary-dark:  #003366;
      --primary-light: #2563EB;
      --text:          #1F2937;
      --text-muted:    #6B7280;
      --bg:            #F9FAFB;
      --card-bg:       #FFFFFF;
      --border:        #E5E7EB;
      --radius:        10px;
      --shadow:        0 4px 6px -1px rgba(0,0,0,.10);
      --shadow-hover:  0 10px 20px -3px rgba(0,0,0,.15);
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Lexend', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      padding: 2rem 1rem;
    }
    .page { max-width: 1200px; margin: 0 auto; }
    h1 {
      font-size: 2rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--primary-dark), var(--primary-light));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 2rem;
    }
    .pres-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: var(--shadow);
      margin-top: 2rem;
    }
    .pres-table thead {
      background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-light) 100%);
      color: white;
    }
    .pres-table th {
      padding: 1rem;
      text-align: left;
      font-weight: 600;
      font-size: 0.95rem;
    }
    .pres-table th.col-num {
      width: 60px;
      text-align: center;
    }
    .pres-table th.col-title {
      width: 40%;
    }
    .pres-table th.col-desc {
      flex: 1;
    }
    .pres-table tbody tr {
      border-top: 1px solid var(--border);
      transition: background .15s ease;
    }
    .pres-table tbody tr:hover {
      background: #F5F6FA;
    }
    .pres-table td {
      padding: 0.9rem 1rem;
      font-size: 0.95rem;
    }
    .pres-table td:first-child {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85rem;
      font-weight: 500;
    }
    .pres-link {
      color: var(--primary-light);
      text-decoration: none;
      font-weight: 500;
      transition: color .15s ease;
    }
    .pres-link:hover {
      color: var(--primary-dark);
      text-decoration: underline;
    }
    .empty-state {
      padding: 2rem;
      background: #EEF2FF;
      border: 1px solid #C7D2FE;
      border-radius: var(--radius);
      color: var(--primary-dark);
    }
  </style>
</head>
<body>
  <div class="page">
    <h1>Présentations</h1>${mainContent}
  </div>
</body>
</html>`;

    await fs.writeFile(path.join(OUT_DIR, 'index.html'), htmlContent, 'utf8');
    console.log(`✅ index.html généré dans ${OUT_DIR}/`);
  } catch (e) {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  }
})();
