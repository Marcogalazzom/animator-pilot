# Distribution & mise à jour

Guide complet pour installer Pilot Animateur sur les postes et publier de
nouvelles versions.

---

## 1. Première mise en place (à faire UNE SEULE FOIS)

### 1.1 Générer les clés de signature

```bash
# Depuis la racine du projet
npx tauri signer generate -w ./.tauri/pilot-animateur.key
```

La commande demande un mot de passe — **choisis-en un robuste et conserve-le**
dans un gestionnaire de mots de passe (ex: Bitwarden, 1Password). Tu en auras
besoin à chaque build local ET dans GitHub Actions.

Résultat :
- `./.tauri/pilot-animateur.key` → **clé privée** (chiffrée par le mot de passe)
- `./.tauri/pilot-animateur.key.pub` → **clé publique**

Le dossier `.tauri/` est déjà dans `.gitignore` — la clé privée ne sera
jamais commitée.

### 1.2 Placer la clé publique dans la config

Ouvre `src-tauri/tauri.conf.json`, trouve :

```json
"pubkey": "REPLACE_WITH_YOUR_TAURI_UPDATER_PUBKEY"
```

Remplace par le contenu de `./.tauri/pilot-animateur.key.pub` (une ligne
base64 du style `dW50cnVzdGVkIGNvbW1lbnQ6...`).

Commit ce changement :

```bash
git add src-tauri/tauri.conf.json
git commit -m "chore: embed updater public key"
git push
```

### 1.3 Ajouter les secrets GitHub

Va sur `https://github.com/Marcogalazzom/animator-pilot/settings/secrets/actions`
et clique **New repository secret** pour créer deux secrets :

| Nom | Valeur |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | Contenu complet du fichier `./.tauri/pilot-animateur.key` (tout coller, lignes `untrusted comment:` incluses) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Le mot de passe choisi à l'étape 1.1 |

---

## 2. Publier une nouvelle version

```bash
# 1) Bump version + commit + tag
npm run release -- 0.2.0

# 2) Push (le script ne le fait pas pour laisser un dernier contrôle)
git push && git push --tags
```

GitHub Actions prend le relais :
1. Build l'installeur Windows NSIS
2. Signe l'installeur + génère `latest.json`
3. Publie une release GitHub avec les 3 artefacts

Durée typique : 5–8 minutes. Tu peux suivre le build ici :
`https://github.com/Marcogalazzom/animator-pilot/actions`

---

## 3. Installer l'app sur un nouveau poste

1. Ouvrir `https://github.com/Marcogalazzom/animator-pilot/releases/latest`
2. Télécharger `pilot-animateur_X.Y.Z_x64-setup.exe`
3. Double-cliquer le fichier
4. Windows SmartScreen peut afficher « Windows a protégé votre PC » →
   cliquer **Informations complémentaires** → **Exécuter quand même**
   (c'est normal, l'installeur n'est pas signé Authenticode)
5. L'installeur installe l'app pour l'utilisateur courant (pas besoin
   d'admin). Raccourcis créés sur le Bureau et dans le Menu Démarrer.

## 4. Mise à jour automatique

Une fois installée, l'app vérifie seule au lancement (au bout de ~3s) si
une version plus récente est publiée sur GitHub Releases.

Si oui → bandeau violet en haut : **« Nouvelle version vX.Y.Z disponible —
Mettre à jour maintenant »**. Cliquer → téléchargement, vérification de
signature, installation et redémarrage auto.

L'utilisateur peut aussi déclencher un check manuel depuis
**Paramètres > À propos > Vérifier les mises à jour**.

---

## 5. Dépannage

### Le bandeau n'apparaît pas alors qu'une nouvelle version est publiée

- Vérifier la connexion internet
- Ouvrir Paramètres → À propos → Vérifier les mises à jour (check manuel)
- Vérifier que `latest.json` est bien attaché à la dernière release
  GitHub (devrait l'être automatiquement via `includeUpdaterJson: true`)

### Erreur de signature au moment de l'update

- La clé publique dans `tauri.conf.json` ne correspond pas à la clé
  privée utilisée par le CI. Régénère les clés (étape 1.1) et mets à
  jour les deux endroits : `tauri.conf.json` + secrets GitHub.

### Le CI échoue au build

- Vérifier que les deux secrets existent et sont corrects
- Si `TAURI_SIGNING_PRIVATE_KEY` a été tronqué au collage : la clé doit
  inclure les en-têtes `untrusted comment:` et toutes les lignes base64.

---

## 6. Rollback

Si une version casse tout :

1. Supprimer la release fautive sur GitHub (Releases → Delete)
2. Supprimer le tag distant : `git push --delete origin vX.Y.Z`
3. La release précédente redevient automatiquement `latest` (GitHub
   bascule sur la plus récente publiée). Les utilisateurs seront
   redirigés vers elle.

Pour une re-publication propre, bump vers une version supérieure
(ex: 0.2.1) et refaire une release.
