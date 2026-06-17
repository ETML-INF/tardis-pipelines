# Build Local - TARDIS Pipeline

Compilez votre cours localement sans dépendre des GitHub Actions.

## Installation

### 1. Copier le Makefile dans votre dépôt de cours

```bash
# Dans votre dépôt de cours (ex: I346, CSR, etc.)
cp path/to/tardis-pipelines/docs/Makefile.template ./Makefile
```

### 2. Structure attendue

Votre dépôt doit avoir :

```
Mon-Cours-I346/
├── Makefile                          ← Copié depuis le template
├── .github/workflows/
│   └── ref-*.yml                     (workflows GitHub optionnels)
└── b-UnitesEnseignement/
    ├── Support/                      (docs Sphinx)
    │   ├── index.rst
    │   ├── conf.py (optionnel)
    │   └── ...
    ├── Presentations/                (slides Marp)
    │   ├── slide1.md
    │   ├── Module-A/
    │   │   ├── intro.md
    │   │   └── concepts.md
    │   └── ...
    └── Legal/ (optionnel)
        └── index.md                  (manifest TARDIS)
```

## Configuration

### Créer le fichier `.env`

Dans votre **dépôt de cours** (où se trouve le Makefile), créez un fichier `.env`:

```bash
echo "ICT_MODULE=117" > .env
```

Ou manuellement, créez `.env` avec:
```
ICT_MODULE=117
```

Remplacez `117` par le code de votre module ICT (ex: 346, etc.).

**Remarque**: Ajoutez `.env` à votre `.gitignore` local pour ne pas commiter vos configuration personnelles.

## Utilisation

### Vérifier les dépendances

```bash
make check-deps
```

Vérifie que vous avez Python 3, Node/NPM et PHP.

### Installer les dépendances

```bash
make install-deps
```

Installe :
- `sphinx` et modules Python (requirements.txt de tardis-pipelines)
- `@marp-team/marp-cli` (npm global)

### Setup initial

```bash
make setup
```

Clone/met à jour `tardis-pipelines/` automatiquement.

### Compiler

**Tout compiler :**
```bash
make build
```

**Juste la documentation :**
```bash
make build-docs
```

**Juste les slides :**
```bash
make build-slides
```

**Juste le manifest TARDIS :**
```bash
make build-manifest
```

### Lancer un serveur local

```bash
make serve
```

Démarre un serveur HTTP sur `http://localhost:8000` :
- `http://localhost:8000/docs/` → Documentation
- `http://localhost:8000/tardis/` → Manifest TARDIS
- `http://localhost:8000/presentations/dist/html/` → Slides

Appuyez sur `Ctrl+C` pour arrêter.

### Nettoyer

```bash
make clean
```

Supprime les fichiers générés dans `_build_local/`.

## Workflow recommandé

```bash
# Première utilisation
make install-deps
make setup
make build
make serve

# Développement ultérieur
make build       # Recompile après modifications
make serve       # Vérifiez le résultat
```

## Dépendances système requises

### Linux/Ubuntu/WSL2

```bash
# Python 3
sudo apt update
sudo apt install python3 python3-pip

# Node.js + npm
sudo apt install nodejs npm

# PHP (optionnel, pour les indexes)
sudo apt install php-cli
```

### macOS

```bash
# Avec Homebrew
brew install python3 node php
```

## Structure de sortie

Le Makefile génère dans `_build_local/` :

```
_build_local/
├── docs/                 (Sphinx HTML)
│   ├── index.html
│   └── ...
├── tardis/               (TARDIS manifest + UI)
│   ├── index.html
│   ├── styles.css
│   └── manifests/
│       ├── tardis.json
│       └── tardis.yml
└── presentations/        (Marp slides)
    └── dist/html/
        ├── index.php
        ├── slide1.html
        └── Module-A/
            ├── index.php
            └── intro.html
```

## Dépannage

### "Python 3 manquant"

Installez Python 3 :
```bash
sudo apt install python3 python3-pip  # Linux/WSL2
brew install python3                  # macOS
```

### "Node/NPM manquant"

Installez Node.js :
```bash
sudo apt install nodejs npm            # Linux/WSL2
brew install node                      # macOS
```

### "Marp CLI not found"

Installez Marp globalement :
```bash
npm install -g @marp-team/marp-cli
```

### Sphinx erreurs

Assurez-vous que `requirements.txt` est présent dans `tardis-pipelines/` :
```bash
cat tardis-pipelines/requirements.txt
```

Si des modules manquent :
```bash
pip3 install --user sphinx sphinx-rtd-theme
```

### "b-UnitesEnseignement/Support not found"

Vérifiez la structure du dossier de cours. Le Makefile cherche :
- `b-UnitesEnseignement/Support/` pour Sphinx
- `b-UnitesEnseignement/Presentations/` pour Marp

## Notes

- Le Makefile clone automatiquement `tardis-pipelines/` s'il n'existe pas
- Les sorties sont générées dans `_build_local/`, qui est `.gitignore`d
- Compatible WSL2, Linux (Ubuntu) et macOS
- Output coloré avec ✓/✗ indicators

## Compatible avec GitHub Actions

Le Makefile local produit la même structure que les workflows GitHub, donc vous pouvez :
1. Développer localement avec `make build && make serve`
2. Pousser sur GitHub
3. Les workflows génèrent les mêmes artefacts pour le déploiement FTP
