// Camada de comunicação com o Web App do Apps Script.
// Estratégia: fetch normal (CORS), sem JSONP, sem no-cors para leitura.
// O POST funciona cross-origin porque Content-Type: text/plain não dispara preflight.
// O GET funciona se o deploy estiver "Executar como Eu" + "Qualquer pessoa".
import "./config.js";

const TIMEOUT_MS = 15000;

function getUrlBase() {
  const url = window.APP_CONFIG && window.APP_CONFIG.APPS_SCRIPT_URL;
  if (!url || typeof url !== "string" || url.trim() === "") {
    throw new Error("APPS_SCRIPT_URL não configurada em js/config.js");
  }
  return url;
}

function fetchComTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

async function lerJson(res) {
  const texto = await res.text();
  try {
    return JSON.parse(texto);
  } catch (_) {
    if (texto.trim().startsWith("<")) {
      throw new Error(
        "Resposta HTML recebida. O Web App provavelmente está restrito. " +
        "Reimplante como 'Executar como Eu' + 'Qualquer pessoa'."
      );
    }
    throw new Error("Resposta inválida: " + texto.slice(0, 120));
  }
}

async function listar() {
  let res;
  try {
    res = await fetchComTimeout(`${getUrlBase()}?acao=listar`, { cache: "no-store" });
  } catch (e) {
    throw new Error("CORS/rede ao listar. Confirme o deploy como 'Qualquer pessoa'.");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await lerJson(res);
  if (!json.ok) throw new Error(json.erro || "Falha ao listar");
  return json.dados || [];
}

async function consultar(seq) {
  let res;
  try {
    res = await fetchComTimeout(
      `${getUrlBase()}?acao=consultar&seq=${encodeURIComponent(seq)}`,
      { cache: "no-store" }
    );
  } catch (e) {
    throw new Error("CORS/rede ao consultar. Confirme o deploy como 'Qualquer pessoa'.");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await lerJson(res);
  if (!json.ok) throw new Error(json.erro || "Falha ao consultar");
  return json.dados || null;
}

async function salvar(payload) {
  let res;
  try {
    res = await fetchComTimeout(getUrlBase(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ acao: "salvar", ...payload }),
    });
  } catch (e) {
    throw new Error("CORS/rede ao salvar. Confirme o deploy como 'Qualquer pessoa'.");
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await lerJson(res);
  if (!json.ok) throw new Error(json.erro || "Falha ao salvar");
  return json;
}

export const api = { listar, consultar, salvar };
