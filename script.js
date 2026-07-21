const STORAGE_KEY = "financePremium";
const METAS_KEY = "financePremiumMetas";
const CATEGORIAS_KEY = "financePremiumCategorias";
const CATEGORIAS_BASE = { geral: "Geral", cartao: "Cartão", alimentacao: "Alimentação", moradia: "Moradia", transporte: "Transporte", lazer: "Lazer", saude: "Saúde", investimento: "Investimento" };
const ICONES_BASE = { geral: "📌", cartao: "💳", alimentacao: "🍔", moradia: "🏠", transporte: "🚗", lazer: "🎮", saude: "🏥", investimento: "📈" };

let dados = migrarDados(ler(STORAGE_KEY, []));
let metas = ler(METAS_KEY, []);
let categoriasExtras = ler(CATEGORIAS_KEY, {});
let periodoRelatorio = "mes";
let mesSelecionado = new Date(); mesSelecionado.setDate(1);
let abaTransacao = "todos";
let tipoFormulario = "receita";
let recorrenciaFormulario = "nao";
let itemSelecionadoId = null;
let resizeTimeout = null;

function gerarId() {
  return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function hojeISO() { return new Date().toISOString().slice(0, 10); }

function formatarDataBR(iso) {
  if (!iso) return "";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function addMeses(dataISO, meses) {
  const data = new Date(dataISO + "T00:00:00");
  const dia = data.getDate();
  data.setDate(1);
  data.setMonth(data.getMonth() + meses);
  const ultimoDia = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate();
  data.setDate(Math.min(dia, ultimoDia));
  return data.toISOString().slice(0, 10);
}

function mesesEntre(dataA, dataB) {
  return (dataB.getFullYear() - dataA.getFullYear()) * 12 + (dataB.getMonth() - dataA.getMonth());
}

function migrarDados(lista) {
  return lista.map(item => ({
    ...item,
    dataVencimento: item.dataVencimento || (item.criadoEm ? item.criadoEm.slice(0, 10) : hojeISO()),
    status: item.status || "concluido",
    recorrencia: item.recorrencia || "nao",
    recorrenciaId: item.recorrenciaId || null
  }));
}

function ler(chave, padrao) { try { const valor = JSON.parse(localStorage.getItem(chave)); return valor && typeof valor === "object" ? valor : padrao; } catch { return padrao; } }
function salvar() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
  localStorage.setItem(METAS_KEY, JSON.stringify(metas));
  localStorage.setItem(CATEGORIAS_KEY, JSON.stringify(categoriasExtras));
}
function moeda(valor) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor); }
function seguro(valor) { const elemento = document.createElement("span"); elemento.textContent = valor; return elemento.innerHTML; }

function todasCategorias() {
  const extras = Object.fromEntries(Object.entries(categoriasExtras).map(([chave, dado]) => [chave, dado.nome]));
  return { ...CATEGORIAS_BASE, ...extras };
}
function todosIcones() {
  const extras = Object.fromEntries(Object.entries(categoriasExtras).map(([chave, dado]) => [chave, dado.icone || "📌"]));
  return { ...ICONES_BASE, ...extras };
}
function nomeCategoria(chave) { return todasCategorias()[chave] || "Geral"; }
function iconeCategoria(chave) { return todosIcones()[chave] || "📌"; }

function slugificar(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || gerarId();
}

function preencherSelectCategorias() {
  const select = document.getElementById("categoria");
  const valorAtual = select.value;
  const categorias = todasCategorias();
  select.innerHTML = Object.entries(categorias).map(([chave, nome]) => `<option value="${chave}">${seguro(nome)}</option>`).join("");
  if (valorAtual && categorias[valorAtual]) select.value = valorAtual;
}

function renderizarCategoriasAjustes() {
  const el = document.getElementById("categoriasLista");
  const chaves = Object.keys(categoriasExtras);
  el.innerHTML = chaves.length
    ? chaves.map(chave => `<span class="categoria-chip">${categoriasExtras[chave].icone || "📌"} ${seguro(categoriasExtras[chave].nome)}<button type="button" onclick="removerCategoria('${chave}')" aria-label="Remover categoria">×</button></span>`).join("")
    : '<p class="vazio-mini">Nenhuma categoria personalizada ainda.</p>';
}

function adicionarCategoria(nome, icone) {
  let chave = slugificar(nome);
  while (todasCategorias()[chave]) chave = `${chave}-2`;
  categoriasExtras[chave] = { nome: nome.trim(), icone: icone || "📌" };
  salvar();
  preencherSelectCategorias();
  renderizarCategoriasAjustes();
  fecharModal();
}

function removerCategoria(chave) {
  if (!confirm("Remover esta categoria? Lançamentos existentes continuam salvos, só o nome deixa de aparecer na lista.")) return;
  delete categoriasExtras[chave];
  salvar();
  preencherSelectCategorias();
  renderizarCategoriasAjustes();
}

function estaNoMes(item, offsetMeses = 0) {
  const dataISO = item.dataVencimento || item.criadoEm.slice(0, 10);
  const data = new Date(dataISO + "T00:00:00");
  const referencia = new Date();
  referencia.setMonth(referencia.getMonth() + offsetMeses);
  return data.getMonth() === referencia.getMonth() && data.getFullYear() === referencia.getFullYear();
}

function mesmaCompetencia(item, mesData) {
  const dataISO = item.dataVencimento || item.criadoEm.slice(0, 10);
  const dataRef = new Date(dataISO + "T00:00:00");
  return dataRef.getMonth() === mesData.getMonth() && dataRef.getFullYear() === mesData.getFullYear();
}

function calcularTotais(filtro) {
  return dados.reduce((resultado, item) => {
    if (item.status !== "concluido") return resultado;
    if (filtro && !filtro(item)) return resultado;
    resultado[item.tipo] += item.valor;
    if (item.tipo === "despesa" && item.categoria === "cartao") resultado.cartao += item.valor;
    if (item.tipo === "despesa") resultado.categorias[item.categoria || "geral"] = (resultado.categorias[item.categoria || "geral"] || 0) + item.valor;
    return resultado;
  }, { receita: 0, despesa: 0, cartao: 0, categorias: {} });
}

function totaisGerais() {
  return dados.reduce((resultado, item) => {
    if (item.status !== "concluido") return resultado;
    resultado[item.tipo] += item.valor;
    return resultado;
  }, { receita: 0, despesa: 0 });
}

function totaisPorMes(offsetMeses) { return calcularTotais(item => estaNoMes(item, offsetMeses)); }
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
  document.getElementById("destaqueIcone").textContent = iconeCategoria(chave);
  document.getElementById("destaqueTexto").innerHTML = `${nomeCategoria(chave)} <small>${moeda(valor)} · ${percentual}% dos gastos</small>`;
  card.hidden = false;
}

function processarRecorrencias() {
  const ultimosPorGrupo = new Map();
  dados.forEach(item => {
    if (item.recorrencia === "sempre" && item.recorrenciaId) {
      const atual = ultimosPorGrupo.get(item.recorrenciaId);
      if (!atual || item.dataVencimento > atual.dataVencimento) ultimosPorGrupo.set(item.recorrenciaId, item);
    }
  });
  const mesAtualRef = new Date(); mesAtualRef.setDate(1);
  ultimosPorGrupo.forEach(ultimo => {
    const dataUltima = new Date(ultimo.dataVencimento + "T00:00:00");
    if (dataUltima.getMonth() === mesAtualRef.getMonth() && dataUltima.getFullYear() === mesAtualRef.getFullYear()) return;
    const diferenca = mesesEntre(new Date(dataUltima.getFullYear(), dataUltima.getMonth(), 1), mesAtualRef);
    dados.push({ ...ultimo, id: gerarId(), dataVencimento: addMeses(ultimo.dataVencimento, diferenca), status: "pendente", criadoEm: new Date().toISOString() });
  });
}

function atualizarLabelMes() {
  const texto = mesSelecionado.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  document.getElementById("mesAtualLabel").textContent = texto;
}

function totaisMesTransacoes(mesData, aba) {
  const itensDoMes = dados.filter(item => mesmaCompetencia(item, mesData) && (aba === "todos" || (aba === "receitas" && item.tipo === "receita") || (aba === "despesas" && item.tipo === "despesa")));
  const soma = (tipoFiltro, statusFiltro) => itensDoMes.filter(i => (!tipoFiltro || i.tipo === tipoFiltro) && i.status === statusFiltro).reduce((s, i) => s + i.valor, 0);

  if (aba === "receitas") {
    const v1 = soma("receita", "concluido"), v2 = soma("receita", "pendente");
    return { itensDoMes, label: "Receitas no mês", label1: "Recebido", label2: "A Receber", valor1: v1, valor2: v2, total: v1 + v2 };
  }
  if (aba === "despesas") {
    const v1 = soma("despesa", "concluido"), v2 = soma("despesa", "pendente");
    return { itensDoMes, label: "Despesas no mês", label1: "Pago", label2: "A Pagar", valor1: v1, valor2: v2, total: v1 + v2 };
  }
  const confirmado = soma("receita", "concluido") - soma("despesa", "concluido");
  const pendente = soma("receita", "pendente") - soma("despesa", "pendente");
  return { itensDoMes, label: "Saldo previsto no mês", label1: "Confirmado", label2: "Pendente", valor1: confirmado, valor2: pendente, total: confirmado + pendente };
}

function renderizarResumoMes() {
  const r = totaisMesTransacoes(mesSelecionado, abaTransacao);
  document.getElementById("resumoMesCard").innerHTML = `
    <span class="resumo-mes-label">${r.label}</span>
    <strong class="resumo-mes-total">${moeda(r.total)}</strong>
    <div class="resumo-mes-split">
      <div class="resumo-mes-item"><span class="bolinha bolinha-ok"></span>${r.label1}<strong>${moeda(r.valor1)}</strong></div>
      <div class="resumo-mes-item"><span class="bolinha bolinha-alerta"></span>${r.label2}<strong>${moeda(r.valor2)}</strong></div>
    </div>`;
  return r.itensDoMes;
}

function renderizarListaTransacoes(itens) {
  const lista = document.getElementById("lancamentos");
  if (!itens.length) { lista.innerHTML = '<p class="vazio">Nenhum lançamento neste período.</p>'; return; }
  const ordenados = itens.slice().sort((a, b) => (a.dataVencimento || "").localeCompare(b.dataVencimento || ""));
  lista.innerHTML = ordenados.map(item => {
    const vencida = item.status === "pendente" && item.dataVencimento < hojeISO();
    const statusTexto = item.status === "concluido" ? "Confirmado" : (vencida ? "Vencido" : "Pendente");
    const statusClasse = item.status === "concluido" ? "status-ok" : (vencida ? "status-vencido" : "status-pendente");
    const classe = item.tipo === "receita" ? "valor-receita" : "valor-despesa";
    const sinal = item.tipo === "receita" ? "+" : "−";
    const tagRecorrente = item.recorrencia !== "nao" ? '<span class="tag-recorrente">Recorrente</span>' : "";
    return `<article class="item ${itemSelecionadoId === item.id ? "item-selecionado" : ""}" onclick="selecionarItem('${item.id}')">
      <div class="item-icone">${iconeCategoria(item.categoria)}</div>
      <div class="item-info">
        <strong>${seguro(item.descricao)}</strong>
        <div class="item-meta"><small>${formatarDataBR(item.dataVencimento)}</small><span class="status-pill ${statusClasse}">${statusTexto}</span>${tagRecorrente}</div>
      </div>
      <div class="item-valor"><small class="${classe}">${sinal} ${moeda(item.valor)}</small></div>
    </article>`;
  }).join("");
}

function renderizarDetalhe() {
  const container = document.getElementById("detalheLancamento");
  const item = dados.find(i => i.id === itemSelecionadoId);
  if (!item) { container.innerHTML = ""; return; }
  const vencida = item.status === "pendente" && item.dataVencimento < hojeISO();
  const jaConcluido = item.status === "concluido";
  const statusTexto = jaConcluido ? "Confirmado" : (vencida ? "Vencido" : "Pendente");
  const statusClasse = jaConcluido ? "status-ok" : (vencida ? "status-vencido" : "status-pendente");
  const acaoLabel = jaConcluido ? "Marcar como pendente" : (item.tipo === "receita" ? "Marcar como recebida" : "Marcar como paga");
  container.innerHTML = `<div class="card detalhe-card">
    <div class="detalhe-topo">
      <div>
        <div class="detalhe-tags">${item.recorrencia !== "nao" ? '<span class="tag-recorrente">Recorrente</span>' : ""}<span class="status-pill ${statusClasse}">${statusTexto}</span></div>
        <h3>${seguro(item.descricao)}</h3>
      </div>
      <div class="detalhe-acoes-icone">
        <button type="button" onclick="editarLancamento('${item.id}')" aria-label="Editar">✏️</button>
        <button type="button" onclick="removerLancamentoDetalhe('${item.id}')" aria-label="Excluir">🗑️</button>
      </div>
    </div>
    <div class="detalhe-linha"><span>Valor</span><strong>${moeda(item.valor)}</strong></div>
    <div class="detalhe-linha"><span>Data de vencimento</span><strong>${formatarDataBR(item.dataVencimento)}</strong></div>
    <div class="detalhe-linha"><span>Categoria</span><strong>${nomeCategoria(item.categoria)}</strong></div>
    ${vencida ? `<p class="detalhe-alerta">Atenção: este lançamento está vencido.</p>` : ""}
    <button type="button" class="btn-primary" onclick="alternarStatus('${item.id}')">${acaoLabel}</button>
  </div>`;
}

function selecionarItem(id) {
  itemSelecionadoId = itemSelecionadoId === id ? null : id;
  atualizar();
  if (itemSelecionadoId) {
    const el = document.getElementById("detalheLancamento");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function alternarStatus(id) {
  const item = dados.find(i => i.id === id);
  if (!item) return;
  item.status = item.status === "concluido" ? "pendente" : "concluido";
  atualizar();
}

function editarLancamento(id) {
  const item = dados.find(i => i.id === id);
  if (!item) return;
  const opcoes = Object.entries(todasCategorias()).map(([chave, nome]) => `<option value="${chave}" ${item.categoria === chave ? "selected" : ""}>${seguro(nome)}</option>`).join("");
  abrirModal("Editar lançamento", `
    <form id="formEditarLancamento" class="form-group">
      <input id="editDescricao" maxlength="80" value="${seguro(item.descricao)}" required>
      <input id="editValor" type="number" min="0.01" step="0.01" inputmode="decimal" value="${item.valor}" required>
      <select id="editCategoria">${opcoes}</select>
      <label class="campo-label">Data de vencimento</label>
      <input id="editData" type="date" value="${item.dataVencimento}" required>
      <p class="form-erro" id="erroEditarLancamento" hidden></p>
      <div class="modal-acoes">
        <button type="button" class="btn-secundario" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn-primary">Salvar</button>
      </div>
    </form>`);
  document.getElementById("formEditarLancamento").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const erroEl = document.getElementById("erroEditarLancamento");
    const novaDescricao = document.getElementById("editDescricao").value.trim();
    const novoValor = Number(document.getElementById("editValor").value);
    const novaData = document.getElementById("editData").value;
    if (!novaDescricao) return mostrarErroForm(erroEl, "Informe uma descrição.");
    if (!Number.isFinite(novoValor) || novoValor <= 0) return mostrarErroForm(erroEl, "Informe um valor válido.");
    if (!novaData) return mostrarErroForm(erroEl, "Escolha a data de vencimento.");
    item.descricao = novaDescricao;
    item.valor = novoValor;
    item.dataVencimento = novaData;
    item.categoria = document.getElementById("editCategoria").value;
    fecharModal();
    atualizar();
  });
}

function removerLancamentoDetalhe(id) {
  if (!confirm("Excluir este lançamento?")) return;
  dados = dados.filter(item => item.id !== id);
  itemSelecionadoId = null;
  atualizar();
}

function renderRelatorio() {
  const totais = obterTotaisPeriodo(periodoRelatorio);
  atualizarRelatorios(totais);
}

function atualizar() {
  processarRecorrencias();
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

  atualizarLabelMes();
  const itensDoMesTransacoes = renderizarResumoMes();
  renderizarListaTransacoes(itensDoMesTransacoes);
  renderizarDetalhe();

  desenharGrafico(mes.receita, mes.despesa);
  renderizarLegendaGrafico(mes.receita, mes.despesa);
  renderRelatorio();
  atualizarMetas();
  renderizarCategoriasAjustes();
  salvar();
}

function mostrarErroForm(elemento, mensagem) {
  elemento.textContent = mensagem;
  elemento.hidden = false;
}

function adicionar(evento) {
  evento.preventDefault();
  const erroEl = document.getElementById("erroLancamento");
  erroEl.hidden = true;
  const descricao = document.getElementById("descricao");
  const valorInput = document.getElementById("valor");
  const categoria = document.getElementById("categoria").value;
  const dataInput = document.getElementById("dataVencimento");
  const numero = Number(valorInput.value);

  if (!descricao.value.trim()) return mostrarErroForm(erroEl, "Informe uma descrição.");
  if (!Number.isFinite(numero) || numero <= 0) return mostrarErroForm(erroEl, "Informe um valor válido, maior que zero.");
  if (!dataInput.value) return mostrarErroForm(erroEl, "Escolha a data de vencimento.");

  const base = { descricao: descricao.value.trim(), tipo: tipoFormulario, categoria, criadoEm: new Date().toISOString() };

  if (recorrenciaFormulario === "parcelado") {
    const parcelas = Number(document.getElementById("numeroParcelas").value);
    if (!Number.isInteger(parcelas) || parcelas < 2) return mostrarErroForm(erroEl, "Informe o número de parcelas (mínimo 2).");
    const recorrenciaId = gerarId();
    const valorParcela = Math.round((numero / parcelas) * 100) / 100;
    let somaParcial = 0;
    for (let i = 0; i < parcelas; i++) {
      const valorAtual = i === parcelas - 1 ? Math.round((numero - somaParcial) * 100) / 100 : valorParcela;
      somaParcial += valorAtual;
      dados.push({ ...base, id: gerarId(), valor: valorAtual, descricao: `${base.descricao} (${i + 1}/${parcelas})`, dataVencimento: addMeses(dataInput.value, i), status: "pendente", recorrencia: "parcelado", recorrenciaId, parcelaAtual: i + 1, parcelaTotal: parcelas });
    }
  } else if (recorrenciaFormulario === "sempre") {
    dados.push({ ...base, id: gerarId(), valor: numero, dataVencimento: dataInput.value, status: "pendente", recorrencia: "sempre", recorrenciaId: gerarId() });
  } else {
    dados.push({ ...base, id: gerarId(), valor: numero, dataVencimento: dataInput.value, status: "pendente", recorrencia: "nao", recorrenciaId: null });
  }

  descricao.value = "";
  valorInput.value = "";
  dataInput.value = hojeISO();
  recorrenciaFormulario = "nao";
  document.querySelectorAll(".recorrencia-btn").forEach(b => b.classList.toggle("active", b.dataset.recorrencia === "nao"));
  document.getElementById("numeroParcelas").hidden = true;
  document.getElementById("numeroParcelas").value = "";
  atualizar();
  descricao.focus();
}

function atualizarRelatorios(totais) {
  const saldo = totais.receita - totais.despesa;
  document.getElementById("resumoRelatorio").innerHTML = `<div><span>Receitas</span><strong class="valor-receita">${moeda(totais.receita)}</strong></div><div><span>Despesas</span><strong class="valor-despesa">${moeda(totais.despesa)}</strong></div><div><span>Saldo</span><strong>${moeda(saldo)}</strong></div><div><span>Cartão</span><strong>${moeda(totais.cartao)}</strong></div>`;
  const categorias = Object.entries(totais.categorias).sort((a, b) => b[1] - a[1]);
  document.getElementById("categoriasRelatorio").innerHTML = categorias.length ? categorias.map(([chave, valor]) => `<div class="categoria-linha"><span>${nomeCategoria(chave)}</span><strong>${moeda(valor)}</strong><div class="barra"><i style="width:${totais.despesa ? valor / totais.despesa * 100 : 0}%"></i></div></div>`).join("") : '<p class="vazio">Adicione despesas para ver as categorias.</p>';
}

function adicionarMeta(evento) {
  evento.preventDefault();
  const erroEl = document.getElementById("erroMeta");
  erroEl.hidden = true;
  const nome = document.getElementById("nomeMeta");
  const valor = document.getElementById("valorMeta");
  const alvo = Number(valor.value);
  if (!nome.value.trim()) return mostrarErroForm(erroEl, "Dê um nome para a meta.");
  if (!Number.isFinite(alvo) || alvo <= 0) return mostrarErroForm(erroEl, "Informe um valor alvo válido.");
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
  abrirModal(`Guardar valor — ${meta.nome}`, `
    <form id="formAporte" class="form-group">
      <input id="valorAporte" type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="Quanto deseja guardar?" required>
      <p class="form-erro" id="erroAporte" hidden></p>
      <div class="modal-acoes">
        <button type="button" class="btn-secundario" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn-primary">Guardar</button>
      </div>
    </form>`);
  document.getElementById("valorAporte").focus();
  document.getElementById("formAporte").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const erroEl = document.getElementById("erroAporte");
    const valor = Number(document.getElementById("valorAporte").value);
    if (!Number.isFinite(valor) || valor <= 0) return mostrarErroForm(erroEl, "Informe um valor válido.");
    meta.valorAcumulado += valor;
    fecharModal();
    atualizar();
  });
}

function editarMeta(id) {
  const meta = metas.find(item => item.id === id);
  if (!meta) return;
  abrirModal("Editar meta", `
    <form id="formEditarMeta" class="form-group">
      <input id="editNomeMeta" maxlength="60" value="${seguro(meta.nome)}" required>
      <input id="editAlvoMeta" type="number" min="0.01" step="0.01" inputmode="decimal" value="${meta.alvo}" required>
      <p class="form-erro" id="erroEditarMeta" hidden></p>
      <div class="modal-acoes">
        <button type="button" class="btn-secundario" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn-primary">Salvar</button>
      </div>
    </form>`);
  document.getElementById("formEditarMeta").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const erroEl = document.getElementById("erroEditarMeta");
    const novoNome = document.getElementById("editNomeMeta").value.trim();
    const novoAlvo = Number(document.getElementById("editAlvoMeta").value);
    if (!novoNome) return mostrarErroForm(erroEl, "Dê um nome para a meta.");
    if (!Number.isFinite(novoAlvo) || novoAlvo <= 0) return mostrarErroForm(erroEl, "Informe um valor alvo válido.");
    meta.nome = novoNome;
    meta.alvo = novoAlvo;
    fecharModal();
    atualizar();
  });
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
}

function renderizarLegendaGrafico(receitas, despesas) {
  const el = document.getElementById("graficoLegenda");
  const total = receitas + despesas;
  const pctReceita = total ? Math.round((receitas / total) * 100) : 0;
  const pctDespesa = total ? 100 - pctReceita : 0;
  el.innerHTML = `
    <div class="legenda-item"><span class="legenda-dot" style="background:var(--green)"></span><span class="legenda-rotulo">Receitas</span><strong>${moeda(receitas)}</strong><small>${pctReceita}%</small></div>
    <div class="legenda-item"><span class="legenda-dot" style="background:var(--red)"></span><span class="legenda-rotulo">Despesas</span><strong>${moeda(despesas)}</strong><small>${pctDespesa}%</small></div>`;
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

function abrirModal(titulo, corpoHTML) {
  document.getElementById("modalTitulo").textContent = titulo;
  document.getElementById("modalCorpo").innerHTML = corpoHTML;
  const overlay = document.getElementById("modalOverlay");
  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add("modal-aberto"));
}

function fecharModal() {
  const overlay = document.getElementById("modalOverlay");
  overlay.classList.remove("modal-aberto");
  setTimeout(() => { overlay.hidden = true; document.getElementById("modalCorpo").innerHTML = ""; }, 220);
}

function exportarBackup() {
  const payload = JSON.stringify({ dados, metas, categoriasExtras, tema: localStorage.getItem("financePremiumTema") || "dark", exportadoEm: new Date().toISOString() }, null, 2);
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
      dados = migrarDados(conteudo.dados);
      metas = conteudo.metas;
      categoriasExtras = conteudo.categoriasExtras || {};
      if (conteudo.tema) aplicarTema(conteudo.tema);
      itemSelecionadoId = null;
      preencherSelectCategorias();
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
  itemSelecionadoId = null;
  atualizar();
}

document.getElementById("formLancamento").addEventListener("submit", adicionar);
document.getElementById("formMeta").addEventListener("submit", adicionarMeta);
document.getElementById("focoFormulario").addEventListener("click", () => document.getElementById("descricao").focus());
document.getElementById("limparTudo").addEventListener("click", () => { if (dados.length && confirm("Excluir todos os lançamentos?")) { dados = []; itemSelecionadoId = null; atualizar(); } });
document.querySelectorAll(".bottom-nav button").forEach(botao => botao.addEventListener("click", () => abrirAba(botao.dataset.view)));
document.getElementById("toggleTema").addEventListener("click", alternarTema);

document.querySelectorAll(".tipo-tab").forEach(botao => botao.addEventListener("click", () => {
  tipoFormulario = botao.dataset.tipo;
  document.querySelectorAll(".tipo-tab").forEach(b => b.classList.toggle("active", b === botao));
}));

document.querySelectorAll(".recorrencia-btn").forEach(botao => botao.addEventListener("click", () => {
  recorrenciaFormulario = botao.dataset.recorrencia;
  document.querySelectorAll(".recorrencia-btn").forEach(b => b.classList.toggle("active", b === botao));
  document.getElementById("numeroParcelas").hidden = recorrenciaFormulario !== "parcelado";
}));

document.getElementById("mesAnterior").addEventListener("click", () => { mesSelecionado.setMonth(mesSelecionado.getMonth() - 1); itemSelecionadoId = null; atualizar(); });
document.getElementById("mesProximo").addEventListener("click", () => { mesSelecionado.setMonth(mesSelecionado.getMonth() + 1); itemSelecionadoId = null; atualizar(); });

document.querySelectorAll(".tab-transacao").forEach(botao => botao.addEventListener("click", () => {
  abaTransacao = botao.dataset.aba;
  document.querySelectorAll(".tab-transacao").forEach(b => b.classList.toggle("active", b === botao));
  itemSelecionadoId = null;
  atualizar();
}));

document.querySelectorAll(".filtro-btn").forEach(botao => botao.addEventListener("click", () => {
  periodoRelatorio = botao.dataset.periodo;
  document.querySelectorAll(".filtro-btn").forEach(b => b.classList.toggle("active", b === botao));
  renderRelatorio();
}));

document.getElementById("exportarBackup").addEventListener("click", exportarBackup);
document.getElementById("importarBackup").addEventListener("click", () => document.getElementById("arquivoBackup").click());
document.getElementById("arquivoBackup").addEventListener("change", importarBackup);
document.getElementById("resetarApp").addEventListener("click", resetarApp);

document.getElementById("abrirNovaCategoria").addEventListener("click", () => {
  abrirModal("Nova categoria", `
    <form id="formNovaCategoria" class="form-group">
      <input id="novaCategoriaNome" maxlength="30" placeholder="Nome da categoria" required>
      <input id="novaCategoriaIcone" maxlength="4" placeholder="Emoji (opcional)">
      <p class="form-erro" id="erroNovaCategoria" hidden></p>
      <div class="modal-acoes">
        <button type="button" class="btn-secundario" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn-primary">Criar</button>
      </div>
    </form>`);
  document.getElementById("novaCategoriaNome").focus();
  document.getElementById("formNovaCategoria").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const erroEl = document.getElementById("erroNovaCategoria");
    const nome = document.getElementById("novaCategoriaNome").value.trim();
    const icone = document.getElementById("novaCategoriaIcone").value.trim();
    if (!nome) return mostrarErroForm(erroEl, "Dê um nome para a categoria.");
    adicionarCategoria(nome, icone);
  });
});

document.getElementById("modalOverlay").addEventListener("click", (evento) => {
  if (evento.target.id === "modalOverlay") fecharModal();
});

window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    const mes = totaisPorMes(0);
    desenharGrafico(mes.receita, mes.despesa);
  }, 150);
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js");

document.getElementById("dataVencimento").value = hojeISO();
preencherSelectCategorias();
aplicarTema(localStorage.getItem("financePremiumTema") || "dark");
atualizar();
