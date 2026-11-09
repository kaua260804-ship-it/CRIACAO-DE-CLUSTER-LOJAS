// Camada de comunicação com o Apps Script.
import "./config.js";

const TIMEOUT_MS = 30000;

function getUrlBase() {
  const url = window.APP_CONFIG && window.APP_CONFIG.APPS_SCRIPT_URL;
  if (!url || typeof url !== "string" || url.trim() === "") {
    throw new Error("APPS_SCRIPT_URL não configurada em js/config.js");
  }
  return url;
}

async function _post(payload) {
  // Usar URLSearchParams é a forma mais segura de enviar dados via no-cors
  // O Apps Script vai receber isso em e.parameter.payload
  const formData = new URLSearchParams();
  formData.append("payload", JSON.stringify(payload));

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  
  try {
    await fetch(getUrlBase(), {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
      signal: ctrl.signal,
    });
    return { ok: true };
  } catch (e) {
    throw new Error("Falha de rede ao salvar.");
  } finally {
    clearTimeout(t);
  }
}

async function salvar(payload) {
  return _post({ acao: "salvar", ...payload });
}

async function salvarLote(itens) {
  if (!Array.isArray(itens) || itens.length === 0) return { ok: true, total: 0 };
  return _post({ acao: "salvarLote", itens });
}

export const api = { salvar, salvarLote };