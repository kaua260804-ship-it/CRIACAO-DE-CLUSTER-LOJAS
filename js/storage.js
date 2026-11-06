// Cache local de clusters. É a FONTE DE VERDADE do site enquanto o usuário
// não fizer o fluxo manual de copiar DEPOSITO → CLUSTER.
// Chave: seqProd → string "A,B,C" (mesmo formato que vai para a planilha).

const KEY = "consultaClusters.clusters.v1";

let _mapa = new Map();

export function carregarStorage() {
  _mapa = new Map();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return _mapa;
    const obj = JSON.parse(raw);
    for (const [k, v] of Object.entries(obj)) {
      _mapa.set(String(k), String(v || "").trim());
    }
  } catch (_) { /* ignora corrupção */ }
  return _mapa;
}

export function salvarNoStorage(seq, statusStr) {
  const s = String(seq);
  const v = String(statusStr || "").trim();
  if (v) _mapa.set(s, v);
  else _mapa.delete(s);
  persistir();
}

export function getMapaLocal() {
  return _mapa;
}

export function getClusterLocal(seq) {
  return _mapa.get(String(seq)) || "";
}

function persistir() {
  try {
    const obj = {};
    for (const [k, v] of _mapa) obj[k] = v;
    localStorage.setItem(KEY, JSON.stringify(obj));
  } catch (_) { /* quota cheia — ignora */ }
}

export function limparStorage() {
  _mapa = new Map();
  try { localStorage.removeItem(KEY); } catch (_) {}
}
