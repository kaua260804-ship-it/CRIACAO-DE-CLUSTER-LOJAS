// Estado dos filtros + mapa de clusters (suporta N clusters por produto, separados por vírgula).
import { listasParaFiltro } from "./data.js";

const STORAGE_KEY = "consultaClusters.filtros.v1";

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

  const { categorias, grupos, subgrupos } = listasParaFiltro();
  popular("fCategoria", categorias, "TODAS");
  popular("fGrupo", grupos, "TODOS");
  popular("fSubgrupo", subgrupos, "TODOS");

  try {
    const salvo = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (salvo && typeof salvo === "object") Object.assign(estado, salvo);
  } catch (_) { /* ignore */ }

  document.getElementById("fSearch").value = estado.texto;
  document.getElementById("fCategoria").value = estado.categoria;
  document.getElementById("fGrupo").value = estado.grupo;
  document.getElementById("fSubgrupo").value = estado.subgrupo;
  document.getElementById("fStatus").value = estado.status;
  document.getElementById("fCluster").value = estado.cluster;

  document.getElementById("fSearch").addEventListener("input", e => {
    estado.texto = e.target.value; persistir(); onChange();
  });
  document.getElementById("fCategoria").addEventListener("change", e => {
    estado.categoria = e.target.value; persistir(); onChange();
  });
  document.getElementById("fGrupo").addEventListener("change", e => {
    estado.grupo = e.target.value; persistir(); onChange();
  });
  document.getElementById("fSubgrupo").addEventListener("change", e => {
    estado.subgrupo = e.target.value; persistir(); onChange();
  });
  document.getElementById("fStatus").addEventListener("change", e => {
    estado.status = e.target.value; persistir(); onChange();
  });
  document.getElementById("fCluster").addEventListener("change", e => {
    estado.cluster = e.target.value; persistir(); onChange();
  });
  document.getElementById("btnClear").addEventListener("click", limpar);

  onChange();
}

function popular(id, valores, primeiroLabel) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const primeira = sel.options[0];
  sel.innerHTML = "";
  sel.appendChild(primeira);
  for (const v of valores) {
    const o = document.createElement("option");
    o.value = v; o.textContent = v;
    sel.appendChild(o);
  }
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
  document.getElementById("fCategoria").value = "";
  document.getElementById("fGrupo").value = "";
  document.getElementById("fSubgrupo").value = "";
  document.getElementById("fStatus").value = "TODOS";
  document.getElementById("fCluster").value = "TODOS";

  persistir();
  onChange();
}

// ---------- Mapa de clusters (N por produto) ----------
// Chave: seqProd | Valor: string[] (lista de clusters) OU [] se sem cluster.
const _clusterMap = new Map();

export function aplicarOverridesMap(mapa) {
  _clusterMap.clear();
  for (const [k, v] of mapa) {
    _clusterMap.set(String(k), _normalizarLista(v));
  }
}

export function getClustersAtuais(seq) {
  return _clusterMap.get(String(seq)) || [];
}

export function setClustersAtuais(seq, clusters) {
  const arr = _normalizarLista(clusters);
  if (arr.length === 0) _clusterMap.delete(String(seq));
  else _clusterMap.set(String(seq), arr);
}

// Converte "A,B , C" ou ["A","B"] em ["A","B","C"] (trim, sem vazios, únicos, preserva ordem).
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

// Compatibilidade com chamadas anteriores (usa string única como primeiro cluster).
export function getClusterAtual(seq) {
  const arr = getClustersAtuais(seq);
  return arr.length ? arr[0] : "";
}

export function setClusterAtual(seq, cluster) {
  if (!cluster) setClustersAtuais(seq, []);
  else setClustersAtuais(seq, [cluster]);
}

// ---------- Aplicação dos filtros ----------
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