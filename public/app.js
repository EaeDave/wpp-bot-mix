const $ = (q) => document.querySelector(q);
const logs = $('#logs');
function appendLog(line) {
  logs.textContent += line + '\n';
  logs.scrollTop = logs.scrollHeight;
}

const socket = io();
socket.on('log', appendLog);
socket.on('qr', (dataURL) => {
  const qrBox = $('#qrBox');
  qrBox.innerHTML = `<img src="${dataURL}" alt="QR" />`;
});

async function api(path, opts = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) {
    let msg = '';
    try { msg = (await res.json()).error; } catch (_){ msg = await res.text(); }
    throw new Error(msg || 'erro http');
  }
  return res.json();
}

async function refreshStatus() {
  const s = await api('/status');
  $('#connState').textContent = s.ready ? 'Conectado ao WhatsApp' : (s.authenticated ? 'Autenticando...' : 'Aguardando conexão...');
  if (s.qr && !$('#qrBox img')) {
    $('#qrBox').innerHTML = `<img src="${s.qr}" alt="QR" />`;
  }
  // group
  if (s.savedGroup) {
    $('#savedGroup').classList.remove('hidden');
    $('#savedGroup').textContent = `Grupo salvo: ${s.savedGroup.name} (${s.savedGroup.id})`;
  } else {
    $('#savedGroup').classList.add('hidden');
    $('#savedGroup').textContent = '';
  }
  // store
  if (s.store) {
    $('#storeSaved').classList.remove('hidden');
    $('#storeSaved').innerHTML = `IP salvo: <strong>${s.store.ip}</strong>${s.store.name ? ' — ' + s.store.name : ''}`;
    $('#storeNameInput').value = s.store.name || '';
    $('#storeIpInput').value = s.store.ip || '';
  } else {
    $('#storeSaved').classList.add('hidden');
    $('#storeSaved').textContent = '';
  }
  // auto + regex
  $('#autoToggle').checked = !!s.autoMode;
  $('#codeRegex').value = s.codeRegex || '^\\d{4,}$';
}

async function loadGroups() {
  const res = await api('/groups');
  const search = $('#searchGroup').value.trim().toLowerCase();
  const select = $('#groupsList');
  select.innerHTML = '';
  res.groups
    .filter(g => !search || g.name.toLowerCase().includes(search))
    .forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id;
      opt.textContent = `${g.name} — ${g.id}`;
      select.appendChild(opt);
    });
  if (!select.children.length) {
    const opt = document.createElement('option');
    opt.textContent = 'Nenhum grupo encontrado (escaneie o QR e tente atualizar).';
    select.appendChild(opt);
  }
}

// store IP handlers
$('#btnSaveIP').addEventListener('click', async () => {
  const name = $('#storeNameInput').value.trim();
  const ip = $('#storeIpInput').value.trim();
  if (!ip) return alert('Informe o IP.');
  try {
    await api('/set-ip', { method: 'POST', body: JSON.stringify({ ip, name }) });
    appendLog(`IP salvo: ${ip}${name ? ' (' + name + ')' : ''}`);
    await refreshStatus();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
});

$('#btnClearIP').addEventListener('click', async () => {
  try {
    await api('/clear-ip', { method: 'POST' });
    appendLog('IP salvo apagado.');
    $('#storeNameInput').value = '';
    $('#storeIpInput').value = '';
    await refreshStatus();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
});

// auto + regex
$('#autoToggle').addEventListener('change', async (e) => {
  try {
    await api('/set-auto', { method: 'POST', body: JSON.stringify({ on: e.target.checked }) });
    appendLog('Modo automático: ' + (e.target.checked ? 'ATIVO' : 'PAUSADO'));
  } catch (err) {
    alert('Erro: ' + err.message);
    await refreshStatus();
  }
});

$('#btnSaveRegex').addEventListener('click', async () => {
  const pattern = $('#codeRegex').value.trim();
  try {
    await api('/set-regex', { method: 'POST', body: JSON.stringify({ pattern }) });
    appendLog('Regex atualizada para: ' + pattern);
  } catch (e) {
    alert('Erro: ' + e.message);
  }
});

// group handlers
$('#btnKnowId').addEventListener('click', () => {
  $('#knowIdPanel').classList.remove('hidden');
  $('#dontKnowPanel').classList.add('hidden');
});
$('#btnDontKnowId').addEventListener('click', async () => {
  $('#dontKnowPanel').classList.remove('hidden');
  $('#knowIdPanel').classList.add('hidden');
  await loadGroups();
});
$('#btnReloadGroups').addEventListener('click', loadGroups);
$('#searchGroup').addEventListener('input', loadGroups);

$('#btnSetGroup').addEventListener('click', async () => {
  const id = $('#groupIdInput').value.trim();
  if (!id) return alert('Informe o ID.');
  try {
    const r = await api('/set-group', { method: 'POST', body: JSON.stringify({ groupId: id }) });
    appendLog(`Grupo salvo: ${r.saved.name} (${r.saved.id})`);
    await refreshStatus();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
});

$('#btnJoinInvite').addEventListener('click', async () => {
  const invite = $('#inviteInput').value.trim();
  if (!invite) return alert('Cole o link de convite.');
  try {
    const r = await api('/join-invite', { method: 'POST', body: JSON.stringify({ invite }) });
    appendLog(`Convite processado. Código: ${r.code}. Atualize a lista e selecione o grupo.`);
  } catch (e) {
    alert('Erro: ' + e.message);
  }
});

$('#btnSelectGroup').addEventListener('click', async () => {
  const sel = $('#groupsList').value;
  if (!sel) return alert('Selecione um grupo.');
  try {
    const r = await api('/select-group', { method: 'POST', body: JSON.stringify({ groupId: sel }) });
    appendLog(`Grupo salvo: ${r.saved.name} (${r.saved.id})`);
    await refreshStatus();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
});

$('#btnClearGroup').addEventListener('click', async () => {
  await api('/clear-group', { method: 'POST' });
  appendLog('Grupo salvo apagado.');
  await refreshStatus();
});

$('#btnSendTest').addEventListener('click', async () => {
  try {
    await api('/send-test', { method: 'POST' });
    appendLog('Mensagem de teste enviada.');
  } catch (e) {
    alert('Erro: ' + e.message);
  }
});

// ====== Manutenção (UI) ======
async function postMaintenance(at, message, exitAfter) {
  await api('/announce-maintenance', {
    method: 'POST',
    body: JSON.stringify({ at, message, exitAfter })
  });
  appendLog(`Manutenção: ${at} — ${message || '(mensagem padrão)'}${exitAfter ? ' (encerrar após enviar)' : ''}`);
}
$('#btnMaintNow').addEventListener('click', async () => {
  const msg = $('#maintMsg').value.trim() || null;
  const exitAfter = $('#maintExit').checked;
  try {
    await postMaintenance('agora', msg, exitAfter);
    if (exitAfter) appendLog('O processo será encerrado após o envio do aviso.');
  } catch (e) { alert('Erro: ' + e.message); }
});
$('#btnMaintSchedule').addEventListener('click', async () => {
  const when = $('#maintWhen').value.trim();
  if (!when) return alert('Preencha o "Quando". Ex.: em 30m, 2025-12-31 22:00, agora');
  const msg = $('#maintMsg').value.trim() || null;
  const exitAfter = $('#maintExit').checked;
  try {
    await postMaintenance(when, msg, exitAfter);
    appendLog(`Agendado: ${when}`);
    if (exitAfter) appendLog('O processo será encerrado após o envio do aviso.');
  } catch (e) { alert('Erro: ' + e.message); }
});

// boot
refreshStatus();
setInterval(refreshStatus, 4000);
