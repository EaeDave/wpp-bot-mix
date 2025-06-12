const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { Builder, By } = require('selenium-webdriver');
require('chromedriver');
const { executablePath } = require('puppeteer');
const { log } = require('console');

const GRUPO_ID = '120363402234740964@g.us';

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
    // Filtrar para escutar só o grupo específico
    if (message.from === GRUPO_ID) {
        const texto = message.body.trim(); // remove espaços laterais

        // Verifica se contém apenas números
        const apenasNumeros = /^\d+$/.test(texto);

        if (apenasNumeros) {
            console.log('✅ Tudo certo');
            
        } else {
            console.log('❌ Mensagem inválida:', texto);
            await message.reply('⚠️ Por favor, envie apenas o código numérico (sem letras, espaços ou símbolos).');
        }
    }
});

client.initialize();