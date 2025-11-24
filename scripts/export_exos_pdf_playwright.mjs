// Node 20+ / Playwright
import { promises as fs } from "fs";
import path from "path";
import { chromium } from "playwright";
import crypto from "crypto";
import { fileURLToPath } from "url";

// -----------------------------------------------------------------------------
//  Contexte & chemins
// -----------------------------------------------------------------------------

// Répertoire courant = racine du cours (ex: I346-...)
// Script = tardis-pipelines/scripts/export_exos_pdf_playwright.mjs
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

// Thème actif (logos + css)
const THEME_ROOT =
  process.env.TARDIS_THEME_ROOT ||
  path.join(SCRIPT_DIR, "..", "themes", "etml-2025");

const HEADER_CSS_PATH = path.join(THEME_ROOT, "css", "header.css");
const FOOTER_CSS_PATH = path.join(THEME_ROOT, "css", "footer.css");
const PRINT_EXO_CSS_PATH = path.join(THEME_ROOT, "css", "print-exo.css");

// Sphinx (dans le repo du module)
const SRC = process.env.SPHINX_SRC_DIR || "b-UnitesEnseignement/Support";
const HTML_OUT = process.env.HTML_OUT_DIR || path.join(SRC, "_build/html");
const PDF_OUT = process.env.PDF_OUT_DIR || path.join(SRC, "_build/exo-pdf");

// Contexte module
const ICT_MODULE = process.env.ICT_MODULE || "Module ICT";
const TODAY = new Date().toLocaleDateString("fr-CH");

// -----------------------------------------------------------------------------
//  Utilitaires
// -----------------------------------------------------------------------------

function shortHash(s) {
  return crypto.createHash("md5").update(s).digest("hex").slice(0, 6);
}

async function* walk(dir) {
  for (const d of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) {
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

// Version brutale qui vire les caractères exotiques (ex: "")
function brutalClean(s) {
  const codes = [];
  for (const ch of s) codes.push(ch.codePointAt(0));
  console.log("RAW TITLE DUMP:", JSON.stringify(s));
  console.log("CODES:", codes);

  return [...s]
    .filter((c) => {
      const code = c.codePointAt(0);
      // Espace
      if (code === 32) return true;
      // ASCII imprimable
      if (code >= 33 && code <= 126) return true;
      // Latin-1 étendu imprimable
      if (code >= 160 && code <= 255) return true;
      // On jette le reste (dont le fameux 61633 == 0xF101)
      return false;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

// -----------------------------------------------------------------------------
//  Chargement des assets (CSS + logos)
// -----------------------------------------------------------------------------

let HEADER_CSS = "";
let FOOTER_CSS = "";
let PRINT_EXO_CSS = "";

try {
  HEADER_CSS = await fs.readFile(HEADER_CSS_PATH, "utf8");
} catch (e) {
  console.warn("⚠️ header.css introuvable:", HEADER_CSS_PATH, e.message);
}

try {
  FOOTER_CSS = await fs.readFile(FOOTER_CSS_PATH, "utf8");
} catch (e) {
  console.warn("⚠️ footer.css introuvable:", FOOTER_CSS_PATH, e.message);
}

try {
  PRINT_EXO_CSS = await fs.readFile(PRINT_EXO_CSS_PATH, "utf8");
} catch (e) {
  console.warn("⚠️ print-exo.css introuvable:", PRINT_EXO_CSS_PATH, e.message);
}

// Logos (dans le thème)
const LOGO_PATH = path.join(THEME_ROOT, "images", "etml_logo_complet.png");
let LOGO_DATA = "";
try {
  const buf = await fs.readFile(LOGO_PATH);
  LOGO_DATA = `data:image/png;base64,${buf.toString("base64")}`;
} catch {
  console.warn("⚠️ Logo ETML introuvable:", LOGO_PATH);
}

const SECTION_LOGO_PATH = path.join(
  THEME_ROOT,
  "images",
  "section_info_logo.png",
);
let SECTION_LOGO_DATA = "";
try {
  const buf = await fs.readFile(SECTION_LOGO_PATH);
  SECTION_LOGO_DATA = `data:image/png;base64,${buf.toString("base64")}`;
} catch {
  console.warn("⚠️ Logo section INF introuvable:", SECTION_LOGO_PATH);
}

// -----------------------------------------------------------------------------
//  Templates header / footer
//  (les <style> injectent le CSS issu de header.css/footer.css)
// -----------------------------------------------------------------------------

function buildHeaderTemplate(title) {
  const safeTitle = brutalClean(title || "");
  return `
  <style>
  ${HEADER_CSS}
  </style>

  <div class="hdr-wrap">
    <div class="left">
      ${LOGO_DATA ? `<img src="${LOGO_DATA}" />` : ``}
      <span class="strong">${ICT_MODULE}</span>
      <span class="title">${safeTitle}</span>
    </div>
    <div class="muted">${TODAY}</div>
    <div class="right">
      ${SECTION_LOGO_DATA ? `<img src="${SECTION_LOGO_DATA}" alt="Section INF logo" />` : ``}
    </div>
  </div>
  `;
}

function buildFooterTemplate(url = "") {
  const safeUrl = url || "";
  return `
  <style>
  ${FOOTER_CSS}
  </style>

  <div class="ftr">
    <div class="ftr-left muted">${safeUrl}</div>
    <div class="ftr-center muted">
      Page <span class="pageNumber"></span>/<span class="totalPages"></span>
    </div>
    <div class="ftr-right muted"></div>
  </div>
  `;
}

// -----------------------------------------------------------------------------
//  Main
// -----------------------------------------------------------------------------

async function main() {
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
    const rel = path.relative(SRC, mdPath); // ex: objX/.../exercices/mon-exo.md
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
    } catch {
      // pas de collision => OK
    }

    const fileUrl = "file://" + path.resolve(htmlAbs);

    await page.goto(fileUrl, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");

    // CSS d'impression global (layout, marges, zones de réponse, etc.)
    if (PRINT_EXO_CSS) {
      await page.addStyleTag({ content: PRINT_EXO_CSS });
    }

    // Titre = <h1> si dispo, sinon baseName
    let pageTitle = baseName;
    const h1 = page.locator("h1").first();
    if (await h1.count()) {
      const raw = await h1.innerText();
      pageTitle = brutalClean(raw);
    }

    const exoUrl = process.env.EXO_URL || "";

    await page.pdf({
      path: pdfTarget,
      printBackground: true,
      preferCSSPageSize: true,
      format: "A4",
      margin: { top: "16mm", bottom: "14mm", left: "12mm", right: "12mm" },
      displayHeaderFooter: true,
      headerTemplate: buildHeaderTemplate(pageTitle),
      footerTemplate: buildFooterTemplate(exoUrl),
    });

    console.log("✓ PDF", path.relative(PDF_OUT, pdfTarget));
    converted++;
  }

  await browser.close();
  console.log(`Terminé: ${converted} PDF créés, ${skipped} ignorés`);
}

await main();
