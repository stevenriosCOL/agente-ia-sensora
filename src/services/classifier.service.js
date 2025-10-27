const OpenAI = require('openai');
const config = require('../config/env.config');
const Logger = require('../utils/logger.util');

class ClassifierService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
  }

  /**
   * Clasifica el mensaje del usuario en una categoría
   * Usa GPT-4o-mini con temperatura 0.1 (como "LLM Policia" en n8n)
   */
  async classify(message, language = 'es') {
    try {
      Logger.info('🔍 Clasificando mensaje...', { length: message.length, language });

      // Prompt EXACTO de n8n (línea 363 del JSON)
      const prompt = this.getClassifierPrompt();

      const completion = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL_CLASSIFIER,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: message }
        ],
        temperature: 0.1,
        max_tokens: 50
      });

      const category = completion.choices[0].message.content.trim().toUpperCase();

      // Validar que la categoría sea válida
      const validCategories = ['VENTAS', 'SOPORTE', 'TECNICO', 'ESCALAMIENTO'];
      const finalCategory = validCategories.includes(category) ? category : 'ESCALAMIENTO';

      Logger.info(`✅ Mensaje clasificado: ${finalCategory}`);

      return finalCategory;
    } catch (error) {
      Logger.error('Error clasificando mensaje:', error);
      // En caso de error, escalar a humano
      return 'ESCALAMIENTO';
    }
  }

  /**
   * Prompt del clasificador EXACTO de n8n
   * No tiene variaciones de idioma en n8n, es un solo prompt
   */
  getClassifierPrompt() {
    // PROMPT EXACTO del JSON de n8n (línea 363)
    return `Clasifica el mensaje del cliente en UNA de estas 4 categorías:

VENTAS: saludos, planes, precios, destinos, compras, recomendaciones
SOPORTE: QR no llegó, pagos, reembolsos, órdenes, problemas con compra
TECNICO: instalación, QR no escanea, sin internet, activación, configuración
ESCALAMIENTO: necesito humano, hablar con persona, esto no sirve, quiero cancelar, muy frustrado

Si menciona "humano", "persona real", "agente" o está muy frustrado -> ESCALAMIENTO

Responde ÚNICAMENTE con una palabra en MAYÚSCULAS: VENTAS, SOPORTE, TECNICO o ESCALAMIENTO`;
  }
}

module.exports = new ClassifierService();