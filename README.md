# Portail Audits & Travaux — IPKONEKT / Bouygues Telecom

Portail unifié regroupant les outils de saisie d'audit et de travaux terrain.

## Outils disponibles

- **`/4g-5g/`** — Formulaire d'intervention sur antenne 4G/5G (mesures radio, plan d'évacuation, compte rendu structuré)
- **`/starlink/`** — Formulaire d'intervention sur antenne Starlink (emplacement, obstruction, cheminement, EPI)
- **`/pico-quatra/`** — Formulaire d'intervention pour solution PICO BTS et/ou Cel-Fi Quatra (sections cumulables)

Chaque formulaire dispose d'un sélecteur **AUDIT / TRAVAUX** en haut de page :
- En mode **AUDIT**, le rapport Word produit est intitulé *Rapport d'audit*
- En mode **TRAVAUX**, le rapport produit est intitulé *Rapport de travaux*

Le mode est aussi reflété dans le nom du fichier exporté (Word et JSON).

Le formulaire **PICO/Quatra** propose deux sections dépliantes activables indépendamment :
- **Section PICO BTS** : forfait BPU (1 à 4), liste des PICO posés, métré câble, photos
- **Section Cel-Fi Quatra** : forfait BPU (1 à 6), nombre NU/CU, métré câble, photos

Les deux sections peuvent être activées simultanément si l'intervention combine les deux solutions.

## Structure du dépôt

```
.
├── index.html              ← Page d'accueil du portail
├── 4g-5g/                  ← Application 4G/5G
├── starlink/               ← Application Starlink
└── pico-quatra/            ← Application PICO BTS / Cel-Fi Quatra
```

## Mise en ligne (GitHub Pages)

1. Pousser ce dossier sur un dépôt GitHub
2. Aller dans **Settings** → **Pages**
3. Choisir la branche `main` et le dossier racine `/`
4. Le portail est accessible à `https://<utilisateur>.github.io/<repo>/`

## Fonctionnalités principales

- Saisie sur PC, tablette ou mobile (interface responsive et tactile)
- Annotation des photos directement dans le navigateur (flèches, formes, texte, éléments métier)
- Génération automatique d'un rapport Word complet et mis en page
- Export et import au format JSON pour archivage, partage ou reprise du travail

## Développement local

Aucune installation requise. Ouvrir directement `index.html` dans un navigateur, ou servir le dossier avec un petit serveur local :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

