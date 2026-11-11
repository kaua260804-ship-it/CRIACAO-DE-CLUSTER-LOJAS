import "./config.js";
import { carregarDados, getEstado } from "./data.js";
import { inicializarFiltros, aplicarOverridesMap, temFiltroAtivo, contarFiltrados, listarFiltrados, getClustersAtuais } from "./filters.js";
import { inicializarTabela, renderTabela, atualizarClustersVisiveis, getSelecionados, setModoFL } from "./table.js";
import { inicializarModal, abrirModal, toast } from "./modal.js";
import { inicializarBulk, abrirBulk, aplicarMassaFL } from "./bulk.js";
import { exportarXLSX } from "./export.js";
import { inicializarPolling, getMapaCluster } from "./polling.js";
import { _enviarViaGet } from "./api.js"; // Importação para pegar a lista FL

let modoFL = false;
let _listaFL = new Set(); // Guarda os SEQ PRODs que estão na aba FL

function atualizarBotoesEStatus() {
  const btnBulk = document.getElementById("btnApplyAllClusters");
  const btnFL = document.getElementById("btnToggleFL");
  const thAction = document.getElementById("thAction");

  if (modoFL) {
    btnFL.textContent = "Sair do Modo FL";
    btnFL.classList.replace("btn--secondary", "btn--danger");
    btnBulk.textContent = "Fora de Linha (Aplicar)";
    btnBulk.disabled = !(temFiltroAtivo() && contarFiltrados() > 0);
    if (thAction) thAction.style.display = "none";
  } else {
    btnFL.textContent = "Fora de Linha";
    btnFL.classList.replace("btn--danger", "btn--secondary");
    btnBulk.textContent = "Aplicar clusters em massa";
    btnBulk.disabled = !(temFiltroAtivo() && contarFiltrados() > 0);
    if (thAction) thAction.style.display = "";
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

async function carregarListaFL() {
  try {
    // Pede para o Apps Script a lista de itens da aba FL
    const res = await _enviarViaGet({ acao: "listarFL" });
    // Como o _enviarViaGet não lê a resposta (CORS), 
    // vamos usar a solução de carregar um JSON externo ou um truque via DOM.
    // Para manter a simplicidade, o Apps Script (lá embaixo) vai nos dar os dados.
  } catch (e) {
    console.warn("Não foi possível carregar a lista FL agora.");
  }
}

async function bootstrap() {
  const loader = document.getElementById("loader");
  loader.hidden = false;

  try {
    await carregarDados();
    // Carrega os produtos que estão na aba FL (simulação via localStorage por enquanto)
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

  document.getElementById("btnApplyAllClusters").addEventListener("click", () => {
    if (modoFL) {
      let selecionados = getSelecionados();
      if (selecionados.length === 0) {
        const ok = confirm("Nenhum item foi selecionado via checkbox. Deseja aplicar FORA DE LINHA em TODOS os produtos filtrados?");
        if (!ok) return;
        selecionados = listarFiltrados().map(p => p.seqProd);
      } else {
        const ok = confirm(`Enviar ${selecionados.length} produto(s) selecionados para FORA DE LINHA?`);
        if (!ok) return;
      }
      if (selecionados.length > 0) {
        // Atualiza a lista local FL para o dashboard contar certo imediatamente
        selecionados.forEach(seq => _listaFL.add(seq));
        localStorage.setItem("consultaClusters.FL", JSON.stringify([..._listaFL]));
        aplicarMassaFL(selecionados);
        atualizarDashboard();
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