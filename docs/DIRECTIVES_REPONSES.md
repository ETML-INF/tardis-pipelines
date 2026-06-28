# Directives de réponses — TARDIS

Les directives de réponses permettent aux apprentis de saisir leurs réponses
directement dans le cours HTML, de les conserver entre les sessions
(localStorage) et de les exporter en un fichier Markdown à remettre au
formateur.

Toutes les directives partagent le même mécanisme :
- **autosave** automatique dans le navigateur
- **export** déclenché par `{export-answers}` en fin de page
- **rendu PDF** : version imprimable sans interactivité

---

## `{answer}` — Réponse libre

Zone de texte libre (textarea). Utiliser `:label:` pour nommer la question —
ce label apparaît visuellement au-dessus de la zone et dans l'export.

**Syntaxe :**

````markdown
```{answer}
:label: A1. Décrivez ce que vous avez observé.
```
````

**Options :**

| Option | Défaut | Description |
|--------|--------|-------------|
| `:label:` | _(vide)_ | Libellé affiché et utilisé dans l'export |
| `:lines:` | `6` | Hauteur de la zone (nombre de lignes) |
| `:lang:` | _(vide)_ | Active Monaco Editor (`shell`, `python`, `sql`…) |

**Argument optionnel :** identifiant stable (recommandé pour éviter la perte
des réponses lors de renommage de fichier).

````markdown
```{answer} e-117-q1-observation
:label: A1. Décrivez ce que vous avez observé.
:lines: 10
```
````

**Export produit :**

```markdown
## A1. Décrivez ce que vous avez observé.
```
Texte saisi par l'apprenti.
```
```

---

## `{qcm-answer}` — QCM exportable

Cases à cocher sans correction automatique. Les choix cochés sont inclus dans
l'export. À utiliser pour les questions à choix multiples d'un exercice.

> Pour un QCM avec vérification et feedback immédiat, utiliser `{qcm}`.

**Syntaxe :**

````markdown
```{qcm-answer}
:label: C1. Un switch KVM permet de :
- Connecter plusieurs serveurs à un seul clavier, écran et souris
- Amplifier le signal réseau entre deux armoires
- Alimenter les équipements en cas de coupure électrique
- Segmenter le réseau en VLANs
```
````

**Options :**

| Option | Description |
|--------|-------------|
| `:label:` | Libellé affiché et utilisé dans l'export |
| `:single:` | Bascule en boutons radio (une seule sélection possible) |

**Argument optionnel :** identifiant stable.

**`:single:` — choix unique :**

````markdown
```{qcm-answer}
:label: 1. Ce réseau est un :
:single:
- WAN
- LAN
- PAN
- SAN
```
````

PDF : `○` pour les radio, `□` pour les cases à cocher.

**Export produit :**

```markdown
## C1. Un switch KVM permet de :
- [x] Connecter plusieurs serveurs à un seul clavier, écran et souris
- [ ] Amplifier le signal réseau entre deux armoires
- [ ] Alimenter les équipements en cas de coupure électrique
- [ ] Segmenter le réseau en VLANs
```

---

## `{hole-answer}` — Texte lacunaire

Texte ou tableau Markdown avec des trous à compléter. Les trous sont marqués
`[___]` dans le contenu. Chaque trou devient un champ de saisie inline dans
le rendu HTML.

**Syntaxe — texte :**

````markdown
```{hole-answer}
:label: B4. Complétez la phrase :
Le modèle OSI comporte [___] couches. La couche [___] gère le transport.
```
````

**Syntaxe — tableau :**

````markdown
```{hole-answer}
:label: B1. Complétez le tableau :
| Segment     | Signification |
|-------------|---------------|
| `A`         | [___]         |
| `P01`       | [___]         |
| `03` (1er)  | [___]         |
| `03` (2e)   | [___]         |
| `09` / `11` | [___]         |
```
````

**Options :**

| Option | Description |
|--------|-------------|
| `:label:` | Libellé affiché et utilisé dans l'export |

**Argument optionnel :** identifiant stable.

**Export produit :**

```markdown
## B1. Complétez le tableau :
| Segment     | Signification  |
|-------------|----------------|
| `A`         | [Bâtiment]     |
| `P01`       | [Potelet 01]   |
| `03` (1er)  | [Étage]        |
| `03` (2e)   | [Local]        |
| `09` / `11` | [Numéro port]  |
```

---

## `{export-answers}` — Bouton d'export

Génère un bouton en bas de page qui télécharge toutes les réponses de la page
(réponses libres, QCM cochés, trous remplis) dans un fichier Markdown horodaté.

**Syntaxe :**

````markdown
```{export-answers}
```
````

À placer **une seule fois**, en fin de page d'exercice.

Le fichier exporté est nommé `titre-de-la-page-AAAA-MM-JJ.md`.

**Ignoré en PDF.**

---

## Structure type d'une page d'exercice

````markdown
# Titre de l'exercice

## Partie A — Questions ouvertes

```{answer}
:label: A1. Première question.
```

```{answer}
:label: A2. Deuxième question.
:lines: 10
```

## Partie B — Tableau lacunaire

```{hole-answer}
:label: B1. Complétez le tableau :
| Colonne 1 | Colonne 2 |
|-----------|-----------|
| Valeur A  | [___]     |
| Valeur B  | [___]     |
```

## Partie C — QCM

```{qcm-answer}
:label: C1. Quelle affirmation est correcte ?
- Proposition 1
- Proposition 2
- Proposition 3
```

---

```{export-answers}
```
````
