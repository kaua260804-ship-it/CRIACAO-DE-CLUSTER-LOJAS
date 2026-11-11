// Camada de comunicação com o Apps Script.
// Usa técnica de JSONP via imagem para driblar o CORS e evitar body limpo.
import "./config.js";

function getUrlBase() {
  const url = window.APP_CONFIG && window.APP_CONFIG.APPS_SCRIPT_URL;
  if (!url || typeof url !== "string" || url.trim() === "") {
    throw new Error("APPS_SCRIPT_URL não configurada em js/config.js");
  }
  return url;
}

// Função exportada para o bulk.js poder chamar no modo FL
export function _enviarViaGet(payload) {
  return new Promise((resolve, reject) => {
    const base = getUrlBase();
    const jsonStr = JSON.stringify(payload);
    const encoded = encodeURIComponent(jsonStr);
    
    const img = new Image();
    let timeout = setTimeout(() => {
      img.src = ""; 
      reject(new Error("Tempo esgotado ao salvar."));
    }, 30000);

    img.onload = img.onerror = () => {
      clearTimeout(timeout);
      resolve({ ok: true });
    };

    img.src = `${base}?acao=receberJson&p=${encoded}&t=${Date.now()}`;
  });
}

async function salvar(payload) {
  return _enviarViaGet({ acao: "salvar", ...payload });
}

async function salvarLote(itens) {
  if (!Array.isArray(itens) || itens.length === 0) return { ok: true, total: 0 };
  return _enviarViaGet({ acao: "salvarLote", itens });
}

export const api = { salvar, salvarLote, _enviarViaGet };