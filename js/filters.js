// Estado dos filtros + mapa de clusters (N clusters por produto, separados por vírgula).
// Filtros DINÂMICOS: as opções de cada dropdown dependem dos demais filtros ativos.
import { listasParaFiltro, getEstado } from "./data.js";

const STORAGE_KEY = "consultaClusters.filtros.v1";
const TIPOS_CLUSTER = ["EMPORIO G", "EMPORIO M", "EMPORIO P", "MERCEARIA M", "MERCEARIA P"];
const OPCOES_STATUS = ["COM VENDA", "SEM VENDA"];

const estado = {
  texto: "",
  categoria: "",
  grupo: "",
  subgrupo: "",
  status: "TODOS",
  cluster: "TODOS",
};

let onChange = () => {};

export function inicializarFiltros(handler) {
  onChange = handler;

  try {
    const salvo = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (salvo && typeof salvo === "object") Object.assign(estado, salvo);
  } catch (_) { /* ignore */ }

  repopularTodos();

  document.getElementById("fSearch").value = estado.texto;
  document.getElementById("fCategoria").value = estado.categoria;
  document.getElementById("fGrupo").value = estado.grupo;
  document.getElementById("fSubgrupo").value = estado.subgrupo;
  document.getElementById("fStatus").value = estado.status;
  document.getElementById("fCluster").value = estado.cluster;

  document.getElementById("fSearch").addEventListener("input", e => {
    estado.texto = e.target.value;
    sincronizarOpcoes(); persistir(); onChange();
  });
  document.getElementById("fCategoria").addEventListener("change", e => {
    estado.categoria = e.target.value;
    sincronizarOpcoes(); persistir(); onChange();
  });
  document.getElementById("fGrupo").addEventListener("change", e => {
    estado.grupo = e.target.value;
    sincronizarOpcoes(); persistir(); onChange();
  });
  document.getElementById("fSubgrupo").addEventListener("change", e => {
    estado.subgrupo = e.target.value;
    sincronizarOpcoes(); persistir(); onChange();
  });
  document.getElementById("fStatus").addEventListener("change", e => {
    estado.status = e.target.value;
    sincronizarOpcoes(); persistir(); onChange();
  });
  document.getElementById("fCluster").addEventListener("change", e => {
    estado.cluster = e.target.value;
    sincronizarOpcoes(); persistir(); onChange();
  });
  document.getElementById("btnClear").addEventListener("click", limpar);

  onChange();
}

/* ---------------- Filtros dinâmicos ---------------- */

function produtosFiltrados(exceto) {
  const { produtos } = getEstado();
  const q = estado.texto.trim().toLowerCase();

  return produtos.filter(p => {
    if (exceto !== "texto" && q) {
      const hay = `${p.desc} ${p.descRed} ${p.seqProd}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (exceto !== "categoria" && estado.categoria && p.categoria !== estado.categoria) return false;
    if (exceto !== "grupo" && estado.grupo && p.grupo !== estado.grupo) return false;
    if (exceto !== "subgrupo" && estado.subgrupo && p.subgrupo !== estado.subgrupo) return false;
    if (exceto !== "status" && estado.status !== "TODOS" && p.status !== estado.status) return false;

    if (exceto !== "cluster" && estado.cluster !== "TODOS") {
      const arr = getClustersAtuais(p.seqProd);
      if (estado.cluster === "SEM CLUSTER") {
        if (arr.length > 0) return false;
      } else {
        if (!arr.includes(estado.cluster)) return false;
      }
    }
    return true;
  });
}

function unicosOrdenados(valores) {
  const set = new Set();
  for (const v of valores) {
    const s = String(v || "").trim();
    if (s) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function sincronizarOpcoes() {
  const cats = unicosOrdenados(produtosFiltrados("categoria").map(p => p.categoria));
  repopular("fCategoria", cats, "TODAS", "TODAS");
  if (estado.categoria && !cats.includes(estado.categoria)) estado.categoria = "";

  const grus = unicosOrdenados(produtosFiltrados("grupo").map(p => p.grupo));
  repopular("fGrupo", grus, "TODOS", "TODOS");
  if (estado.grupo && !grus.includes(estado.grupo)) estado.grupo = "";

  const subs = unicosOrdenados(produtosFiltrados("subgrupo").map(p => p.subgrupo));
  repopular("fSubgrupo", subs, "TODOS", "TODOS");
  if (estado.subgrupo && !subs.includes(estado.subgrupo)) estado.subgrupo = "";

  const statusDisponiveis = unicosOrdenados(
    produtosFiltrados("status").map(p => p.status).filter(s => OPCOES_STATUS.includes(s))
  );
  repopular("fStatus", statusDisponiveis, "TODOS", "TODOS");
  if (estado.status !== "TODOS" && !statusDisponiveis.includes(estado.status)) estado.status = "TODOS";

  const prodsSemClusterExceto = produtosFiltrados("cluster");
  const clustersPresentes = new Set();
  let temSemCluster = false;
  for (const p of prodsSemClusterExceto) {
    const arr = getClustersAtuais(p.seqProd);
    if (arr.length === 0) temSemCluster = true;
    for (const c of arr) if (TIPOS_CLUSTER.includes(c)) clustersPresentes.add(c);
  }
  const opcoesCluster = TIPOS_CLUSTER.filter(c => clustersPresentes.has(c));
  if (temSemCluster) opcoesCluster.push("SEM CLUSTER");
  repopular("fCluster", opcoesCluster, "TODOS", "TODOS");
  if (estado.cluster !== "TODOS" && !opcoesCluster.includes(estado.cluster)) estado.cluster = "TODOS";

  document.getElementById("fCategoria").value = estado.categoria;
  document.getElementById("fGrupo").value = estado.grupo;
  document.getElementById("fSubgrupo").value = estado.subgrupo;
  document.getElementById("fStatus").value = estado.status;
  document.getElementById("fCluster").value = estado.cluster;
}

function repopular(id, valores, primeiroLabel, primeiroValor) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = "";
  const primeira = document.createElement("option");
  primeira.value = primeiroValor;
  primeira.textContent = primeiroLabel;
  sel.appendChild(primeira);
  for (const v of valores) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  }
}

function repopularTodos() {
  const { categorias, grupos, subgrupos } = listasParaFiltro();
  repopular("fCategoria", categorias, "TODAS", "TODAS");
  repopular("fGrupo", grupos, "TODOS", "TODOS");
  repopular("fSubgrupo", subgrupos, "TODOS", "TODOS");
  repopular("fStatus", OPCOES_STATUS, "TODOS", "TODOS");
  repopular("fCluster", [...TIPOS_CLUSTER, "SEM CLUSTER"], "TODOS", "TODOS");
}

function persistir() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(estado)); } catch (_) {}
}

export function getFiltros() { return { ...estado }; }

export function limpar() {
  estado.texto = "";
  estado.categoria = "";
  estado.grupo = "";
  estado.subgrupo = "";
  estado.status = "TODOS";
  estado.cluster = "TODOS";

  document.getElementById("fSearch").value = "";
  repopularTodos();

  document.getElementById("fCategoria").value = "";
  document.getElementById("fGrupo").value = "";
  document.getElementById("fSubgrupo").value = "";
  document.getElementById("fStatus").value = "TODOS";
  document.getElementById("fCluster").value = "TODOS";

  persistir();
  onChange();
}

/* ---------------- Helpers para "Aplicar em massa" ---------------- */

// true se pelo menos um dos filtros (exceto "Buscar", que conta se não for vazio) está ativo
export function temFiltroAtivo() {
  return (
    estado.texto.trim() !== "" ||
    estado.categoria !== "" ||
    estado.grupo !== "" ||
    estado.subgrupo !== "" ||
    estado.status !== "TODOS" ||
    estado.cluster !== "TODOS"
  );
}

// quantos produtos passam pelos filtros atuais
export function contarFiltrados() {
  return produtosFiltrados(null).length;
}

// Lista dos produtos filtrados (com o objeto completo)
export function listarFiltrados() {
  return produtosFiltrados(null);
}

export function getTiposCluster() { return TIPOS_CLUSTER.slice(); }

/* ---------------- Mapa de clusters ---------------- */

const _clusterMap = new Map();

export function aplicarOverridesMap(mapa) {
  _clusterMap.clear();
  for (const [k, v] of mapa) {
    _clusterMap.set(String(k), _normalizarLista(v));
  }
  sincronizarOpcoes();
}

export function getClustersAtuais(seq) {
  return _clusterMap.get(String(seq)) || [];
}

export function setClustersAtuais(seq, clusters) {
  const arr = _normalizarLista(clusters);
  if (arr.length === 0) _clusterMap.delete(String(seq));
  else _clusterMap.set(String(seq), arr);
}

export function _normalizarLista(v) {
  let arr = [];
  if (Array.isArray(v)) arr = v.map(x => String(x).trim());
  else if (typeof v === "string") arr = v.split(",").map(x => String(x).trim());
  const vistos = new Set();
  const out = [];
  for (const x of arr) {
    if (x && !vistos.has(x)) { vistos.add(x); out.push(x); }
  }
  return out;
}

export function getClusterAtual(seq) {
  const arr = getClustersAtuais(seq);
  return arr.length ? arr[0] : "";
}

export function setClusterAtual(seq, cluster) {
  if (!cluster) setClustersAtuais(seq, []);
  else setClustersAtuais(seq, [cluster]);
}

/* ---------------- Filtro efetivo para a tabela ---------------- */

export function filtrar(produtos) {
  const f = estado;
  const q = f.texto.trim().toLowerCase();
  return produtos.filter(p => {
    if (q) {
      const hay = `${p.desc} ${p.descRed} ${p.seqProd}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.categoria && p.categoria !== f.categoria) return false;
    if (f.grupo && p.grupo !== f.grupo) return false;
    if (f.subgrupo && p.subgrupo !== f.subgrupo) return false;
    if (f.status !== "TODOS" && p.status !== f.status) return false;

    if (f.cluster !== "TODOS") {
      const arr = getClustersAtuais(p.seqProd);
      if (f.cluster === "SEM CLUSTER") {
        if (arr.length > 0) return false;
      } else {
        if (!arr.includes(f.cluster)) return false;
      }
    }
    return true;
  });
}