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
   * Clasifica el mensaje del usuario en:
   * - intent: CONSULTA, DIAGNOSTICO, TECNICO, ESCALAMIENTO
   * - emotion: CALM, NEUTRAL, FRUSTRATED, ANGRY, SAD, CONFUSED
   *
   * Devuelve siempre un objeto:
   * { intent: 'CONSULTA', emotion: 'NEUTRAL' }
   */
  async classify(message, language = 'es') {
    try {
      Logger.info('🔍 Clasificando mensaje...', { length: message.length, language });

      const prompt = this.getClassifierPrompt(language);

      const completion = await this.openai.chat.completions.create({
        model: config.OPENAI_MODEL_CLASSIFIER,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: message }
        ],
        temperature: 0.1,
        max_tokens: 80
      });

      const raw = completion.choices[0].message.content.trim();
      let intent = 'CONSULTA';
      let emotion = 'NEUTRAL';

      try {
        // Esperamos un JSON: { "intent": "...", "emotion": "..." }
        const parsed = JSON.parse(raw);

        const validIntents = ['CONSULTA', 'DIAGNOSTICO', 'TECNICO', 'ESCALAMIENTO'];
        const validEmotions = ['CALM', 'NEUTRAL', 'FRUSTRATED', 'ANGRY', 'SAD', 'CONFUSED'];

        if (parsed.intent && typeof parsed.intent === 'string') {
          const upperIntent = parsed.intent.trim().toUpperCase();
          if (validIntents.includes(upperIntent)) {
            intent = upperIntent;
          }
        }

        if (parsed.emotion && typeof parsed.emotion === 'string') {
          const upperEmotion = parsed.emotion.trim().toUpperCase();
          if (validEmotions.includes(upperEmotion)) {
            emotion = upperEmotion;
          }
        }
      } catch (parseError) {
        // Si no vino JSON, intentamos interpretar como antes (solo categoría)
        Logger.warn('⚠️ Respuesta de clasificador no es JSON, usando fallback simple', { raw });

        const upper = raw.toUpperCase();
        const validIntents = ['CONSULTA', 'DIAGNOSTICO', 'TECNICO', 'ESCALAMIENTO'];
        if (validIntents.includes(upper)) {
          intent = upper;
        }
      }

      Logger.info(`✅ Mensaje clasificado`, { intent, emotion });

      return { intent, emotion };
    } catch (error) {
      Logger.error('Error clasificando mensaje:', error);
      // Fallback seguro
      return {
        intent: 'CONSULTA',
        emotion: 'NEUTRAL'
      };
    }
  }

  /**
   * Prompt del clasificador para Sensora AI
   * Ahora devuelve JSON con intent + emotion
   */
  getClassifierPrompt(language = 'es') {
    return `Eres un clasificador para Sensora AI (empresa de automatización con IA para LATAM).

Debes analizar el mensaje del cliente y devolver SIEMPRE un JSON con esta forma EXACTA:

{
  "intent": "CONSULTA|DIAGNOSTICO|TECNICO|ESCALAMIENTO",
  "emotion": "CALM|NEUTRAL|FRUSTRATED|ANGRY|SAD|CONFUSED"
}

SIN texto extra, SIN explicaciones, SIN comentarios. Solo el JSON.

DEFINICIONES DE INTENT:

- CONSULTA:
  - saludos
  - preguntas generales sobre qué hace Sensora AI
  - cómo funciona, precios, sectores que atiende
  - dudas comerciales básicas
  - preguntas "de ejemplo", "simula que", "dame un ejemplo de respuesta"
  - mensajes de evaluación del bot (cuando alguien solo está probando el sistema)

- DIAGNOSTICO:
  - el cliente describe un problema específico de su empresa
  - menciona tareas manuales que consumen tiempo
  - pide analizar su caso
  - quiere saber si Sensora puede ayudarle con su situación particular
  - solicita diagnóstico gratuito

- TECNICO:
  - preguntas sobre stack tecnológico (lenguajes, infra, herramientas)
  - integraciones específicas (MercadoPago, WhatsApp API, Airtable, etc.)
  - tiempos de desarrollo, arquitectura de sistemas

- ESCALAMIENTO:
  - SOLO si se trata de un caso REAL del cliente (no un ejemplo)
  - y además:
    - pide explícitamente hablar con una persona real / humano / equipo
    - o quiere agendar llamada directa
    - o reporta un problema GRAVE y URGENTE sobre un sistema EN PRODUCCIÓN suyo
  - Frases típicas:
    - "quiero hablar con alguien"
    - "ponme con un humano"
    - "necesito hablar con el equipo"
    - "quiero agendar una llamada ya"

⚠️ REGLAS ESPECIALES (MUY IMPORTANTES):
- Si el usuario escribe cosas como:
  - "Simula que soy un cliente que quiere cancelar un plan"
  - "Dame un ejemplo de cómo responderías a alguien molesto"
  - "Respóndeme como si estuviera decepcionado"
  - "Qué harías si un cliente...?"
  Entonces NO es un caso real, es una prueba. En esos casos:
  intent = "CONSULTA"

- "ayudar", "ayuda", "necesito ayuda" → NO es ESCALAMIENTO por sí solo
- "hola", "buenos días", "cómo estás" → CONSULTA
- "tengo un problema con X" → normalmente DIAGNOSTICO (a menos que pida hablar con humano)
- "usan Node.js?" → TECNICO

DEFINICIONES DE EMOTION (del cliente):

- CALM: tranquilo, educado, sin urgencia
- NEUTRAL: informativo, directo, sin carga emocional importante
- FRUSTRATED: expresa molestia moderada, cansancio, "esto no funciona", quejas suaves
- ANGRY: muy molesto, exige soluciones, usa tono fuerte
- SAD: expresa decepción, desánimo, "me siento decepcionado", "esto me tiene mal"
- CONFUSED: no entiende algo, pide aclaración, se nota perdido

EJEMPLOS RÁPIDOS:

"Hola, qué es Sensora AI?" →
{
  "intent": "CONSULTA",
  "emotion": "CALM"
}

"Mi equipo pierde 20 horas semanales en reportes manuales, pueden ayudar?" →
{
  "intent": "DIAGNOSTICO",
  "emotion": "NEUTRAL"
}

"Usan Node.js y se integran con MercadoPago?" →
{
  "intent": "TECNICO",
  "emotion": "NEUTRAL"
}

"Quiero hablar con alguien del equipo, esto no puede seguir así" →
{
  "intent": "ESCALAMIENTO",
  "emotion": "ANGRY"
}

"Simula que soy un cliente que quiere cancelar un plan. ¿Qué harías?" →
{
  "intent": "CONSULTA",
  "emotion": "NEUTRAL"
}

RECORDATORIO FINAL:
- Responde SIEMPRE solo con un JSON válido.
- LAS CLAVES deben ser exactamente "intent" y "emotion".
- Los valores deben estar en MAYÚSCULAS.`;
  }
}

module.exports = new ClassifierService();
