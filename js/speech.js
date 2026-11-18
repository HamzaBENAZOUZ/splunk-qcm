// Adaptateur audio : réécrit un texte pour qu'il s'écoute bien avec la synthèse vocale.
// Le texte affiché ne change pas ; seule la phrase envoyée à la voix est adaptée.
//  - ponctuation et symboles muets (puces, guillemets, crochets, astérisques, dièses…) ou changés en pauses ;
//  - points collés (fréquents dans les PDF importés) : espace ajoutée pour qu'ils restent une fin de phrase ;
//  - chemins (/opt/splunk/etc/apps, $SPLUNK_HOME/etc) lus dossier par dossier, sans « slash » ;
//  - SPL : « | » → « puis », « = » → « égal », comparateurs en toutes lettres ;
//  - liens : « lien vers splunk.com » au lieu de l'adresse complète ;
//  - abréviations (e.g., i.e., vs., cf., &) en toutes lettres.
// Utilisé par le lecteur des livres, les boutons « Écouter » du QCM et les livres envoyés dans Android Auto.

export const SPEECH_V = "a2";      // à changer quand les règles changent : les livres déjà dans la voiture sont proposés à la mise à jour

const W = {
  fr: { link: "lien vers", or: "ou", and: "et", then: "puis", eq: "égal", ne: "différent de", ge: "supérieur ou égal à", le: "inférieur ou égal à",
        gt: "supérieur à", lt: "inférieur à", star: "étoile", plus: "plus", eg: "par exemple", ie: "c'est-à-dire", vs: "contre", cf: "voir",
        nb: "note", sect: "section", code: "Exemple de code", codeN: "Exemple de code de {n} lignes, à lire à l'écran" },
  en: { link: "link to", or: "or", and: "and", then: "then", eq: "equals", ne: "not equal to", ge: "greater than or equal to", le: "less than or equal to",
        gt: "greater than", lt: "less than", star: "star", plus: "plus", eg: "for example", ie: "that is", vs: "versus", cf: "see",
        nb: "note", sect: "section", code: "Code example", codeN: "Code example of {n} lines, see the screen" },
};
const words = lang => W[lang === "fr" ? "fr" : "en"];

/** Un chemin lu dossier par dossier : « $SPLUNK_HOME/etc/apps » → « SPLUNK HOME, etc, apps ». */
function pathWords(p) {
  const parts = p.split(/[\\/]+/).map(x => x.replace(/^[$~%]+|%$/g, "").replace(/_+/g, " ").trim()).filter(Boolean);
  return parts.join(", ");
}

export function forEar(text, lang = "en") {
  const w = words(lang);
  let s = String(text == null ? "" : text);

  // émojis et symboles décoratifs
  s = s.replace(/\p{Extended_Pictographic}\uFE0F?/gu, " ").replace(/[\u200B-\u200D\uFEFF]/g, "");

  // liens : « lien vers domaine »
  s = s.replace(/\b(?:https?:\/\/|www\.)[^\s<>"«»“”]+/gi, u => {
    const host = u.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#:]/)[0].replace(/[.,;:!?)\]]+$/, "");
    return ` ${w.link} ${host} `;
  });

  // abréviations
  s = s.replace(/\b[eE]\.\s?[gG]\.,?/g, w.eg).replace(/\b[iI]\.\s?[eE]\.,?/g, w.ie)
       .replace(/\bp\.\s?ex\.,?/g, "par exemple").replace(/\bvs\.?(?=\s)/gi, w.vs)
       .replace(/\bcf\.\s?/gi, w.cf + " ").replace(/\bN\.\s?B\.\s?:?/g, w.nb + ", ")
       .replace(/§\s*/g, w.sect + " ");

  // pluriels entre parenthèses : chapitre(s) → chapitres
  s = s.replace(/([A-Za-zÀ-ÿ])\((s|es|x|e|nt)\)/g, "$1$2");

  // points de suspension
  s = s.replace(/\[\s*(?:\.{3}|…)\s*\]/g, " ").replace(/\s*(?:\.{2,}|…)\s*/g, ", ");

  // ponctuation collée au mot suivant (texte extrait d'un PDF) : « fin.Début » → « fin. Début »
  s = s.replace(/([a-zà-ÿ0-9)\]»”"'])([.!?;])([A-ZÀ-Ý])/g, "$1$2 $3")
       .replace(/,(?=[A-Za-zÀ-ÿ])/g, ", ");

  // numérotation en tête (1.2.3, 4., IV.) et puces
  s = s.replace(/^[\s•·▪▫◦‣∙●○■□►▶▸✓✔✗✘→\-–—*>#]+(?=\S)/, "")
       .replace(/^\s*(?:\d+(?:\.\d+)+\.?|\d+[.)]|[IVXLC]+\.|[a-z]\))\s+(?=\S)/, "");

  // flèches et comparateurs
  s = s.replace(/\s*(?:->|=>|→|⇒|⟶|⟹)\s*/g, `, ${w.then} `)
       .replace(/\s*(?:>=|≥)\s*/g, ` ${w.ge} `).replace(/\s*(?:<=|≤)\s*/g, ` ${w.le} `)
       .replace(/\s*(?:!=|≠|<>)\s*/g, ` ${w.ne} `)
       .replace(/\s+>\s+/g, ` ${w.gt} `).replace(/\s+<\s+/g, ` ${w.lt} `);

  s = s.replace(/\b[A-Za-z]:\\/g, "");
  // chemins : au moins deux niveaux (/opt/splunk, $SPLUNK_HOME/etc, C:\Program\Splunk) ; les dates (12/03/2024) restent telles quelles
  s = s.replace(/(?:[$~%][\w%]*|[A-Za-z]:|\b[\w.-]+)?(?:[\\/][\w.$%@+-]+){2,}[\\/]?/g, m => {
    if (/^[\d/.-]+$/.test(m)) return m;
    if (!/^[$~%\\/]|^[A-Za-z]:/.test(m) && m.split(/[\\/]/).length < 3) return m;
    return ` ${pathWords(m)} `;
  });
  // et/ou, TCP/UDP
  s = s.replace(/\bet\/ou\b/gi, "et ou").replace(/\band\/or\b/gi, "and or")
       .replace(/([A-Za-zÀ-ÿ])\s?\/\s?(?=[A-Za-zÀ-ÿ])/g, `$1 ${w.or} `)
       .replace(/(?<!\d)\/|\/(?!\d)/g, " ").replace(/\\/g, " ");

  // SPL et opérateurs (« la commande | eval » : le pipe est nommé, pas lu)
  s = s.replace(/\b(the|a|an|le|la|les|un|une|des|du)\s*\|\s*/gi, "$1 ")
       .replace(/\s*\|\|\s*/g, ` ${w.or} `).replace(/\s*&&\s*/g, ` ${w.and} `)
       .replace(/\s*\|\s*/g, `, ${w.then} `)
       .replace(/\s*={1,3}\s*/g, ` ${w.eq} `)
       .replace(/\s*&\s*/g, ` ${w.and} `)
       .replace(/\s\+\s/g, ` ${w.plus} `);
  // joker : access_* , sourcetype=* , « * » seul
  s = s.replace(/([\w.-])\*(?=[\s,.;:)\]"'`]|$)/g, `$1 ${w.star}`).replace(/(^|\s)\*(?=\s|$)/g, `$1${w.star}`)
       .replace(/\*([\w])/g, `${w.star} $1`);

  // options de ligne de commande : --accept-license → accept-license
  s = s.replace(/(^|\s)-{1,2}(?=[A-Za-z])/g, "$1");
  // tirets d'incise
  s = s.replace(/\s+[-–—]+\s+/g, ", ").replace(/[–—]/g, ", ");

  // identifiants : _time, access_combined, my_app
  s = s.replace(/_+/g, " ");

  // parenthèses → pauses ; symboles muets
  s = s.replace(/[()]/g, ", ")
       .replace(/[[\]{}<>`"“”«»„*#^~|\\•·▪◦‣∙●○■□►▶▸✓✔✗✘]/g, " ");

  // répétitions et ponctuation en double
  s = s.replace(/([!?])\1+/g, "$1")
       .replace(/\s+([,.;:!?])/g, "$1")
       .replace(/([,;:])(?:\s*[,;:])+/g, "$1")
       .replace(/,\s*([.!?])/g, "$1")
       .replace(/([.!?])\s*[,;:]+/g, "$1")
       .replace(/^[\s,;:.]+/, "").replace(/[\s,;:]+$/, "")
       .replace(/\s+/g, " ").trim();
  return s;
}

/** Bloc de code : lu s'il est court, sinon simplement annoncé. */
export function codeForEar(code, lang = "en") {
  const w = words(lang);
  const lines = String(code || "").split(/\n/).map(x => x.trim()).filter(Boolean);
  if (!lines.length) return "";
  const flat = lines.join(" ");
  if (lines.length > 4 || flat.length > 240) return w.codeN.replace("{n}", lines.length) + ".";
  const txt = forEar(lines.map((l, i) => (i && !/^\|/.test(l) ? ". " : " ") + l).join(""), lang);
  return txt ? `${w.code}${lang === "fr" ? " :" : ":"} ${txt}${/[.!?]$/.test(txt) ? "" : "."}` : "";
}
