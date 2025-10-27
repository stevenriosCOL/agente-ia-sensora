const axios = require('axios');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

class ManyChatService {
  constructor() {
    this.apiUrl = 'https://api.manychat.com/fb/sending/sendContent';
    this.token = config.MANYCHAT_TOKEN;
    
    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
  }

  async sendMessage(subscriberId, text) {
    try {
      Logger.info('📤 Enviando a ManyChat', { subscriberId, textLength: text.length });

      const payload = {
        subscriber_id: subscriberId,
        data: {
          version: "v2",
          content: {
            type: "whatsapp",
            messages: [
              {
                type: "text",
                text: text
              }
            ]
          }
        },
        message_tag: "ACCOUNT_UPDATE"
      };

      // LOG EL PAYLOAD COMPLETO
      console.log('🔍 PAYLOAD COMPLETO A MANYCHAT:');
      console.log(JSON.stringify(payload, null, 2));

      const response = await this.axiosInstance.post('', payload);

      if (response.status === 200) {
        Logger.info('✅ Mensaje enviado a ManyChat', { subscriberId });
        return { success: true, data: response.data };
      }

      return { success: false, error: 'Respuesta inesperada de ManyChat' };

    } catch (error) {
      // LOG COMPLETO Y DETALLADO DEL ERROR
      console.log('❌ ERROR COMPLETO DE MANYCHAT:');
      console.log('Status:', error.response?.status);
      console.log('Status Text:', error.response?.statusText);
      console.log('Data:', JSON.stringify(error.response?.data, null, 2));
      console.log('Details Messages:', JSON.stringify(error.response?.data?.details?.messages, null, 2));
      
      Logger.error('❌ Error enviando a ManyChat:', {
        subscriberId,
        error: error.message,
        status: error.response?.status,
        fullError: error.response?.data,
        detailsMessages: error.response?.data?.details?.messages
      });

      return { 
        success: false, 
        error: error.response?.data || error.message 
      };
    }
  }

  async notifyAdmin(escalationData) {
    try {
      const { subscriberId, nombre, mensaje, timestamp } = escalationData;

      const adminMessage = `🚨 ESCALAMIENTO

Cliente: ${nombre}
ID: ${subscriberId}
Mensaje: "${mensaje}"
Fecha: ${timestamp}`;

      const result = await this.sendMessage(config.ADMIN_SUBSCRIBER_ID, adminMessage);

      if (result.success) {
        Logger.info('✅ Admin notificado sobre escalamiento', { subscriberId });
      } else {
        Logger.error('❌ Error notificando admin', { subscriberId });
      }

      return result;

    } catch (error) {
      Logger.error('Error en notifyAdmin:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ManyChatService();