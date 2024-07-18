function exportResponses() {
      const studentInfo = document.getElementById('studentName').value;
      if (!studentInfo) {
        alert('Veuillez renseigner votre identité (Prénom, Nom, Classe) avant d\'exporter les réponses.');
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.text(`Nom, Prénom, Classe : ${studentInfo}`, 10, 10);
      let output = questions.map((q, i) => `${q}\nRéponse : ${responses[i] || "Pas de réponse."}\n\n`).join('');
      doc.text(output, 10, 30);
      doc.save('reponses_evaluation.pdf');
    }
