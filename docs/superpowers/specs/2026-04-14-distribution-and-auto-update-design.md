# Distribution Windows & auto-update

## Context

L'app Pilot Animateur tourne aujourd'hui en `tauri dev` uniquement sur le PC
du développeur. Pour qu'elle soit utilisable en résidence (un ou plusieurs
postes), on veut :

1. Un **installeur Windows propre** (NSIS, per-user, sans droits admin)
   facile à distribuer.
2. Un **mécanisme d'auto-update** qui dispense l'animatrice (non-technique)
   de devoir re-télécharger manuellement à chaque nouvelle version.
3. Un **workflow de publication CI** : l'auteur du projet tag `vX.Y.Z` sur
   git, tout le reste (build, signature, release GitHub, manifest) est
   automatique.

Résultat attendu : au premier install, l'utilisateur récupère l'installeur
depuis la page GitHub Releases. Ensuite, à chaque lancement, l'app vérifie
en arrière-plan si une version plus récente existe ; si oui, un bandeau
propose « Mettre à jour maintenant » → téléchargement, vérification de
signature, installation et redémarrage automatique.

## Portée v1

- Cible : **Windows x64 uniquement** (la résidence tourne sur Windows).
  MacOS / Linux seront ajoutables en dupliquant le job CI plus tard.
- Distribution : **GitHub Releases public** du repo `Marcogalazzom/animator-pilot`.
- Pas de certificat Windows Authenticode (trop cher pour un outil interne).
  SmartScreen affichera « Éditeur inconnu » au premier run — acceptable.

## Architecture

### Signature & clés

- Paire ed25519 générée via `npx tauri signer generate -- -w <path>` (minisign).
- **Clé publique** → commitée dans `src-tauri/tauri.conf.json`
  (`plugins.updater.pubkey`).
- **Clé privée** chiffrée par mot de passe → stockée :
  - localement (hors repo, ex. `~/.tauri/pilot-animateur.key`)
  - dans GitHub Actions : deux secrets repo
    - `TAURI_SIGNING_PRIVATE_KEY` (contenu du fichier de clé)
    - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- Chaque artefact publié (installeur `.exe` + manifest `latest.json`) est
  signé. L'app refuse toute maj dont la signature ne matche pas la pubkey
  embarquée.

### Installeur NSIS

Config `src-tauri/tauri.conf.json > bundle` :

- `targets: ["nsis"]` (ou inclure dans "all" mais NSIS suffit)
- `windows.nsis.installMode: "perUser"` — pas de droits admin requis
- `windows.nsis.displayLanguageSelector: false`
- `publisher: "Marcogalazzom"`
- `longDescription`, `shortDescription`, `category: "Productivity"`
- Raccourcis Bureau + Menu Démarrer (défaut NSIS)
- Icônes déjà présentes dans `src-tauri/icons/`

Output : `src-tauri/target/release/bundle/nsis/pilot-animateur_X.Y.Z_x64-setup.exe`

### Updater plugin

**Côté Rust** (`src-tauri/`) :

- Ajouter `tauri-plugin-updater` dans `Cargo.toml`
- Ajouter `tauri-plugin-process` (nécessaire pour `relaunch()`)
- Enregistrer les deux plugins dans `lib.rs`
- Config dans `tauri.conf.json > plugins.updater` :
  - `endpoints`: `["https://github.com/Marcogalazzom/animator-pilot/releases/latest/download/latest.json"]`
  - `pubkey`: contenu de la clé publique

**Côté capabilities** (`src-tauri/capabilities/default.json`) :

- Ajouter `updater:default`, `process:default`

**Côté JS** :

- Installer `@tauri-apps/plugin-updater` + `@tauri-apps/plugin-process`
- Nouveau module `src/utils/updater.ts` avec :
  - `checkForAppUpdate()` → `Update | null`
  - `downloadAndInstall(update, onProgress?)` → applique la maj
  - `relaunchApp()` → redémarre

### UX in-app

**Bandeau de notification** (`src/components/UpdateBanner.tsx`) :

- Monté en haut de `Layout`, au-dessus de la sidebar/main
- Visible uniquement si un update est disponible
- Contenu : « Nouvelle version **vX.Y.Z** disponible · [Mettre à jour] · [✕] »
- Pendant le téléchargement : barre de progression + texte « Téléchargement… »
- Après installation : toast « Redémarrage… » puis `relaunch()`
- Le bouton `✕` stocke un flag dans `localStorage` (`update-dismissed-<version>`)
  pour ne plus afficher cette version précise jusqu'à une version suivante

**Check automatique** :

- Hook `useUpdateCheck()` monté dans `App.tsx`
- Délai de 3s après le mount (ne pas ralentir le démarrage)
- Résultat stocké dans un store Zustand (`src/stores/updateStore.ts`) ou
  un contexte simple ; le bandeau lit ce store

**Page Settings** :

- Nouvelle section **« À propos »** dans `src/pages/Settings.tsx`
- Affiche : version courante (depuis `getVersion()` du plugin `@tauri-apps/api/app`)
- Bouton **« Vérifier les mises à jour »** → lance un check manuel ;
  affiche le résultat en-dessous (soit "À jour", soit "Nouvelle version vX.Y.Z
  disponible" avec bouton direct)

### Workflow CI

Nouveau fichier `.github/workflows/release.yml` :

- **Trigger** : `push` sur tag `v*.*.*`
- **Runner** : `windows-latest`
- **Steps** :
  1. `checkout`
  2. Setup Node + Rust (caches)
  3. `npm ci`
  4. `tauri-apps/tauri-action@v0` avec :
     - `tagName: ${{ github.ref_name }}`
     - `releaseName: "Pilot Animateur vX.Y.Z"`
     - `releaseBody`: template simple
     - `includeUpdaterJson: true`
     - Secrets `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- **Résultat** : release GitHub publiée avec :
  - `pilot-animateur_X.Y.Z_x64-setup.exe`
  - `pilot-animateur_X.Y.Z_x64-setup.exe.sig`
  - `latest.json` (manifest avec version, notes, URL, signature)

### Processus de publication (côté dev)

```bash
# 1) Bump version (3 endroits : package.json, tauri.conf.json, Cargo.toml)
# 2) Commit
git commit -am "chore: bump v0.2.0"
# 3) Tag & push
git tag v0.2.0
git push origin main v0.2.0
# → CI prend le relais (~5 min)
```

Ajout d'un petit script `scripts/release.mjs` qui automatise les trois bumps
à partir d'un numéro passé en argument. Invocation : `npm run release -- 0.2.0`.

### Documentation

Nouveau fichier `docs/RELEASING.md` avec :

- Setup one-shot (génération des clés, ajout secrets GitHub)
- Processus pour publier (bump → tag → push)
- Comment l'utilisateur final installe la 1ʳᵉ version
- Comment vérifier qu'une maj a bien été déployée

### .gitignore

Ajouter `*.key`, `*.pem`, `.tauri/` au `.gitignore` — garde-fou contre
commit accidentel d'une clé privée.

## Fichiers à créer/modifier

**Créer :**

- `.github/workflows/release.yml`
- `src/utils/updater.ts`
- `src/components/UpdateBanner.tsx`
- `src/stores/updateStore.ts` (ou simple state global React)
- `scripts/release.mjs`
- `docs/RELEASING.md`

**Modifier :**

- `src-tauri/Cargo.toml` — ajouter `tauri-plugin-updater`, `tauri-plugin-process`
- `src-tauri/src/lib.rs` — enregistrer les plugins
- `src-tauri/capabilities/default.json` — `updater:default`, `process:default`
- `src-tauri/tauri.conf.json` — bundle config NSIS + plugins.updater
- `package.json` — deps `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process` + script `release`
- `src/components/Layout.tsx` — monter `<UpdateBanner />`
- `src/pages/Settings.tsx` — section "À propos" + check manuel
- `.gitignore` — `*.key`, `.tauri/`

## Vérification end-to-end

1. **Setup clés** : `npx tauri signer generate` génère la paire. Ajouter pubkey
   dans `tauri.conf.json`. Ajouter secrets GitHub.
2. **Premier build** : push tag `v0.2.0` → workflow CI passe au vert →
   release GitHub contient `...setup.exe` + `latest.json`.
3. **Installation** : sur un autre PC Windows, télécharger l'installeur depuis
   la page Releases → lancer → app installée dans `%LOCALAPPDATA%\Programs\`.
4. **Check auto** : lancer l'app → au bout de ~3s si aucune nouvelle version,
   rien ; sinon bandeau visible.
5. **Faux update** : bump `tauri.conf.json` à `v0.3.0`, push tag `v0.3.0` →
   nouvelle release publiée. Sur le PC où v0.2.0 tourne, relancer l'app :
   bandeau "v0.3.0 disponible". Cliquer "Mettre à jour" → download, verify,
   install, redémarrage → version = v0.3.0.
6. **Manuel** : dans `/settings`, bouton "Vérifier les mises à jour" fonctionne.
7. **Sécurité** : modifier manuellement le `latest.json` dans une branche test
   (fausse signature) → l'app refuse la maj ; message d'erreur propre affiché.
