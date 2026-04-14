# Pilot Animateur

**Outil de pilotage tout-en-un pour les animateurs et animatrices en EHPAD.**

Application de bureau (Windows) conçue pour centraliser la gestion du quotidien
en résidence : activités, résidents, budget, photos, rendez-vous, projets,
comptes rendus — avec génération automatique du journal mensuel **Famileo**.

---

## ✨ Fonctionnalités principales

### Pilotage
- **Tableau de bord** — vue d'ensemble : indicateurs clés, tâches en retard, activités à venir.
- **Budget** — suivi des dépenses par catégorie, graphiques, export.
- **Projets** — gestion d'initiatives avec sous-tâches (titre, échéance modifiable, progression, statut).
- **KPIs & Benchmarking** — indicateurs de performance et comparaison.

### Vie quotidienne
- **Activités** — planification, catégorisation, historique des séances.
- **Calendrier** — vue mensuelle / hebdomadaire consolidée.
- **Rendez-vous** — suivi des visites (famille, médicales, externes).
- **Résidents** — fiches individuelles, préférences, dates clés.
- **Photos** — albums photos par événement / résident.
- **Inventaire** — matériel d'animation, consommables.

### Communication & reporting
- **Famileo** — génération automatique du journal mensuel PDF destiné aux familles.
- **Journal** — notes libres datées.
- **Notes** — prise de notes rapide avec éditeur riche.
- **Compliance** — suivi des obligations réglementaires.
- **Veille** — veille professionnelle et idées d'animation.

### Administration
- **Personnel, Fournisseurs, Tutelles** — répertoires et coordonnées.
- **Import** — reprise de données depuis fichiers CSV / Excel.
- **Paramètres** — configuration de l'établissement, synchronisation cloud, vérification de mises à jour.

---

## 🚀 Installation (utilisateur final)

1. Aller sur la page des [**releases GitHub**](https://github.com/Marcogalazzom/animator-pilot/releases/latest).
2. Télécharger `pilot-animateur_X.Y.Z_x64-setup.exe`.
3. Double-cliquer sur le fichier téléchargé.
4. Si Windows SmartScreen affiche « Windows a protégé votre PC » → cliquer sur
   **Informations complémentaires** → **Exécuter quand même** (c'est normal,
   l'installeur n'est pas signé Authenticode).
5. L'installation se fait pour l'utilisateur courant — **aucun droit administrateur requis**. Des raccourcis sont créés sur le Bureau et dans le menu Démarrer.

### Mises à jour automatiques

Au lancement, l'application vérifie automatiquement si une nouvelle version
est disponible. Si oui, un bandeau violet apparaît en haut :
**« Nouvelle version vX.Y.Z disponible — Mettre à jour maintenant »**.
Un clic suffit : téléchargement, vérification de signature, installation et
redémarrage se font tout seuls.

Vérification manuelle possible depuis **Paramètres → À propos → Vérifier les mises à jour**.

---

## 🛠️ Stack technique

| Couche | Technologie |
|---|---|
| **Desktop shell** | [Tauri 2](https://tauri.app/) (Rust) |
| **Frontend** | React 19 + TypeScript + Vite |
| **Style** | Tailwind CSS 4 |
| **Base de données locale** | SQLite (via `tauri-plugin-sql`) |
| **Synchronisation cloud** | Firebase (authentification + Firestore) |
| **Éditeur riche** | Tiptap |
| **Graphiques** | Recharts |
| **Export** | jsPDF, html2canvas, xlsx, papaparse |
| **Installeur** | NSIS (Windows) avec auto-updater signé (minisign) |

---

## 💻 Développement

### Prérequis

- **Node.js** ≥ 20
- **Rust** (stable) — [rustup.rs](https://rustup.rs/)
- **Outils Windows** : Visual Studio Build Tools avec la charge de travail « Développement Desktop en C++ »

### Lancer en mode développement

```bash
# Installer les dépendances
npm install

# Démarrer l'app avec hot-reload
npm run tauri dev
```

### Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Frontend seul (Vite) — sans la coque Tauri |
| `npm run tauri dev` | App complète avec hot-reload |
| `npm run build` | Build frontend (TypeScript + Vite) |
| `npm run tauri build` | Build de l'installeur Windows |
| `npm test` | Lance la suite de tests Vitest |
| `npm run test:watch` | Tests en mode watch |
| `npm run release -- X.Y.Z` | Bump de version + commit + tag (voir `docs/RELEASING.md`) |

---

## 📦 Publier une nouvelle version

Guide complet et détaillé dans **[`docs/RELEASING.md`](docs/RELEASING.md)**.

Version courte :

```bash
# 1) Bump + commit + tag local
npm run release -- 0.5.0

# 2) Publier (pousse le tag → GitHub Actions prend le relais)
git push && git push --tags
```

GitHub Actions construit l'installeur NSIS, le signe avec minisign, génère
`latest.json` et publie le tout comme release GitHub (~5–8 minutes).

Les installations existantes détecteront la nouvelle version au prochain
lancement et proposeront la mise à jour.

---

## 📁 Structure du projet

```
.
├── src/                    # Code frontend (React)
│   ├── pages/              # Pages principales (une par module métier)
│   ├── components/         # Composants partagés (Sidebar, Header, etc.)
│   ├── db/                 # Couche SQLite : types + services par domaine
│   ├── services/           # Logique métier transverse (sync, export…)
│   ├── utils/              # Utilitaires (updater, formateurs…)
│   └── stores/             # Stores Zustand
├── src-tauri/              # Code Rust (Tauri)
│   ├── src/                # Commandes Rust, gestion fenêtre
│   ├── migrations/         # Schéma SQLite (SQL)
│   ├── icons/              # Icônes de l'app
│   └── tauri.conf.json     # Configuration Tauri
├── scripts/                # Scripts d'automatisation (release, etc.)
├── docs/                   # Documentation (RELEASING, specs…)
└── .github/workflows/      # CI/CD (build + release automatisée)
```

---

## 💾 Données

- **Stockage local** : base SQLite dans `%APPDATA%\com.marco.pilot-animateur\`.
  Toutes les données fonctionnent **hors ligne**.
- **Synchronisation cloud** (optionnelle) : via Firebase Firestore, activable
  dans Paramètres. Permet de retrouver ses données sur un autre poste.

Les migrations SQL se trouvent dans `src-tauri/migrations/` et sont appliquées
automatiquement au démarrage.

---

## 🐛 Dépannage

| Problème | Solution |
|---|---|
| L'installeur est bloqué par SmartScreen | Cliquer « Informations complémentaires » → « Exécuter quand même » |
| Le bandeau de mise à jour n'apparaît pas | Forcer un check via **Paramètres → À propos → Vérifier les mises à jour** |
| Erreur de signature à la MàJ | La clé publique dans `tauri.conf.json` ne correspond plus à la privée — voir `docs/RELEASING.md` §5 |
| CI échoue au build | Vérifier les secrets `TAURI_SIGNING_PRIVATE_KEY` et `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` |

Plus de cas dans [`docs/RELEASING.md`](docs/RELEASING.md) §5.

---

## 📄 Licence

Projet privé. Tous droits réservés © Marcogalazzom.

---

## 🙋 Contact

Pour toute question, suggestion ou bug : ouvrir une issue sur
[GitHub](https://github.com/Marcogalazzom/animator-pilot/issues).
