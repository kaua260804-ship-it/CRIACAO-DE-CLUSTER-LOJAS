// Carrega BASE.xlsx (abas BASE, TABLE, VENDA, CLUSTER) e cruza tudo.
// A aba CLUSTER do BASE.xlsx é a FONTE DE VERDADE dos clusters já definidos.
// Formato esperado da aba CLUSTER (1ª linha = cabeçalho):
//   SEQ PROD | CLUSTER   (aceita também "STATUS" no lugar de "CLUSTER")
// Múltiplos clusters: separar por vírgula → "EMPORIO G,MERCEARIA P"

const CAMINHO = "dados/BASE.xlsx";

let estado = {
  produtos: [],
  porSeq: new Map(),
  clusterMap: new Map(),
};

function parseSheet(ws, XLSX) {
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

function normalizarCabecalho(obj) {
  const out = {};
  for (const k of Object.keys(obj)) {
    out[String(k).trim().toUpperCase()] = obj[k];
  }
  return out;
}

function normalizarCluster(v) {
  if (v == null) return "";
  const arr = String(v).split(",").map(x => x.trim()).filter(Boolean);
  const vistos = new Set();
  const out = [];
  for (const x of arr) {
    if (!vistos.has(x)) { vistos.add(x); out.push(x); }
  }
  return out.join(",");
}

export async function carregarDados() {
  const res = await fetch(CAMINHO, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Não foi possível carregar ${CAMINHO} (HTTP ${res.status})`);
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  const nomeBase = wb.SheetNames.includes("BASE") ? "BASE" : wb.SheetNames[0];
  const nomeTable = wb.SheetNames.find(n => /^TABLE$/i.test(n.trim()));
  const nomeVenda = wb.SheetNames.find(n => /^VENDA$/i.test(n.trim()));
  const nomeCluster = wb.SheetNames.find(n => /^CLUSTER$/i.test(n.trim()));

  const baseRows = parseSheet(wb.Sheets[nomeBase], XLSX).map(normalizarCabecalho);
  const tableRows = nomeTable ? parseSheet(wb.Sheets[nomeTable], XLSX).map(normalizarCabecalho) : [];
  const vendaRows = nomeVenda ? parseSheet(wb.Sheets[nomeVenda], XLSX).map(normalizarCabecalho) : [];
  const clusterRows = nomeCluster ? parseSheet(wb.Sheets[nomeCluster], XLSX).map(normalizarCabecalho) : [];

  // Mapa de clusters vindo da aba CLUSTER
  const clusterMap = new Map();
  for (const r of clusterRows) {
    const seq = String(r["SEQ PROD"] ?? r["SEQ_PROD"] ?? r["SEQPROD"] ?? "").trim();
    if (!seq) continue;
    const clu = normalizarCluster(r["CLUSTER"] ?? r["STATUS"] ?? "");
    if (clu) clusterMap.set(seq, clu);
  }

  // Mapa loja → tipo (da TABLE)
  const tipoPorLoja = new Map();
  for (const r of tableRows) {
    const empresa = String(r["EMPRESA"] || r["LOJA"] || "").trim();
    const tipo = String(r["TIPO"] || "").trim();
    if (empresa) tipoPorLoja.set(empresa, tipo);
  }

  // Agrupar vendas por Codigo C5
  const vendasPorProduto = new Map();
  for (const v of vendaRows) {
    const cod = String(v["CODIGO C5"] ?? v["CODIGO_C5"] ?? v["COD"] ?? "").trim();
    if (!cod) continue;
    if (!vendasPorProduto.has(cod)) vendasPorProduto.set(cod, []);
    vendasPorProduto.get(cod).push({
      loja: String(v["LOJA"] || "").trim(),
      qtd: Number(v["QTD"] || 0),
      unid: String(v["UNID"] || "").trim(),
      precoMedio: Number(String(v["PR. MÉDIO"] || v["PR. MEDIO"] || "0").replace(",", ".")) || 0,
      total: Number(String(v["TOTAL R$"] || "0").replace(",", ".")) || 0,
      mes: String(v["MÊS"] || v["MES"] || "").trim(),
    });
  }

  const produtos = [];
  const porSeq = new Map();
  for (const r of baseRows) {
    const seqProd = String(r["SEQ PROD"] ?? "").trim();
    if (!seqProd) continue;
    const vendas = vendasPorProduto.get(seqProd) || [];
    const produto = {
      seqFml: String(r["SEQ FML"] ?? "").trim(),
      seqProd,
      desc: String(r["DESC"] ?? "").trim(),
      descRed: String(r["DESC RED"] ?? "").trim(),
      embalagem: String(r["EMBALAGEM"] ?? "").trim(),
      divisao: String(r["DIVISAO"] ?? "").trim(),
      categoria: String(r["CATEGORIA"] ?? "").trim(),
      grupo: String(r["GRUPO"] ?? "").trim(),
      subgrupo: String(r["SUBGRUPO"] ?? "").trim(),
      subgrupo1: String(r["SUBGRUPO 1"] ?? "").trim(),
      subgrupo2: String(r["SUBGRUPO 2"] ?? "").trim(),
      status: String(r["STATUS"] ?? "").trim().toUpperCase(),
      vendas,
      tipoPorLoja,
      cluster: clusterMap.get(seqProd) || "",
    };
    produtos.push(produto);
    porSeq.set(seqProd, produto);
  }

  estado = { produtos, porSeq, clusterMap };
  return estado;
}

export function getEstado() { return estado; }
export function getProduto(seq) { return estado.porSeq.get(String(seq)); }
export function getMapaClustersPlanilha() { return estado.clusterMap || new Map(); }

// Listas para popular dropdowns (deduplicadas e ordenadas)
export function listasParaFiltro() {
  const cats = new Set(), grus = new Set(), subs = new Set();
  for (const p of estado.produtos) {
    if (p.categoria) cats.add(p.categoria);
    if (p.grupo) grus.add(p.grupo);
    if (p.subgrupo) subs.add(p.subgrupo);
  }
  const ord = arr => [...arr].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { categorias: ord(cats), grupos: ord(grus), subgrupos: ord(subs) };
}