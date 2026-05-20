const STORAGE_KEY = "zapflow-lite-clients-v1";

const statuses = [
  { id: "novo", label: "Novo" },
  { id: "aguardando", label: "Aguardando resposta" },
  { id: "orcamento", label: "Orçamento enviado" },
  { id: "fechado", label: "Fechado" },
  { id: "perdido", label: "Perdido" },
];

const templates = [
  ["Primeiro retorno", "Olá, {nome}! Tudo bem? Vi seu contato aqui e queria entender melhor como posso te ajudar."],
  ["Cobrar orçamento", "Olá, {nome}! Tudo bem? Passando para saber se conseguiu analisar o orçamento. Posso te ajudar com alguma dúvida?"],
  ["Confirmar fechamento", "Perfeito, {nome}! Posso seguir com a proposta no valor de {valor}?"],
  ["Reativar cliente", "Oi, {nome}! Faz um tempinho que conversamos. Ainda precisa de ajuda com o que tinha me pedido?"],
];

let clients = readClients();
let currentTemplate = templates[1][1];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const els = {
  app: $("#app"),
  openButtons: [$("#openAppTop"), $("#openAppHero"), $("#openAppPrice")],
  navButtons: $$(".nav-button"),
  views: $$(".view"),
  viewTitle: $("#viewTitle"),
  quickAdd: $("#quickAdd"),
  form: $("#clientForm"),
  editingId: $("#editingId"),
  name: $("#clientName"),
  phone: $("#clientPhone"),
  value: $("#clientValue"),
  status: $("#clientStatus"),
  followup: $("#clientFollowup"),
  source: $("#clientSource"),
  notes: $("#clientNotes"),
  clearForm: $("#clearForm"),
  metricOpenValue: $("#metricOpenValue"),
  metricActiveClients: $("#metricActiveClients"),
  metricDueFollowups: $("#metricDueFollowups"),
  metricClosedValue: $("#metricClosedValue"),
  priorityList: $("#priorityList"),
  funnelSummary: $("#funnelSummary"),
  pipelineBoard: $("#pipelineBoard"),
  templateList: $("#templateList"),
  seedDemo: $("#seedDemo"),
  exportData: $("#exportData"),
  importData: $("#importData"),
  clearData: $("#clearData"),
  dataPreview: $("#dataPreview"),
};

function init() {
  els.status.innerHTML = statuses.map((s) => `<option value="${s.id}">${s.label}</option>`).join("");
  els.openButtons.forEach((button) => button && button.addEventListener("click", openApp));
  els.quickAdd.addEventListener("click", () => showView("client"));
  els.navButtons.forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
  els.form.addEventListener("submit", onSubmitClient);
  els.clearForm.addEventListener("click", resetForm);
  els.seedDemo.addEventListener("click", seedDemoData);
  els.exportData.addEventListener("click", exportData);
  els.importData.addEventListener("change", importData);
  els.clearData.addEventListener("click", clearData);
  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
  renderAll();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
}

function openApp() {
  els.app.classList.remove("hidden");
  els.app.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showView(view) {
  const titles = { dashboard: "Painel", pipeline: "Funil de atendimento", client: "Novo cliente", templates: "Mensagens prontas", settings: "Dados e backup" };
  els.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  els.views.forEach((section) => section.classList.remove("active-view"));
  $(`#${view}View`)?.classList.add("active-view");
  els.viewTitle.textContent = titles[view] || "Painel";
}

function readClients() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; }
}

function saveClients() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  renderAll();
}

function onSubmitClient(event) {
  event.preventDefault();
  const id = els.editingId.value || makeId();
  const old = clients.find((client) => client.id === id);
  const client = {
    id,
    name: els.name.value.trim(),
    phone: onlyNumbers(els.phone.value),
    value: Number(els.value.value || 0),
    status: els.status.value,
    followup: els.followup.value,
    source: els.source.value.trim(),
    notes: els.notes.value.trim(),
    createdAt: old?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (!client.name) return;
  clients = old ? clients.map((item) => item.id === id ? client : item) : [client, ...clients];
  resetForm();
  saveClients();
  showView("dashboard");
}

function resetForm() {
  els.form.reset();
  els.editingId.value = "";
  els.status.value = "novo";
}

function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.action === "edit") editClient(id);
  if (button.dataset.action === "delete") deleteClient(id);
  if (button.dataset.action === "copy") copyMessage(id);
  if (button.dataset.action === "template") selectTemplate(Number(button.dataset.index));
}

function handleChange(event) {
  const select = event.target.closest("[data-status-select]");
  if (!select) return;
  const client = clients.find((item) => item.id === select.dataset.id);
  if (!client) return;
  client.status = select.value;
  client.updatedAt = new Date().toISOString();
  saveClients();
}

function editClient(id) {
  const client = clients.find((item) => item.id === id);
  if (!client) return;
  els.editingId.value = client.id;
  els.name.value = client.name;
  els.phone.value = client.phone;
  els.value.value = client.value;
  els.status.value = client.status;
  els.followup.value = client.followup || "";
  els.source.value = client.source || "";
  els.notes.value = client.notes || "";
  showView("client");
  openApp();
}

function deleteClient(id) {
  const client = clients.find((item) => item.id === id);
  if (!client) return;
  if (!confirm(`Apagar ${client.name}?`)) return;
  clients = clients.filter((item) => item.id !== id);
  saveClients();
}

async function copyMessage(id) {
  const client = clients.find((item) => item.id === id);
  if (!client) return;
  const message = buildMessage(currentTemplate, client);
  try {
    await navigator.clipboard.writeText(message);
    alert("Mensagem copiada. Agora é só colar no WhatsApp do cliente.");
  } catch {
    prompt("Copie a mensagem:", message);
  }
}

function selectTemplate(index) {
  currentTemplate = templates[index]?.[1] || templates[1][1];
  alert("Modelo selecionado. O botão de copiar mensagem vai usar esse texto.");
}

function buildMessage(template, client) {
  return template
    .replaceAll("{nome}", client.name)
    .replaceAll("{valor}", formatMoney(client.value))
    .replaceAll("{status}", getStatusLabel(client.status));
}

function renderAll() {
  renderMetrics();
  renderPriorityList();
  renderFunnelSummary();
  renderPipeline();
  renderTemplates();
  renderDataPreview();
}

function renderMetrics() {
  const active = clients.filter((client) => !["fechado", "perdido"].includes(client.status));
  const openValue = active.reduce((sum, client) => sum + Number(client.value || 0), 0);
  const closedValue = clients.filter((client) => client.status === "fechado").reduce((sum, client) => sum + Number(client.value || 0), 0);
  els.metricOpenValue.textContent = formatMoney(openValue);
  els.metricActiveClients.textContent = active.length;
  els.metricDueFollowups.textContent = active.filter((client) => isDue(client.followup)).length;
  els.metricClosedValue.textContent = formatMoney(closedValue);
}

function renderPriorityList() {
  const active = clients.filter((client) => !["fechado", "perdido"].includes(client.status));
  const priority = active.sort((a, b) => Number(isDue(b.followup)) - Number(isDue(a.followup))).slice(0, 6);
  els.priorityList.innerHTML = priority.length ? priority.map(renderClientCard).join("") : emptyState("Nenhum cliente cadastrado", "Clique em popular demo ou cadastre seu primeiro cliente.");
}

function renderFunnelSummary() {
  els.funnelSummary.innerHTML = statuses.map((status) => {
    const list = clients.filter((client) => client.status === status.id);
    const value = list.reduce((sum, client) => sum + Number(client.value || 0), 0);
    return `<div class="funnel-row"><span>${status.label} • ${list.length}</span><strong>${formatMoney(value)}</strong></div>`;
  }).join("");
}

function renderPipeline() {
  els.pipelineBoard.innerHTML = statuses.map((status) => {
    const list = clients.filter((client) => client.status === status.id);
    return `<div class="pipeline-column"><h3>${status.label} <span class="chip">${list.length}</span></h3>${list.length ? list.map(renderClientCard).join("") : emptyState("Vazio", "Sem clientes nesta etapa.")}</div>`;
  }).join("");
}

function renderClientCard(client) {
  const due = isDue(client.followup);
  const statusOptions = statuses.map((status) => `<option value="${status.id}" ${status.id === client.status ? "selected" : ""}>${status.label}</option>`).join("");
  return `
    <article class="client-card">
      <header><div><h4>${escapeHtml(client.name)}</h4><p>${client.source ? escapeHtml(client.source) + " • " : ""}${getStatusLabel(client.status)}</p></div><strong>${formatMoney(client.value)}</strong></header>
      <p>${client.notes ? escapeHtml(client.notes) : "Sem observações."}</p>
      <div><span class="chip ${due ? "due" : "ok"}">${client.followup ? `Retorno: ${formatDate(client.followup)}` : "Sem retorno"}</span></div>
      <div class="client-actions">
        <button class="card-button whats" data-action="copy" data-id="${client.id}">Copiar mensagem</button>
        <button class="card-button" data-action="edit" data-id="${client.id}">Editar</button>
        <select data-status-select data-id="${client.id}">${statusOptions}</select>
        <button class="card-button delete" data-action="delete" data-id="${client.id}">Apagar</button>
      </div>
    </article>
  `;
}

function renderTemplates() {
  els.templateList.innerHTML = templates.map((template, index) => `
    <article class="template-card">
      <h3>${template[0]}</h3>
      <p>${template[1]}</p>
      <button class="card-button whats" data-action="template" data-index="${index}">Usar este modelo</button>
    </article>
  `).join("");
}

function seedDemoData() {
  const now = new Date();
  const addDays = (days) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };
  clients = [
    makeClient("Ana Souza", "43999990001", 850, "orcamento", addDays(0), "Instagram", "Quer orçamento para pacote mensal."),
    makeClient("Mercado Bom Preço", "43999990002", 2400, "aguardando", addDays(-1), "Indicação", "Pediu retorno com proposta simplificada."),
    makeClient("Lucas Pereira", "43999990003", 430, "novo", addDays(1), "WhatsApp", "Ainda não recebeu proposta."),
    makeClient("Clínica Bela Face", "43999990004", 3200, "fechado", "", "Google", "Fechado pacote inicial."),
  ];
  saveClients();
}

function makeClient(name, phone, value, status, followup, source, notes) {
  return { id: makeId(), name, phone, value, status, followup, source, notes, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

function exportData() {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), clients }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `zapflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const imported = Array.isArray(parsed) ? parsed : parsed.clients;
      if (!Array.isArray(imported)) throw new Error("invalid");
      clients = imported;
      saveClients();
      alert("Dados importados com sucesso.");
    } catch {
      alert("Não consegui importar esse arquivo JSON.");
    }
  };
  reader.readAsText(file);
}

function clearData() {
  if (!confirm("Apagar todos os clientes salvos neste navegador?")) return;
  clients = [];
  saveClients();
}

function renderDataPreview() {
  els.dataPreview.value = JSON.stringify({ clients }, null, 2);
}

function formatMoney(value) { return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function onlyNumbers(value) { return String(value || "").replace(/\D/g, ""); }
function makeId() { return `zfl_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
function getStatusLabel(id) { return statuses.find((s) => s.id === id)?.label || id; }
function formatDate(date) { return date ? new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR") : ""; }
function isDue(date) {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${date}T00:00:00`) <= today;
}
function emptyState(title, text) { return `<div class="client-card"><h4>${title}</h4><p>${text}</p></div>`; }
function escapeHtml(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

init();
