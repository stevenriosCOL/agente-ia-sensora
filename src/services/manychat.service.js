// src/services/manychat.service.js
const axios = require('axios');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

class ManyChatService {
  constructor() {
    // 👉 Usa la URL de env, o por defecto la de WhatsApp
    this.apiUrl =
      config.MANYCHAT_API_URL ||
      'https://api.manychat.com/whatsapp/sending/sendContent';

    // 👉 Usa el token correcto de env
    this.token = config.MANYCHAT_TOKEN;

    if (!this.token) {
      Logger.warn(
        '⚠️ MANYCHAT_TOKEN no está configurado. No se podrán enviar mensajes a ManyChat.'
      );
    }

    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        Authorization: `Bearer ${this.token}`, // 👈 formato correcto
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  /**
   * Enviar mensaje a usuario vía ManyChat
   */
  async sendMessage(subscriberId, text) {
    if (!this.token) {
      Logger.warn(
        '⚠️ Intento de enviar mensaje a ManyChat sin MANYCHAT_TOKEN configurado'
      );
      return { success: false, error: 'MANYCHAT_TOKEN not configured' };
    }

    try {
      Logger.info('📤 Enviando a ManyChat', {
        subscriberId,
        textLength: text.length
      });

      const payload = {
        subscriber_id: subscriberId,
        data: {
          version: 'v2',
          content: {
            messages: [
              {
                type: 'text',
                text
              }
            ]
          }
        },
        message_tag: 'ACCOUNT_UPDATE'
      };

      const response = await this.axiosInstance.post('', payload);

      if (response.status === 200 && response.data?.status === 'success') {
        Logger.info('✅ Mensaje enviado a ManyChat', { subscriberId });
        return { success: true, data: response.data };
      }

      Logger.error('❌ Respuesta inesperada de ManyChat', {
        status: response.status,
        data: response.data
      });
      return { success: false, error: 'Respuesta inesperada de ManyChat' };
    } catch (error) {
      Logger.error('❌ Error enviando a ManyChat:', {
        subscriberId,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  /**
   * Notificar a admin sobre escalamiento o evento importante
   */
  async notifyAdmin(escalationData) {
    try {
      if (!this.token) {
        Logger.warn(
          '⚠️ notifyAdmin llamado sin MANYCHAT_TOKEN configurado. Se omite envío.'
        );
        return { success: false, error: 'MANYCHAT_TOKEN not configured' };
      }

      if (!config.ADMIN_SUBSCRIBER_ID) {
        Logger.warn(
          '⚠️ ADMIN_SUBSCRIBER_ID no configurado. No se puede notificar al admin.'
        );
        return {
          success: false,
          error: 'ADMIN_SUBSCRIBER_ID not configured'
        };
      }

      const { subscriberId, nombre, mensaje, timestamp } = escalationData;

      const adminMessage = `🚨 *NOTIFICACIÓN SENSORA AI*

*Cliente:* ${nombre}
*ID:* ${subscriberId}
*Mensaje:* "${mensaje}"
*Fecha:* ${timestamp}

Requiere atención humana.`;

      const result = await this.sendMessage(
        config.ADMIN_SUBSCRIBER_ID,
        adminMessage
      );

      if (result.success) {
        Logger.info('✅ Admin notificado', { subscriberId });
      } else {
        Logger.error('❌ Error notificando admin', {
          subscriberId,
          error: result.error
        });
      }

      return result;
    } catch (error) {
      Logger.error('Error en notifyAdmin:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * (Legacy) Generar link de pago para consultoría en backend viejo
   * Ya no lo necesitas si generas MP desde este nuevo backend,
   * pero lo dejo por compatibilidad si no lo estás usando en ningún lado.
   */
  async generatePaymentLink(nombre, whatsapp, monto = 25) {
    try {
      Logger.info('💳 Generando link de pago (LEGACY)', {
        nombre,
        whatsapp,
        monto
      });

      const response = await axios.post(
        'https://backend-sensora-2025-production.up.railway.app/webhooks/manychat',
        {
          nombre,
          whatsapp,
          monto: monto.toString()
        },
        { timeout: 10000 }
      );

      if (response.data && response.data.link && response.data.codigo) {
        Logger.info('✅ Link de pago generado (LEGACY)', {
          codigo: response.data.codigo
        });
        return {
          success: true,
          link: response.data.link,
          codigo: response.data.codigo
        };
      }

      Logger.error('Respuesta inesperada del backend de pagos LEGACY:', response.data);
      return { success: false, error: 'Respuesta inesperada' };
    } catch (error) {
      Logger.error('Error generando link de pago LEGACY:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ManyChatService();
