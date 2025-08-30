/**
 * WPP Bot — © 2025 Urich
 * Ideia: Urich
 * Automação RUB (Selenium): eudaverdgs@gmail.com
 * Melhorias/ajustes: leozinho.yukih@gmail.com
 * Licença: MIT (veja LICENSE)
 */

// server.js
// UI web + fila + execução automática: código no grupo -> selenium.js -> envia PDF.
// Usa seu Chrome (sem baixar Chromium). QR na página, salvar IP/Grupo, autoMode e regex via UI.

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const cors = require('cors');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const {
  readConfig,
  setGroup,
  clearGroup,
  setStoreIP,
  clearStoreIP,
  setAutoMode,
  setCodeRegex
} = require('./storage');
const child_process = require('child_process');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const STATE = {
  ready: false,
  authenticated: false,
  loading: true
};

function broadcast(event, payload) {
  io.sockets.emit(event, payload);
}

function log(msg) {
  const stamp = new Date().toLocaleTimeString();
  const line = `[${stamp}] ${msg}`;
  console.log(line);
  broadcast('log', line);
}

let qrDataURL = null;

// ===== Helpers manutenção (UI) =====
function parseWhen(s) {
  if (!s) return null;
  const lower = String(s).toLowerCase();
  if (lower === 'agora' || lower === 'now') return new Date();
  const em = lower.match(/^em\s+(\d+)\s*([mh])$/); // "em 30m"/"em 2h"
  if (em) {
    const n = parseInt(em[1], 10);
    const unit = em[2];
    const d = new Date();
    if (unit === 'm') d.setMinutes(d.getMinutes() + n);
    if (unit === 'h') d.setHours(d.getHours() + n);
    return d;
  }
  const d = new Date(String(s).replace(' ', 'T')); // "YYYY-MM-DD HH:mm"
  return isNaN(d.getTime()) ? null : d;
}

// ==== WhatsApp client ====

// Chrome do sistema (evita baixar Chromium)
const BROWSER_PATH = process.env.PUPPETEER_EXECUTABLE_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// Cache da versão do WhatsApp Web (estabiliza mudanças do WA)
const useRemoteCache = process.env.WWEBJS_USE_REMOTE_CACHE === '1';
const webVersionCache = useRemoteCache
  ? 'remote'
  : { type: 'local', path: path.join(__dirname, '.wwebjs_cache') };

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, 'wwebjs_auth') }),
  puppeteer: {
    executablePath: BROWSER_PATH,
    headless: false,
    protocolTimeout: 180000,
    // ⚠️ NÃO use userDataDir com LocalAuth
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1200,900'
    ]
  },
  webVersionCache,
  takeoverOnConflict: true,
  takeoverTimeoutMs: 8000
});

client.on('qr', async (qr) => {
  try {
    qrDataURL = await QRCode.toDataURL(qr);
    log('QR gerado. Escaneie com o WhatsApp do seu celular.');
    broadcast('qr', qrDataURL);
  } catch (e) {
    log('Falha ao gerar QR: ' + e.message);
  }
});

client.on('loading_screen', (percent, message) => {
  log(`Carregando WhatsApp (${percent || 0}%) ${message || ''}`);
});

client.on('authenticated', () => {
  STATE.authenticated = true;
  log('Autenticado com sucesso.');
});

client.on('auth_failure', (m) => {
  log('Falha de autenticação: ' + (m || ''));
});

client.on('ready', async () => {
  STATE.ready = true;
  STATE.loading = false;
  try {
    const wv = await client.getWWebVersion?.();
    if (wv) log('WWeb version: ' + wv);
  } catch {}
  log('Cliente pronto.');

  const cfg = readConfig();
  if (cfg.groupId) {
    try {
      const chat = await client.getChatById(cfg.groupId);
      const name = chat?.name || cfg.groupName || 'Grupo';
      setGroup(cfg.groupId, name); // mantém nome atualizado
      log(`Grupo salvo encontrado: ${name} (${cfg.groupId}).`);
      await client.sendMessage(cfg.groupId, `🤖 Bot online. Modo automático: ${cfg.autoMode ? 'ATIVO' : 'PAUSADO'}`);
    } catch (e) {
      log('Não foi possível acessar o grupo salvo. Limpe e selecione novamente.');
    }
  } else {
    log('Nenhum grupo salvo ainda. Use a interface para selecionar/definir o grupo.');
  }
});

client.on('change_state', s => log('change_state: ' + s));
client.on('disconnected', r => {
  STATE.ready = false;
  STATE.authenticated = false;
  log('Desconectado: ' + r);
});

// ---------- Logs focados no grupo salvo ----------
client.on('message_create', (m) => {
  try {
    const cfg = readConfig();

    const chatId =
      m?.from ||
      m?.to ||
      m?.id?._serialized ||
      m?.id?.remote ||
      '';

    const isStatus = chatId === 'status@broadcast' || m?.isStatus;
    if (isStatus) return;

    if (cfg?.groupId && chatId !== cfg.groupId) return;

    const body = (m?.body || '').trim();
    if (body) log(`message_create: ${chatId} :: "${body}"`);
  } catch {}
});

client.initialize();

// ==== Fila de execução (um código por vez) ====
const fila = [];
let processando = false;

function pushFila(item) {
  fila.push(item);
  if (!processando) processarFila();
}

async function processarFila() {
  processando = true;
  while (fila.length) {
    const job = fila.shift();
    try {
      await executarSelenium(job.codigo, job.chatId);
    } catch (e) {
      log(`Falha no job ${job.codigo}: ${e.message}`);
      if (job.chatId) {
        try { await client.sendMessage(job.chatId, `❌ Erro ao gerar/enviar PDF do código ${job.codigo}.`); } catch {}
      }
    }
  }
  processando = false;
}

async function executarSelenium(codigo, chatId) {
  const cfg = readConfig();

  // cria pasta downloads se não existir
  const downloadsDir = path.join(__dirname, 'downloads');
  if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

  log(`⏳ Rodando selenium.js para código ${codigo} ...`);
  const startMark = Date.now();

  await new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'selenium.js');
    const env = { ...process.env };
    if (cfg.storeIP) env.STORE_IP = cfg.storeIP;
    if (cfg.storeName) env.STORE_NAME = cfg.storeName;
    if (cfg.rubUser) env.RUB_USER = cfg.rubUser;
    if (cfg.rubPass) env.RUB_PASS = cfg.rubPass;

    const cmd = `node "${scriptPath}" ${codigo}`;
    child_process.exec(cmd, { env }, (err, stdout, stderr) => {
      if (stdout) log(stdout.trim());
      if (stderr) log(stderr.trim());
      if (err) return reject(err);
      resolve();
    });
  });

  // Prioridade: downloads/<codigo>.pdf; fallback: PDF mais novo após startMark
  const alvoPreferido = path.join(downloadsDir, `${codigo}.pdf`);
  let pdfFile = fs.existsSync(alvoPreferido) ? alvoPreferido : null;

  if (!pdfFile) {
    const files = fs.readdirSync(downloadsDir)
      .filter(n => /\.pdf$/i.test(n))
      .map(n => {
        const p = path.join(downloadsDir, n);
        const m = fs.statSync(p).mtimeMs;
        return { p, m };
      })
      .filter(o => o.m >= startMark - 5000) // tolerância de 5s
      .sort((a, b) => b.m - a.m);
    if (files[0]) pdfFile = files[0].p;
  }

  if (!pdfFile) throw new Error('PDF não encontrado após execução.');

  log(`📄 PDF localizado: ${path.basename(pdfFile)} — enviando ao grupo...`);
  const media = await MessageMedia.fromFilePath(pdfFile);
  const caption = `PDF gerado para código ${codigo}`;

  // Retry simples (3 tentativas)
  for (let i = 1; i <= 3; i++) {
    try {
      await client.sendMessage(chatId || readConfig().groupId, media, { caption, sendMediaAsDocument: true });
      log('✅ PDF enviado.');
      return;
    } catch (e) {
      log(`Tentativa ${i} de envio falhou: ${e.message}`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error('Falha ao enviar PDF após 3 tentativas.');
}

// ==== Listener de mensagens (modo automático) ====
// Quando alguém manda um "código" no grupo salvo, roda selenium.js e envia o PDF.
client.on('message', async (message) => {
  try {
    const cfg = readConfig();
    if (!cfg.autoMode || !cfg.groupId) return;
    if (message.from === 'status@broadcast' || message.isStatus) return; // ignora status
    if (message.from !== cfg.groupId) return; // só o grupo salvo
    if (message.fromMe) return;

    const body = (message.body || '').trim();
    if (!body) return;

    const regex = new RegExp(cfg.codeRegex);
    if (!regex.test(body)) {
      await client.sendMessage(cfg.groupId, '⚠️ Envie apenas 1 código numérico por mensagem.');
      return;
    }

    log(`📥 Código detectado: "${body}".`);
    await client.sendMessage(cfg.groupId, `🔎 Recebi o código **${body}**. Gerando o PDF...`);
    pushFila({ codigo: body, chatId: cfg.groupId });
  } catch (e) {
    log('Erro no listener de mensagem: ' + e.message);
  }
});

// ==== API HTTP (usada pela UI) ====

app.get('/status', async (req, res) => {
  const cfg = readConfig();
  res.json({
    ok: true,
    ...STATE,
    qr: qrDataURL,
    savedGroup: cfg.groupId ? { id: cfg.groupId, name: cfg.groupName } : null,
    store: cfg.storeIP ? { ip: cfg.storeIP, name: cfg.storeName || null } : null,
    autoMode: cfg.autoMode,
    codeRegex: cfg.codeRegex
  });
});

app.post('/set-ip', (req, res) => {
  const { ip, name } = req.body || {};
  if (!ip) return res.status(400).json({ ok: false, error: 'ip é obrigatório' });
  setStoreIP(ip, name);
  log(`IP da loja salvo: ${ip}${name ? ' (' + name + ')' : ''}`);
  res.json({ ok: true });
});

app.post('/clear-ip', (req, res) => {
  clearStoreIP();
  log('IP da loja apagado.');
  res.json({ ok: true });
});

app.post('/set-auto', (req, res) => {
  const { on } = req.body || {};
  setAutoMode(!!on);
  log('Modo automático: ' + (on ? 'ATIVO' : 'PAUSADO'));
  res.json({ ok: true });
});

app.post('/set-regex', (req, res) => {
  const { pattern } = req.body || {};
  setCodeRegex(pattern || '^\\d{4,}$');
  log('Regex de captura atualizada: ' + (pattern || '^\\d{4,}$'));
  res.json({ ok: true });
});

app.get('/groups', async (req, res) => {
  try {
    const chats = await client.getChats();
    const groups = chats
      .filter(c => c.isGroup)
      .map(c => ({ id: c.id._serialized, name: c.name || '(sem nome)' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    res.json({ ok: true, groups });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post('/set-group', async (req, res) => {
  const { groupId } = req.body || {};
  if (!groupId) return res.status(400).json({ ok: false, error: 'groupId é obrigatório' });
  try {
    const chat = await client.getChatById(groupId);
    const name = chat?.name || 'Grupo';
    setGroup(groupId, name);
    log(`Grupo salvo: ${name} (${groupId}).`);
    res.json({ ok: true, saved: { id: groupId, name } });
  } catch (e) {
    res.status(400).json({ ok: false, error: 'ID inválido ou inacessível. Entre no grupo com esta conta e tente novamente.' });
  }
});

app.post('/select-group', async (req, res) => {
  const { groupId } = req.body || {};
  if (!groupId) return res.status(400).json({ ok: false, error: 'groupId é obrigatório' });
  try {
    const chat = await client.getChatById(groupId);
    const name = chat?.name || 'Grupo';
    setGroup(groupId, name);
    log(`Grupo salvo: ${name} (${groupId}).`);
    res.json({ ok: true, saved: { id: groupId, name } });
  } catch (e) {
    res.status(400).json({ ok: false, error: 'ID inválido ou inacessível.' });
  }
});

app.post('/clear-group', (req, res) => {
  clearGroup();
  log('Grupo salvo apagado.');
  res.json({ ok: true });
});

app.post('/join-invite', async (req, res) => {
  try {
    const { invite } = req.body || {};
    if (!invite) return res.status(400).json({ ok: false, error: 'invite é obrigatório' });
    const codeMatch = invite.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/i);
    const code = codeMatch ? codeMatch[1] : invite;
    log(`Tentando aceitar convite com código: ${code}`);
    const result = await client.acceptInvite(code);
    log(`Convite aceito? Resposta: ${result}`);
    const chats = await client.getChats();
    const groups = chats.filter(c => c.isGroup).map(c => ({ id: c.id._serialized, name: c.name }));
    res.json({ ok: true, code, groups });
  } catch (e) {
    log('Falha ao aceitar convite: ' + e.message);
    res.status(400).json({ ok: false, error: String(e) });
  }
});

app.post('/send-test', async (req, res) => {
  try {
    const cfg = readConfig();
    if (!cfg.groupId) return res.status(400).json({ ok: false, error: 'Nenhum grupo salvo.' });
    await client.sendMessage(cfg.groupId, '✅ Teste: o bot está ativo e consegue enviar mensagens aqui.');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// Execução manual do selenium + envio de PDF
app.post('/run-selenium', async (req, res) => {
  try {
    const { codigo, pdfPath } = req.body || {};
    const cfg = readConfig();
    if (!cfg.groupId) return res.status(400).json({ ok: false, error: 'Nenhum grupo salvo para envio.' });

    if (!codigo && !pdfPath) {
      return res.status(400).json({ ok: false, error: 'Envie {codigo} ou {pdfPath}.' });
    }

    if (codigo) {
      await executarSelenium(codigo, cfg.groupId);
      return res.json({ ok: true });
    }

    if (pdfPath && fs.existsSync(pdfPath)) {
      const media = await MessageMedia.fromFilePath(pdfPath);
      await client.sendMessage(cfg.groupId, media, { caption: 'PDF enviado manualmente', sendMediaAsDocument: true });
      return res.json({ ok: true });
    }

    res.status(400).json({ ok: false, error: 'pdfPath não existe.' });
  } catch (e) {
    log('Falha no run-selenium: ' + e.message);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ====== NOVO: agendar/emitir aviso de manutenção (UI) ======
app.post('/announce-maintenance', async (req, res) => {
  try {
    const { at, message, exitAfter } = req.body || {};
    const cfg = readConfig();
    if (!cfg.groupId) return res.status(400).json({ ok: false, error: 'Nenhum grupo salvo.' });

    const when = parseWhen(at || 'agora');
    if (!when) return res.status(400).json({ ok: false, error: 'Data/hora inválida.' });

    const texto = message || `🚧 Entraremos em manutenção em ${when.toLocaleString()}.`;
    const ms = when.getTime() - Date.now();

    if (ms <= 0) {
      await client.sendMessage(cfg.groupId, texto);
      if (exitAfter) process.exit(0);
      return res.json({ ok: true, sent: true });
    }

    setTimeout(async () => {
      try { await client.sendMessage(cfg.groupId, texto); }
      catch (e) { log('Falha ao enviar manutenção (UI): ' + e.message); }
      finally { if (exitAfter) process.exit(0); }
    }, ms);

    res.json({ ok: true, scheduledFor: when.toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// ==== WebSocket de logs ====
io.on('connection', (socket) => {
  if (qrDataURL) socket.emit('qr', qrDataURL);
  log('UI conectada.');
});

// ==== Start ====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Servidor ouvindo em http://localhost:' + PORT);
});

// --------- Fechamento limpo (sem deslogar) ---------
let _closing = false;
async function cleanExit(code = 0) {
  if (_closing) return;
  _closing = true;
  try { await client.destroy(); } catch (_) {}
  process.exit(code);
}
process.once('SIGINT',  () => cleanExit(0)); // Ctrl+C
process.once('SIGTERM', () => cleanExit(0)); // kill “normal”
process.on('uncaughtException', (err) => { console.error(err); cleanExit(1); });
process.on('unhandledRejection', (reason) => { console.error(reason); cleanExit(1); });
