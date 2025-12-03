# Qu'est-ce que TARDIS ?

TARDIS signifie **T**eaching **A**nd **R**esearch for **I**ntegrated **S**equences. En d'autres termes, à l'instar des épsiodes de Dr Who votre cours se construit souvent de manière non-linéaire, mais à la fin tous les éléments s'emboîtent pour former un tout cohérent.

Tardis c'est ça : une boîte à outils vous permettant d'emmener dans vos cours, vos élèves à la découverte d'une chouette aventure. Prêts ? Alors... Allons-y !



---

## 1. Contenu du dépôt

### 1.1. Workflows réutilisables

Dans `.github/workflows/` :

- `build-docs-and-exo.yml`  
  > Build la doc Sphinx (HTML) + génère les PDF d’exercices via Playwright + déploie le tout par FTP.
- `build-lessons-schedule.yml`  
  > Génère le manifeste TARDIS (tardis.yml / tardis.json) + déploie les manifests et les fichiers UI (index.html / styles.css).
- `marp-to-section-inf.yml`  
  > Build les présentations Marp et les déploie sur le FTP de la section INF.

Ces workflows sont consommés via `workflow_call` depuis chaque dépôt de cours.

### 1.2. Actions composites

Dans `.github/actions/` :

- `ftp-sync`  
  Action composite d’abstraction autour de `SamKirkland/FTP-Deploy-Action` :
  - crée au besoin l’arborescence distante `moduleICT/<module>/<dossier>`,
  - s’assure de la présence d’un fichier de state (placeholder) pour le delta,
  - lance la sync FTP en FTPS.

### 1.3. Extensions Sphinx

Dans `extensions/` :

- `tardis_qcm.py` : rôle/directive pour questions à choix multiples.
- `tardis_textarea.py` : bloc de réponse libre (textarea) pour les exercices.

### 1.4. Thèmes & assets

# 🎨 Thèmes & Assets — Synthèse

Le dossier `themes/` contient le **thème par défaut `etml-2025`**, utilisé dans l’ensemble de la chaîne TARDIS :

- **MARP** (présentations)
- **PDF / Playwright** (supports & exercices)
- **Sphinx** (documentation HTML)
- **TARDIS Frontend** (landing pages des modules)

Chaque pipeline charge ce thème via un paramètre (ex. `THEME=etml-2025`).

## 💡 Personnalisation

Pour créer une variante visuelle :

1. Copier le dossier `etml-2025`
2. Le renommer (ex. `etml-darklab`, `dev-blue`, `retro-ghosts`)
3. Adapter les CSS / polices / images
4. Passer le nouveau nom au workflow GitHub Actions

L’ensemble du système TARDIS basculera automatiquement sur le thème choisi.

## 🔧 Exemple d’utilisation (workflow)

```yaml
with:
  sphinx_theme: "etml-2025"
```

Il suffit de remplacer par votre thème :

```yaml
with:
  sphinx_theme: "dev-blue"
```

---

Ce mécanisme permet :
- une identité graphique cohérente pour toute la section INF  
- des déclinaisons modulaires et réutilisables  
- une intégration simple dans les pipelines GitHub  


### 1.5. Scripts

Dans `scripts/` :

- `export_exos_pdf_playwright.mjs`  
  Script Node/Playwright qui :
  - détecte tous les `.md` dans un dossier `exercices/`,
  - charge la version HTML Sphinx correspondante,
  - applique une feuille de style print dédiée,
  - génère les PDF (exercices + solutions) avec header/footer ETML.

- `build_exo_index.mjs`
  Script Node qui :
  - Construit la page d'index des exercices et solutions à partir des PDF générés.  

---

## 2. Pré-requis

### 2.1. Dans le dépôt **tardis-pipelines**

- Fichier `requirements.txt` (dépendances Sphinx, myst-parser, thème RTD, etc.).
- Fichier `conf.py` générique, utilisé par tous les modules via `-c tardis-pipelines`.

### 2.2. Dans chaque dépôt de cours

Exemple : `ETML-INF/I346-concevoir-et-realiser-des-solutions-cloud`
  - `b-UnitesEnseignement/`
    - `Support/`
      - `index.md` + autres `.md`
      - sous-dossiers `objX-.../exercices/` contenant les `.md` d’exercices et un éventuel `solutions/`

### 2.3. Secrets / Variables GitHub

Dans le dépôt **de cours** (Settings → Secrets and variables → Actions) :

**Variables (Repository variables)**

- `ICT_MODULE` : ex. `346`

*Votre dépôt utilisera aussi les variables et secrets définis au niveau de l'organisation (FTP_PASSWORD, ...)*

---

## 3. Utilisation des workflows réutilisables

### 3.1. Build docs + PDF d’exercices

*Si vous avez créé votre dépôt à partir du template, regardez dans votre dossier .github/workflows si vous n'avez pas déjà les workflows déjà préparés*

Dans le dépôt du module, créer `.github/workflows/ref-build-docs-and-exo.yml` (le nom vous appartient) :

```yaml
name: (Ref) Build docs & exercices PDF (TARDIS pipelines)

on:
  push:
    branches: [ "main" ]
    paths:
      - "b-UnitesEnseignement/Support/**"
      - ".github/workflows/ref-build-docs-and-exo.yml"
  workflow_dispatch:

jobs:
  build:
    uses: ETML-INF/tardis-pipelines/.github/workflows/build-docs-and-exo.yml@v0.1
    with:
      ict_module: ${{ vars.ICT_MODULE }}
      sphinx_src: "b-UnitesEnseignement/Support"
      theme: "etml-2025"
```



Ce workflow va :

1. **Checkout** le repo de cours.
2. **Checkout** `ETML-INF/tardis-pipelines`.
3. Installer les dépendances Python (à partir de `tardis-pipelines/requirements.txt`).
4. Builder la doc **Sphinx HTML** dans `b-UnitesEnseignement/Support/_build/html`.
5. Uploader l’artefact `site-html`.
6. Installer Node + Playwright.
7. Générer les **PDF d’exercices** avec `export_exos_pdf_playwright.mjs` dans `.../_build/exo-pdf`.
8. Uploader l’artefact `exercices-pdf`.
9. Déployer par FTP (HTML + exercices) via l’action composite `ftp-sync`.

### 3.2. Build manifest TARDIS + UI

Dans le dépôt du module, créer `.github/workflows/ref-build-lessons-schedule.yml` :

```yaml
name: Build Lessons Schedule (TARDIS pipelines)

on:
  push:
    branches: [ "main" ]
    paths:
      - "b-UnitesEnseignement/**"
      - ".github/workflows/ref-build-lessons-schedule.yml"
  workflow_dispatch:

jobs:
  build:
    uses: ETML-INF/tardis-pipelines/.github/workflows/ref-build-lessons-schedule.yml@v0.1
    with:
      ict_module: ${{ vars.ICT_MODULE }}
```

Ce workflow va :

1. Scanner tous les `.md` avec front matter TARDIS (`type`, `id`, `seq`, etc.).  
2. Générer un manifeste unifié :
   - `b-UnitesEnseignement/_build/manifests/tardis.yml`
   - `b-UnitesEnseignement/_build/manifests/tardis.json`
3. Uploader l’artefact `manifests`.
4. Uploader l’artefact `tardis-ui` (`a-IdentificationModule/index.html` + `styles.css`).
5. Déployer `manifests` + UI sur le FTP, à l’emplacement :  
   `moduleICT/<module>/<FTP_TARDIS_DIR>/`.

### 3.3. Build Marp (présentations)

Un workflow est fourni :

- `marp-to-section-inf.yml`

Ce workflow convertit les `.md` de votre dépôt Github en présentation `MARP` et les uploade sur [https://enseignement.section-inf.ch/moduleICT/votre_module](https://enseignament.section-inf.ch)


Le thème par défaut se situe dans le dépôt dans le dossier `tardis-pipelines/themes/marp/etml-2025`

---

## 4. Action composite `ftp-sync`

Définie dans `.github/actions/ftp-sync/action.yml`.

### 4.1. Inputs

```yaml
inputs:
  local-dir:      # Répertoire local à synchroniser (obligatoire)
  custom-dir:     # sous-dossier distant, ex: cours / exercices / tardis / presentations
  ictroot-dir:    # racine des modules, ex: moduleICT
  ictmodule-dir:  # ex: 346
  state-name:     # nom du fichier de state, défaut: .ftp-sync-state.json
  log-level:      # minimal/basic/standard/verbose
  timeout:        # ms, défaut: 300000
  ftp-server:     # hôte FTP
  ftp-username:   # user
  ftp-password:   # password
```

### 4.2. Comportement

1. Vérifie que `ftp-server`, `ftp-username`, `ftp-password` ne sont pas vides.  
2. Utilise `curl` pour :
   - créer si besoin l’arborescence :  
     `/ictroot-dir/ictmodule-dir/custom-dir/`,
   - vérifier la présence d’un fichier de state,
   - pousser un placeholder `{}` si le state n’existe pas.
3. Appelle `SamKirkland/FTP-Deploy-Action` en mode FTPS (port 21) pour synchroniser `local-dir` vers le remote.

---

## 5. Versioning et bonnes pratiques

- **Toujours** référencer une version taggée du workflow :  
  `@v0.1`, `@v0.2`, etc.  
  Éviter d’utiliser `@main` dans les repos de cours.
- Aligner les structures de répertoires de tous les modules pour limiter les cas particuliers.
- Ne pas modifier `tardis-pipelines` depuis les repos de cours : proposer des évolutions via PR.

---

## 6. Roadmap (esquisse)

- **v0.1**
  - ✅ Build Sphinx HTML + Playwright PDF (exercices).
  - ✅ Déploiement FTP factorisé via `ftp-sync`.
  - ✅ Génération du manifeste TARDIS (tardis.yml/json).

- **v0.2**
  - Génération d’index HTML (exercices, présentations) à partir de templates versionnés dans `tardis-pipelines` (HTML + CSS dédiés).
  - Thèmes multiples (ex: `etml-2025`, `minimal`, `dark`, etc.), avec sélection par input.
  - Thèmes confort

- **v1.0**
  - Stabilisation des contrats (inputs, chemins).
  - Exemple de repo de cours “template” pour onboarding des nouveaux collègues.

---

## 7. Contribution

- PR bienvenues depuis les membres de la section INF.
- Merci de :
  - respecter la structure existante (`extensions/`, `themes/`, `.github/`…),
  - documenter tout nouveau workflow ou action composite,
  - éviter les dépendances exotiques (priorité à la simplicité et à la reproductibilité sur GitHub Actions).

---

Section INF — ETML  
TARDIS : Teaching And Resources Development for Integrated Sequences


