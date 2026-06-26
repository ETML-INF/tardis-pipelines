---
marp: true
theme: etml
title: "LAN, WAN, composants réseau et modèle OSI"
description: "Composants d'un réseau local, distinction LAN/WAN et 7 couches du modèle OSI — bases pour recenser les besoins réseau d'une PME."
paginate: true
header: "<div class=\"left\"><img src=\"../img/etml_logo_complet.svg\" alt=\"ETML\"></div><div class=\"center\">Section INF</div><div class=\"right\"><span class=\"deck\">Notions réseau</span><span class=\"badge\">SEQ-01</span></div>"
footer: "<div class=\"left\">Module 117 — Réseau PME</div><div class=\"right\">© 2025</div>"
type: slides
id: F-117-notions-reseau
seq: SEQ-01
order: 3
align_ict: ["ICT-117-OO1"]
---

<!-- _class: title -->

# LAN, WAN, composants réseau et modèle OSI

**Module 117 · ICT-117-OO1 · SEQ-01**

---

![bg opacity:0.12](../img/ghost_objectives.png)

## Objectifs d'apprentissage

* **C1** Citer les composants d'un réseau local
  *(switch, routeur, point d'accès, câblage)*
* **C2** Distinguer un LAN d'un WAN
* **C1** Citer les 7 couches du modèle OSI dans l'ordre
* **C2** Relier un équipement réseau à sa couche OSI

---

<!-- _class: transition -->

# 1 — LAN vs WAN

---

<!-- _class: concept -->

# LAN

---

**LAN** — *Local Area Network*

Un réseau **local** relie des équipements d'un même bâtiment ou d'un même site.

- Débit élevé — typiquement **1 Gbps** en filaire
- Câblage et équipements gérés par l'entreprise
- **À l'atelier :** les 4 zones de l'Atelier Lemania reliées par vos switches

> C'est le réseau que vous allez **construire** pendant ce module.

---

<!-- _class: concept -->

# WAN

---

**WAN** — *Wide Area Network*

Un réseau **étendu** relie des sites géographiquement distants.

- Passe par l'infrastructure d'un **opérateur** (Swisscom, Sunrise…)
- Débit et délai plus variables qu'en LAN
- **À l'atelier :** la connexion Internet via le ZyWALL Z200

> Le WAN commence là où l'atelier sort vers l'extérieur — au **routeur**.

---

<!-- _class: question -->

![bg opacity:0.12](../img/ghost_questions.png)

## Où s'arrête le LAN et où commence le WAN dans l'atelier ?

---

<!-- _class: transition -->

# 2 — Composants réseau

---

## Les 5 composants d'un réseau local

| Composant | Rôle principal |
|---|---|
| **Switch** | Relie les équipements du LAN, achemine les **trames** |
| **Routeur** | Relie le LAN à un autre réseau, achemine les **paquets** |
| **Point d'accès Wi-Fi** | Diffuse le réseau en **sans-fil** |
| **Carte réseau (NIC)** | Connecte un poste au réseau (filaire ou Wi-Fi) |
| **Câblage / prises RJ45** | Support physique de la liaison filaire |

---

## Switch vs Routeur

**Switch**
- Travaille avec des adresses **MAC** (adresses physiques gravées dans la carte réseau)
- Fait circuler le trafic **à l'intérieur** du LAN

**Routeur / ZyWALL Z200**
- Travaille avec des adresses **IP** (adresses logiques configurables)
- Fait passer le trafic d'un réseau **vers un autre**
- Assure aussi le rôle de **pare-feu** à l'atelier

> Un switch ne « voit » pas Internet. Un routeur ouvre la porte vers l'extérieur.

---

<!-- _class: check -->

## Je sais identifier…

- La frontière LAN / WAN dans un schéma réseau
- Le rôle d'un switch, d'un routeur, d'un point d'accès
- Quel équipement gère les trames et lequel gère les paquets

---

<!-- _class: transition -->

# 3 — Modèle OSI

---

<!-- _class: concept -->

# OSI

---

## Les 7 couches du modèle OSI

Mnémonique (C1 → C7) : **P**artout **L**e **R**oi **T**rouve **S**a **P**lace **A**ssise

| # | Nom | Rôle | Exemple |
|---|---|---|---|
| **1** | Physique | Transmettre des **bits** sur un support | Câble RJ45, signal |
| **2** | Liaison | Acheminer des **trames** dans le LAN | Switch |
| **3** | Réseau | Acheminer des **paquets** entre réseaux | Routeur |
| **4** | Transport | Découper / réassembler, fiabiliser | TCP, UDP |
| **5** | Session | Ouvrir et fermer une session | — |
| **6** | Présentation | Mise en forme, chiffrement | TLS |
| **7** | Application | Service utilisé directement | HTTP, e-mail |

---

## Équipements → couches OSI

| Équipement | Couche | Pourquoi ? |
|---|---|---|
| Câble RJ45 | **C1** — Physique | Transporte le signal électrique |
| Switch | **C2** — Liaison | Lit et achemine les trames par adresse MAC |
| Routeur / ZyWALL | **C3** — Réseau | Route les paquets par adresse IP |
| Navigateur web | **C7** — Application | Fournit directement le service à l'utilisateur |

> ↓ Plus le numéro est bas → plus on est proche du **câble**
> ↑ Plus le numéro est haut → plus on est proche de l'**utilisateur**

---

<!-- _class: question -->

![bg opacity:0.12](../img/ghost_questions.png)

## Sur quelle couche intervient le ZyWALL Z200 lorsqu'il filtre le trafic Internet ?

---

<!-- _class: summary -->

## En résumé — SEQ-01 · Notions réseau

- **LAN** : réseau local, haut débit, maîtrisé par l'entreprise
- **WAN** : réseau étendu, géré par l'opérateur — démarre au routeur
- **5 composants** : switch · routeur · AP · NIC · câblage
- **OSI 7 couches** : *Partout Le Roi Trouve Sa Place Assise*

| Équipement | Couche OSI |
|---|---|
| Câble | C1 — Physique |
| Switch | C2 — Liaison |
| Routeur | C3 — Réseau |
