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

// GET tolerante: tenta leitura normal; se falhar por CORS, refaz em no-cors.
// Em no-cors a resposta não é legível, então retornamos { ok: true, dados: null, opaco: true }.
// Quem usa a informação (polling) decide o que fazer com opaco.
async function getJson(url) {
  try {
    const res = await fetchComTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await lerJson(res);
    if (!json.ok) throw new Error(json.erro || "Falha na resposta");
    return { ok: true, dados: json.dados };
  } catch (err) {
    // fallback: dispara sem ler a resposta para evitar erro no console
    try {
      await fetch(url, { method: "GET", mode: "no-cors", cache: "no-store" });
    } catch (_) { /* ignora */ }
    return { ok: false, opaco: true, erro: err.message };
  }
}

async function listar() {
  const r = await getJson(`${getUrlBase()}?acao=listar`);
  if (!r.ok) throw new Error(r.erro || "Falha ao listar");
  return r.dados || [];
}

async function consultar(seq) {
  const r = await getJson(`${getUrlBase()}?acao=consultar&seq=${encodeURIComponent(seq)}`);
  if (!r.ok) throw new Error(r.erro || "Falha ao consultar");
  return r.dados || null;
}

// POST via no-cors: garante o efeito no servidor sem erro no console.
// A confirmação é feita por um GET ?acao=consultar depois.
async function salvar(payload) {
  const url = getUrlBase();
  const body = JSON.stringify({ acao: "salvar", ...payload });

  // 1) Dispara o POST sem tentar ler a resposta.
  //    Em GAS o redirect 302 quebra o CORS, então no-cors é a única via silenciosa.
  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
    });
  } catch (_) {
    // Se falhar até em no-cors, é problema real de rede — propaga.
    throw new Error("Falha de rede ao enviar a gravação.");
  }

  // 2) Confirma a gravação via GET. Pequeno atraso para o servidor processar.
  await new Promise(r => setTimeout(r, 600));

  try {
    const atual = await consultar(payload.seqProd);
    if (atual && String(atual["SEQ PROD"]).trim() === String(payload.seqProd).trim()) {
      return { ok: true, confirmado: true };
    }
    // Sem confirmação explícita, mas POST foi disparado: consideramos OK
    // (o polling acaba refletindo o estado real em até 15s).
    return { ok: true, confirmado: false };
  } catch (_) {
    return { ok: true, confirmado: false };
  }
}

export const api = { listar, consultar, salvar, ping: () => getJson(`${getUrlBase()}?acao=ping`) };
