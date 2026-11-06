// Camada de comunicação com o Web App do Apps Script.
import "./config.js";

const TIMEOUT_MS = 10000;

function getUrlBase() {
  const url = window.APP_CONFIG && window.APP_CONFIG.APPS_SCRIPT_URL;
  if (!url || url === "COLE_AQUI_A_URL_DO_WEB_APP") {
    throw new Error("APPS_SCRIPT_URL não configurada em js/config.js");
  }
  return url;
}

function fetchComTimeout(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// O GAS pode devolver texto/HTML quando a implantação está mal configurada.
// Nesse caso, tentamos extrair JSON; se não der, lançamos erro claro.
async function lerJson(res) {
  const texto = await res.text();
  try {
    return JSON.parse(texto);
  } catch (_) {
    if (texto.trim().startsWith("<")) {
      throw new Error(
        "Resposta HTML recebida do Apps Script. Verifique se o Web App está " +
        "publicado como 'Qualquer pessoa' e se a URL em js/config.js é a implantação mais recente."
      );
    }
    throw new Error("Resposta inválida do Apps Script: " + texto.slice(0, 120));
  }
}

async function listar() {
  let res;
  try {
    res = await fetchComTimeout(`${getUrlBase()}?acao=listar`);
  } catch (e) {
    throw new Error(
      "Falha de rede/CORS ao chamar o Apps Script. Confirme o deploy como " +
      "'Executar como Eu' e 'Qualquer pessoa'."
    );
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await lerJson(res);
  if (!json.ok) throw new Error(json.erro || "Falha ao listar");
  return json.dados || [];
}

async function consultar(seq) {
  let res;
  try {
    res = await fetchComTimeout(`${getUrlBase()}?acao=consultar&seq=${encodeURIComponent(seq)}`);
  } catch (e) {
    throw new Error(
      "Falha de rede/CORS ao chamar o Apps Script. Confirme o deploy como " +
      "'Executar como Eu' e 'Qualquer pessoa'."
    );
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
    throw new Error(
      "Falha de rede/CORS ao chamar o Apps Script. Confirme o deploy como " +
      "'Executar como Eu' e 'Qualquer pessoa'."
    );
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await lerJson(res);
  if (!json.ok) throw new Error(json.erro || "Falha ao salvar");
  return json;
}

export const api = { listar, consultar, salvar };