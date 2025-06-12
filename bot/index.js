const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { Builder, By } = require('selenium-webdriver');
require('chromedriver');
const { executablePath } = require('puppeteer');
const { log } = require('console');

const ID_DO_GRUPO = '120363402234740964@g.us';

// Configuração do WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('🟢 Bot WhatsApp está pronto!'));

client.on('message', async message => {
    if (message.from === ID_DO_GRUPO) {
        const texto = message.body;
        console.log(`🔊 Mensagem no grupo autorizado: ${texto}`);
        // Continue aqui com sua lógica de automação
    } else {
        console.log(`❌ Ignorando mensagem de outro chat: ${message.from}`);
    }
});

client.initialize();