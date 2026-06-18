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

function renderCard(slide) {
  const thumb = slide.previewUrl
    ? `<img src="${escapeHtml(slide.previewUrl)}" alt="" class="thumb-img" loading="lazy">`
    : `<div class="thumb-placeholder"></div>`;

  return `
      <a class="pres-card" href="${escapeHtml(slide.path)}" target="_blank" rel="noreferrer">
        <div class="thumb">
          ${thumb}
          <div class="thumb-overlay">
            <span class="thumb-title">${escapeHtml(slide.title)}</span>
          </div>
        </div>${slide.description ? `
        <p class="pres-desc">${escapeHtml(slide.description)}</p>` : ''}
      </a>`;
}

(async () => {
  try {
    const metaMap = await buildMetaMap(SRC_DIR);
    const data = await collectPresentations(OUT_DIR, metaMap);
    const allSlides = flattenSlides(data);

    const mainContent = allSlides.length > 0
      ? `\n    <div class="pres-grid">${allSlides.map(renderCard).join('')}\n    </div>`
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
    .pres-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
      margin-top: 2rem;
    }
    .pres-card {
      display: flex;
      flex-direction: column;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
      text-decoration: none;
      color: inherit;
      box-shadow: var(--shadow);
      transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
    }
    .pres-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-hover);
      border-color: var(--primary-light);
    }
    .thumb {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-light) 100%);
      flex-shrink: 0;
    }
    .thumb-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .thumb-placeholder { width: 100%; height: 100%; }
    .thumb-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: flex-end;
      padding: 0.75rem;
      background: linear-gradient(to top, rgba(0,0,0,.65) 0%, transparent 55%);
    }
    .thumb-title {
      color: #fff;
      font-size: .95rem;
      font-weight: 600;
      line-height: 1.3;
      text-shadow: 0 1px 3px rgba(0,0,0,.5);
    }
    .pres-desc {
      padding: 0.65rem 0.9rem 0.75rem;
      color: var(--text-muted);
      font-size: .85rem;
      line-height: 1.5;
      flex: 1;
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
