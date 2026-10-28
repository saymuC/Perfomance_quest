/**
 * Configurações da Aplicação Frontend - Performance Quest
 * 
 * Define a URL base da API REST do backend.
 * Para publicar no Cloudflare Pages, Vercel, Netlify ou GitHub Pages,
 * altere 'apiBaseUrl' para a URL pública do seu servidor (ex: https://sua-api.com/api).
 * 
 * NOTA: Não coloque tokens nem senhas neste arquivo: tudo no frontend é público.
 */

window.PERFORMANCE_QUEST_CONFIG = {
  apiBaseUrl: ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? 'http://localhost:3001/api'
    : 'https://perfomance-quest-api.onrender.com/api'
};
