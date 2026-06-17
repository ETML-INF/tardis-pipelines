# Mutualisation des ressources TARDIS

Ce document explique comment les ressources sont partagées entre deux approches de build :
1. **GitHub Actions workflows** (déploiement automatique en production)
2. **Makefile local** (développement local et testing)

## Principes

L'objectif est d'éviter la duplication et les divergences entre les deux approches :
- Mêmes dépendances logicielles
- Mêmes versions des bibliothèques
- Même logique de build
- Même structure de sortie

## Architecture partagée

```
tardis-pipelines/
├── package.json              ← Dépendances Node.js partagées
├── requirements.txt          ← Dépendances Python partagées
├── scripts/
│   ├── build-manifest.mjs    ← Script partagé (Makefile + WF)
│   ├── build_exo_index.mjs   ← Script partagé (Makefile + WF)
│   └── export_exos_pdf_playwright.mjs  ← Script partagé
├── themes/                   ← Thèmes partagés
│   ├── sphinx/etml-2025/
│   ├── marp/etml-2025/
│   └── tardis/etml-2025/
└── docs/Makefile.template   ← Référence pour les dépôts de cours

.github/workflows/           ← Automatisation production
├── build-docs-and-exo.yml
├── build-tardis-manifest.yml
└── marp-to-section-inf.yml
```

## Dépendances Node.js

Centralisées dans **`package.json`** :

```json
{
  "scripts": {
    "build-manifest": "node scripts/build-manifest.mjs",
    "build-exo-index": "node scripts/build_exo_index.mjs",
    "build-exos-pdf": "node scripts/export_exos_pdf_playwright.mjs",
    "playwright:install": "playwright install --with-deps chromium"
  },
  "dependencies": {
    "glob": "^10.3.10",
    "playwright": "^1.57.0",
    "yaml": "^2.4.5"
  }
}
```

### Avantages

- ✅ Version unique pour chaque lib (pas de `npm install yaml@2` ad-hoc)
- ✅ `npm ci` installe exactement les versions lockées (si `package-lock.json` existe)
- ✅ Les workflows et Makefile utilisent les mêmes versions

### Ajouter une dépendance

```bash
# Dans tardis-pipelines/
npm install --save nomDuPackage
# Commit le changement
git add package.json package-lock.json
git commit -m "chore: ajouter nomDuPackage"
```

## Dépendances Python

Centralisées dans **`requirements.txt`** :

```
sphinx==7.x
sphinx-rtd-theme==...
...
```

### Installation

**Makefile** :
```bash
pip install -r tardis-pipelines/requirements.txt
```

**Workflows** :
```yaml
- name: Install Python deps
  run: pip install -r tardis-pipelines/requirements.txt
```

## Scripts Node.js

Les scripts dans `scripts/*.mjs` sont partagés. Ils sont appelés via :

### Approche 1 : npm run (Makefile moderne)

```bash
cd tardis-pipelines
npm ci                    # Installe les dépendances
npm run build-manifest    # Appelle scripts/build-manifest.mjs
```

### Approche 2 : node direct (Workflows)

```bash
cd tardis-pipelines
npm ci
node scripts/build-manifest.mjs
```

### Approche 3 : inline (ancien code)

❌ À éviter : installer ad-hoc `npm install yaml@2 glob@10` à chaque fois

## Structure de sortie partagée

Les deux approches génèrent la **même structure** :

```
_build_local/  (ou _build/ dans les WF)
├── cours/              ← HTML Sphinx
├── tardis/             ← Manifest TARDIS + UI
│   ├── manifests/
│   │   ├── tardis.json
│   │   └── tardis.yml
│   ├── index.html
│   └── styles.css
├── presentations/      ← Slides Marp
│   └── index.php
└── exercices/          ← PDFs Playwright
```

Cela signifie qu'un développeur testant localement (`make build`) obtiendra exactement la même structure que les workflows.

## Workflows et mutualisation

Les workflows GitHub Actions **doivent** être mis à jour pour utiliser les scripts centralisés :

### Exemple : build-tardis-manifest.yml

**Avant** (code inline) :
```yaml
- name: Build manifest
  run: |
    npm install yaml@2 glob@10
    node <<'NODE'
    # 50+ lignes de code...
    NODE
```

**Après** (script centralisé) :
```yaml
- name: Build manifest
  run: |
    cd tardis-pipelines
    npm ci
    npm run build-manifest
```

### Checklist pour mutualization

- [ ] Dépendances déclarées dans `package.json` (pas d'installations ad-hoc)
- [ ] Scripts Node.js dans `scripts/*.mjs` (pas de code inline)
- [ ] Appels via `npm run` ou `node scripts/...`
- [ ] Même structure de sortie
- [ ] Même configuration (ICT_MODULE, BRANCH_PREFIX, etc.)

## Maintenance

### Mettre à jour une dépendance

```bash
cd tardis-pipelines
npm update nomDuPackage  # ou npm install nomDuPackage@version
npm ci                   # Pour tester localement
git add package*.json
git commit -m "chore: mettre à jour nomDuPackage"
```

### Ajouter un nouveau script

1. Créer `scripts/mon-script.mjs`
2. Ajouter dans `package.json` :
   ```json
   "scripts": {
     "mon-script": "node scripts/mon-script.mjs"
   }
   ```
3. Appeler via `npm run mon-script` (Makefile et workflows)
4. Documenter dans ce fichier

### Ajouter un nouveau thème

Ajouter dans `themes/{sphinx|marp|tardis}/theme-name/`

- Sphinx : référencé dans `conf.py` et Makefile
- Marp : appelé via `--theme-set tardis-pipelines/themes/marp`
- TARDIS : copié dans le bundle avec `index.html` et `styles.css`

## Dépannage

### "Package not found"

```bash
# S'assurer que npm ci a été lancé
cd tardis-pipelines && npm ci
```

### Versions divergentes

Si les dépendances semblent divergentes entre Makefile et WF :

```bash
# Dans tardis-pipelines, vérifier la version installée
npm list nomDuPackage

# Comparer avec package.json
cat package.json | grep nomDuPackage
```

### Ajouter une nouvelle dépendance ad-hoc

❌ Ne pas faire :
```bash
npm install --save-dev quelquechose-temp
npm install yaml@2 glob@10  # Ad-hoc dans un WF
```

✅ Faire :
```bash
# Dans tardis-pipelines
npm install --save quelquechose
git add package*.json && git commit
```

## Prochaines étapes

- [ ] Migrer `build-docs-and-exo.yml` pour utiliser les scripts npm
- [ ] Migrer `build-tardis-manifest.yml` pour utiliser `npm run build-manifest`
- [ ] Migrer `marp-to-section-inf.yml` si applicable
- [ ] Documenter la versioning de tardis-pipelines (tags/releases)
- [ ] Ajouter des tests pour vérifier que Makefile et WF produisent les mêmes outputs
