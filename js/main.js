// Bootstrap: inicializa módulos e liga eventos.
import "./config.js";
import { carregarDados, getEstado } from "./data.js";
import { inicializarFiltros, aplicarOverridesMap } from "./filters.js";
import { inicializarTabela, renderTabela, atualizarClustersVisiveis } from "./table.js";
import { inicializarModal, abrirModal, toast } from "./modal.js";
import { exportarXLSX } from "./export.js";
import { inicializarPolling, getMapaCluster } from "./polling.js";

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
  });

  inicializarModal({
    onSaved: () => atualizarClustersVisiveis(),
  });

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
    },
  });

  window.__clusterMap = getMapaCluster();
}

document.addEventListener("DOMContentLoaded", bootstrap);
