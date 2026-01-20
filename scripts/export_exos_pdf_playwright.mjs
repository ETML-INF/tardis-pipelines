// Node 20+ / Playwright
import { promises as fs } from "fs";
import path from "path";
import { chromium } from "playwright";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// ENV + CONSTANTES
// ---------------------------------------------------------------------------
const SRC = process.env.SPHINX_SRC_DIR || "b-UnitesEnseignement/Support";
const HTML_OUT = process.env.HTML_OUT_DIR || path.join(SRC, "_build/html");
const PDF_OUT = process.env.PDF_OUT_DIR || path.join(SRC, "_build/exo-pdf");

const ICT_MODULE = process.env.ICT_MODULE || "Module ICT";
const TODAY = new Date().toLocaleDateString("fr-CH");

// Theme PDF (header/footer/css)
const PDF_THEME_SELECTED = process.env.PDF_THEME
  ? path.join("tardis-pipelines", "themes", "pdf", process.env.PDF_THEME)
  : path.join("tardis-pipelines", "themes", "pdf", "etml-2025");

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

// Détection "a des cartes" côté source MD (rapide, robuste)
async function mdHasCards(mdPath) {
  try {
    const s = await fs.readFile(mdPath, "utf8");
    // tes sources utilisent surtout les fences MyST: ```{card}
    // on accepte aussi :::{card} au cas où
    return /```{card\b|:::{card\b|```{cardgrid\b|:::{cardgrid\b/i.test(s);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// CHARGEMENT DU THEME (CSS + logos)
// ---------------------------------------------------------------------------
const headerCss = await safeLoad(path.join(PDF_THEME_SELECTED, "css", "header.css"));
const footerCss = await safeLoad(path.join(PDF_THEME_SELECTED, "css", "footer.css"));

const PRINT_EXO_CSS_PATH = path.join(PDF_THEME_SELECTED, "css", "print-exo.css");

// CSS cartes (ton fichier "print-cards.css" dédié cartes)
const PRINT_CARDS_CSS_PATH = path.join(PDF_THEME_SELECTED, "css", "print-cards.css");

const LOGO_DATA = await safeLoadBinaryDataURL(
  path.join(PDF_THEME_SELECTED, "images", "etml_logo_complet.png")
);

const SECTION_LOGO_DATA = await safeLoadBinaryDataURL(
  path.join(PDF_THEME_SELECTED, "images", "section_info_logo.png")
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
  return `
    ${cssBlock}
    <div class="ftr-wrap">
      <div class="ftr-left muted">
        <span class="hdr-date">${TODAY}</span>
      </div>
      <div class="ftr-center muted">
        Page <span class="pageNumber"></span>/<span class="totalPages"></span>
      </div>
      <div class="ftr-right muted"></div>
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
// PDF - PASS 2 : PDF "cartes only" + page blanche après chaque planche
// ---------------------------------------------------------------------------
async function pdfCardsOnlyWithBlank(page, htmlAbs, pdfTargetCards) {
  const fileUrl = "file://" + path.resolve(htmlAbs);

  await page.goto(fileUrl, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");

  // Si pas de planches, on skip
  const hasSheets = await page.evaluate(() => {
    return document.querySelectorAll(".tardis-cardsheet").length > 0;
  });
  if (!hasSheets) return false;

  // Isoler uniquement les planches + intercaler une page blanche après chaque planche
  await page.evaluate(() => {
    const sheets = Array.from(document.querySelectorAll(".tardis-cardsheet"));
    if (!sheets.length) return;

    // purge body
    document.body.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.id = "cards-only";
    document.body.appendChild(wrap);

    for (const s of sheets) {
      wrap.appendChild(s); // déplacement DOM

      // page blanche après la planche
      const blank = document.createElement("div");
      blank.className = "tardis-blank-page";
      wrap.appendChild(blank);
    }
  });

  // Marges CARTES : à régler (imprimante / découpe). Exemple: 10mm.
  await page.addStyleTag({
    content: `
      @page { size: A4; margin: 10mm; }
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
    `,
  });

  // CSS cartes (ton layout + cards)
  if (PRINT_CARDS_CSS_PATH) {
    await page.addStyleTag({ path: PRINT_CARDS_CSS_PATH });
  }

  // CSS page blanche intercalée
  await page.addStyleTag({
    content: `
      @media print{
        .tardis-blank-page{
          height: 0;
          page-break-before: always;
          break-before: page;
        }
      }
    `,
  });

  // Important: pas de header/footer sinon la "page blanche" ne sera plus blanche
  await page.pdf({
    path: pdfTargetCards,
    printBackground: true,
    preferCSSPageSize: true,
    format: "A4",
    margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    displayHeaderFooter: false,
  });

  return true;
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
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
  const bucketCards = path.join(PDF_OUT, "cards");

  await fs.mkdir(bucketExo, { recursive: true });
  await fs.mkdir(bucketSol, { recursive: true });
  await fs.mkdir(bucketCards, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ locale: "fr-CH" });
  const page = await ctx.newPage();

  let converted = 0;
  let skipped = 0;
  let cardsMade = 0;
  let cardsSkipped = 0;

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

    // --- PASS 1 : PDF complet exo/solution
    {
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

    // --- PASS 2 : PDF cartes-only si le MD contient des cards
    // (tu peux aussi décider de faire le check côté HTML, mais ce check MD évite des navigateurs inutiles)
    const hasCards = await mdHasCards(mdPath);
    if (!hasCards) {
      cardsSkipped++;
      continue;
    }

    {
      let pdfCardsName = `${baseName}--cards.pdf`;
      let pdfCardsTarget = path.join(bucketCards, pdfCardsName);

      try {
        await fs.access(pdfCardsTarget);
        const h = shortHash(rel);
        pdfCardsName = `${baseName}--cards-${h}.pdf`;
        pdfCardsTarget = path.join(bucketCards, pdfCardsName);
      } catch {}

      const ok = await pdfCardsOnlyWithBlank(page, htmlAbs, pdfCardsTarget);
      if (ok) {
        console.log("✓ PDF cards", path.relative(PDF_OUT, pdfCardsTarget));
        cardsMade++;
      } else {
        // si le MD disait "cards" mais que le HTML n’a pas de cardsheet (erreur build / directive)
        console.warn("⚠️ Cardsheet introuvable (cards skippé):", htmlAbs);
        cardsSkipped++;
      }
    }
  }

  await browser.close();

  console.log(
    `Terminé: ${converted} PDF exo/sol créés, ${skipped} ignorés. ` +
      `Cards: ${cardsMade} créés, ${cardsSkipped} ignorés.`
  );
}

await main();
