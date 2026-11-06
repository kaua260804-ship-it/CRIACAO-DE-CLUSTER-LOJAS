// Camada de comunicação com o Apps Script.
// Só faz ESCRITA (POST para a aba DEPOSITO).
// A LEITURA dos clusters já definidos vem do BASE.xlsx (aba CLUSTER) via data.js.
import "./config.js";

const TIMEOUT_MS = 15000;

function getUrlBase() {
  const url = window.APP_CONFIG && window.APP_CONFIG.APPS_SCRIPT_URL;
  if (!url || typeof url !== "string" || url.trim() === "") {
    throw new Error("APPS_SCRIPT_URL não configurada em js/config.js");
  }
  return url;
}

async function salvar(payload) {
  const body = JSON.stringify({ acao: "salvar", ...payload });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    await fetch(getUrlBase(), {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
      signal: ctrl.signal,
    });
    return { ok: true };
  } catch (e) {
    throw new Error("Falha de rede ao salvar.");
  } finally {
    clearTimeout(t);
  }
}

export const api = { salvar };