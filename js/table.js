// Renderização paginada + tooltip de lojas (únicas, agrupadas por TIPO) + coluna cluster (N chips).
import { filtrar, getClustersAtuais, _normalizarLista } from "./filters.js";

const POR_PAGINA = 50;
const ORDEM_TIPO = ["EMPORIO G", "EMPORIO M", "EMPORIO P", "MERCEARIA M", "MERCEARIA P"];

let _produtos = [];
let _pagina = 1;
let _onDefineCluster = () => {};

export function inicializarTabela({ onDefineCluster }) {
  _onDefineCluster = onDefineCluster;
  document.getElementById("tableBody").addEventListener("click", onClickTabela);
  document.getElementById("tableBody").addEventListener("mouseover", onHoverStatus);
  document.getElementById("tableBody").addEventListener("focusin", onHoverStatus);
  document.getElementById("tableBody").addEventListener("touchstart", onTouchStatus, { passive: true });
  document.addEventListener("click", e => {
    const tt = document.getElementById("tooltip");
    if (!tt.hidden && !tt.contains(e.target) && !e.target.closest(".status")) esconderTooltip();
  });
}

export function renderTabela(produtosBase) {
  _produtos = filtrar(produtosBase);
  _pagina = 1;
  renderPagina();
}

export function atualizarClustersVisiveis() {
  const linhas = document.querySelectorAll("#tableBody tr[data-seq]");
  for (const tr of linhas) {
    const seq = tr.dataset.seq;
    const cel = tr.querySelector(".cell-cluster");
    if (!cel) continue;
    cel.innerHTML = clusterHtml(seq);
  }
}

export function totalFiltrado() { return _produtos.length; }

function renderPagina() {
  const tbody = document.getElementById("tableBody");
  const empty = document.getElementById("emptyState");
  const table = document.getElementById("productsTable");
  const count = document.getElementById("resultsCount");

  count.textContent = `${_produtos.length} produto(s)`;
  const totalPag = Math.max(1, Math.ceil(_produtos.length / POR_PAGINA));
  if (_pagina > totalPag) _pagina = totalPag;

  if (_produtos.length === 0) {
    tbody.innerHTML = "";
    table.hidden = true;
    empty.hidden = false;
    renderPaginacao(0);
    return;
  }
  table.hidden = false;
  empty.hidden = true;

  const ini = (_pagina - 1) * POR_PAGINA;
  const fim = ini + POR_PAGINA;
  const fatia = _produtos.slice(ini, fim);

  tbody.innerHTML = fatia.map(p => linhaHtml(p)).join("");
  renderPaginacao(totalPag);
}

function clusterHtml(seq) {
  const arr = getClustersAtuais(seq);
  if (!arr.length) return `<span class="cluster-tag cluster-tag--empty">Sem cluster</span>`;
  return arr.map(c => `<span class="cluster-tag">${escapeHtml(c)}</span>`).join(" ");
}

function linhaHtml(p) {
  const statusCls = p.status === "COM VENDA" ? "status--com" : "status--sem";
  const interativo = p.status === "COM VENDA" || p.status === "SEM VENDA";

  return `
    <tr data-seq="${escapeAttr(p.seqProd)}">
      <td class="col-seq">${escapeHtml(p.seqProd)}</td>
      <td class="col-desc" title="${escapeAttr(p.desc)}">${escapeHtml(p.desc)}</td>
      <td>${escapeHtml(p.embalagem)}</td>
      <td>${escapeHtml(p.categoria)}</td>
      <td>${escapeHtml(p.grupo)}</td>
      <td>${escapeHtml(p.subgrupo)}</td>
      <td>
        <span class="status ${statusCls}" tabindex="0" data-interactive="${interativo}" data-seq="${escapeAttr(p.seqProd)}">
          ${escapeHtml(p.status || "—")}
        </span>
      </td>
      <td class="cell-cluster">${clusterHtml(p.seqProd)}</td>
      <td>
        <button class="btn btn--sm btn--secondary" data-action="definir" data-seq="${escapeAttr(p.seqProd)}">Definir cluster</button>
      </td>
    </tr>`;
}

function renderPaginacao(totalPag) {
  const nav = document.getElementById("pagination");
  if (totalPag <= 1) { nav.innerHTML = ""; return; }
  const partes = [];
  partes.push(`<button type="button" data-page="prev" ${_pagina === 1 ? "disabled" : ""} aria-label="Página anterior">‹</button>`);
  const janela = 2;
  const paginas = new Set([1, totalPag]);
  for (let i = _pagina - janela; i <= _pagina + janela; i++) if (i >= 1 && i <= totalPag) paginas.add(i);
  const ordenadas = [...paginas].sort((a, b) => a - b);
  let anterior = 0;
  for (const p of ordenadas) {
    if (p - anterior > 1) partes.push(`<span class="pagination__info">…</span>`);
    partes.push(`<button type="button" data-page="${p}" ${p === _pagina ? 'aria-current="page"' : ""}>${p}</button>`);
    anterior = p;
  }
  partes.push(`<button type="button" data-page="next" ${_pagina === totalPag ? "disabled" : ""} aria-label="Próxima página">›</button>`);
  nav.innerHTML = partes.join("");
  nav.querySelectorAll("button[data-page]").forEach(btn => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.page;
      if (v === "prev") _pagina = Math.max(1, _pagina - 1);
      else if (v === "next") _pagina = Math.min(totalPag, _pagina + 1);
      else _pagina = Number(v);
      renderPagina();
    });
  });
}

function onClickTabela(e) {
  const btn = e.target.closest("button[data-action='definir']");
  if (btn) {
    const seq = btn.dataset.seq;
    _onDefineCluster(seq);
  }
}

// ---------- Tooltip de STATUS (lojas únicas, agrupadas por TIPO) ----------
function onHoverStatus(e) {
  const el = e.target.closest(".status");
  if (!el || el.dataset.interactive !== "true") return;
  mostrarTooltipStatus(el);
}
function onTouchStatus(e) {
  const el = e.target.closest(".status");
  if (!el || el.dataset.interactive !== "true") return;
  mostrarTooltipStatus(el);
}

function mostrarTooltipStatus(el) {
  const seq = el.dataset.seq;
  const linha = _produtos.find(p => p.seqProd === seq);
  if (!linha) return;

  const tt = document.getElementById("tooltip");

  if (linha.status === "SEM VENDA" || !linha.vendas.length) {
    tt.innerHTML = `<div class="tooltip__title">Sem vendas registradas</div>`;
  } else {
    const porLoja = new Map();
    for (const v of linha.vendas) {
      const loja = v.loja;
      if (!loja) continue;
      if (!porLoja.has(loja)) {
        porLoja.set(loja, linha.tipoPorLoja.get(loja) || "");
      }
    }

    const grupos = new Map();
    for (const [loja, tipo] of porLoja) {
      const t = tipo || "SEM TIPO";
      if (!grupos.has(t)) grupos.set(t, []);
      grupos.get(t).push(loja);
    }

    const tiposOrdenados = [...grupos.keys()].sort((a, b) => {
      const ia = ORDEM_TIPO.indexOf(a);
      const ib = ORDEM_TIPO.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, "pt-BR");
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    const blocos = tiposOrdenados.map(tipo => {
      const lojas = grupos.get(tipo).slice().sort((a, b) => a.localeCompare(b, "pt-BR"));
      const itens = lojas.map(l => `<li><span>${escapeHtml(l)}</span></li>`).join("");
      return `<div class="tooltip__group">
        <div class="tooltip__group-title">${escapeHtml(tipo)}</div>
        <ul class="tooltip__list">${itens}</ul>
      </div>`;
    }).join("");

    const totalLojas = porLoja.size;
    tt.innerHTML = `
      <div class="tooltip__title">Lojas com venda (${totalLojas})</div>
      ${blocos}`;
  }

  tt.hidden = false;
  tt.classList.add("is-open");

  const rect = el.getBoundingClientRect();
  const ttRect = tt.getBoundingClientRect();
  let top = rect.top - ttRect.height - 8;
  if (top < 8) top = rect.bottom + 8;
  let left = rect.left;
  if (left + ttRect.width > window.innerWidth - 8) {
    left = window.innerWidth - ttRect.width - 8;
  }
  tt.style.top = `${top}px`;
  tt.style.left = `${left}px`;
}

function esconderTooltip() {
  const tt = document.getElementById("tooltip");
  tt.classList.remove("is-open");
  tt.hidden = true;
}

// ---------- utils ----------
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[m]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }