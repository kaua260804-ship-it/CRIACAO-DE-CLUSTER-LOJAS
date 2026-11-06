// Camada de comunicação com o Web App do Apps Script.
// Estratégia: JSONP (script tag) para leitura e GET com querystring para
// escrita. Isso contorna 100% dos problemas de CORS/redirect 302 do GAS.
import "./config.js";

const TIMEOUT_MS = 15000;
let _jsonpSeq = 0;

function getUrlBase() {
  const url = window.APP_CONFIG && window.APP_CONFIG.APPS_SCRIPT_URL;
  if (!url || url === "https://script.google.com/macros/s/AKfycbyTVkrCKYFJS_8qUKQw7z1V88pvekPWWCb2XVzMBciOPLb6DnikeMmN_W-VwNQNe3jgLQ/exec") {
    throw new Error("APPS_SCRIPT_URL não configurada em js/config.js");
  }
  return url;
}

// ---------- JSONP ----------
function jsonp(params) {
  return new Promise((resolve, reject) => {
    const cbName = "__jsonp_cb_" + (++_jsonpSeq) + "_" + Date.now();
    const qs = new URLSearchParams({ ...params, callback: cbName }).toString();
    const script = document.createElement("script");
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout na comunicação com o Apps Script."));
    }, TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[cbName]; } catch (_) { window[cbName] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[cbName] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error("Falha de rede (JSONP).")); };
    script.src = `${getUrlBase()}?${qs}`;
    document.head.appendChild(script);
  });
}

// ---------- GET simples para escrita (redirect 302 preserva querystring) ----------
async function getSimples(params) {
  const qs = new URLSearchParams(params).toString();
  const url = `${getUrlBase()}?${qs}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // no-cors: só dispara; a confirmação vem por jsonp(consultar) depois.
    await fetch(url, { method: "GET", mode: "no-cors", cache: "no-store", signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// ---------- API pública ----------
async function listar() {
  const json = await jsonp({ acao: "listar" });
  if (!json || !json.ok) throw new Error(json && json.erro || "Falha ao listar");
  return json.dados || [];
}

async function consultar(seq) {
  const json = await jsonp({ acao: "consultar", seq: String(seq) });
  if (!json || !json.ok) throw new Error(json && json.erro || "Falha ao consultar");
  return json.dados || null;
}

async function salvar(payload) {
  // 1) Dispara a gravação via GET (querystring sobrevive ao 302 do GAS).
  await getSimples({
    acao: "salvar",
    seqProd: payload.seqProd,
    desc: payload.desc || "",
    embalagem: payload.embalagem || "",
    categoria: payload.categoria || "",
    grupo: payload.grupo || "",
    subgrupo: payload.subgrupo || "",
    subgrupo1: payload.subgrupo1 || "",
    subgrupo2: payload.subgrupo2 || "",
    status: payload.status || "",
  });

  // 2) Confirma via JSONP (leitura confiável).
  await new Promise(r => setTimeout(r, 700));
  try {
    const atual = await consultar(payload.seqProd);
    if (atual && String(atual["SEQ PROD"]).trim() === String(payload.seqProd).trim()) {
      const statusSalvo = String(atual["STATUS"] || "").trim();
      const statusEsperado = String(payload.status || "").trim();
      return { ok: true, confirmado: statusSalvo === statusEsperado, dados: atual };
    }
  } catch (_) { /* cai no retorno abaixo */ }
  return { ok: true, confirmado: false };
}

export const api = { listar, consultar, salvar, ping: () => jsonp({ acao: "ping" }) };
