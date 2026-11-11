import "./config.js";
import { carregarDados, getEstado } from "./data.js";
import { inicializarFiltros, aplicarOverridesMap, temFiltroAtivo, contarFiltrados, listarFiltrados, getClustersAtuais } from "./filters.js";
import { inicializarTabela, renderTabela, atualizarClustersVisiveis, getSelecionados, setModoFL } from "./table.js";
import { inicializarModal, abrirModal, toast } from "./modal.js";
import { inicializarBulk, abrirBulk, aplicarMassaFL } from "./bulk.js";
import { exportarXLSX } from "./export.js";
import { inicializarPolling, getMapaCluster } from "./polling.js";

let modoFL = false;
let _listaFL = new Set();

function atualizarBotoesEStatus() {
  const btnBulk = document.getElementById("btnApplyAllClusters");
  const btnFL = document.getElementById("btnToggleFL");
  const thAction = document.getElementById("thAction");
  const wrapMaster = document.getElementById("wrapMasterCheck");
  const checkMaster = document.getElementById("checkMasterFL");

  if (modoFL) {
    btnFL.textContent = "Sair do Modo FL";
    btnFL.classList.replace("btn--secondary", "btn--danger");
    btnBulk.textContent = "Fora de Linha (Aplicar)";
    btnBulk.disabled = !(temFiltroAtivo() && contarFiltrados() > 0);
    if (thAction) thAction.style.display = "none";
    if (wrapMaster) wrapMaster.style.display = "block"; // Mostra checkbox mestre
  } else {
    btnFL.textContent = "Fora de Linha";
    btnFL.classList.replace("btn--danger", "btn--secondary");
    btnBulk.textContent = "Aplicar clusters em massa";
    btnBulk.disabled = !(temFiltroAtivo() && contarFiltrados() > 0);
    if (thAction) thAction.style.display = "";
    if (wrapMaster) wrapMaster.style.display = "none"; // Esconde checkbox mestre
    if (checkMaster) checkMaster.checked = false;      // Desmarca ao sair
  }

  atualizarDashboard();
}

function atualizarDashboard() {
  const filtrados = listarFiltrados();
  
  let flCount = 0;
  let feitosCount = 0;
  let faltamCount = 0;

  for (const p of filtrados) {
    const isFL = _listaFL.has(p.seqProd);
    const clusters = getClustersAtuais(p.seqProd);
    const temCluster = clusters.length > 0;

    if (isFL) {
      flCount++;
    } else if (temCluster) {
      feitosCount++;
    } else {
      faltamCount++;
    }
  }

  const total = filtrados.length;
  const dias = parseInt(document.getElementById("dashDias").value, 10) || 1;
  const porDia = Math.ceil(faltamCount / dias);

  document.getElementById("dashTotal").textContent = total;
  document.getElementById("dashFeitos").textContent = feitosCount;
  document.getElementById("dashFL").textContent = flCount;
  document.getElementById("dashFaltam").textContent = faltamCount;
  document.getElementById("dashPorDia").textContent = porDia > 0 ? porDia : 0;
}

async function bootstrap() {
  const loader = document.getElementById("loader");
  loader.hidden = false;

  try {
    await carregarDados();
    const flSalvos = localStorage.getItem("consultaClusters.FL");
    if (flSalvos) _listaFL = new Set(JSON.parse(flSalvos));
  } catch (err) {
    console.error(err);
    toast("Erro ao carregar BASE.xlsx: " + err.message, "error");
    loader.hidden = true;
    return;
  }
  loader.hidden = true;

  inicializarTabela({ onDefineCluster: abrirModal, onCheckChange: atualizarBotoesEStatus });

  inicializarFiltros(() => {
    const { produtos } = getEstado();
    renderTabela(produtos);
    atualizarBotoesEStatus();
  });

  inicializarModal({ onSaved: () => { atualizarClustersVisiveis(); atualizarBotoesEStatus(); } });
  inicializarBulk({ onSaved: () => { atualizarClustersVisiveis(); atualizarBotoesEStatus(); } });

  document.getElementById("btnToggleFL").addEventListener("click", () => {
    modoFL = !modoFL;
    setModoFL(modoFL);
    atualizarBotoesEStatus();
  });

  document.getElementById("dashDias").addEventListener("input", atualizarDashboard);

  // NOVO: Lógica de envio FL
  document.getElementById("btnApplyAllClusters").addEventListener("click", () => {
    if (modoFL) {
      const checkMaster = document.getElementById("checkMasterFL").checked;
      let selecionados = getSelecionados(); // Pega os marcados na tabela

      // Se marcou o Checkbox Mestre, pega TODOS os filtrados
      if (checkMaster) {
        selecionados = listarFiltrados().map(p => p.seqProd);
        if (!confirm(`Marcar TODOS os ${selecionados.length} produtos filtrados como FORA DE LINHA?`)) return;
      } 
      // Se não marcou o Mestre, mas marcou itens na tabela
      else if (selecionados.length > 0) {
        if (!confirm(`Enviar ${selecionados.length} produto(s) selecionados na tabela para FORA DE LINHA?`)) return;
      } 
      // Se não marcou nada
      else {
        toast("Selecione produtos na tabela ou marque a caixa 'Marcar TODOS'.", "warn");
        return;
      }

      if (selecionados.length > 0) {
        selecionados.forEach(seq => _listaFL.add(seq));
        localStorage.setItem("consultaClusters.FL", JSON.stringify([..._listaFL]));
        
        aplicarMassaFL(selecionados);
        atualizarDashboard();
        
        // Desmarca o mestre após enviar para evitar duplo clique
        document.getElementById("checkMasterFL").checked = false; 
      }
    } else {
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
      atualizarBotoesEStatus();
    },
  });

  window.__clusterMap = getMapaCluster();
  atualizarBotoesEStatus();
}

document.addEventListener("DOMContentLoaded", bootstrap);