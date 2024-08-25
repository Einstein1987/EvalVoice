const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  try {
    const { url } = JSON.parse(event.body);

    if (!url) {
      return {
        statusCode: 400,
        body: 'URL manquante dans la requête.'
      };
    }

    const response = await fetch(url);
    if (!response.ok) {
      return { statusCode: response.status, body: 'Erreur lors de la récupération du document.' };
    }
    
    // Traiter la réponse en tant que blob pour les PDF
    const buffer = await response.arrayBuffer();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="document.pdf"',
      },
      body: Buffer.from(buffer).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: 'Erreur serveur: ' + error.message
    };
  }
};
