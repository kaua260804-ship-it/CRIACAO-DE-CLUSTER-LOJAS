// "Fonte de verdade" dos clusters = aba CLUSTER do BASE.xlsx (carregada em data.js).
// O localStorage é apenas cache/otimização. O site NÃO faz polling de rede:
// a SAÍDA (POST) continua indo para a aba DEPOSITO via Apps Script.
// O nome do arquivo foi mantido para não quebrar imports em main.js.
import { carregarStorage, getMapaLocal } from "./storage.js";
import { getMapaClustersPlanilha } from "./data.js";

let _onUpdate = () => {};
let _ultimaAtualizacao = 0;

function _mapaCombinado() {
  const m = new Map(getMapaClustersPlanilha());
  for (const [k, v] of getMapaLocal()) {
    if (!m.has(k)) m.set(k, v);
  }
  return m;
}

export function inicializarPolling({ onUpdate }) {
  _onUpdate = onUpdate;
  carregarStorage();
  _ultimaAtualizacao = Date.now();
  _onUpdate(_mapaCombinado());
  atualizarRodape();

  setInterval(() => {
    if (!document.hidden) atualizarRodape();
  }, 5000);

  window.addEventListener("storage", (e) => {
    if (e.key === "consultaClusters.clusters.v1") {
      carregarStorage();
      _ultimaAtualizacao = Date.now();
      _onUpdate(_mapaCombinado());
    }
  });
}

export function getMapaCluster() {
  return _mapaCombinado();
}

export function atualizarMapaLocal(mapa) {
  _ultimaAtualizacao = Date.now();
  _onUpdate(mapa);
  atualizarRodape();
}

function atualizarRodape() {
  const el = document.getElementById("pollStatus");
  if (!el) return;
  if (!_ultimaAtualizacao) { el.textContent = "Aguardando…"; return; }
  const seg = Math.floor((Date.now() - _ultimaAtualizacao) / 1000);
  el.textContent = `Atualizado há ${seg}s (BASE.xlsx · aba CLUSTER)`;
}