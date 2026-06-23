// Node 20+ / Playwright
import { promises as fs } from "fs";
import path from "path";
import { chromium } from "playwright";
import crypto from "crypto";
import YAML from "yaml";

// ---------------------------------------------------------------------------
// ENV + CONSTANTES
// ---------------------------------------------------------------------------
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const THEMES_DIR = path.resolve(SCRIPT_DIR, "..", "themes", "pdf");

const SRC = process.env.SPHINX_SRC_DIR || "b-UnitesEnseignement/Support";
const HTML_OUT = process.env.HTML_OUT_DIR || path.join(SRC, "_build/html");
const PDF_OUT = process.env.PDF_OUT_DIR || path.join(SRC, "_build/exo-pdf");

const ICT_MODULE = process.env.ICT_MODULE || "Module ICT";
const TODAY = new Date().toLocaleDateString("fr-CH");

// Theme PDF (header/footer/css) — chemin absolu basé sur l'emplacement du script
const PDF_THEME_SELECTED = process.env.PDF_THEME
  ? path.join(THEMES_DIR, process.env.PDF_THEME)
  : path.join(THEMES_DIR, "etml-2025");

// ---------------------------------------------------------------------------
// MÉTADONNÉES MODULE (auteur depuis legal/index.md)
// ---------------------------------------------------------------------------
async function loadAuthor(srcDir) {
  try {
    const legalPath = path.join(srcDir, "legal", "index.md");
    const raw = await fs.readFile(legalPath, "utf8");
    const m = raw.replace(/^﻿/, '').match(/^---\s*\n([\s\S]*?)\n(?:---|\.\.\.)/);
    if (!m) return null;
    const data = YAML.parse(m[1]) ?? {};
    return data.author ?? data.authors ?? null;
  } catch { return null; }
}

const AUTHOR = await loadAuthor(SRC);

// ---------------------------------------------------------------------------
// UTILS
// ---------------------------------------------------------------------------
function shortHash(s) {
  return crypto.createHash("md5").update(s).digest("hex").slice(0, 6);
}

async function* walk(dir) {
  for (const d of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function brutalClean(s) {
  return [...String(s)]
    .filter((c) => {
      const code = c.charCodeAt(0);
      return (
        code === 32 ||
        (code >= 33 && code <= 126) ||
        (code >= 160 && code <= 255)
      );
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

async function safeLoad(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

async function safeLoadBinaryDataURL(filePath, mime = "image/png") {
  try {
    const buf = await fs.readFile(filePath);
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// CHARGEMENT DU THEME (CSS + logos)
// ---------------------------------------------------------------------------
const headerCss = await safeLoad(path.join(PDF_THEME_SELECTED, "css", "header.css"));
const footerCss = await safeLoad(path.join(PDF_THEME_SELECTED, "css", "footer.css"));

const PRINT_EXO_CSS_PATH = path.join(PDF_THEME_SELECTED, "css", "print-exo.css");

const LOGO_DATA = await safeLoadBinaryDataURL(
  path.join(PDF_THEME_SELECTED, "images", "etml_logo_complet.png")
);

const SECTION_LOGO_DATA = await safeLoadBinaryDataURL(
  path.join(PDF_THEME_SELECTED, "images", "logo.png")
);

// ---------------------------------------------------------------------------
// HEADER & FOOTER
// ---------------------------------------------------------------------------
function buildHeaderTemplate(title) {
  const safeTitle = brutalClean(title || "");
  const cssBlock = headerCss ? `<style>${headerCss}</style>` : "";
  return `
    ${cssBlock}
    <div class="hdr-wrap">
      <div class="hdr-left">
        ${LOGO_DATA ? `<img class="hdr-logo-etml" src="${LOGO_DATA}" />` : ``}
        <div class="hdr-text-block">
          <div class="hdr-module">${ICT_MODULE}</div>
        </div>
      </div>
      <div class="hdr-center">
        <div class="hdr-title">${safeTitle}</div>
      </div>
      <div class="hdr-right">
        ${SECTION_LOGO_DATA ? `<img class="hdr-logo-section" src="${SECTION_LOGO_DATA}" />` : ``}
      </div>
    </div>
  `;
}

function buildFooterTemplate() {
  const cssBlock = footerCss ? `<style>${footerCss}</style>` : "";
  const authorLabel = AUTHOR ? `Auteur : ${brutalClean(String(AUTHOR))}` : "";
  return `
    ${cssBlock}
    <div class="ftr-wrap">
      <div class="ftr-left muted">
        ${authorLabel}
      </div>
      <div class="ftr-center muted">
        Page <span class="pageNumber"></span>/<span class="totalPages"></span>
      </div>
      <div class="ftr-right muted">
        <span class="hdr-date">${TODAY}</span>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// PDF - PASS 1 : PDF exercices "complets"
// ---------------------------------------------------------------------------
async function pdfExerciseFull(page, htmlAbs, pdfTarget, baseName) {
  const fileUrl = "file://" + path.resolve(htmlAbs);

  await page.goto(fileUrl, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");

  // Marges exercice (comme avant)
  await page.addStyleTag({
    content: `
      @page { size: A4; margin: 25mm; }
    `,
  });

  // CSS print-exo (nettoyage RTD etc.)
  if (PRINT_EXO_CSS_PATH) {
    await page.addStyleTag({ path: PRINT_EXO_CSS_PATH });
  }

  // Titre
  let pageTitle = baseName;
  const h1 = await page.locator("h1").first();
  if (await h1.count()) pageTitle = brutalClean(await h1.innerText());

  await page.pdf({
    path: pdfTarget,
    printBackground: true,
    preferCSSPageSize: true,
    format: "A4",
    margin: { top: "25mm", bottom: "25mm", left: "25mm", right: "25mm" },
    displayHeaderFooter: true,
    headerTemplate: buildHeaderTemplate(pageTitle),
    footerTemplate: buildFooterTemplate(),
  });
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  const srcStat = await fs.stat(SRC).catch(() => null);
  if (!srcStat?.isDirectory()) {
    console.log(`Dossier source introuvable: ${SRC} — aucun exercice à exporter.`);
    return;
  }

  // collecte des .md sous /exercices (hors index.md)
  const mdFiles = [];
  for await (const p of walk(SRC)) {
    if (!p.toLowerCase().endsWith(".md")) continue;
    const parts = p.split(path.sep).map((s) => s.toLowerCase());
    if (!parts.includes("exercices")) continue;
    if (path.basename(p).toLowerCase() === "index.md") continue;
    mdFiles.push(p);
  }

  if (!mdFiles.length) {
    console.log("Aucun exercice trouvé.");
    return;
  }

  await fs.mkdir(PDF_OUT, { recursive: true });

  const bucketExo = path.join(PDF_OUT, "exercices");
  const bucketSol = path.join(PDF_OUT, "solutions");

  await fs.mkdir(bucketExo, { recursive: true });
  await fs.mkdir(bucketSol, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ locale: "fr-CH" });
  const page = await ctx.newPage();

  let converted = 0;
  let skipped = 0;

  for (const mdPath of mdFiles) {
    const rel = path.relative(SRC, mdPath);
    const htmlRel = rel.replace(/\.md$/i, ".html");
    const htmlAbs = path.join(HTML_OUT, htmlRel);

    try {
      await fs.access(htmlAbs);
    } catch {
      console.warn("⚠️ HTML introuvable (skippé):", htmlAbs);
      skipped++;
      continue;
    }

    const parent = path.basename(path.dirname(mdPath)).toLowerCase();
    const bucket = parent === "solutions" ? bucketSol : bucketExo;

    const baseName = path.basename(mdPath, ".md");

    let pdfName = `${baseName}.pdf`;
    let pdfTarget = path.join(bucket, pdfName);

    try {
      await fs.access(pdfTarget);
      const h = shortHash(rel);
      pdfName = `${baseName}-${h}.pdf`;
      pdfTarget = path.join(bucket, pdfName);
    } catch {}

    await pdfExerciseFull(page, htmlAbs, pdfTarget, baseName);
    console.log("✓ PDF", path.relative(PDF_OUT, pdfTarget));
    converted++;
  }

  await browser.close();

  console.log(`Terminé: ${converted} PDF exo/sol créés, ${skipped} ignorés.`);
}

await main();
