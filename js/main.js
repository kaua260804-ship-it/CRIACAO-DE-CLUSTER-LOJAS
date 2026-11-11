import "./config.js";
import { carregarDados, getEstado } from "./data.js";
import { inicializarFiltros, aplicarOverridesMap, temFiltroAtivo, contarFiltrados } from "./filters.js";
import { inicializarTabela, renderTabela, atualizarClustersVisiveis, getSelecionados, setModoFL } from "./table.js";
import { inicializarModal, abrirModal, toast } from "./modal.js";
import { inicializarBulk, abrirBulk, aplicarMassaFL } from "./bulk.js";
import { exportarXLSX } from "./export.js";
import { inicializarPolling, getMapaCluster } from "./polling.js";

let modoFL = false;

function atualizarBotoes() {
  const btnBulk = document.getElementById("btnApplyAllClusters");
  const btnFL = document.getElementById("btnToggleFL");
  const thAction = document.getElementById("thAction");

  if (modoFL) {
    btnFL.textContent = "Sair do Modo FL";
    btnFL.classList.replace("btn--secondary", "btn--danger");
    
    // No modo FL, o botão se chama "Aplicar FL" e só liga se houver produtos filtrados na tela
    btnBulk.textContent = "Fora de Linha (Aplicar)";
    btnBulk.disabled = !(temFiltroAtivo() && contarFiltrados() > 0);
    
    // Esconde a coluna de Ação (Definir Cluster)
    if (thAction) thAction.style.display = "none";
  } else {
    btnFL.textContent = "Fora de Linha";
    btnFL.classList.replace("btn--danger", "btn--secondary");
    
    btnBulk.textContent = "Aplicar clusters em massa";
    btnBulk.disabled = !(temFiltroAtivo() && contarFiltrados() > 0);
    
    if (thAction) thAction.style.display = "";
  }
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

  inicializarTabela({ 
    onDefineCluster: abrirModal, 
    onCheckChange: atualizarBotoes 
  });

  inicializarFiltros(() => {
    const { produtos } = getEstado();
    renderTabela(produtos);
    atualizarBotoes();
  });

  inicializarModal({ onSaved: () => atualizarClustersVisiveis() });
  inicializarBulk({ onSaved: () => atualizarClustersVisiveis() });

  // Botão de Toggle do Modo FL
  document.getElementById("btnToggleFL").addEventListener("click", () => {
    modoFL = !modoFL;
    setModoFL(modoFL);
    atualizarBotoes();
  });

  // Ação do Botão Principal (Massa)
  document.getElementById("btnApplyAllClusters").addEventListener("click", () => {
    if (modoFL) {
      // Pega APENAS os que estão com o checkbox marcado
      let selecionados = getSelecionados();
      
      // Se o usuário não marcou nenhum checkbox, mas aplicou um filtro, 
      // aplicamos em todos os filtrados (para facilitar a vida)
      if (selecionados.length === 0) {
        const ok = confirm("Nenhum item foi selecionado via checkbox. Deseja aplicar FORA DE LINHA em TODOS os produtos filtrados?");
        if (!ok) return;
        selecionados = listarFiltrados().map(p => p.seqProd);
      } else {
        const ok = confirm(`Enviar ${selecionados.length} produto(s) selecionados para FORA DE LINHA?`);
        if (!ok) return;
      }
      
      if (selecionados.length > 0) {
        aplicarMassaFL(selecionados);
      }
    } else {
      // Modo Normal: abre o modal de clusters
      abrirBulk();
    }
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
      atualizarBotoes();
    },
  });

  window.__clusterMap = getMapaCluster();
  atualizarBotoes();
}

document.addEventListener("DOMContentLoaded", bootstrap);