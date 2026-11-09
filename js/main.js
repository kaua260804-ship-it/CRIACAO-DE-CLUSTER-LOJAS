// Bootstrap: inicializa módulos e liga eventos.
import "./config.js";
import { carregarDados, getEstado } from "./data.js";
import {
  inicializarFiltros, aplicarOverridesMap,
  temFiltroAtivo, contarFiltrados,
} from "./filters.js";
import { inicializarTabela, renderTabela, atualizarClustersVisiveis } from "./table.js";
import { inicializarModal, abrirModal, toast } from "./modal.js";
import { inicializarBulk, abrirBulk } from "./bulk.js";
import { exportarXLSX } from "./export.js";
import { inicializarPolling, getMapaCluster } from "./polling.js";

function atualizarBotaoBulk() {
  const btn = document.getElementById("btnApplyAllClusters");
  if (!btn) return;
  const habilitado = temFiltroAtivo() && contarFiltrados() > 0;
  btn.disabled = !habilitado;
  btn.title = habilitado
    ? "Aplicar clusters em massa nos produtos filtrados"
    : "Aplique algum filtro primeiro";
}

async function bootstrap() {
  const loader = document.getElementById("loader");
  loader.hidden = false;

  try {
    await carregarDados();
  } catch (err) {
    console.error(err);
    toast("Erro ao carregar BASE.xlsx: " + err.message, "error");
    loader.hidden = true;
    return;
  }
  loader.hidden = true;

  inicializarTabela({ onDefineCluster: abrirModal });

  inicializarFiltros(() => {
    const { produtos } = getEstado();
    renderTabela(produtos);
    atualizarBotaoBulk();
  });

  inicializarModal({
    onSaved: () => {
      atualizarClustersVisiveis();
      atualizarBotaoBulk();
    },
  });

  inicializarBulk({
    onSaved: () => {
      atualizarClustersVisiveis();
      atualizarBotaoBulk();
    },
  });

  document.getElementById("btnApplyAllClusters").addEventListener("click", abrirBulk);

  document.getElementById("btnExport").addEventListener("click", () => {
    const { produtos } = getEstado();
    try { exportarXLSX(produtos); toast("Exportação gerada.", "success"); }
    catch (e) { toast("Falha ao exportar: " + e.message, "error"); }
  });

  inicializarPolling({
    onUpdate: (mapa) => {
      window.__clusterMap = mapa;
      aplicarOverridesMap(mapa);
      atualizarClustersVisiveis();
      atualizarBotaoBulk();
    },
  });

  window.__clusterMap = getMapaCluster();
  atualizarBotaoBulk();
}

document.addEventListener("DOMContentLoaded", bootstrap);