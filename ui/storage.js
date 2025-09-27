// storage.js
// Persistência simples em data/config.json (grupo, IP da loja, modo automático, regex)

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(CONFIG_PATH)) fs.writeFileSync(CONFIG_PATH, JSON.stringify({}), 'utf8');
}

function readConfig() {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const cfg = JSON.parse(raw || '{}');

    // defaults
    if (typeof cfg.autoMode === 'undefined') cfg.autoMode = true;
    if (!cfg.codeRegex) cfg.codeRegex = '^\\d{4,}$'; // só dígitos, 4+ caracteres

    return cfg;
  } catch (e) {
    return { autoMode: true, codeRegex: '^\\d{4,}$' };
  }
}

function writeConfig(cfg) {
  ensureDataDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

function setGroup(groupId, groupName) {
  const cfg = readConfig();
  cfg.groupId = groupId;
  cfg.groupName = groupName;
  writeConfig(cfg);
  return cfg;
}

function clearGroup() {
  const cfg = readConfig();
  delete cfg.groupId;
  delete cfg.groupName;
  writeConfig(cfg);
  return cfg;
}

function setStoreIP(ip, name) {
  const cfg = readConfig();
  cfg.storeIP = ip;
  if (name) cfg.storeName = name;
  writeConfig(cfg);
  return cfg;
}

function clearStoreIP() {
  const cfg = readConfig();
  delete cfg.storeIP;
  delete cfg.storeName;
  writeConfig(cfg);
  return cfg;
}

function setAutoMode(on) {
  const cfg = readConfig();
  cfg.autoMode = !!on;
  writeConfig(cfg);
  return cfg;
}

function setCodeRegex(pattern) {
  const cfg = readConfig();
  cfg.codeRegex = pattern || '^\\d{4,}$';
  writeConfig(cfg);
  return cfg;
}

module.exports = {
  readConfig,
  writeConfig,
  setGroup,
  clearGroup,
  setStoreIP,
  clearStoreIP,
  setAutoMode,
  setCodeRegex,
  DATA_DIR,
  CONFIG_PATH
};
