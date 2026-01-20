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
  return [...s]
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

// ---------------------------------------------------------------------------
// CHARGEMENT DU THEME (CSS + logos)
// ---------------------------------------------------------------------------
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

const headerCss = await safeLoad(path.join(PDF_THEME_SELECTED, "css", "header.css"));
const footerCss = await safeLoad(path.join(PDF_THEME_SELECTED, "css", "footer.css"));

const LOGO_DATA = await safeLoadBinaryDataURL(
  path.join(PDF_THEME_SELECTED, "images", "etml_logo_complet.png")
);
const SECTION_LOGO_DATA = await safeLoadBinaryDataURL(
  path.join(PDF_THEME_SELECTED, "images", "section_info_logo.png")
);

// ---------------------------------------------------------------------------
// HEADER & FOOTER
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
      </div>
    </div>
    <div class="hdr-center">
      <div class="hdr-title">${safeTitle}</div>
    </div>
    <div class="hdr-right">
      ${sectionLogoData ? `<img class="hdr-logo-section" src="${sectionLogoData}" />` : ``}
    </div>
  </div>
  `;
}

function buildFooterTemplate(footerCss) {
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
// CARDS-ONLY EXPORT
// ---------------------------------------------------------------------------
async function exportCardsOnlyPDF({
  browserCtx,
  htmlAbs,
  pdfTarget,
  themeDir,
}) {
  const p = await browserCtx.newPage();
  const fileUrl = "file://" + path.resolve(htmlAbs);

  await p.goto(fileUrl, { waitUntil: "load" });
  await p.waitForLoadState("networkidle");

  // Marges faibles: sinon 3 cartes poker ne passent pas en A4
  await p.addStyleTag({
    content: `
      @media print {
        html, body { margin: 0 !important; padding: 0 !important; }
        @page { size: A4; margin: 6mm; }
      }
    `,
  });

