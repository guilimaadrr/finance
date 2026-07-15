const STORAGE_KEY = "financePremium";
const METAS_KEY = "financePremiumMetas";
const CATEGORIAS = { geral: "Geral", cartao: "Cartão", alimentacao: "Alimentação", moradia: "Moradia", transporte: "Transporte", lazer: "Lazer", saude: "Saúde", investimento: "Investimento" };
let dados = ler(STORAGE_KEY, []);
let metas = ler(METAS_KEY, []);

function ler(chave, padrao) { try { const valor = JSON.parse(localStorage.getItem(chave)); return Array.isArray(valor) ? valor : padrao; } catch { return padrao; } }
function salvar() { localStorage.setItem(STORAGE_KEY, JSON.stringify(dados)); localStorage.setItem(METAS_KEY, JSON.stringify(metas)); }
function moeda(valor) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor); }
function seguro(valor) { const elemento = document.createElement("span"); elemento.textContent = valor; return elemento.innerHTML; }
function totais() { return dados.reduce((resultado, item) => { resultado[item.tipo] += item.valor; if (item.tipo === "despesa" && item.categoria === "cartao") resultado.cartao += item.valor; if (item.tipo === "despesa") resultado.categorias[item.categoria || "geral"] = (resultado.categorias[item.categoria || "geral"] || 0) + item.valor; return resultado; }, { receita: 0, despesa: 0, cartao: 0, categorias: {} }); }

function atualizar() {
  const resumo = totais(); const saldo = resumo.receita - resumo.despesa;
  document.getElementById("saldo").textContent = moeda(saldo);
  document.getElementById("receitas").textContent = moeda(resumo.receita);
  document.getElementById("despesas").textContent = moeda(resumo.despesa);
  document.getElementById("economia").textContent = moeda(Math.max(saldo, 0));
  document.getElementById("cartao").textContent = moeda(resumo.cartao);
  const lista = document.getElementById("lancamentos");
  lista.innerHTML = dados.length ? dados.slice().reverse().map((item, posicao) => { const indice = dados.length - 1 - posicao; const classe = item.tipo === "receita" ? "valor-receita" : "valor-despesa"; const sinal = item.tipo === "receita" ? "+" : "−"; return `<article class="item"><div><strong>${seguro(item.descricao)}</strong><br><small>${CATEGORIAS[item.categoria] || "Geral"}</small><br><small class="${classe}">${sinal} ${moeda(item.valor)}</small></div><button type="button" onclick="remover(${indice})" aria-label="Remover lançamento">🗑️</button></article>`; }).join("") : '<p class="vazio">Ainda não há lançamentos.</p>';
  desenharGrafico(resumo.receita, resumo.despesa); atualizarRelatorios(resumo); atualizarMetas(saldo); salvar();
}

function adicionar(evento) { evento.preventDefault(); const descricao = document.getElementById("descricao"); const valor = document.getElementById("valor"); const numero = Number(valor.value); if (!descricao.value.trim() || !Number.isFinite(numero) || numero <= 0) return; dados.push({ descricao: descricao.value.trim(), valor: numero, tipo: document.getElementById("tipo").value, categoria: document.getElementById("categoria").value, criadoEm: new Date().toISOString() }); descricao.value = ""; valor.value = ""; atualizar(); descricao.focus(); }
function remover(indice) { dados.splice(indice, 1); atualizar(); }

function atualizarRelatorios(resumo) {
  const saldo = resumo.receita - resumo.despesa;
  document.getElementById("resumoRelatorio").innerHTML = `<div><span>Receitas</span><strong class="valor-receita">${moeda(resumo.receita)}</strong></div><div><span>Despesas</span><strong class="valor-despesa">${moeda(resumo.despesa)}</strong></div><div><span>Saldo</span><strong>${moeda(saldo)}</strong></div><div><span>Cartão</span><strong>${moeda(resumo.cartao)}</strong></div>`;
  const categorias = Object.entries(resumo.categorias).sort((a, b) => b[1] - a[1]);
  document.getElementById("categoriasRelatorio").innerHTML = categorias.length ? categorias.map(([chave, valor]) => `<div class="categoria-linha"><span>${CATEGORIAS[chave] || "Geral"}</span><strong>${moeda(valor)}</strong><div class="barra"><i style="width:${resumo.despesa ? valor / resumo.despesa * 100 : 0}%"></i></div></div>`).join("") : '<p class="vazio">Adicione despesas para ver as categorias.</p>';
}

function adicionarMeta(evento) { evento.preventDefault(); const nome = document.getElementById("nomeMeta"); const valor = document.getElementById("valorMeta"); const alvo = Number(valor.value); if (!nome.value.trim() || !Number.isFinite(alvo) || alvo <= 0) return; metas.push({ nome: nome.value.trim(), alvo }); nome.value = ""; valor.value = ""; atualizar(); }
function atualizarMetas(saldo) { const poupado = Math.max(saldo, 0); const lista = document.getElementById("listaMetas"); lista.innerHTML = metas.length ? metas.map((meta, indice) => { const percentual = Math.min(poupado / meta.alvo * 100, 100); return `<article class="meta-item"><div><strong>${seguro(meta.nome)}</strong><br><small>${moeda(poupado)} de ${moeda(meta.alvo)} · ${percentual.toFixed(0)}%</small><div class="progresso"><i style="width:${percentual}%"></i></div></div><button type="button" onclick="removerMeta(${indice})" aria-label="Excluir meta">🗑️</button></article>`; }).join("") : '<p class="vazio">Crie uma meta para acompanhar sua economia.</p>'; }
function removerMeta(indice) { metas.splice(indice, 1); atualizar(); }

function desenharGrafico(receitas, despesas) { const canvas = document.getElementById("graficoFinanceiro"); const vazio = document.getElementById("graficoVazio"); const total = receitas + despesas; vazio.hidden = total > 0; const medida = Math.min(canvas.parentElement.clientWidth, 230); const escala = window.devicePixelRatio || 1; canvas.width = medida * escala; canvas.height = medida * escala; canvas.style.width = `${medida}px`; canvas.style.height = `${medida}px`; const contexto = canvas.getContext("2d"); contexto.scale(escala, escala); contexto.clearRect(0, 0, medida, medida); if (!total) return; const centro = medida / 2, raio = medida * .34, inicio = -Math.PI / 2, angulo = receitas / total * Math.PI * 2; contexto.lineWidth = medida * .14; contexto.lineCap = "round"; contexto.beginPath(); contexto.strokeStyle = "#22c55e"; contexto.arc(centro, centro, raio, inicio, inicio + angulo); contexto.stroke(); contexto.beginPath(); contexto.strokeStyle = "#ef4444"; contexto.arc(centro, centro, raio, inicio + angulo, inicio + Math.PI * 2); contexto.stroke(); contexto.fillStyle = "#fff"; contexto.font = `600 ${medida * .085}px system-ui`; contexto.textAlign = "center"; contexto.fillText("Resumo", centro, centro - 5); contexto.fillStyle = "#94a3b8"; contexto.font = `${medida * .06}px system-ui`; contexto.fillText(moeda(receitas - despesas), centro, centro + medida * .09); }

function abrirAba(nome) { if (nome === "ajustes") { alert("Os ajustes serão adicionados na próxima etapa."); return; } document.getElementById("homeView").hidden = nome !== "home"; document.getElementById("relatoriosView").hidden = nome !== "relatorios"; document.getElementById("metasView").hidden = nome !== "metas"; document.getElementById("focoFormulario").hidden = nome !== "home"; document.querySelectorAll(".bottom-nav button").forEach(botao => botao.classList.toggle("active", botao.dataset.view === nome)); window.scrollTo({ top: 0, behavior: "smooth" }); }

document.getElementById("formLancamento").addEventListener("submit", adicionar);
document.getElementById("formMeta").addEventListener("submit", adicionarMeta);
document.getElementById("focoFormulario").addEventListener("click", () => document.getElementById("descricao").focus());
document.getElementById("limparTudo").addEventListener("click", () => { if (dados.length && confirm("Excluir todos os lançamentos?")) { dados = []; atualizar(); } });
document.querySelectorAll(".bottom-nav button").forEach(botao => botao.addEventListener("click", () => abrirAba(botao.dataset.view)));
window.addEventListener("resize", atualizar);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js");
atualizar();
