# EvalVoice

EvalVoice est une application web d’aide à la passation d’évaluations. Elle
charge un sujet PDF ou Google Docs, en extrait les questions, les lit à voix
haute, transcrit les réponses dictées et produit un PDF de réponses.

## Ce que reconnaît le parseur

Le parseur conserve les retours à la ligne et utilise plusieurs signaux, par
ordre de fiabilité :

1. une séquence numérotée cohérente : `1)`, `2)`, `3)`… ;
2. une question unique explicitement numérotée : `Question 1 :` ;
3. une tâche complexe non numérotée commençant par un verbe de Bloom en gras.

Exemples de verbes reconnus : **Analyser**, **Évaluer**, **Justifier**,
**Comparer**, **Concevoir**, **Proposer**, **Rédiger** et **Créer**. Les formes
à l’impératif comme **Analysez** et **Justifiez** sont aussi prises en charge.

Le gras du PDF sert de signal fort. Certains générateurs PDF ne publient pas
clairement le poids de la police : dans ce cas, une seule consigne commençant
par un verbe de Bloom peut encore être reconnue avec une confiance moyenne.
Si plusieurs consignes sont possibles, EvalVoice affiche une boîte de
vérification au lieu de choisir silencieusement.

## Utilisation

- Charger un PDF local de 20 Mo maximum, ou coller un lien Google Docs.
- Vérifier la question reconnue si EvalVoice le demande.
- Utiliser « Lire la question », puis saisir ou dicter la réponse.
- Pour une réponse longue, la dictée continue jusqu’au clic sur
  « Arrêter la dictée ».
- Exporter les questions et réponses en PDF.

La reconnaissance vocale fonctionne surtout dans les navigateurs Chromium.
Quand elle n’est pas disponible, toutes les fonctions de saisie au clavier,
navigation et export restent accessibles.

## Confidentialité

Les réponses et l’identité de l’élève restent dans le navigateur. Une reprise
de session est conservée dans `sessionStorage` pendant huit heures au maximum
et uniquement dans l’onglet concerné.

La reconnaissance vocale est fournie par le navigateur. Selon le navigateur
et sa configuration, l’audio peut être transmis au service de transcription de
son éditeur. Avant un usage avec des élèves, l’établissement doit informer les
utilisateurs et valider ce traitement avec la personne responsable de la
protection des données.

Lors du chargement d’un Google Docs, la fonction Netlify télécharge seulement
le PDF exporté. Elle ne reçoit ni l’identité de l’élève ni ses réponses.

## Développement

Pré-requis : Node.js 24 ou supérieur.

```bash
npm ci
npm run check
npm run build
```

Le site prêt à publier est généré dans `dist/`. Les versions de PDF.js et
jsPDF sont verrouillées dans `package-lock.json` et copiées localement lors du
build : aucune bibliothèque JavaScript n’est chargée depuis un CDN.

Commandes utiles :

```bash
npm test
npm run audit:prod
```

## Déploiement Netlify

`netlify.toml` configure le build, les en-têtes de sécurité et la fonction
`/api/fetch-doc`. Les URL Netlify du déploiement sont autorisées
automatiquement.

Pour ajouter d’autres domaines exacts, définir :

```text
ALLOWED_ORIGINS=https://evalvoice.exemple.fr,https://autre-domaine.exemple
```

Les jokers et les correspondances partielles ne sont volontairement pas
acceptés. Le document Google Docs doit être accessible avec son lien afin que
Google puisse l’exporter en PDF.

## Limites connues

- Un PDF scanné sans couche de texte nécessite un OCR, non inclus actuellement.
- Le poids « gras » n’est pas standardisé dans tous les PDF ; la validation
  manuelle couvre les cas ambigus.
- La synthèse et la reconnaissance vocales varient selon le système et le
  navigateur : tester les appareils utilisés en classe avant une session.

Le compte rendu complet se trouve dans
[`docs/AUDIT_TECHNIQUE_2026-07-23.md`](docs/AUDIT_TECHNIQUE_2026-07-23.md).
