// Exporta XLSX respeitando os filtros ativos.
import { filtrar, getClusterAtual } from "./filters.js";

export function exportarXLSX(produtos) {
  const filtrados = filtrar(produtos);
  const linhas = filtrados.map(p => ({
    "SEQ PROD": p.seqProd,
    "DESC": p.desc,
    "EMBALAGEM": p.embalagem,
    "CATEGORIA": p.categoria,
    "GRUPO": p.grupo,
    "SUBGRUPO": p.subgrupo,
    "SUBGRUPO 1": p.subgrupo1,
    "SUBGRUPO 2": p.subgrupo2,
    "STATUS": p.status,
    "CLUSTER": getClusterAtual(p.seqProd) || "Sem cluster",
  }));

  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Consulta");

  const agora = new Date();
  const stamp = [
    agora.getFullYear(),
    String(agora.getMonth() + 1).padStart(2, "0"),
    String(agora.getDate()).padStart(2, "0"),
    "_",
    String(agora.getHours()).padStart(2, "0"),
    String(agora.getMinutes()).padStart(2, "0"),
    String(agora.getSeconds()).padStart(2, "0"),
  ].join("");

  XLSX.writeFile(wb, `consulta_clusters_${stamp}.xlsx`);
}