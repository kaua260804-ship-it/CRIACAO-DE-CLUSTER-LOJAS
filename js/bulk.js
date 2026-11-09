// Modal "Aplicar clusters em massa" + orquestração do envio em lote.
// - Abre com os 5 tipos de cluster (checkboxes), todos desmarcados.
// - Ao aplicar: confirm() → envia via GET mascarado → atualiza UI local.
import { api } from "./api.js";
import {
  listarFiltrados, getTiposCluster, getClustersAtuais,
  setClustersAtuais, _normalizarLista,
} from "./filters.js";
import { getProduto } from "./data.js";
import { salvarNoStorage } from "./storage.js";
import { atualizarClustersVisiveis } from "./table.js";
import { toast } from "./modal.js";

let _onSaved = () => {};

export function inicializarBulk({ onSaved }) {
  _onSaved = onSaved || (() => {});
  const modal = document.getElementById("modalBulk");
  const backdrop = modal.querySelector(".modal__backdrop");
  const btnCancel = document.getElementById("modalBulkCancel");
  const btnApply = document.getElementById("modalBulkApply");
  const checks = document.getElementById("modalBulkChecks");

  btnCancel.addEventListener("click", fecharBulk);
  backdrop.addEventListener("click", fecharBulk);
  btnApply.addEventListener("click", aplicar);

  checks.addEventListener("change", () => {
    const qtd = checks.querySelectorAll("input[type=checkbox]:checked").length;
    btnApply.disabled = qtd === 0;
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !modal.hidden) fecharBulk();
  });
}

export function abrirBulk() {
  const filtrados = listarFiltrados();
  if (filtrados.length === 0) {
    toast("Nenhum produto filtrado.", "warn");
    return;
  }

  const modal = document.getElementById("modalBulk");
  document.getElementById("modalBulkHint").textContent =
    `Serão afetados ${filtrados.length} produto(s). Os clusters escolhidos serão SOMADOS aos já existentes.`;

  const tipos = getTiposCluster();
  const container = document.getElementById("modalBulkChecks");
  container.innerHTML = tipos.map(t => `
    <label class="check">
      <input type="checkbox" value="${escapeAttr(t)}" />
      <span>${escapeHtml(t)}</span>
    </label>
  `).join("");

  // Reset do estado do modal
  document.getElementById("modalBulkApply").disabled = true;
  document.getElementById("modalBulkApply").textContent = "Aplicar em massa";
  document.getElementById("modalBulkProgressWrap").hidden = true;
  document.getElementById("modalBulkProgressBar").style.width = "0%";
  document.getElementById("modalBulkProgressText").textContent = "Salvando 0/0…";

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  setTimeout(() => {
    const first = container.querySelector("input");
    if (first) first.focus();
  }, 30);
}

function fecharBulk() {
  const modal = document.getElementById("modalBulk");
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
}

async function aplicar() {
  const checks = document.getElementById("modalBulkChecks");
  const escolhidos = _normalizarLista(
    [...checks.querySelectorAll("input[type=checkbox]:checked")].map(i => i.value)
  );
  if (escolhidos.length === 0) return;

  const filtrados = listarFiltrados();
  const n = filtrados.length;
  if (n === 0) return;

  const confirmMsg =
    `Aplicar ${escolhidos.join(", ")} em ${n} produto(s)?\n\n` +
    `Os clusters serão SOMADOS aos já existentes (não remove nenhum).`;
  if (!confirm(confirmMsg)) return;

  const btnApply = document.getElementById("modalBulkApply");
  const btnCancel = document.getElementById("modalBulkCancel");
  const progressWrap = document.getElementById("modalBulkProgressWrap");
  const progressBar = document.getElementById("modalBulkProgressBar");
  const progressText = document.getElementById("modalBulkProgressText");

  btnApply.disabled = true;
  btnCancel.disabled = true;
  progressWrap.hidden = false;

  // Monta os itens já com o cluster final (merge) calculado
  const itens = [];
  const updatesLocais = []; // { seqProd, clustersFinais, statusStr }
  
  for (const p of filtrados) {
    const antigos = getClustersAtuais(p.seqProd);
    const finais = _normalizarLista([...antigos, ...escolhidos]);
    const statusStr = finais.join(",");
    
    itens.push({
      seqProd: p.seqProd,
      desc: p.desc,
      embalagem: p.embalagem,
      categoria: p.categoria,
      grupo: p.grupo,
      subgrupo: p.subgrupo,
      subgrupo1: p.subgrupo1,
      subgrupo2: p.subgrupo2,
      status: statusStr, // Texto com vírgulas
      clusters: finais,  // <--- ENVIA O ARRAY TAMBÉM
    });
    
    updatesLocais.push({ seqProd: p.seqProd, clustersFinais: finais, statusStr });
  }

  // Animação da barra: como o POST é único, a barra avança em "etapas" para dar feedback.
  let feitos = 0;
  const setProgress = (k) => {
    feitos = Math.min(n, k);
    const pct = n === 0 ? 100 : Math.round((feitos / n) * 100);
    progressBar.style.width = pct + "%";
    progressText.textContent = `Salvando ${feitos}/${n}…`;
  };
  setProgress(0);

  // Avança a barra visualmente em ~n/20 passos enquanto a requisição está em andamento
  const passo = Math.max(1, Math.ceil(n / 20));
  const anim = setInterval(() => {
    if (feitos < n - 1) setProgress(feitos + passo);
  }, 120);

  try {
    await api.salvarLote(itens);
    clearInterval(anim);
    setProgress(n);

    // Atualiza estado local de todos
    for (const u of updatesLocais) {
      setClustersAtuais(u.seqProd, u.clustersFinais);
      salvarNoStorage(u.seqProd, u.statusStr);
      if (window.__clusterMap) {
        if (u.statusStr) window.__clusterMap.set(String(u.seqProd), u.statusStr);
        else window.__clusterMap.delete(String(u.seqProd));
      }
    }
    atualizarClustersVisiveis();
    _onSaved();

    toast(`${n} produto(s) enviados para a planilha com sucesso.`, "success");
    fecharBulk();
  } catch (err) {
    clearInterval(anim);
    console.error(err);
    toast("Falha ao enviar em massa: " + err.message, "error");
    progressText.textContent = "Falhou. Tente novamente.";
  } finally {
    btnApply.disabled = false;
    btnCancel.disabled = false;
  }
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[m]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/"/g, "&quot;"); }