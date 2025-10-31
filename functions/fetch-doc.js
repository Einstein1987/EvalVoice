const fetch = require('node-fetch');

// Configuration de sécurité
const CONFIG = {
  // Whitelist des domaines autorisés pour les documents
  ALLOWED_DOMAINS: [
    'docs.google.com',
    'drive.google.com'
  ],
  
  // Taille maximale du document (10 MB)
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  
  // Timeout pour la requête (30 secondes)
  REQUEST_TIMEOUT: 30000,
  
  // Rate limiting (nombre de requêtes par IP par minute)
  RATE_LIMIT_PER_MINUTE: 10,
  
  // Mode de sécurité CORS
  // 'permissive' : accepte toutes les origines (développement/test)
  // 'strict' : utilise la whitelist (production recommandée)
  // Configurez via variable d'environnement : CORS_MODE=strict ou CORS_MODE=permissive
  CORS_MODE: process.env.CORS_MODE || 'strict',
  
  // Domaines autorisés pour CORS en mode strict
  // Configurez via variable d'environnement ALLOWED_ORIGINS
  // Exemple : "https://evalvoice.netlify.app,https://votre-domaine.com,*.netlify.app"
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [],
  
  // Activer les logs détaillés (utile pour débugger)
  DEBUG_MODE: process.env.DEBUG_MODE === 'true'
};

// Store pour le rate limiting (en production, utilisez Redis)
const rateLimitStore = new Map();

/**
 * Vérifie si l'origine est autorisée
 * Supporte deux modes : permissive (dev) et strict (prod)
 */
function isOriginAllowed(origin) {
  // Mode permissif : accepter toutes les origines
  if (CONFIG.CORS_MODE === 'permissive') {
    if (CONFIG.DEBUG_MODE) {
      console.log(`[CORS] Mode permissif - origine acceptée: ${origin}`);
    }
    return true;
  }
  
  // Mode strict : vérifier la whitelist
  if (!origin) {
    console.warn('[CORS] Aucune origine fournie en mode strict');
    return false;
  }
  
  // Toujours autoriser localhost en développement
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    if (CONFIG.DEBUG_MODE) {
      console.log(`[CORS] Localhost autorisé: ${origin}`);
    }
    return true;
  }
  
  // Vérifier si la liste des origines est vide
  if (CONFIG.ALLOWED_ORIGINS.length === 0) {
    console.warn('[CORS] Mode strict activé mais ALLOWED_ORIGINS est vide !');
    console.warn('[CORS] Configurez la variable d\'environnement ALLOWED_ORIGINS');
    // Accepter quand même pour ne pas bloquer (peut être changé en false)
    return true;
  }
  
  // Vérifier la whitelist
  const isAllowed = CONFIG.ALLOWED_ORIGINS.some(allowed => {
    // Supporter les wildcards simples (*.netlify.app)
    if (allowed.startsWith('*.')) {
      const domain = allowed.substring(2);
      return origin.endsWith(domain);
    }
    // Match exact ou sous-domaine
    return origin === allowed || origin.endsWith('.' + allowed) || origin.endsWith(allowed);
  });
  
  if (isAllowed) {
    if (CONFIG.DEBUG_MODE) {
      console.log(`[CORS] ✓ Origine autorisée: ${origin}`);
    }
  } else {
    console.warn(`[CORS] ✗ Origine refusée: ${origin}`);
    console.warn(`[CORS] Origines autorisées: ${CONFIG.ALLOWED_ORIGINS.join(', ')}`);
  }
  
  return isAllowed;
}

/**
 * Vérifie si l'URL est valide et autorisée
 */
function validateUrl(urlString) {
  try {
    const url = new URL(urlString);
    
    // Vérifier le protocole
    if (url.protocol !== 'https:') {
      return { valid: false, error: 'Seul le protocole HTTPS est autorisé' };
    }
    
    // Vérifier le domaine
    if (!CONFIG.ALLOWED_DOMAINS.includes(url.hostname)) {
      return { 
        valid: false, 
        error: `Domaine non autorisé. Domaines autorisés: ${CONFIG.ALLOWED_DOMAINS.join(', ')}` 
      };
    }
    
    // Vérifier que c'est bien un export PDF Google Docs
    if (url.hostname === 'docs.google.com' && !url.pathname.includes('/export')) {
      return { valid: false, error: 'URL Google Docs invalide. Utilisez une URL d\'export.' };
    }
    
    return { valid: true, url };
  } catch (error) {
    return { valid: false, error: 'URL invalide' };
  }
}

/**
 * Vérifie le rate limiting
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const key = `${ip}-${minute}`;
  
  const count = rateLimitStore.get(key) || 0;
  
  if (count >= CONFIG.RATE_LIMIT_PER_MINUTE) {
    return { allowed: false, error: 'Trop de requêtes. Veuillez réessayer dans une minute.' };
  }
  
  rateLimitStore.set(key, count + 1);
  
  // Nettoyer les anciennes entrées (garder seulement les 2 dernières minutes)
  for (const [storeKey] of rateLimitStore) {
    const keyMinute = parseInt(storeKey.split('-')[1]);
    if (keyMinute < minute - 2) {
      rateLimitStore.delete(storeKey);
    }
  }
  
  return { allowed: true };
}

/**
 * Télécharge le document avec timeout et vérification de taille
 */
async function fetchDocumentWithLimits(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, CONFIG.REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'EvalVoice/1.0'
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        success: false,
        error: `Erreur HTTP ${response.status}: ${response.statusText}`
      };
    }

    // Vérifier le Content-Type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/pdf')) {
      return {
        success: false,
        error: 'Le document doit être un PDF'
      };
    }

    // Vérifier la taille avant de télécharger
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > CONFIG.MAX_FILE_SIZE) {
      return {
        success: false,
        error: `Fichier trop volumineux. Taille maximale: ${CONFIG.MAX_FILE_SIZE / 1024 / 1024} MB`
      };
    }

    // Télécharger avec vérification de taille progressive
    const chunks = [];
    let totalSize = 0;

    for await (const chunk of response.body) {
      totalSize += chunk.length;
      
      if (totalSize > CONFIG.MAX_FILE_SIZE) {
        return {
          success: false,
          error: `Fichier trop volumineux. Taille maximale: ${CONFIG.MAX_FILE_SIZE / 1024 / 1024} MB`
        };
      }
      
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);
    
    return {
      success: true,
      buffer,
      contentType
    };

  } catch (error) {
    clearTimeout(timeout);
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Délai d\'attente dépassé. Le document est peut-être trop volumineux.'
      };
    }
    
    return {
      success: false,
      error: `Erreur réseau: ${error.message}`
    };
  }
}

/**
 * Handler principal
 */
exports.handler = async function(event, context) {
  // Log du mode CORS au démarrage (une seule fois)
  if (CONFIG.DEBUG_MODE) {
    console.log(`[CONFIG] Mode CORS: ${CONFIG.CORS_MODE}`);
    console.log(`[CONFIG] Origines autorisées: ${CONFIG.ALLOWED_ORIGINS.join(', ') || 'Toutes (mode permissif)'}`);
  }
  
  // Récupérer l'origine de la requête
  const origin = event.headers.origin || event.headers.Origin;
  
  // Vérifier si l'origine est autorisée
  const originAllowed = isOriginAllowed(origin);
  const allowedOrigin = originAllowed ? (origin || '*') : 'null';
  
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'none'; script-src 'none'; object-src 'none'"
  };

  // Gérer les requêtes OPTIONS (preflight CORS)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Si l'origine n'est pas autorisée en mode strict, refuser
  if (CONFIG.CORS_MODE === 'strict' && !originAllowed) {
    console.warn(`[SECURITY] Requête refusée - origine non autorisée: ${origin}`);
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ 
        error: 'Origine non autorisée',
        hint: 'Contactez l\'administrateur pour ajouter votre domaine à la liste'
      })
    };
  }

  // Vérifier la méthode HTTP
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Méthode non autorisée. Utilisez POST.' })
    };
  }

  try {
    // Récupérer l'IP du client
    const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     event.headers['client-ip'] || 
                     'unknown';

    // Vérifier le rate limiting
    const rateLimitCheck = checkRateLimit(clientIp);
    if (!rateLimitCheck.allowed) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ error: rateLimitCheck.error })
      };
    }

    // Parser le body
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Corps de requête JSON invalide' })
      };
    }

    const { url } = body;

    // Vérifier la présence de l'URL
    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL manquante dans la requête' })
      };
    }

    // Valider l'URL
    const urlValidation = validateUrl(url);
    if (!urlValidation.valid) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: urlValidation.error })
      };
    }

    // Log sécurisé (sans exposer l'URL complète)
    if (CONFIG.DEBUG_MODE) {
      console.log(`[${new Date().toISOString()}] Requête depuis IP: ${clientIp}, Domaine: ${urlValidation.url.hostname}`);
    }

    // Télécharger le document
    const downloadResult = await fetchDocumentWithLimits(url);

    if (!downloadResult.success) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: downloadResult.error })
      };
    }

    // Retourner le PDF
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="document.pdf"',
        'Cache-Control': 'private, max-age=3600' // Cache 1 heure
      },
      body: downloadResult.buffer.toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    // Log l'erreur mais ne pas exposer les détails au client
    console.error('[ERROR]', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Erreur interne du serveur. Veuillez réessayer plus tard.' 
      })
    };
  }
};
