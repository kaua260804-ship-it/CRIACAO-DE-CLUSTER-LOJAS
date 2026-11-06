// Loop de 15s consultando o Apps Script (acao=listar); pausa em aba oculta.
import { api } from "./api.js";

const INTERVALO_MS = 15000;

let _timer = null;
let _ultimaAtualizacao = 0;
let _onUpdate = () => {};
let _mapaCluster = new Map(); // seq -> "EMPORIO G,MERCEARIA M" (string bruta)

export function inicializarPolling({ onUpdate }) {
  _onUpdate = onUpdate;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pararTimer();
    else { tick(); iniciarTimer(); }
  });
  iniciarTimer();
}

export function getMapaCluster() { return _mapaCluster; }

function iniciarTimer() {
  pararTimer();
  _timer = setInterval(tick, INTERVALO_MS);
  tick();
}

function pararTimer() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

let _tentativasErro = 0;

async function tick() {
  if (document.hidden) return;
  try {
    const dados = await api.listar();
    _mapaCluster = new Map();
    for (const r of dados) {
      const seq = String(r["SEQ PROD"] || r.seqProd || "").trim();
      const status = String(r["STATUS"] || r.status || "").trim();
      if (seq) _mapaCluster.set(seq, status); // status pode ser "A,B" ou ""
    }
    _ultimaAtualizacao = Date.now();
    _tentativasErro = 0;
    atualizarRodape();
    _onUpdate(_mapaCluster);
  } catch (err) {
    _tentativasErro++;
    console.warn("Polling falhou:", err.message);
    if (_tentativasErro <= 3) {
      setTimeout(() => { if (!document.hidden) tick(); }, 3000 * _tentativasErro);
    }
    atualizarRodape(true);
  }
}

function atualizarRodape(comErro = false) {
  const el = document.getElementById("pollStatus");
  if (!el) return;
  if (comErro) { el.textContent = "Falha na atualização automática — tentando novamente…"; return; }
  if (!_ultimaAtualizacao) { el.textContent = "Aguardando atualização…"; return; }
  const seg = Math.floor((Date.now() - _ultimaAtualizacao) / 1000);
  el.textContent = `Atualizado há ${seg}s`;
  setTimeout(() => {
    if (!document.hidden && !comErro) atualizarRodape();
  }, 1000);
}