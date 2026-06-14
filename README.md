# EvalVoice
**EvalVoice** est une application web conçue pour assister les enseignants et les élèves lors des évaluations, spécifiquement adaptée à un usage éducatif. Elle facilite la lecture orale des questions, l'entrée vocale des réponses et la transcription textuelle, améliorant ainsi l'accessibilité pour les élèves ayant des difficultés de lecture et d'écriture.
### Fonctionnalités
- **Chargement de Documents** : Les utilisateurs peuvent charger des documents d'évaluation soit en fournissant une URL Google Docs, soit en téléchargeant un fichier PDF.
- **Synthèse Vocale** : L'application lit les questions d'évaluation à haute voix en utilisant la technologie de synthèse vocale.
- **Reconnaissance Vocale** : Les élèves peuvent répondre aux questions verbalement, et leurs réponses sont transcrites en texte.
- **Navigation entre les Questions** : Navigation facile entre les questions à l'aide des boutons "Question précédente" et "Question suivante".
- **Export des Réponses** : Exportez toutes les réponses dans un document PDF pour la révision et la notation.

### Comment Utiliser
##### Charger un Document Google Docs
- **Option 1 (Manuelle)** : Ouvrez l'application EvalVoice, entrez l'URL d'un document Google Docs accessible au public dans le champ prévu à cet effet, puis cliquez sur "Charger le document en ligne".
- **Option 2 (Automatique)** : Ouvrez l'application via un lien direct contenant l'URL du document en paramètre (ex: `https://evalvoice.netlify.app/?doc=URL_DU_DOC`). Le document se chargera automatiquement.

##### Charger un Document PDF
1. Sur la page principale, allez dans la section **Option B** et cliquez sur "Choisir un fichier PDF".
2. Sélectionnez un fichier PDF contenant l'évaluation depuis votre appareil.
3. Le PDF sera analysé, affiché, et l'évaluation commencera automatiquement.

##### Répondre aux Questions
- **Enregistrement des Informations de l'Élève** : Cliquez sur le bouton info élève et dites votre prénom, nom et classe.
- **Écouter et Répondre** : L'application lira chaque question à haute voix. Après la lecture de la question, vous pouvez enregistrer votre réponse.
- **Navigation entre les Questions** : Utilisez les boutons "Question précédente" et "Question suivante" pour naviguer entre les questions.
- **Export des Réponses** : Une fois toutes les questions répondues, cliquez sur "Exporter les réponses" pour sauvegarder les réponses sous forme de PDF.
### Technologies Utilisées
- **HTML/CSS** : Pour la structuration et le style de l'application web.
- **JavaScript** : Pour gérer les interactions, la synthèse vocale et la reconnaissance vocale.
- **PDF.js** : Pour afficher les documents PDF.
### Instructions d'Installation
1. Cloner le Dépôt : `git clone https://github.com/Einstein1987/EvalVoice.git`
2. Naviguer vers le Répertoire du Projet : `cd EvalVoice`
3. Installer **Netlify CLI** (si nécessaire) : `npm install -g netlify-cli`
4. Démarrer localement avec `netlify dev` ou déployer sur Netlify pour que la fonction `functions/fetch-doc.js` soit disponible. Le fichier `index.html` utilise cette fonction pour récupérer les documents. Ouvrez ensuite l'application via l'URL fournie par Netlify.
## Licence
Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.
## Auteur
- **Jérémy VIOLETTE** - Professeur de Physique-Chimie, Collège La NACELLE (REP) de Corbeil-Essonnes (91100).
  
Pour toute question ou support, veuillez me contacter.

*EvalVoice est conçu pour aider les élèves en difficulté de lecture et d'écriture en leur offrant une évaluation adaptée utilisant la synthèse vocale et la transcription de réponses dictées.*

--------------------------------------------------------------------------------------------

# EvalVoice
**EvalVoice** is a web application designed to assist teachers and students during evaluations, specifically tailored for use in educational settings. It facilitates oral reading of questions, voice input for responses, and text transcription, enhancing accessibility for students with reading and writing difficulties.

### Features
- **Document Loading** : Users can load evaluation documents either by providing a Google Docs URL or by uploading a PDF file.
- **Voice Synthesis** : The application reads the evaluation questions aloud using text-to-speech technology.
- **Voice Recognition** : Students can respond to questions verbally, and their answers are transcribed into text.
- **Question Navigation** : Easily navigate between questions using "Previous Question" and "Next Question" buttons.
- **Response Export** : Export all responses into a PDF document for review and grading.

### How to Use
##### Loading a Google Docs Document
- **Option 1 (Manual)**: Open the EvalVoice application, enter the URL of a publicly accessible Google Docs document, and click the "Charger le document en ligne" button.
- **Option 2 (Automatic)**: Open the application using a direct link containing the document URL as a parameter (e.g., `https://evalvoice.netlify.app/?doc=DOC_URL`). The document will load automatically.

##### Loading a PDF Document
1. On the main page, go to **Option B** and click on "Choisir un fichier PDF".
2. Select a PDF file containing the evaluation from your device.
3. The PDF will be analyzed, displayed, and the evaluation will begin automatically.

##### Responding to Questions
- **Recording Student Information** : Click the student info button and speak your name, surname, and class.
- **Listening and Responding** : The application will read each question aloud. After the question is read, you can record your response.
- **Navigating Questions** : Use the "Previous Question" and "Next Question" buttons to move through the questions.
- **Exporting Responses** : Once all questions are answered, click "Exporter les réponses" to save the responses as a PDF.

### Technologies Used
- **HTML/CSS** : For structuring and styling the web application.
- **JavaScript** : For handling interactions, voice synthesis, and recognition.
- **PDF.js** : For rendering and extracting text from PDF documents.

### Setup Instructions
1. Clone the Repository : `git clone https://github.com/Einstein1987/EvalVoice.git`
2. Navigate to the Project Directory : `cd EvalVoice`
3. Install **Netlify CLI** if you don't have it : `npm install -g netlify-cli`
4. Run `netlify dev` to start the project locally, or deploy to Netlify so the `functions/fetch-doc.js` function is available. (Note: Node.js 22 or higher environment is recommended). The `index.html` file relies on this function to fetch documents. Access the app through the URL provided by Netlify.

## Licence
This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

## Author
- **Jérémy VIOLETTE** - Professor of Physics-Chemistry, La NACELLE College (REP) of Corbeil-Essonnes (91100).

For any inquiries or support, please contact me.

*EvalVoice is designed to assist students with reading and writing difficulties by providing an adapted evaluation using speech synthesis and dictated response transcription.*ist students with reading and writing difficulties by providing an adapted evaluation using speech synthesis and dictated response transcription.*
