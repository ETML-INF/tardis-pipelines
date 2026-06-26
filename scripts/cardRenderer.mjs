/**
 * Generates card PDFs from parsed card objects.
 * Cards are 63.5×88.9mm (standard poker size), 3×3 per A4 page.
 * Includes crop marks and optional mirrored back sheet for duplex printing.
 */

import { promises as fsPromises, existsSync, readdirSync } from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import markdownIt from 'markdown-it';
import sharp from 'sharp';

const md = markdownIt({ html: false, breaks: true });

const TYPE_LABELS = {
  location:    'Lieu',
  object:      'Objet',
  combination: 'Combo',
  puzzle:      'Puzzle',
  machine:     'Machine',
  intrus:      'Intrus',
  red_herring: 'Intrus',
  penalty:     'Pénalité',
  end:         'Fin',
};

const COLS     = 3;
const ROWS     = 3;
const CARD_W   = '63.5mm';
const CARD_H   = '88.9mm';
const CARD_W_MM = 63.5;
const CARD_H_MM = 88.9;
const PDF_IMG_W = 207;
const PDF_IMG_H = 323;

// ── CSS ───────────────────────────────────────────────────────────────────────

const CARDS_CSS = `
:root {
  --card-w: ${CARD_W};
  --card-h: ${CARD_H};
  --card-bg: #fff;
  --card-accent: #1f2a44;
  --card-margin-border-color: rgba(0,0,0,0.12);
  --card-strip-color: #fff;
}
.tardis-cardsheet { margin: 0 0 8mm 0; }
.cards-outer { position: relative; display: inline-block; overflow: visible; }

.cm-h, .cm-v { position: absolute; background: #000; print-color-adjust: exact; }
.cm-h { height: 0.4px; transform: translateY(-50%); }
.cm-v { width: 0.4px; transform: translateX(-50%); }

.tardis-cardgrid {
  display: grid; gap: 0;
  align-items: stretch; justify-items: stretch;
}
.tardis-cardgrid.cols-3 { grid-template-columns: repeat(3, var(--card-w)); }
.tardis-cardgrid > .container { display: contents; }

.tardis-card {
  box-sizing: border-box;
  width: var(--card-w); height: var(--card-h);
  border-top: 0.25mm solid var(--card-accent);
  border-right: 0.25mm solid var(--card-accent);
  border-bottom: 0.25mm solid var(--card-accent);
  border-radius: 4mm 2mm 4mm 2mm;
  background: var(--card-bg, #fff);
  display: flex; flex-direction: row;
  break-inside: avoid; page-break-inside: avoid;
  print-color-adjust: exact; overflow: hidden;
}
.tardis-card.critical { --card-accent: #b02a37; }
.tardis-card.warning  { --card-accent: #d39e00; }
.tardis-card.info     { --card-accent: #0d6efd; }
.tardis-card.success  { --card-accent: #198754; }

.tardis-card__strip {
  width: 5.5mm; flex-shrink: 0;
  background: var(--card-accent);
  display: flex; align-items: center; justify-content: center;
  print-color-adjust: exact;
}
.tardis-card__strip-text {
  writing-mode: vertical-lr; transform: rotate(180deg);
  font-size: 0.6em; font-weight: 700; letter-spacing: 0.06em;
  color: var(--card-strip-color, #fff);
  white-space: nowrap; overflow: hidden;
  max-height: 82mm; text-overflow: ellipsis; padding: 1mm 0;
}

.tardis-card__body {
  flex: 1; min-width: 0; padding: 1.5mm;
  display: flex; flex-direction: column;
  background: var(--card-margin-color, transparent); overflow: hidden;
}
.tardis-card__inner {
  flex: 1; min-height: 0; padding: 2mm;
  display: flex; flex-direction: column;
  background: var(--card-bg, #fff);
  position: relative; overflow: hidden;
  border-radius: 2mm;
  box-shadow: inset 0 0 0 0.5mm var(--card-margin-border-color);
}

.tardis-card__title {
  margin: 0 0 2mm 0; font-weight: 700; line-height: 1.15; font-size: 0.9em;
}
.tardis-card--has-image .tardis-card__title {
  position: relative; z-index: 1; margin: 0; padding: 1.5mm;
  background: var(--card-text-bg, rgba(245,235,210,0.85));
  border-radius: 1.5mm 1.5mm 0 0; print-color-adjust: exact;
}

.tardis-card__text-zone {
  flex: 1; min-height: 0; overflow: hidden;
  background: var(--card-text-bg, rgba(245,235,210,0.85));
  border-radius: 1.5mm; padding: 1.5mm; print-color-adjust: exact;
}
.tardis-card--has-image .tardis-card__text-zone {
  position: absolute; bottom: 0; left: 0; right: 0;
  border-radius: 0 0 1.5mm 1.5mm;
}

.tardis-card__content { font-size: 7pt; line-height: 1.35; overflow: hidden; }
.tardis-card__content > :first-child { margin-top: 0; }
.tardis-card__content > :last-child  { margin-bottom: 0; }
.tardis-card__content p  { margin: 0 0 1.5mm 0; }
.tardis-card__content ul,
.tardis-card__content ol { margin: 0 0 1.5mm 2mm; padding-left: 3mm; }
.tardis-card__content li { margin-bottom: 0.5mm; }
.tardis-card__content code {
  font-family: monospace; background: rgba(0,0,0,0.07);
  padding: 0 0.5mm; border-radius: 1mm;
}
.tardis-card__content pre {
  background: rgba(0,0,0,0.07); padding: 1.5mm;
  border-radius: 1.5mm; overflow: hidden; font-size: 0.85em;
}

.tardis-card--has-image .tardis-card__image {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover; display: block; z-index: 0;
}

.tardis-card__number {
  position: absolute; top: 1.5mm; right: 2.5mm;
  font-size: 5mm; font-weight: 900; line-height: 1;
  color: var(--card-accent); opacity: 0.9; z-index: 2;
}
.tardis-card__counter {
  position: absolute; bottom: 2mm; right: 2.5mm;
  font-size: 0.5em; font-weight: 600; opacity: 0.5; z-index: 2;
}

.tardis-card__reveals {
  position: absolute; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  display: flex; flex-wrap: wrap; gap: 2mm;
  justify-content: center; align-items: center;
  z-index: 3; max-width: 80%; print-color-adjust: exact;
}
.tardis-card__reveal-token {
  width: 9mm; height: 9mm; border-radius: 50%;
  background: rgba(255,255,255,0.92); color: #1f2a44;
  font-size: 4mm; font-weight: 900;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0.5mm 2mm rgba(0,0,0,0.35); print-color-adjust: exact;
}

.back-sheet { break-before: page; page-break-before: always; print-color-adjust: exact; }
.back-cell {
  box-sizing: border-box; width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden; position: relative; print-color-adjust: exact;
  background-repeat: no-repeat; background-size: cover; background-position: center;
}
.back-cell__margin {
  position: absolute; inset: 0;
  border-style: solid; border-width: 3.5mm; border-color: transparent;
  background: transparent; pointer-events: none; print-color-adjust: exact;
}
.back-cell__border {
  position: absolute; inset: 3.5mm;
  border-style: solid; border-width: 0.5mm; border-color: transparent;
  border-radius: 2mm; background: transparent;
  pointer-events: none; print-color-adjust: exact;
}
.back-number {
  position: relative; font-size: 16mm; font-weight: 900; line-height: 1;
  color: #1f2a44; background: rgba(255,255,255,0.82);
  padding: 1.5mm 3mm; border-radius: 2mm;
}

@media print {
  .tardis-cardsheet { margin: 0; break-before: page; page-break-before: always; }
  .tardis-cardsheet:first-of-type { break-before: auto; page-break-before: auto; }
  .tardis-card { border-radius: 0 !important; }
}
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function encodeImage(imgPath, width, height) {
  const buffer = await sharp(imgPath)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

function resolveImagePath(card, baseDir) {
  if (!baseDir) return null;
  const safe = (p) => {
    const resolved = path.resolve(baseDir, p);
    return resolved.startsWith(baseDir + path.sep) || resolved === baseDir ? resolved : null;
  };

  if (card.number) {
    const imagesDir = safe('images');
    if (imagesDir && existsSync(imagesDir)) {
      const prefix = `carte_${card.number}_`.toLowerCase();
      const match = readdirSync(imagesDir).find(f =>
        f.toLowerCase().startsWith(prefix) && f.toLowerCase().endsWith('.png')
      );
      if (match) { const p = safe(`images/${match}`); if (p) return p; }
    }
  }

  if (card.image) {
    const p = safe(card.image);
    if (p && existsSync(p)) return p;
  }

  const wip = safe('images/workinprogress.png');
  if (wip && existsSync(wip)) return wip;

  return null;
}

async function resolveImages(cards, baseDir) {
  if (!baseDir) return cards;
  return Promise.all(cards.map(async (card) => {
    const imgPath = resolveImagePath(card, baseDir);
    if (!imgPath) return card;
    try {
      return { ...card, imageDataUri: await encodeImage(imgPath, PDF_IMG_W, PDF_IMG_H) };
    } catch { return card; }
  }));
}

// ── Crop marks ────────────────────────────────────────────────────────────────

function buildCropMarks(cols, rows) {
  const LINE = 4;
  const GAP  = 0.8;
  const marks = [];
  for (let col = 0; col <= cols; col++) {
    for (let row = 0; row <= rows; row++) {
      const x = col * CARD_W_MM;
      const y = row * CARD_H_MM;
      marks.push(`<div class="cm-h" style="left:calc(${x}mm - ${GAP + LINE}mm);top:${y}mm;width:${LINE}mm;"></div>`);
      marks.push(`<div class="cm-h" style="left:calc(${x}mm + ${GAP}mm);top:${y}mm;width:${LINE}mm;"></div>`);
      marks.push(`<div class="cm-v" style="left:${x}mm;top:calc(${y}mm - ${GAP + LINE}mm);height:${LINE}mm;"></div>`);
      marks.push(`<div class="cm-v" style="left:${x}mm;top:calc(${y}mm + ${GAP}mm);height:${LINE}mm;"></div>`);
    }
  }
  return marks.join('\n');
}

// ── HTML par carte ────────────────────────────────────────────────────────────

function buildCardHtml(card, index, total) {
  const hasImage   = Boolean(card.imageDataUri);
  const hasContent = Boolean(card.content);

  const classes = ['tardis-card', ...card.classes, hasImage ? 'tardis-card--has-image' : '']
    .filter(Boolean).join(' ');

  const styles = [];
  if (card.bg)                styles.push(`--card-bg:${card.bg}`);
  if (card.accent)            styles.push(`--card-accent:${card.accent}`);
  if (card.accentTextColor)   styles.push(`--card-strip-color:${card.accentTextColor}`);
  if (card.marginColor)       styles.push(`--card-margin-color:${card.marginColor}`);
  if (card.marginBorderColor) styles.push(`--card-margin-border-color:${card.marginBorderColor}`);
  if (card.textBg)            styles.push(`--card-text-bg:${card.textBg}`);
  const styleAttr = styles.length ? ` style="${styles.join(';')}"` : '';

  let html = `<div class="${classes}"${styleAttr}>`;
  html += `<div class="tardis-card__strip">`;
  const stripLabel = card.accentText || TYPE_LABELS[card.type] || null;
  if (stripLabel) html += `<span class="tardis-card__strip-text">${escapeHtml(stripLabel)}</span>`;
  html += `</div>`;

  html += `<div class="tardis-card__body"><div class="tardis-card__inner">`;

  if (hasImage) html += `<img class="tardis-card__image" src="${card.imageDataUri}" alt="">`;

  const isWip = card.image && card.image.toLowerCase().includes('workinprogress');
  if (isWip && card.reveals?.length) {
    html += `<div class="tardis-card__reveals">`;
    for (const num of card.reveals)
      html += `<div class="tardis-card__reveal-token">${escapeHtml(num)}</div>`;
    html += `</div>`;
  }

  if (card.number) html += `<span class="tardis-card__number">${escapeHtml(card.number)}</span>`;
  html += `<span class="tardis-card__counter">${index}/${total}</span>`;
  if (card.title) html += `<p class="tardis-card__title"><strong>${escapeHtml(card.title)}</strong></p>`;

  if (hasContent) {
    html += `<div class="tardis-card__text-zone">`;
    html += `<div class="tardis-card__content">${md.render(card.content)}</div>`;
    html += `</div>`;
  }

  html += `</div></div></div>`;
  return html;
}

// ── Verso miroir pour impression recto-verso ──────────────────────────────────

function buildBackSheet(pageCards, backDataUri) {
  const padded = [...pageCards];
  while (padded.length < COLS * ROWS) padded.push(null);

  const mirrored = [];
  for (let row = 0; row < ROWS; row++)
    for (let col = COLS - 1; col >= 0; col--)
      mirrored.push(padded[row * COLS + col]);

  const cellsHtml = mirrored.map((card) => {
    if (!card) return `<div class="back-cell"></div>`;
    const num = card.number ? escapeHtml(card.number) : '';
    const cellStyles = [];
    if (card.marginColor) cellStyles.push(`background-color:${card.marginColor}`);
    if (backDataUri)      cellStyles.push(`background-image:url('${backDataUri}')`);
    const cellStyle   = cellStyles.length ? ` style="${cellStyles.join(';')}"` : '';
    const marginStyle = card.marginColor       ? ` style="border-color:${card.marginColor}"` : '';
    const borderStyle = card.marginBorderColor ? ` style="border-color:${card.marginBorderColor}"` : '';
    return `<div class="back-cell"${cellStyle}>
      <div class="back-cell__margin"${marginStyle}></div>
      <div class="back-cell__border"${borderStyle}></div>
      ${num ? `<span class="back-number">${num}</span>` : ''}
    </div>`;
  }).join('\n');

  return `
<div class="back-sheet">
  <div class="cards-outer">
    ${buildCropMarks(COLS, ROWS)}
    <div class="tardis-cardgrid cols-${COLS}" style="--card-w:${CARD_W};--card-h:${CARD_H};grid-template-rows:repeat(${ROWS},${CARD_H});">
      <div class="container">${cellsHtml}</div>
    </div>
  </div>
</div>`;
}

// ── Page HTML complète ────────────────────────────────────────────────────────

function buildHtmlPage(cards, backDataUri = null) {
  const marginColor = cards.find(c => c.marginColor)?.marginColor || '#ffffff';
  const perPage = COLS * ROWS;
  const total   = cards.length;
  const sheetsHtml = [];

  for (let i = 0; i < cards.length; i += perPage) {
    const pageCards = cards.slice(i, i + perPage);
    const cardsHtml = pageCards.map((c, j) => buildCardHtml(c, i + j + 1, total)).join('\n');

    sheetsHtml.push(`
<div class="tardis-cardsheet">
  <div class="cards-outer">
    ${buildCropMarks(COLS, ROWS)}
    <div class="tardis-cardgrid cols-${COLS}" style="--card-w:${CARD_W};--card-h:${CARD_H};">
      <div class="container">${cardsHtml}</div>
    </div>
  </div>
</div>
${buildBackSheet(pageCards, backDataUri)}`);
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
${CARDS_CSS}
body { margin:0; padding:0; background:#fff; font-family:'Segoe UI',Arial,sans-serif; }
.tardis-cardsheet, .back-sheet { display:flex; justify-content:center; padding-top:10mm; }
.back-sheet {
  box-sizing:border-box; padding-right:2mm;
  min-height:297mm; background-color:${marginColor};
}
</style>
</head>
<body>
${sheetsHtml.join('\n')}
</body>
</html>`;
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function generateCardsPdf(cards, baseDir = null, backPath = null) {
  const resolved    = await resolveImages(cards, baseDir);
  const backDataUri = backPath ? await encodeImage(backPath, PDF_IMG_W, PDF_IMG_H) : null;
  const html        = buildHtmlPage(resolved, backDataUri);

  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
  } finally {
    await browser.close();
  }
}
