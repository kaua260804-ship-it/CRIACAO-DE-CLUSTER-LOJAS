// Não faz mais polling de rede. A "fonte de verdade" é o localStorage.
// O nome foi mantido para não quebrar imports de main.js, mas a API mudou.
import { carregarStorage, getMapaLocal } from "./storage.js";

let _onUpdate = () => {};
let _ultimaAtualizacao = 0;

export function inicializarPolling({ onUpdate }) {
  _onUpdate = onUpdate;
  carregarStorage();
  _ultimaAtualizacao = Date.now();
  _onUpdate(getMapaLocal());
  atualizarRodape("ok");

  // Atualiza o rodapé a cada 5s sem travar nada.
  setInterval(() => {
    if (!document.hidden) atualizarRodape("ok");
  }, 5000);

  // Sincroniza entre abas do mesmo navegador.
  window.addEventListener("storage", (e) => {
    if (e.key === "consultaClusters.clusters.v1") {
      carregarStorage();
      _ultimaAtualizacao = Date.now();
      _onUpdate(getMapaLocal());
    }
  });
}

export function getMapaCluster() { return getMapaLocal(); }

export function atualizarMapaLocal(mapa) {
  _ultimaAtualizacao = Date.now();
  _onUpdate(mapa);
  atualizarRodape("ok");
}

function atualizarRodape(estado) {
  const el = document.getElementById("pollStatus");
  if (!el) return;
  if (!_ultimaAtualizacao) { el.textContent = "Aguardando…"; return; }
  const seg = Math.floor((Date.now() - _ultimaAtualizacao) / 1000);
  el.textContent = `Atualizado há ${seg}s (local)`;
}
