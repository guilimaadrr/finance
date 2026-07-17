const STORAGE_KEY = "financePremium";
const METAS_KEY = "financePremiumMetas";
const CATEGORIAS = { geral: "Geral", cartao: "Cartão", alimentacao: "Alimentação", moradia: "Moradia", transporte: "Transporte", lazer: "Lazer", saude: "Saúde", investimento: "Investimento" };
const ICONES = { geral: "📌", cartao: "💳", alimentacao: "🍔", moradia: "🏠", transporte: "🚗", lazer: "🎮", saude: "🏥", investimento: "📈" };
let dados = ler(STORAGE_KEY, []);
let metas = ler(METAS_KEY, []);
let periodoRelatorio = "mes";

function gerarId() {
  return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function ler(chave, padrao) { try { const valor = JSON.parse(localStorage.getItem(chave)); return Array.isArray(valor) ? valor : padrao; } catch { return padrao; } }
function salvar() { localStorage.setItem(STORAGE_KEY, JSON.stringify(dados)); localStorage.setItem(METAS_KEY, JSON.stringify(metas)); }
function moeda(valor) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor); }
function seguro(valor) { const elemento = document.createElement("span"); elemento.textContent = valor; return elemento.innerHTML; }

function estaNoMes(dataISO, offsetMeses = 0) {
  const data = new Date(dataISO);
  const referencia = new Date();
  referencia.setMonth(referencia.getMonth() + offsetMeses);
  return data.getMonth() === referencia.getMonth() && data.getFullYear() === referencia.getFullYear();
}

function calcularTotais(filtro) {
  return dados.reduce((resultado, item) => {
    if (filtro && !filtro(item)) return resultado;
    resultado[item.tipo] += item.valor;
    if (item.tipo === "despesa" && item.categoria === "cartao") resultado.cartao += item.valor;
    if (item.tipo === "despesa") resultado.categorias[item.categoria || "geral"] = (resultado.categorias[item.categoria || "geral"] || 0) + item.valor;
    return resultado;
  }, { receita: 0, despesa: 0, cartao: 0, categorias: {} });
}

function totaisGerais() {
  return dados.reduce((resultado, item) => {
    resultado[item.tipo] += item.valor;
    return resultado;
  }, { receita: 0, despesa: 0 });
}

function totaisPorMes(offsetMeses) { return calcularTotais(item => estaNoMes(item.criadoEm, offsetMeses)); }
function totaisTudo() { return calcularTotais(null); }

function obterTotaisPeriodo(periodo) {
  if (periodo === "mes") return totaisPorMes(0);
  if (periodo === "anterior") return totaisPorMes(-1);
  return totaisTudo();
}

function atualizarSaudacao() {
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  document.getElementById("saudacaoHeader").textContent = `${saudacao}, Guilherme 👋`;
}

function atualizarData() {
  const texto = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  document.getElementById("dataAtual").textContent = texto;
}

function atualizarTendencia(atual, anterior) {
  const el = document.getElementById("saldoTrend");
  if (anterior === 0 && atual === 0) { el.innerHTML = ""; return; }
  const variacao = anterior !== 0 ? ((atual - anterior) / Math.abs(anterior)) * 100 : 100;
  const positivo = variacao >= 0;
  const seta = positivo ? "▲" : "▼";
  const classe = positivo ? "trend-alta" : "trend-baixa";
  el.innerHTML = `<span class="${classe}">${seta} ${Math.abs(variacao).toFixed(0)}%</span><small>vs mês passado</small>`;
}

function atualizarDestaque(categorias, totalDespesas) {
  const card = document.getElementById("destaqueCard");
  const entradas = Object.entries(categorias);
  if (!entradas.length) { card.hidden = true; return; }
  const [chave, valor] = entradas.sort((a, b) => b[1] - a[1])[0];
  const percentual = totalDespesas ? ((valor / totalDespesas) * 100).toFixed(0) : 0;
  document.getElementById("destaqueIcone").textContent = ICONES[chave] || "📌";
  document.getElementById("destaqueTexto").innerHTML = `${CATEGORIAS[chave] || "Geral"} <small>${moeda(valor)} · ${percentual}% dos gastos</small>`;
  card.hidden = false;
}

function formatarGrupo(dataISO) {
  const data = new Date(dataISO);
  const hoje = new Date();
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  const mesmoDia = (a, b) => a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (mesmoDia(data, hoje)) return "Hoje";
  if (mesmoDia(data, ontem)) return "Ontem";
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

function renderizarLancamentos() {
  const lista = document.getElementById("lancamentos");
  if (!dados.length) { lista.innerHTML = '<p class="vazio">Ainda não há lançamentos.</p>'; return; }
  const ordenados = dados.slice().sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
  let grupoAtual = "";
  let html = "";
  ordenados.forEach((item) => {
    const grupo = formatarGrupo(item.criadoEm);
    if (grupo !== grupoAtual) { html += `<h3 class="grupo-data">${grupo}</h3>`; grupoAtual = grupo; }
    const classe = item.tipo === "receita" ? "valor-receita" : "valor-despesa";
    const sinal = item.tipo === "receita" ? "+" : "−";
    const icone = ICONES[item.categoria] || "📌";
    html += `<article class="item"><div class="item-icone">${icone}</div><div class="item-info"><strong>${seguro(item.descricao)}</strong><br><small>${CATEGORIAS[item.categoria] || "Geral"}</small></div><div class="item-valor"><small class="${classe}">${sinal} ${moeda(item.valor)}</small><button type="button" onclick="remover('${item.id}')" aria-label="Remover lançamento">🗑️</button></div></article>`;
  });
  lista.innerHTML = html;
}

function renderRelatorio() {
  const totais = obterTotaisPeriodo(periodoRelatorio);
  atualizarRelatorios(totais);
}

function atualizar() {
  const geral = totaisGerais();
  const saldoDisponivel = geral.receita - geral.despesa;
  const mes = totaisPorMes(0);
  const mesPassado = totaisPorMes(-1);
  const economiaMes = mes.receita - mes.despesa;
  const economiaPassada = mesPassado.receita - mesPassado.despesa;

  atualizarSaudacao();
  atualizarData();

  document.getElementById("saldo").textContent = moeda(saldoDisponivel);
  document.getElementById("receitas").textContent = moeda(mes.receita);
  document.getElementById("despesas").textContent = moeda(mes.despesa);
  document.getElementById("economia").textContent = moeda(Math.max(economiaMes, 0));
  document.getElementById("cartao").textContent = moeda(mes.cartao);

  atualizarTendencia(economiaMes, economiaPassada);
  atualizarDestaque(mes.categorias, mes.despesa);
  renderizarLancamentos();
  desenharGrafico(mes.receita, mes.despesa);
  renderRelatorio();
  atualizarMetas();
  salvar();
}

function adicionar(evento) {
  evento.preventDefault();
  const descricao = document.getElementById("descricao");
  const valor = document.getElementById("valor");
  const numero = Number(valor.value);
  if (!descricao.value.trim() || !Number.isFinite(numero) || numero <= 0) return;
  dados.push({
    id: gerarId(),
    descricao: descricao.value.trim(),
    valor: numero,
    tipo: document.getElementById("tipo").value,
    categoria: document.getElementById("categoria").value,
    criadoEm: new Date().toISOString()
  });
  descricao.value = "";
  valor.value = "";
  atualizar();
  descricao.focus();
}

function remover(id) {
  dados = dados.filter(item => item.id !== id);
  atualizar();
}

function atualizarRelatorios(totais) {
  const saldo = totais.receita - totais.despesa;
  document.getElementById("resumoRelatorio").innerHTML = `<div><span>Receitas</span><strong class="valor-receita">${moeda(totais.receita)}</strong></div><div><span>Despesas</span><strong class="valor-despesa">${moeda(totais.despesa)}</strong></div><div><span>Saldo</span><strong>${moeda(saldo)}</strong></div><div><span>Cartão</span><strong>${moeda(totais.cartao)}</strong></div>`;
  const categorias = Object.entries(totais.categorias).sort((a, b) => b[1] - a[1]);
  document.getElementById("categoriasRelatorio").innerHTML = categorias.length ? categorias.map(([chave, valor]) => `<div class="categoria-linha"><span>${CATEGORIAS[chave] || "Geral"}</span><strong>${moeda(valor)}</strong><div class="barra"><i style="width:${totais.despesa ? valor / totais.despesa * 100 : 0}%"></i></div></div>`).join("") : '<p class="vazio">Adicione despesas para ver as categorias.</p>';
}

function adicionarMeta(evento) {
  evento.preventDefault();
  const nome = document.getElementById("nomeMeta");
  const valor = document.getElementById("valorMeta");
  const alvo = Number(valor.value);
  if (!nome.value.trim() || !Number.isFinite(alvo) || alvo <= 0) return;
  metas.push({ id: gerarId(), nome: nome.value.trim(), alvo, valorAcumulado: 0 });
  nome.value = "";
  valor.value = "";
  atualizar();
}

function atualizarMetas() {
  const lista = document.getElementById("listaMetas");
  lista.innerHTML = metas.length ? metas.map((meta) => {
    const percentual = Math.min((meta.valorAcumulado / meta.alvo) * 100, 100);
    const concluida = meta.valorAcumulado >= meta.alvo;
    const restante = Math.max(meta.alvo - meta.valorAcumulado, 0);
    return `<article class="meta-item ${concluida ? "meta-concluida" : ""}">
      <div class="meta-conteudo">
        <div class="meta-topo"><strong>${seguro(meta.nome)}</strong>${concluida ? '<span class="badge-concluida">✓ Concluída</span>' : ""}</div>
        <small>${moeda(meta.valorAcumulado)} de ${moeda(meta.alvo)} · ${percentual.toFixed(0)}%</small>
        ${!concluida ? `<small class="meta-restante">Faltam ${moeda(restante)}</small>` : ""}
        <div class="progresso"><i style="width:${percentual}%"></i></div>
        <div class="meta-acoes">
          <button type="button" onclick="aportarMeta('${meta.id}')" class="btn-aporte">+ Guardar valor</button>
          <button type="button" onclick="editarMeta('${meta.id}')" class="btn-editar" aria-label="Editar meta">✏️</button>
        </div>
      </div>
      <button type="button" onclick="removerMeta('${meta.id}')" aria-label="Excluir meta">🗑️</button>
    </article>`;
  }).join("") : '<p class="vazio">Crie uma meta para acompanhar sua economia.</p>';
}

function aportarMeta(id) {
  const meta = metas.find(item => item.id === id);
  if (!meta) return;
  const entrada = prompt(`Quanto deseja guardar para "${meta.nome}"?`);
  const valor = Number(entrada);
  if (!Number.isFinite(valor) || valor <= 0) return;
  meta.valorAcumulado += valor;
  atualizar();
}

function editarMeta(id) {
  const meta = metas.find(item => item.id === id);
  if (!meta) return;
  const novoNome = prompt("Nome da meta:", meta.nome);
  if (novoNome === null || !novoNome.trim()) return;
  const novoAlvo = Number(prompt("Valor alvo:", meta.alvo));
  if (!Number.isFinite(novoAlvo) || novoAlvo <= 0) return;
  meta.nome = novoNome.trim();
  meta.alvo = novoAlvo;
  atualizar();
}

function removerMeta(id) {
  metas = metas.filter(item => item.id !== id);
  atualizar();
}

function desenharGrafico(receitas, despesas) {
  const canvas = document.getElementById("graficoFinanceiro");
  const vazio = document.getElementById("graficoVazio");
  const total = receitas + despesas;
  vazio.hidden = total > 0;
  const medida = Math.min(canvas.parentElement.clientWidth, 230);
  const escala = window.devicePixelRatio || 1;
  canvas.width = medida * escala;
  canvas.height = medida * escala;
  canvas.style.width = `${medida}px`;
  canvas.style.height = `${medida}px`;
  const contexto = canvas.getContext("2d");
  contexto.scale(escala, escala);
  contexto.clearRect(0, 0, medida, medida);
  if (!total) return;
  const centro = medida / 2, raio = medida * .34, inicio = -Math.PI / 2, angulo = receitas / total * Math.PI * 2;
  contexto.lineWidth = medida * .14;
  contexto.lineCap = "round";
  contexto.beginPath();
  contexto.strokeStyle = "#22c55e";
  contexto.arc(centro, centro, raio, inicio, inicio + angulo);
  contexto.stroke();
  contexto.beginPath();
  contexto.strokeStyle = "#ef4444";
  contexto.arc(centro, centro, raio, inicio + angulo, inicio + Math.PI * 2);
  contexto.stroke();
  contexto.fillStyle = "#fff";
  contexto.font = `600 ${medida * .085}px system-ui`;
  contexto.textAlign = "center";
  contexto.fillText("Resumo", centro, centro - 5);
  contexto.fillStyle = "#94a3b8";
  contexto.font = `${medida * .06}px system-ui`;
  contexto.fillText(moeda(receitas - despesas), centro, centro + medida * .09);
}

function abrirAba(nome) {
  document.getElementById("homeView").hidden = nome !== "home";
  document.getElementById("relatoriosView").hidden = nome !== "relatorios";
  document.getElementById("metasView").hidden = nome !== "metas";
  document.getElementById("ajustesView").hidden = nome !== "ajustes";
  document.getElementById("focoFormulario").hidden = nome !== "home";
  document.querySelectorAll(".bottom-nav button").forEach(botao => botao.classList.toggle("active", botao.dataset.view === nome));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function aplicarTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  document.getElementById("toggleTema").setAttribute("aria-pressed", tema === "dark");
  localStorage.setItem("financePremiumTema", tema);
}

function alternarTema() {
  const atual = localStorage.getItem("financePremiumTema") || "dark";
  aplicarTema(atual === "dark" ? "light" : "dark");
}

function exportarBackup() {
  const payload = JSON.stringify({ dados, metas, tema: localStorage.getItem("financePremiumTema") || "dark", exportadoEm: new Date().toISOString() }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `finance-premium-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importarBackup(evento) {
  const arquivo = evento.target.files[0];
  if (!arquivo) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    try {
      const conteudo = JSON.parse(leitor.result);
      if (!Array.isArray(conteudo.dados) || !Array.isArray(conteudo.metas)) throw new Error("formato inválido");
      if (!confirm("Importar este backup vai substituir todos os dados atuais. Continuar?")) return;
      dados = conteudo.dados;
      metas = conteudo.metas;
      if (conteudo.tema) aplicarTema(conteudo.tema);
      atualizar();
      alert("Backup importado com sucesso.");
    } catch {
      alert("Arquivo inválido. Verifique se é um backup do Finance Premium.");
    }
  };
  leitor.readAsText(arquivo);
  evento.target.value = "";
}

function resetarApp() {
  if (!confirm("Isso vai apagar TODOS os lançamentos e metas permanentemente. Deseja continuar?")) return;
  dados = [];
  metas = [];
  atualizar();
}

document.getElementById("formLancamento").addEventListener("submit", adicionar);
document.getElementById("formMeta").addEventListener("submit", adicionarMeta);
document.getElementById("focoFormulario").addEventListener("click", () => document.getElementById("descricao").focus());
document.getElementById("limparTudo").addEventListener("click", () => { if (dados.length && confirm("Excluir todos os lançamentos?")) { dados = []; atualizar(); } });
document.querySelectorAll(".bottom-nav button").forEach(botao => botao.addEventListener("click", () => abrirAba(botao.dataset.view)));
document.getElementById("toggleTema").addEventListener("click", alternarTema);
document.querySelectorAll(".filtro-btn").forEach(botao => botao.addEventListener("click", () => {
  periodoRelatorio = botao.dataset.periodo;
  document.querySelectorAll(".filtro-btn").forEach(b => b.classList.toggle("active", b === botao));
  renderRelatorio();
}));
document.getElementById("exportarBackup").addEventListener("click", exportarBackup);
document.getElementById("importarBackup").addEventListener("click", () => document.getElementById("arquivoBackup").click());
document.getElementById("arquivoBackup").addEventListener("change", importarBackup);
document.getElementById("resetarApp").addEventListener("click", resetarApp);
window.addEventListener("resize", atualizar);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js");
aplicarTema(localStorage.getItem("financePremiumTema") || "dark");
atualizar();
