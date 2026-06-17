#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

const OUT_DIR = process.env.OUT_DIR || '.';

async function scanSlidesHierarchy(dir, baseUrl = './') {
  const structure = {
    folders: {},
    slides: {}
  };

  if (!await fs.stat(dir).catch(() => null)) return structure;

  const items = await fs.readdir(dir);
  items.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = await fs.stat(fullPath);

    if (stat.isDirectory()) {
      const subStructure = await scanSlidesHierarchy(fullPath, baseUrl + encodeURIComponent(item) + '/');
      if (Object.keys(subStructure.slides).length > 0 || Object.keys(subStructure.folders).length > 0) {
        structure.folders[item] = subStructure;
      }
    } else if (item.endsWith('.html') && item !== 'index.php') {
      // Include all HTML files except index.php
      // index.html at root is skipped by the folder check, but index.html in subdirs is included
      const name = item === 'index.html' ? '📄 Présentation' : item.replace(/\.html$/, '');
      structure.slides[item] = {
        name,
        path: baseUrl + encodeURIComponent(item),
        file: item
      };
    }
  }

  return structure;
}

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, char => map[char]);
}

function renderHierarchy(structure, level = 0) {
  let html = '';
  const uniqueId = `accordion_${Math.random().toString(36).substr(2, 9)}`;

  if (Object.keys(structure.slides).length > 0) {
    html += '<div class="slides-grid">';
    for (const [_, slide] of Object.entries(structure.slides)) {
      html += `
            <div class="slide-card">
              <div class="card shadow-sm h-100">
                <div class="card-body">
                  <h5 class="card-title mb-2">
                    <a href="${escapeHtml(slide.path)}" target="_blank" class="text-decoration-none">
                      ${escapeHtml(slide.name)}
                    </a>
                  </h5>
                  <p class="card-text text-muted small mb-0">Présentation MARP</p>
                </div>
              </div>
            </div>`;
    }
    html += '</div>';
  }

  if (Object.keys(structure.folders).length > 0) {
    html += `<div class="accordion mt-4" id="${uniqueId}">`;
    let itemIndex = 0;

    for (const [folderName, subStructure] of Object.entries(structure.folders)) {
      const collapsedId = `${uniqueId}_${itemIndex}`;
      html += `
            <div class="card mb-2 border-light">
              <div class="card-header bg-light p-0">
                <button class="btn btn-link btn-block text-left" type="button" data-toggle="collapse" data-target="#${collapsedId}" aria-expanded="false">
                  <span class="folder-icon">📁</span> ${escapeHtml(folderName)}
                </button>
              </div>
              <div id="${collapsedId}" class="collapse" data-parent="#${uniqueId}">
                <div class="card-body">
                  ${renderHierarchy(subStructure, level + 1)}
                </div>
              </div>
            </div>`;
      itemIndex++;
    }

    html += '</div>';
  }

  return html;
}

(async () => {
  try {
    const hierarchy = await scanSlidesHierarchy(OUT_DIR);
    const hasContent = Object.keys(hierarchy.slides).length > 0 || Object.keys(hierarchy.folders).length > 0;

    const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Présentations disponibles</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" rel="stylesheet">
  <style>
    :root {
      --color-primary: #004595;
      --color-primary-light: #2563EB;
      --color-primary-lighter: #DBEAFE;
      --color-primary-dark: #003366;
      --color-text: #1F2937;
      --color-text-light: #6B7280;
      --color-bg: #FFFFFF;
      --color-bg-soft: #F9FAFB;
      --color-bg-accent: #F0F4FF;
      --color-border: #E5E7EB;
      --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      --radius-md: 8px;
      --transition-fast: 0.15s ease-in-out;
    }

    * {
      font-family: 'Lexend', system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    body {
      background: var(--color-bg-soft);
      color: var(--color-text);
      min-height: 100vh;
      padding: 2rem 1rem;
    }

    .container {
      background: var(--color-bg);
      border-radius: var(--radius-md);
      padding: 2.5rem;
      box-shadow: var(--shadow-md);
      max-width: 1200px;
    }

    h1 {
      background: linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 2rem;
      font-weight: 700;
      font-size: 2rem;
    }

    .slides-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }

    .slide-card {
      height: 100%;
    }

    .card {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      transition: all var(--transition-fast);
      overflow: hidden;
      background: var(--color-bg);
    }

    .card:hover {
      transform: translateY(-3px);
      box-shadow: var(--shadow-lg);
      border-color: var(--color-primary-light);
    }

    .card-body {
      padding: 1.25rem;
    }

    .card-title {
      margin-bottom: 0.75rem;
    }

    .card a {
      color: var(--color-primary);
      font-weight: 600;
      text-decoration: none;
      transition: all var(--transition-fast);
      position: relative;
    }

    .card a::after {
      content: '';
      position: absolute;
      bottom: -2px;
      left: 0;
      width: 0;
      height: 2px;
      background: linear-gradient(90deg, var(--color-primary), var(--color-primary-light));
      transition: width var(--transition-fast);
    }

    .card a:hover::after {
      width: 100%;
    }

    .card-text {
      color: var(--color-text-light);
    }

    .accordion .card {
      border: 1px solid var(--color-border);
      margin-bottom: 0.75rem;
    }

    .accordion .card-header {
      border-bottom: none;
      background: var(--color-bg-soft);
      padding: 0;
    }

    .accordion .btn-link {
      color: var(--color-primary);
      font-weight: 600;
      padding: 1rem;
      text-decoration: none;
      display: block;
      width: 100%;
      text-align: left;
      transition: all var(--transition-fast);
    }

    .accordion .btn-link:hover {
      color: var(--color-primary-dark);
      background: var(--color-bg-accent);
      text-decoration: none;
    }

    .accordion .btn-link::after {
      float: right;
      transition: transform var(--transition-fast);
    }

    .accordion .btn-link[aria-expanded="true"]::after {
      transform: rotate(-180deg);
    }

    .accordion .card-body {
      padding: 1.5rem;
      background: var(--color-bg);
    }

    .folder-icon {
      margin-right: 0.5rem;
      font-size: 1.1em;
    }

    .alert {
      background: var(--color-bg-accent);
      border: 1px solid var(--color-primary-lighter);
      color: var(--color-primary-dark);
      border-radius: var(--radius-md);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Présentations disponibles</h1>

    ${!hasContent ? `
      <div class="alert">
        <strong>ℹ️ Aucune présentation trouvée.</strong> Les fichiers HTML générés par MARP apparaîtront ici.
      </div>
    ` : renderHierarchy(hierarchy)}
  </div>

  <script src="https://code.jquery.com/jquery-3.3.1.slim.min.js"></script>
  <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js"></script>
</body>
</html>`;

    await fs.writeFile(path.join(OUT_DIR, 'index.html'), htmlContent, 'utf8');
    console.log(`✅ index.html généré dans ${OUT_DIR}/`);
  } catch (e) {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  }
})();
