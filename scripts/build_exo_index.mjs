// Génère un index.html pour les exercices/solutions à partir d'un template + CSS
import { promises as fs } from "fs";
import path from "path";

const ROOT = process.env.EXO_ROOT || "site-exo/exercices";

const PDF_THEME_SELECTED = process.env.PDF_THEME
  ?  path.join("tardis-pipelines", "themes", "pdf", process.env.PDF_THEME)
  : path.join("tardis-pipelines", "themes", "pdf", "etml-2025");

const TEMPLATE_PATH = path.join(PDF_THEME_SELECTED, "templates", "exo-index.html");
const CSS_SOURCE = path.join(PDF_THEME_SELECTED, "css", "exo-index.css");
const CSS_TARGET = path.join(ROOT, "exo-index.css"); // copié à côté de index.html

async function listPdfs(dir) {
  try {
    const files = await fs.readdir(dir);
    return files
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

function buildListSection(title, baseHref, files) {
  if (!files.length) return "";

  const items = files
    .map(
      (f) =>
        `<li><a href="${baseHref}${encodeURIComponent(f)}" download>${f}</a></li>`
    )
    .join("\n");

  return `
<section class="exo-section">
  <h2>${title}</h2>
  <ul>
    ${items}
  </ul>
</section>`;
}

async function main() {
  console.log(`📄 Génération de l'index d'exercices dans: ${ROOT}`);

  // 1) Lire template HTML
  const template = await fs.readFile(TEMPLATE_PATH, "utf8");

  // 2) Lister PDFs
  const exoDir = path.join(ROOT, "exercices");;
  const solDir = path.join(ROOT, "solutions");

  const exo = await listPdfs(exoDir);
  const sol = await listPdfs(solDir);

  // 3) Construire sections HTML
  const exoSection = exo.length
    ? buildListSection("Exercices", "./exercices/", exo)
    : '<p class="exo-empty">Aucun exercice PDF disponible pour le moment.</p>';

  const solSection = sol.length
    ? buildListSection("Solutions", "./solutions/", sol)
    : "";

  // 4) Injecter dans le template
  let html = template
    .replace("{{EXO_SECTION}}", exoSection)
    .replace("{{SOL_SECTION}}", solSection);

  // 5) Écrire index.html
  const indexPath = path.join(ROOT, "index.html");
  await fs.writeFile(indexPath, html, "utf8");
  console.log(`✅ index.html généré: ${indexPath}`);

  // 6) Copier le CSS du thème
  try {
    await fs.copyFile(CSS_SOURCE, CSS_TARGET);
    console.log(`✅ CSS copié: ${CSS_TARGET}`);
  } catch (err) {
    console.error("⚠️ Impossible de copier exo-index.css:", err);
  }
}

await main().catch((err) => {
  console.error("❌ Erreur lors de la génération de l'index exercices:", err);
  process.exit(1);
});
