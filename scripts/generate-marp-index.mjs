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

function extractFMField(fmStr, key) {
  const m = fmStr.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
  if (!m) return null;
  const v = m[1];
  if (v.length >= 2 && ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'"))) {
    return v.slice(1, -1);
  }
  return v;
}

async function loadModuleMeta(srcDir) {
  const base = srcDir ?? OUT_DIR;
  const candidate = path.resolve(base, '..', 'Support', 'legal', 'index.md');
  try {
    const fmStr = extractFM(stripBOM(await fs.readFile(candidate, 'utf8')));
    if (!fmStr) return null;

    let data = null;
    try { data = YAML.parse(fmStr) ?? {}; } catch { /* fall through to regex */ }

    const type   = data?.type   ?? extractFMField(fmStr, 'type');
    const module = data?.module ?? extractFMField(fmStr, 'module');
    const title  = data?.title  ?? extractFMField(fmStr, 'title');

    if (type !== 'legal') return null;
    return { module: module ?? null, title: title ?? null };
  } catch { return null; }
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
        meta.set(relHtml, {
          title: data.title ?? null,
          description: data.description ?? null,
          seq: data.seq ?? null,
        });
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
        seq: meta.seq ?? null,
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

function groupBySeq(slides) {
  const groups = new Map();
  for (const slide of slides) {
    const key = slide.seq ?? '__none__';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(slide);
  }
  // Sort: SEQ-01, SEQ-02, … then ungrouped last
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === '__none__') return 1;
    if (b === '__none__') return -1;
    return a.localeCompare(b, 'en', { numeric: true });
  });
}

function seqLabel(key) {
  if (key === '__none__') return 'Autres';
  // SEQ-01 → Séquence 1, SEQ-12 → Séquence 12
  const m = key.match(/(\d+)$/);
  return m ? `Séquence ${parseInt(m[1], 10)}` : key;
}

function renderMainContent(allSlides) {
  if (allSlides.length === 0) {
    return `
    <div class="empty-state">
      <p><strong>Aucune présentation trouvée.</strong> Les fichiers HTML générés par MARP apparaîtront ici.</p>
    </div>`;
  }

  const groups = groupBySeq(allSlides);
  const hasMultipleGroups = groups.length > 1 || (groups.length === 1 && groups[0][0] !== '__none__');

  return groups.map(([key, slides]) => `
    <section class="seq-section">
      ${hasMultipleGroups ? `<h2 class="seq-heading"><span class="seq-badge">${escapeHtml(key === '__none__' ? '—' : key)}</span>${escapeHtml(seqLabel(key))}</h2>` : ''}
      <div class="pres-grid">${slides.map(renderCard).join('')}
      </div>
    </section>`).join('');
}

(async () => {
  try {
    const [metaMap, moduleMeta] = await Promise.all([
      buildMetaMap(SRC_DIR),
      loadModuleMeta(SRC_DIR),
    ]);
    const data = await collectPresentations(OUT_DIR, metaMap);
    const allSlides = flattenSlides(data);

    const mainContent = renderMainContent(allSlides);

    const headerTitle = moduleMeta?.module
      ? `Module ${escapeHtml(moduleMeta.module)} — Présentations`
      : 'TARDIS — Présentations';
    const headerSubtitle = moduleMeta?.title
      ? escapeHtml(moduleMeta.title)
      : 'Slides générées par Marp, organisées par séquence';

    const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Présentations — TARDIS</title>
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
      --shadow-hover: 0 10px 20px -3px rgba(0,0,0,.15);
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

    /* ===== Header ===== */
    .site-header {
      background: var(--brand);
      color: #fff;
      box-shadow: 0 2px 10px rgba(0,21,51,.12);
    }
    .site-header .inner {
      width: min(95vw, 1400px);
      margin: 0 auto;
      padding: 16px;
    }
    .site-title { margin: 0; font-size: 1.35rem; line-height: 1.2; }
    .site-subtitle { margin: 4px 0 0; opacity: .9; font-size: .95rem; }

    /* ===== Main ===== */
    .wrap {
      width: min(95vw, 1400px);
      margin: 24px auto;
      padding: 0 0 40px;
      flex: 1;
    }

    /* ===== Section séquence ===== */
    .seq-section { margin-bottom: 2.5rem; }
    .seq-heading {
      display: flex;
      align-items: center;
      gap: .6rem;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--brand-dark);
      margin-bottom: 1rem;
      padding-bottom: .5rem;
      border-bottom: 2px solid var(--bd);
    }
    .seq-badge {
      display: inline-block;
      background: var(--brand);
      color: #fff;
      font-size: .75rem;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      letter-spacing: .04em;
    }

    /* ===== Grid ===== */
    .pres-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
    }
    .pres-card {
      display: flex;
      flex-direction: column;
      background: var(--card-bg);
      border: 1px solid var(--bd);
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
      border-color: var(--brand);
    }
    .thumb {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      background: linear-gradient(135deg, var(--brand-dark) 0%, #2563EB 100%);
      flex-shrink: 0;
    }
    .thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .thumb-placeholder { width: 100%; height: 100%; }
    .thumb-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: flex-end;
      padding: .75rem;
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
      padding: .65rem .9rem .75rem;
      color: var(--muted);
      font-size: .85rem;
      line-height: 1.5;
      flex: 1;
    }
    .empty-state {
      padding: 2rem;
      background: #e6eefb;
      border: 1px solid var(--bd);
      border-radius: var(--radius);
      color: var(--brand-dark);
    }

    /* ===== Footer ===== */
    .site-footer {
      background: var(--brand-dark);
      color: rgba(255,255,255,.75);
      font-size: .8rem;
      text-align: center;
      padding: 14px 16px;
    }
    .site-footer a { color: rgba(255,255,255,.85); text-decoration: none; }
    .site-footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="inner">
      <h1 class="site-title">${headerTitle}</h1>
      <p class="site-subtitle">${headerSubtitle}</p>
    </div>
  </header>

  <main class="wrap">${mainContent}
  </main>

  <footer class="site-footer">
    <p>TARDIS — Teaching And Resources Development for Integrated Sequences &nbsp;|&nbsp; <a href="..">Retour à l'accueil</a></p>
  </footer>
</body>
</html>`;

    await fs.writeFile(path.join(OUT_DIR, 'index.html'), htmlContent, 'utf8');
    console.log(`✅ index.html généré dans ${OUT_DIR}/`);
  } catch (e) {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  }
})();
