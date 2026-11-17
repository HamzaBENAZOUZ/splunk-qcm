# Splunk Training Terminal

Site de QCM pour préparer les certifications Splunk, construit sur la même base que le site CISSP. Il reprend toutes ses fonctionnalités : quiz par module et par thème, examen blanc chronométré, révision des erreurs, questions marquées 🔖, historique, quiz sauvegardés et repris sur n'importe quel appareil, thème clair/sombre, français/anglais, lecture à voix haute (« Lire tout » / « Lire la réponse »), mode hors ligne et mode autonome ✈️.

Deux onglets :

| Onglet | Contenu |
|---|---|
| **SPLK-1001** (Core Certified User) | **221 questions** : les 99 questions des quiz du cours Packt (9 modules), avec corrigé, explication et traduction FR rédigés pour ce site, et 122 questions originales réparties sur les 8 thèmes officiels de l'examen. |
| **SPLK-1002** (Core Certified Power User) | **120 questions originales** : 12 par thème, sur les 10 thèmes officiels de l'examen (chart/timechart, eval/where, transaction/sous-recherches, extractions, alias et champs calculés, tags et event types, macros, workflow actions, data models, CIM). |

L'examen blanc tire des questions au hasard dans l'onglet actif, avec 1 minute par question. La taille proposée par défaut est celle du vrai examen : 60 questions pour SPLK-1001, 65 pour SPLK-1002.

**Sources et droits.** Les questions des modules 1 à 9 viennent du dépôt [PacktPublishing/Splunk-Core-Certified-User-SPLK-1001---Complete-Training-Prep-Guide](https://github.com/PacktPublishing/Splunk-Core-Certified-User-SPLK-1001---Complete-Training-Prep-Guide), sous licence MIT (© 2025 Packt). Ce dépôt ne fournit aucun corrigé : les réponses et les explications ont été rédigées pour ce site. Toutes les autres questions sont originales. Aucune question ne vient d'un site de « dumps ».

## Différences avec le site CISSP

- Tous les réglages du navigateur sont préfixés par `splunk-` au lieu de `cissp-`. Les deux sites peuvent donc tourner sur le même `github.io` sans mélanger progression, sauvegardes ni copie hors ligne.
- Les tables Supabase sont préfixées `splunk_` (projet suivi-splunk depuis la v1.5). Le schéma est le même, sauf que `splunk_chapters.domain` accepte 1 à 20 (thèmes 1-8 pour SPLK-1001, 11-20 pour SPLK-1002).
- Numérotation des quiz : `1-9` = modules Packt, `11-18` = questions originales SPLK-1001 (thèmes 1-8), `101-110` = SPLK-1002 (thèmes 1-10, stockés en domain 11-20).

## Structure

```
splunk-qcm/
├── index.html, css/, js/, assets/, sw.js   le site (mêmes fichiers que le site CISSP, adaptés)
├── js/config.js           ← vos clés Supabase (à remplir)
├── tools/json_to_sql.py   génère les fichiers d'import SQL (dans private/, jamais publiés)
└── private/               non publié (ignoré par .gitignore)
    ├── questions.json         SPLK-1001 (221 questions)
    └── practice.json          SPLK-1002 (120 questions)
```

## 1. Tester en local

Si `js/config.js` est vide, le site lit `private/*.json` et garde la progression dans le navigateur :

```bash
cd splunk-qcm
python3 -m http.server 8000      # puis ouvrir http://localhost:8000
```

## 2. Base Supabase : le projet « suivi-splunk »

Depuis la v1.5 (QCM + onglet Suivi dans une seule appli), le site utilise le projet Supabase **suivi-splunk** (`https://jmmwzrwdavufrzwaigrc.supabase.co`), le même que l'ancien site de suivi : un seul compte pour le QCM et le planning. `js/config.js` contient déjà cette adresse et sa clé publishable. Les tables sont préfixées `splunk_` (`splunk_chapters`, `splunk_questions`, `splunk_attempts`, `splunk_answers`, `splunk_saved_quizzes`, `splunk_flags`, `splunk_suivi`).

Le schéma (tables + RLS) et les 341 questions sont déjà en place dans ce projet. Les fichiers SQL ne sont **jamais** publiés dans ce dépôt (`*.sql` est ignoré) : ils restent hors de GitHub.

1. **Authentication → URL Configuration** : **ajoutez** `https://hamzabenazouz.github.io/splunk-qcm/` dans *Redirect URLs*.

Les anciennes tables `splunk_*` du projet CISSP ne servent plus ; elles peuvent rester ou être supprimées.

Ne mettez **jamais** la clé secrète (`sb_secret_…`) dans `js/config.js`.

## 3. Publier sur GitHub Pages

Même procédure que pour le site CISSP (voir son README, section 3), avec un **nouveau dépôt public** `splunk-qcm` :

```bash
cd splunk-qcm
git init
git add .
git status                       # private/ ne doit PAS apparaître
git commit -m "Site QCM Splunk"
git branch -M main
git remote add origin https://github.com/HamzaBENAZOUZ/splunk-qcm.git
git push -u origin main
```

Vérifiez avant le push que `js/config.js` contient bien l'adresse `dywhikydfvpnxytawoty` et la clé `sb_publishable_…`.

Puis **Settings → Pages → Deploy from a branch → main / (root)**. Le site sera sur `https://hamzabenazouz.github.io/splunk-qcm/`. L'application Android attend cette adresse : si vous choisissez un autre nom de dépôt, dites-le pour que l'APK soit reconstruite.

Avec l'upload web de GitHub (*Add file → Upload files*), déposez le **contenu** du dossier (index.html, css/, js/…), sans `private/`, et vérifiez qu'aucun dossier temporaire (`7zE…`) n'est créé.

## Modifier ou ajouter des questions

Éditez `private/questions.json` ou `private/practice.json` (champs `q`, `opts`, `ans`, `exp` en anglais ; `q_fr`, `opts_fr`, `exp_fr` en français), puis :

```bash
python3 tools/json_to_sql.py
```

et exécutez le fichier d'import généré dans `private/` (jamais publié) dans le SQL Editor de Supabase. L'import est idempotent : il met à jour les questions sans créer de doublons, et votre progression est conservée.
