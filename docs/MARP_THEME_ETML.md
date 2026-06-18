# Aide-mémoire — Thème Marp `etml-2025`

Thème situé dans `themes/marp/etml-2025/etml.css`.

---

## Front matter minimal

```yaml
---
marp: true
theme: etml
title: "Titre de la présentation"
paginate: true
header: "<div class=\"left\"><img src=\"../img/etml_logo_complet.svg\" alt=\"ETML\"></div><div class=\"center\">Section INF</div><div class=\"right\"><span class=\"deck\">Titre court</span><span class=\"badge\">SEQ-01</span></div>"
footer: "<div class=\"left\">Section ALL</div><div class=\"right\">© 2025</div>"
seq: SEQ-01
order: 1
align_ict: ["ICT-117-OO1"]
---
```

---

## Types de slides (`<!-- _class: ... -->`)

| Classe | Usage | Ce qu'elle fait |
|---|---|---|
| `title` | Slide de couverture | Centré, pas de header/footer/pagination |
| `transition` | Séparateur de bloc | Titre énorme, fond clair, fade-in animé, pas de barre |
| `concept` | Mot-clé / brainstorm | Fond noir, texte doré avec halo néon pulsé, `h1` uniquement |
| `question` | Question à la classe | Centré verticalement |
| `definition` | Poser une définition | Bordure gauche bleue, préfixe `(Def.)` automatique sur le `h1` |
| `example` | Exemple de code | Bloc de code stylisé sombre |
| `check` | Liste de vérification | Puces `✅` automatiques |
| `warning` | Point d'attention | Fond orange, bordure épaisse orange |
| `summary` | Récap de fin de bloc | Fond bleu pâle, puces `◾` |
| `schema` | Image pleine slide | Image centrée à 92% de la largeur |
| `activity` | Consigne d'activité | Fond blanc, texte compact, `h2` en majuscules |
| `quote` | Citation | Centré, italique |

**Utilisation :**

```markdown
<!-- _class: concept -->

# Le protocole TCP/IP
```

---

## Layout du texte (slides normales)

Le contenu paragraphe/liste est décalé de **15% à gauche et 15% à droite** par défaut (`--text-left` / `--text-right`). Les slides `activity` utilisent une marge réduite de 5%.

---

## Palette de couleurs

| Variable | Valeur | Rôle |
|---|---|---|
| `--brand-primary` | `#0f2a6d` | Bleu électrique — titres `h1`, liens |
| `--brand-secondary` | `#475569` | Bleu profond — `h2`, `h3`, puces |
| `--brand-accent` | `#ff7a1a` | Orange — warnings |

---

## Images disponibles dans `themes/marp/etml-2025/img/`

| Fichier | Usage suggéré |
|---|---|
| `etml_logo_complet.svg` | Logo dans le header |
| `ghost_questions.png` | Slide `question` |
| `ghost_objectives.png` | Slide d'objectifs |
| `working_ghost.png` | Slide `activity` |
| `happy_ghosts.png` / `proud_ghost.png` | Fin de séquence / félicitations |
| `scared_ghosts.png` | Warning / difficulté |

```markdown
![bg right:40%](../img/ghost_questions.png)
```

---

## Badge SEQ dans le header

Le `<span class="badge">SEQ-01</span>` dans le header est stylisé en pilule bleue automatiquement par le thème.
