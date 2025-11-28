// Node 20+ / Playwright
import { promises as fs } from "fs";
import path from "path";
import { chromium } from "playwright";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// ENV & chemins de base
// ---------------------------------------------------------------------------
const SRC = process.env.SPHINX_SRC_DIR || "b-UnitesEnseignement/Support";
const HTML_OUT = process.env.HTML_OUT_DIR || path.join(SRC, "_build/html");
const PDF_OUT = process.env.PDF_OUT_DIR || path.join(SRC, "_build/exo-pdf");

const ICT_MODULE = process.env.ICT_MODULE || "Module ICT";
const TODAY = new Date().toLocaleDateString("fr-CH");

// Thème TARDIS (passé par le workflow)
// ex: /home/runner/work/.../tardis-pipelines/themes/etml-2025
const THEME_ROOT = process.env.TARDIS_THEME_ROOT ||
  path.join("tardis-pipelines", "themes", "etml-2025");

const CSS_DIR = path.join(THEME_ROOT, "css");
const IMG_DIR = path.join(THEME_ROOT, "images");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

// Nettoyage brutal pour virer les caractères bizarres (icône d’ancre Sphinx, etc.)
function brutalClean(s) {
  return [...s]
    .filter((c) => {
      const code = c.charCodeAt(0);
      return (
        code === 32 || // espace
        (code >= 33 && code <= 126) || // ASCII imprimable
        (code >= 160 && code <= 255) // Latin-1 imprimable
      );
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Chargement des ressources du thème (CSS + logos)
// ---------------------------------------------------------------------------
async function loadThemeAssets() {
  const printCssPath = path.join(CSS_DIR, "print-exo.css");
  const headerCssPath = path.join(CSS_DIR, "header.css");
  const footerCssPath = path.join(CSS_DIR, "footer.css");

  let printCss = "";
  let headerCss = "";
  let footerCss = "";
  let logoData = "";
  let sectionLogoData = "";

  try {
    printCss = await fs.readFile(printCssPath, "utf8");
    console.log(`[TARDIS] print-exo.css chargé depuis: ${printCssPath}`);
  } catch (err) {
    console.warn("[TARDIS] Impossible de lire print-exo.css:", err.message);
  }

  try {
    headerCss = await fs.readFile(headerCssPath, "utf8");
    console.log(`[TARDIS] header.css chargé depuis: ${headerCssPath}`);
  } catch (err) {
    console.warn("[TARDIS] Impossible de lire header.css:", err.message);
  }

  try {
    footerCss = await fs.readFile(footerCssPath, "utf8");
    console.log(`[TARDIS] footer.css chargé depuis: ${footerCssPath}`);
  } catch (err) {
    console.warn("[TARDIS] Impossible de lire footer.css:", err.message);
  }

  // Logos
  const logoPath = path.join(IMG_DIR, "etml_logo_complet.png");
  const sectionLogoPath = path.join(IMG_DIR, "section_info_logo.png");

  try {
    const buf = await fs.readFile(logoPath);
    logoData = `data:image/png;base64,${buf.toString("base64")}`;
    console.log(`[TARDIS] Logo ETML chargé depuis: ${logoPath}`);
  } catch (err) {
    console.warn("[TARDIS] Impossible de lire etml_logo_complet.png:", err.message);
  }

  try {
    const buf = await fs.readFile(sectionLogoPath);
    sectionLogoData = `data:image/png;base64,${buf.toString("base64")}`;
    console.log(`[TARDIS] Logo section INF chargé depuis: ${sectionLogoPath}`);
  } catch (err) {
    console.warn("[TARDIS] Impossible de lire section_info_logo.png:", err.message);
  }

  return { printCss, headerCss, footerCss, logoData, sectionLogoData };
}

// ---------------------------------------------------------------------------
// Templates header / footer
// ---------------------------------------------------------------------------
function buildHeaderTemplate(title, headerCss, logoData, sectionLogoData) {
  const safeTitle = brutalClean(title || "");
  const cssBlock = headerCss ? `<style>${headerCss}</style>` : "";

  return `
  ${cssBlock}
  <div class="hdr-wrap">
    <div class="hdr-left">
      ${logoData ? `<img class="hdr-logo-etml" src="${logoData}" />` : ``}
      <div class="hdr-text-block">
        <div class="hdr-module">${ICT_MODULE}</div>
        <div class="hdr-title">${safeTitle}</div>
      </div>
    </div>
    <div class="hdr-center">
      <span class="hdr-date">${TODAY}</span>
    </div>
    <div class="hdr-right">
      ${sectionLogoData ? `<img class="hdr-logo-section" src="${sectionLogoData}" />` : ``}
    </div>
  </div>
  `;
}

function buildFooterTemplate(url, footerCss) {
  const cssBlock = footerCss ? `<style>${footerCss}</style>` : "";
  const safeUrl = brutalClean(url || "");

  return `
  ${cssBlock}
  <div class="ftr-wrap">
    <div class="ftr-left muted">
      ${safeUrl}
    </div>
    <div class="ftr-center muted">
      Page <span class="pageNumber"></span>/<span class="totalPages"></span>
    </div>
    <div class="ftr-right muted">
      <!-- placeholder pour signature / auteur / copyright -->
    </div>
  </div>
  `;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  console.log(`[TARDIS] SRC         = ${SRC}`);
  console.log(`[TARDIS] HTML_OUT    = ${HTML_OUT}`);
  console.log(`[TARDIS] PDF_OUT     = ${PDF_OUT}`);
  console.log(`[TARDIS] THEME_ROOT  = ${THEME_ROOT}`);

  const { printCss, headerCss, footerCss, logoData, sectionLogoData } =
    await loadThemeAssets();

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
    console.log("[TARDIS] Aucun exercice trouvé.");
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
      // ok, pas encore de fichier → on garde le nom simple
    }

    const fileUrl = "file://" + path.resolve(htmlAbs);

    await page.goto(fileUrl, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");

    // Appliquer la CSS d’impression du thème
    if (printCss) {
      await page.addStyleTag({ content: printCss });
    }

    // Titre = <h1> si dispo, sinon baseName
    let pageTitle = baseName;
    const h1 = page.locator("h1").first();
    if (await h1.count()) {
      const rawTitle = (await h1.innerText()) || "";
      pageTitle = brutalClean(rawTitle);
    }

    // Eventuellement une URL publique → pour l’instant vide
    const exoUrl = process.env.EXO_URL || "";

    await page.pdf({
      path: pdfTarget,
      printBackground: true,
      preferCSSPageSize: true,
      format: "A4",
      margin: { top: "16mm", bottom: "14mm", left: "12mm", right: "12mm" },
      displayHeaderFooter: true,
      headerTemplate: buildHeaderTemplate(
        pageTitle,
        headerCss,
        logoData,
        sectionLogoData,
      ),
      footerTemplate: buildFooterTemplate(exoUrl, footerCss),
    });

    console.log("✓ PDF", path.relative(PDF_OUT, pdfTarget));
    converted++;
  }

  await browser.close();
  console.log(
    `[TARDIS] Terminé: ${converted} PDF créés, ${skipped} ignorés`,
  );
}

await main();
