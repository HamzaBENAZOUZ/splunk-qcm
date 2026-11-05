# Mise à jour : thème Splunk

Nouveau thème inspiré de l'univers visuel de Splunk, sur le site et dans l'application :

- fond noir profond (thème sombre) ou blanc cassé (thème clair) ;
- dégradé **magenta → orange** sur le titre, les boutons principaux, les onglets, les statistiques, les barres de progression et la bordure de la barre du haut ;
- fond animé « flux de données » : vagues en dégradé et chevrons `>` qui défilent (remplace la pluie « matrix ») ; l'animation s'arrête si le système demande moins de mouvement ;
- nouvelle icône : chevron en dégradé sur fond noir ;
- les bonnes réponses restent en vert et les mauvaises en rouge, pour rester lisibles.

Le logo et la marque Splunk ne sont pas utilisés : c'est un thème « dans l'esprit », pas une copie.

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `css/style.css` | couleurs et surcharges du thème |
| `js/matrix.js` | nouveau fond animé |
| `assets/favicon.svg` | nouvelle icône |
| `index.html` | icône de la barre du haut, couleur du navigateur mobile |

## Installer

1. **Site** : déposez dans le dépôt `splunk-qcm` les 4 fichiers ci-dessus, chacun dans son dossier (`css/`, `js/`, `assets/`, racine). Ils sont dans `splunk-maj-theme.zip`, avec la bonne arborescence.
2. **Téléphone** : installez `splunk-training-v1.3.apk` par-dessus l'ancienne version.
