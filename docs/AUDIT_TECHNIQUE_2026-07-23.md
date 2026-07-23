# Audit technique d’EvalVoice

Date : 23 juillet 2026

Base auditée : branche `main`, commit `c044a84`

Périmètre : sécurité, extraction PDF, détection des questions, expérience
vocale, accessibilité, état local, export PDF, fonction Netlify, qualité et
maintenabilité.

## Synthèse

La version auditée remplissait son objectif principal pour des questions
numérotées, mais elle reposait sur une extraction PDF qui supprimait les
retours à la ligne et les informations de police. Une question unique non
numérotée était donc remplacée par le document entier. La logique rejetait
également explicitement une seule question numérotée.

Les risques les plus importants étaient une version vulnérable de PDF.js
chargée depuis un CDN, un proxy Google Docs permissif, l’absence d’en-têtes de
sécurité et plusieurs modules historiques non initialisés ou incohérents. La
dictée, limitée au premier résultat final, était mal adaptée aux tâches
complexes longues.

La refonte corrige ces points sans ajouter de stockage serveur des réponses.

## Constats et traitement

| Priorité | Constat sur la version auditée | Traitement dans la refonte |
|---|---|---|
| Critique | PDF.js 2.10.377 était concerné par CVE-2024-4367. | PDF.js 6.1.200 verrouillé, auto-hébergé et appelé avec `isEvalSupported: false`. |
| Haute | Le texte PDF était aplati avec `join(' ')`, ce qui supprimait lignes et indices de gras. | Reconstruction visuelle des lignes par coordonnées, conservation des pages et résolution des objets de police. |
| Haute | Une seule question numérotée était rejetée par la condition `length > 1`. | Stratégie dédiée `single-numbered` avec score de confiance. |
| Haute | Une tâche complexe non numérotée devenait le document entier. | Détection d’un verbe de Bloom en début de ligne ; le gras augmente fortement la confiance. |
| Haute | Des entrées de barème comme `1) 2 points` pouvaient être prises pour des questions. | Score par séquence, contenu interrogatif, verbes de Bloom, contexte négatif et arrêt avant les sections de barème. |
| Haute | Le proxy acceptait des origines par suffixe, échouait en mode ouvert et utilisait un rate limiter en mémoire. | Origines exactes, refus par défaut, seule donnée acceptée : un identifiant Google Docs, rate limit natif Netlify. |
| Haute | La taille distante de 10 Mo ne tenait pas compte des limites de réponse d’une fonction Netlify. | Limite de 4 Mo contrôlée avant et pendant le flux. |
| Haute | L’ancien proxy permissif restait déployable. | Suppression de `fetch-doc_old.js` et remplacement par une seule fonction moderne. |
| Moyenne | La reconnaissance vocale s’arrêtait au premier résultat final et écrasait la réponse. | Mode continu, accumulation des segments, zone multiligne et arrêt explicite. |
| Moyenne | L’application exigeait le microphone au démarrage et s’arrêtait si l’API vocale manquait. | Permission demandée uniquement après action ; fallback clavier complet. |
| Moyenne | Le bouton micro de réponse était caché et non relié. | Boutons « Dicter » et « Arrêter la dictée » visibles et fonctionnels. |
| Moyenne | Des événements de synthèse annulés pouvaient relancer le micro. | Jeton de lecture invalidant les callbacks obsolètes. |
| Moyenne | Les modules d’état et d’accessibilité utilisaient des globales inexistantes et n’étaient pas initialisés. | Modules remplacés par des composants ES indépendants et testables. |
| Moyenne | Une restauration pouvait exposer un état ancien sans choix explicite. | Session validée, expirant après huit heures, restaurée seulement après confirmation. |
| Moyenne | Le chargement `?doc=` pouvait démarrer avant l’exposition de l’application. | Initialisation unique et chargement du paramètre après branchement de tous les événements. |
| Moyenne | L’export ne paginait pas une réponse longue à l’intérieur d’une question. | Pagination ligne par ligne, avec pied de page sur chaque page. |
| Moyenne | Aucun en-tête de sécurité du site n’était configuré. | CSP sans scripts inline, HSTS, politique de permissions, anti-framing et `nosniff`. |
| Moyenne | Les bibliothèques étaient chargées depuis des CDN sans SRI. | Dépendances npm exactes, lockfile et copie dans `dist/vendor`. |
| Moyenne | Contrastes insuffisants, sélecteur de fichier masqué, notifications non annoncées. | Palette contrastée, focus visible, contrôle fichier natif, régions live et barre de progression ARIA. |
| Faible | `pdf-lib` était chargé mais inutilisé. | Dépendance supprimée. |
| Faible | `test_cors.html`, un footer non inclus et plusieurs scripts historiques augmentaient la surface. | Fichiers morts supprimés. |
| Faible | Aucun test ni pipeline CI. | Tests Node, contrôle statique, build reproductible, audit npm et GitHub Actions. |
| Faible | Le catch-all Netlify masquait les ressources absentes comme une page valide. | Redirection globale supprimée. |
| Faible | Les URL `blob:` d’aperçu n’étaient jamais libérées. | Révocation lors d’un remplacement, d’une réinitialisation et de la fermeture de page. |

## Détection des questions

### Questions numérotées

Le parseur recherche les marqueurs au début d’une ligne, construit les
séquences cohérentes et compare leur score. Une séquence bénéficie notamment
des signaux suivants :

- départ à `1` et incrément régulier ;
- marqueur explicite `Question n` ou `Qn` ;
- formulation interrogative ou verbe de Bloom ;
- longueur suffisante.

Les mentions de points et la proximité de « barème », « correction » ou
« critères » diminuent le score. Le contenu d’une question s’arrête à la
question suivante ou à une section structurelle.

### Tâches complexes de niveau 3

Une ligne est candidate si son premier mot est un verbe de Bloom reconnu. Le
parseur normalise les accents et accepte l’infinitif ainsi que plusieurs formes
à l’impératif. Exemples : `Analyser`, `Évaluer`, `Justifier`, `Comparer`,
`Concevoir`, `Proposer`, `Rédiger`.

PDF.js ne publie pas directement `fontWeight` dans chaque élément de texte.
EvalVoice résout donc l’objet de police de la page et cherche ses propriétés
`bold`/`black`, son poids CSS éventuel et son nom. Ce signal est volontairement
traité comme un indice :

- un verbe de Bloom en gras et sans concurrent est accepté avec confiance
  élevée ;
- un seul verbe de Bloom sans information de gras peut être accepté avec
  confiance moyenne ;
- plusieurs candidats comparables ouvrent une boîte de validation ;
- aucun pattern fiable n’entraîne plus l’utilisation silencieuse du document
  entier.

## Sécurité et données

Le navigateur transmet à la fonction Netlify uniquement l’identifiant du
Google Docs. La fonction reconstruit elle-même l’URL canonique
`docs.google.com/document/d/{id}/export?format=pdf`, impose HTTPS, vérifie le
type MIME et limite le flux. Elle n’accepte donc plus une URL arbitraire.

La page n’autorise que ses propres scripts et styles. PDF.js et jsPDF sont
servis depuis le même déploiement. Les réponses, le nom de l’élève et l’état de
session ne sont jamais envoyés à la fonction.

La Web Speech API reste un traitement fourni par le navigateur. Son mode
d’exécution local ou distant dépend de l’éditeur et de l’appareil ; cette
question doit être validée dans le cadre RGPD de l’établissement, en
particulier pour des mineurs.

## Vérifications automatisées

La suite couvre notamment :

- niveau 2 avec `1)`, `2)`, `3)` ;
- niveau 3 avec verbe de Bloom en gras ;
- fallback quand le poids de police est indisponible ;
- question numérotée unique ;
- rejet d’un barème numéroté ;
- ambiguïté entre plusieurs verbes de Bloom ;
- reconstruction des lignes et identification d’une police grasse ;
- expiration et validation de session ;
- validation d’origine, d’identifiant, de type MIME et de taille du proxy ;
- absence de CDN et de gestionnaires JavaScript inline ;
- présence de tous les éléments DOM attendus.

Le pipeline CI exécute `npm ci`, les tests, les contrôles de syntaxe, le build
et `npm audit --omit=dev`.

## Risques résiduels et validation avant production

1. Tester sur un déploiement de préproduction avec plusieurs vrais sujets
   Google Docs de niveaux 2 et 3. Les polices incorporées varient selon les
   outils d’export.
2. Vérifier ChromeOS, Chrome Android, Edge et les tablettes réellement
   utilisées. La Web Speech API n’est pas uniforme entre navigateurs.
3. Confirmer la politique de transcription vocale et l’information des élèves
   avec le référent protection des données.
4. Ajouter un OCR si les sujets scannés sans couche texte doivent être pris en
   charge.
5. Ajouter les domaines personnalisés exacts à `ALLOWED_ORIGINS` s’ils ne sont
   pas déjà représentés par les variables Netlify.
6. Surveiller les alertes Dependabot/npm et conserver les versions de PDF.js et
   jsPDF à jour.

Ces points sont des validations d’exploitation ; aucun ne justifie de revenir
au fallback silencieux de l’ancienne détection.
