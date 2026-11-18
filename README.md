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
- Les tables Supabase sont dans le projet suivi-splunk depuis la v1.5.
- Numérotation des quiz : `1-9` = modules Packt, `11-18` = questions originales SPLK-1001 (thèmes 1-8), `101-110` = SPLK-1002 (thèmes 1-10, stockés en domain 11-20).

## Structure

```
splunk-qcm/
├── index.html, css/, js/, assets/, sw.js   le site (mêmes fichiers que le site CISSP, adaptés)
├── js/config.js           ← vos clés Supabase (à remplir)
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

Depuis la v1.5 (QCM + onglet Suivi dans une seule appli), le site utilise le projet Supabase **suivi-splunk** (`https://jmmwzrwdavufrzwaigrc.supabase.co`), le même que l'ancien site de suivi : un seul compte pour le QCM et le planning. `js/config.js` contient déjà cette adresse et sa clé publishable.

La base et les 341 questions sont déjà en place dans ce projet. Aucun fichier SQL n'est publié dans ce dépôt (`*.sql` est ignoré).

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

## Onglet Books (livres)

L'onglet **Books** affiche les livres de l'utilisateur : lecture chapitre par chapitre en anglais ou en français, écoute à voix haute (paragraphe par paragraphe, vitesse réglable ; dans l'appli Android, via le moteur vocal du téléphone), note de vérification quand le livre contient une erreur, et quiz bilingue de 5 questions à la fin de chaque chapitre. La progression (chapitres lus, meilleur score) est synchronisée.

**Le contenu des livres n'est jamais dans ce dépôt ni dans l'APK** (droit d'auteur) : il est dans la base Supabase, lisible uniquement par son propriétaire.

Préparer un livre (EPUB ou PDF) :

```bash
python3 tools/book_extract.py livre.epub private/books/<id>.json      # découpe en chapitres
# traductions + quiz : private/books/<id>.fr/*.txt (format décrit dans tools/book_build.py)
python3 tools/book_build.py private/books/<id>.json --cover couverture.jpg   # -> private/books/<id>.book.json
```

Puis, dans l'appli : onglet Books, « Ajouter un livre (.book.json) ». En mode local, le site lit `private/books/index.json` et les fichiers `.book.json` du même dossier.

### Importer ses propres cours (PDF ou EPUB)

Bouton « Importer un cours (PDF ou EPUB) » de l'onglet Books (site et appli). Tout se passe sur l'appareil (`js/doc-import.js`) :

- **EPUB** : sommaire du livre (nav EPUB 3 ou toc.ncx), à défaut les titres h1/h2 du texte, à défaut un chapitre par fichier ;
- **PDF** : signets du fichier, à défaut les titres repérés (grande police, « Chapitre 3 »…), à défaut des tranches de 5, 10 ou 20 pages. En-têtes, pieds et numéros de page sont retirés. Un PDF scanné (sans texte) est refusé.

Un écran de vérification montre les chapitres trouvés : titre, auteur, langue de la voix et mode de découpage sont modifiables. Le texte est ensuite enregistré dans les mêmes tables privées (`source` = `upload:pdf:fr`…), sans quiz. Le livre se lit et s'écoute comme les autres, et peut être redécoupé ou supprimé depuis sa page.

Le fichier d'origine reste sur l'appareil (`js/doc-files.js`) : dans l'appli Android, il est recopié dans un dossier privé de l'appli ; sur PC sous Chrome ou Edge, un lien vers le fichier du disque est gardé (un navigateur ne donne jamais le chemin d'un fichier, le lien se rouvre tant que le fichier n'est ni déplacé ni renommé) ; sur les autres navigateurs, une copie est gardée dans le navigateur.

pdf.js (Apache-2.0) et JSZip (MIT) sont dans `vendor/`, chargés seulement au moment d'un import, et embarqués dans l'APK pour marcher hors ligne.

## Télé et voiture

- **Télé (Android TV)** : la même APK s'installe sur une télé Android TV et apparaît sur son écran d'accueil. Sur une télé, l'appli le signale au site (`SplunkTV/1` dans le user-agent) et `js/tv.js` active le mode télécommande : flèches pour passer d'un bouton à l'autre (ou faire défiler un long chapitre), OK pour valider, focus bien visible, texte plus grand. L'import de fichiers est masqué sur la télé. Pour essayer ce mode sur un PC : ajouter `?tv=1` à l'adresse du site.
- **Voiture (Android Auto, appli 2.1)** : sur la page d'un livre, dans l'appli, le bouton « Écouter dans la voiture » confie le texte du livre, découpé en phrases sur le téléphone, à l'appli (pont `AndroidCar`). Android Auto affiche alors la liste des livres, puis leurs chapitres. La voix du téléphone les lit sans réseau et sans que la page soit ouverte. ⏮ / ⏭ changent de chapitre, deux boutons avancent ou reculent d'une phrase, la position est gardée et les chapitres s'enchaînent. Les chapitres écoutés jusqu'au bout sont marqués comme lus à la prochaine ouverture de l'appli. Comme l'APK ne vient pas du Play Store, il faut activer « Sources inconnues » dans les réglages développeur d'Android Auto.
- **Écran éteint / Bluetooth (appli 2.0)** : dans l'appli, l'écoute d'un livre continue aussi écran éteint ou en arrière-plan. La notification et l'écran verrouillé affichent lecture/pause et phrase précédente/suivante, et les boutons du casque ou du volant fonctionnent. La lecture se met en pause pendant un appel et reprend après une annonce GPS. Le réglage « Enchaîner automatiquement le chapitre suivant » passe d'un chapitre à l'autre.

## Modifier ou ajouter des questions

Éditez `private/questions.json` ou `private/practice.json` (champs `q`, `opts`, `ans`, `exp` en anglais ; `q_fr`, `opts_fr`, `exp_fr` en français), puis :

puis importez-les dans Supabase avec l'outil d'import gardé hors du dépôt (jamais publié). L'import est idempotent : il met à jour les questions sans créer de doublons, et votre progression est conservée.
