# 🚀 Sensora AI - Backend del Super Agente Conversacional

## 1. Introducción
Este repositorio contiene el backend de **Sensora AI**, un agente conversacional avanzado que atiende a prospectos y clientes de empresas latinoamericanas a través de **WhatsApp** conectado mediante **ManyChat**. La API recibe mensajes desde el webhook, clasifica la intención del usuario con modelos de **OpenAI**, responde con agentes especializados, puede generar enlaces de pago usando **Mercado Pago** y persiste analíticas, memoria, feedback y estados de pago en **Supabase**. También implementa limitación de tasa con **Redis** para proteger la infraestructura.

## 2. Arquitectura general
```
Cliente WhatsApp → ManyChat → POST /webhook
    │
    ├── Rate limiting (Redis / memoria)
    ├── Clasificador IA (OpenAI)
    ├── Agentes conversacionales (OpenAI + RAG + Memoria)
    ├── Servicios complementarios
    │     ├── Supabase (analytics, memoria, lead scoring, feedback, pagos)
    │     ├── Mercado Pago (links de pago)
    │     ├── ManyChat (notificación admin / respuestas)
    │     ├── Redis (rate limit)
    │     └── RAG + Memoria en caliente
    └── Respuesta JSON → ManyChat → Usuario final
```
**Flujo de alto nivel:**
1. ManyChat envía los campos `subscriber_id`, `first_name`, `last_input_text` y `phone` al endpoint `POST /webhook`.
2. El backend sanitiza el mensaje, detecta códigos especiales (`SENS-XXXX`, `P-XXXXX`) o intención de pago y genera respuestas automáticas o links de Mercado Pago.
3. Si no hay flujo especial, aplica rate limiting, detecta idioma, clasifica la intención/emoción y ejecuta el agente IA correspondiente con contexto de RAG y memoria.
4. Registra analíticas en Supabase, notifica al administrador en casos de escalamiento o pago y responde a ManyChat.

## 3. Requisitos previos
- **Node.js**: usa la versión definida en `package.json` (`>=18`).
- **npm** instalado.
- Cuenta y proyecto en **Supabase** con las tablas/funciones requeridas.
- Cuenta en **ManyChat** con acceso a WhatsApp y permisos para webhooks.
- Cuenta en **Mercado Pago** con credenciales de producción o sandbox.
- Clave de **OpenAI** con acceso a los modelos configurados.
- Instancia de **Redis** (Upstash, Elasticache, etc.) si se habilita `USE_REDIS=true`.

## 4. Instalación
1. Clona el repositorio:
   ```bash
   git clone https://github.com/<tu-org>/agente-ia-sensora.git
   cd agente-ia-sensora
   ```
2. Instala dependencias:
   ```bash
   npm install
   ```
3. Crea un archivo `.env` tomando como referencia `src/config/env.config.js`:
   ```env
   OPENAI_API_KEY=tu_clave_openai
   OPENAI_MODEL_CLASSIFIER=gpt-4o-mini
   OPENAI_MODEL_AGENT=gpt-4o
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
   MERCADOPAGO_ACCESS_TOKEN=tu_token_mercadopago
   MANYCHAT_API_KEY=tu_token_manychat
   ADMIN_SUBSCRIBER_ID=1234567890
   REDIS_URL=rediss://<usuario>:<password>@<host>:<puerto>
   USE_REDIS=true
   RATE_LIMIT_MAX=30
   RATE_LIMIT_WINDOW=86400
   PORT=3000
   ```
   **Descripción rápida de variables:**
   - `OPENAI_*`: credenciales y modelos usados para clasificación y generación de respuestas.
   - `SUPABASE_*`: URL y Service Role Key para operar tablas y RPC (match_sensora_knowledge).
   - `MERCADOPAGO_ACCESS_TOKEN`: token privado para crear preferencias de pago.
   - `MANYCHAT_API_KEY`: token de la API de ManyChat para enviar mensajes y notificaciones.
   - `ADMIN_SUBSCRIBER_ID`: ID del suscriptor ManyChat que recibirá alertas del bot.
   - `REDIS_URL` + `USE_REDIS`: configuran el rate limiting con Redis; si no se define se usa modo en memoria.
   - `RATE_LIMIT_MAX` y `RATE_LIMIT_WINDOW`: mensajes máximos y ventana (segundos) del rate limit.
   - `PORT`: puerto HTTP de Express.

## 5. Ejecución en local
- **Desarrollo con autoreload:**
  ```bash
  npm run dev
  ```
- **Producción / entorno simple:**
  ```bash
  npm start
  ```
- **Health check:** visita `GET http://localhost:3000/health` para verificar estado (`status`, `timestamp`, `uptime`, `environment`).