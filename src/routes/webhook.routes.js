const express = require('express');
const router = express.Router();
const classifierService = require('../services/classifier.service');
const agentsService = require('../services/agents.service');
const manychatService = require('../services/manychat.service');
const supabaseService = require('../services/supabase.service');
const rateLimitService = require('../services/ratelimit.service');
const Logger = require('../utils/logger.util');
const { detectLanguage } = require('../utils/language.util');
const { sanitizeText } = require('../utils/sanitize.util');

/**
 * POST /webhook/vuelasim-bot
 * Webhook principal para recibir mensajes de ManyChat
 */
router.post('/vuelasim-bot', async (req, res) => {
  const startTime = Date.now();
  
  try {
    Logger.info('🔵 Webhook recibido', { body: req.body });

    // 1. Extraer datos del body
    const body = req.body || {};
    let subscriberId = body.subscriber_id || body.key || 'unknown';
    const mensaje = body.last_input_text || body.text || '';
    const nombre = body.first_name || 'viajero';
    const phone = body.phone || '';

    // Limpiar subscriber_id
    subscriberId = String(subscriberId).replace(/^user:/, '').trim();

    Logger.info('📋 Datos extraídos', {
      subscriberId,
      nombre,
      idioma: detectLanguage(mensaje),
      mensajeLength: mensaje.length
    });

    // 2. Validar datos básicos
    if (!subscriberId || !mensaje) {
      return res.status(400).json({
        status: 'error',
        message: 'Faltan datos requeridos: subscriber_id y mensaje'
      });
    }

    // 3. Rate limiting (30 mensajes por día)
    const rateLimitResult = await rateLimitService.checkRateLimit(subscriberId);
    
    if (!rateLimitResult.allowed) {
      Logger.warn('⚠️ Rate limit excedido', { subscriberId });
      
      // Enviar mensaje de rate limit
      await manychatService.sendMessage(
        subscriberId,
        'Has alcanzado el límite de mensajes por hoy. Por favor intenta mañana o contacta a hola@vuelasim.com'
      );
      
      return res.status(200).json({
        status: 'rate_limited',
        message: 'Rate limit excedido'
      });
    }

    Logger.info('✅ Rate limit OK: ' + rateLimitResult.count + '/' + rateLimitResult.limit);

    // 4. Detectar idioma
    const idioma = detectLanguage(mensaje);
    Logger.info('🔍 Clasificando mensaje...', { length: mensaje.length, language: idioma });

    // 5. Clasificar mensaje
    const categoria = await classifierService.classify(mensaje, idioma);
    Logger.info('🎯 Categoría: ' + categoria);

    // 6. Ejecutar agente correspondiente
    const respuesta = await agentsService.executeAgent(
      categoria,
      subscriberId,
      nombre,
      mensaje,
      idioma
    );

    // 7. Si es escalamiento, notificar admin
    if (categoria === 'ESCALAMIENTO') {
      await manychatService.notifyAdmin({
        subscriberId,
        nombre,
        mensaje,
        timestamp: new Date().toISOString()
      });
    }

    // 8. Enviar respuesta a ManyChat
    const result = await manychatService.sendMessage(subscriberId, respuesta);
    
    if (!result.success) {
      Logger.error('Error enviando respuesta a ManyChat', result);
    }

    // 9. Guardar analytics en Supabase (en background, no bloqueante)
    supabaseService.saveAnalytics({
      subscriber_id: subscriberId,
      nombre_cliente: nombre,
      categoria: categoria,
      mensaje_cliente: sanitizeText(mensaje),
      respuesta_bot: sanitizeText(respuesta),
      fue_escalado: categoria === 'ESCALAMIENTO',
      duracion_ms: Date.now() - startTime,
      idioma: idioma
    }).catch(err => {
      Logger.error('Error guardando analytics:', err);
    });

    // 10. Respuesta exitosa al webhook
    Logger.info('✅ Webhook procesado exitosamente', {
      subscriberId,
      categoria,
      duracion: (Date.now() - startTime) + 'ms'
    });

    // Retornar JSON compatible con ManyChat (evitar error de json path)
    return res.status(200).json({
      status: 'success',
      categoria: categoria,
      duracion_ms: Date.now() - startTime,
      content: {
        messages: [
          {
            text: "Mensaje procesado correctamente"
          }
        ]
      }
    });

  } catch (error) {
    Logger.error('Error en webhook:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Error interno del servidor',
      content: {
        messages: [
          {
            text: "Error procesando mensaje"
          }
        ]
      }
    });
  }
});

module.exports = router;