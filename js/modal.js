// Modal "Definir cluster" com múltipla escolha (checkboxes).
import { api } from "./api.js";
import { getProduto } from "./data.js";
import { getClustersAtuais, setClustersAtuais, _normalizarLista } from "./filters.js";
import { atualizarClustersVisiveis } from "./table.js";

const TIPOS = ["EMPORIO G", "EMPORIO M", "EMPORIO P", "MERCEARIA M", "MERCEARIA P"];

let _seqAtual = null;
let _onSaved = () => {};

export function inicializarModal({ onSaved }) {
  _onSaved = onSaved;
  const modal = document.getElementById("modalCluster");
  const btnCancel = document.getElementById("modalCancel");
  const btnSave = document.getElementById("modalSave");
  const backdrop = modal.querySelector(".modal__backdrop");

  btnCancel.addEventListener("click", fecharModal);
  backdrop.addEventListener("click", fecharModal);
  btnSave.addEventListener("click", salvar);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !modal.hidden) fecharModal();
  });
}

export function abrirModal(seq) {
  const p = getProduto(seq);
  if (!p) return;
  _seqAtual = seq;
  const modal = document.getElementById("modalCluster");
  document.getElementById("modalClusterProduct").textContent =
    `${p.seqProd} — ${p.desc}${p.embalagem ? " · " + p.embalagem : ""}`;

  const atuais = getClustersAtuais(seq);
  const container = document.getElementById("modalClusterChecks");
  container.innerHTML = TIPOS.map(t => `
    <label class="check">
      <input type="checkbox" value="${escapeAttr(t)}" ${atuais.includes(t) ? "checked" : ""} />
      <span>${escapeHtml(t)}</span>
    </label>
  `).join("");

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  setTimeout(() => {
    const first = container.querySelector("input");
    if (first) first.focus();
  }, 30);
}

function fecharModal() {
  const modal = document.getElementById("modalCluster");
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  _seqAtual = null;
}

async function salvar() {
  if (!_seqAtual) return;
  const p = getProduto(_seqAtual);
  if (!p) return;

  const container = document.getElementById("modalClusterChecks");
  const selecionados = [...container.querySelectorAll("input[type=checkbox]:checked")]
    .map(i => i.value);
  const lista = _normalizarLista(selecionados);
  const statusStr = lista.join(",");

  const btn = document.getElementById("modalSave");
  btn.disabled = true;
  try {
    const res = await api.salvar({
      seqProd: p.seqProd,
      desc: p.desc,
      embalagem: p.embalagem,
      categoria: p.categoria,
      grupo: p.grupo,
      subgrupo: p.subgrupo,
      subgrupo1: p.subgrupo1,
      subgrupo2: p.subgrupo2,
      status: statusStr,
    });

    if (!res.confirmado) {
      toast("Enviado, mas não foi possível confirmar. Verifique em alguns segundos.", "warn");
    } else {
      toast("Cluster salvo com sucesso.", "success");
    }

    // Atualiza estado local de qualquer forma (o polling vai reconciliar)
    setClustersAtuais(p.seqProd, lista);
    if (window.__clusterMap) window.__clusterMap.set(String(p.seqProd), lista.join(","));
    atualizarClustersVisiveis();
    fecharModal();
    _onSaved();
  } catch (err) {
    console.error(err);
    toast("Falha ao salvar: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

export function toast(msg, tipo = "info") {
  const box = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = `toast toast--${tipo}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[m]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }
