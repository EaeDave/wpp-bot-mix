const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
require('dotenv').config({ path: path.resolve(__dirname, '../.env')});

// Seu grupo WhatsApp
const GRUPO_ID = process.env.WHATSAPP_GROUP_ID;

// Função para executar o selenium.js e gerar o PDF
function executarAutomacao(codigo) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.resolve(__dirname, 'selenium.js');
        const comando = `node "${scriptPath}" ${codigo}`;

        exec(comando, (error, stdout, stderr) => {
            if (error) {
                console.error(`Erro ao executar Selenium: ${stderr}`);
                return reject(error);
            }
            console.log(`Selenium finalizado:\n${stdout}`);
            const caminhoPDF = path.join(__dirname, 'downloads', `${codigo}.pdf`);
            resolve(caminhoPDF);
            // desenvolvedor da automação - eudaverdgs@gmail.com
        });
    });
}

// --- Fila de execução ---
const filaDeExecucao = [];
let processando = false;
let clientReady = false;

async function adicionarNaFila(codigo, chatId) {
    filaDeExecucao.push({ codigo, chatId });
    if (clientReady && !processando) {
        await processarFila();
    }
}

// Retry simples para envio de mídia
async function sendMessageWithRetry(client, chatId, media, options, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await client.sendMessage(chatId, media, options);
            return; // sucesso
        } catch (error) {
            if (attempt === retries) throw error;
            console.warn(`Tentativa ${attempt} de envio de mídia falhou: ${error.message}. Tentando novamente...`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

// Processa a fila sequencialmente
async function processarFila() {
    processando = true;
    while (filaDeExecucao.length > 0) {
        const { codigo, chatId } = filaDeExecucao.shift();

        try {
            await client.sendMessage(chatId, `🔄 Código recebido: ${codigo}. Iniciando automação...`);

            const caminhoPDF = await executarAutomacao(codigo);

            if (!fs.existsSync(caminhoPDF)) {
                await client.sendMessage(chatId, `⚠️ PDF não encontrado, confirme se o código "${codigo}" está correto ou se o estoque está zerado.`);
                continue;
            }

            const media = MessageMedia.fromFilePath(caminhoPDF);
            await sendMessageWithRetry(client, chatId, media, {
                caption: `📄 Resultado do código ${codigo}`,
                sendMediaAsDocument: true,
            });

            console.log('📤 PDF enviado com sucesso!');
        } catch (err) {
            console.error('Erro ao rodar automação:', err);
            await client.sendMessage(chatId, '❌ Erro ao gerar o PDF. Verifique os dados ou tente novamente.');
        }
    }
    processando = false;
}

// --- Configuração do client WhatsApp ---
const client = new Client({
    // ↓ ATUALIZAÇÕES AQUI ↓ -----------------------------------------------------------------------------------------------------------
    authStrategy: new LocalAuth({
        clientId: 'mix-rub' // essa parte vai isolar a sessão pra não dar mais aquele bug de cache.
    }),                                                                                                            // Deixa o like kkkkkkkkk
    webVersionCache: { type: 'none' }, // desativa cache da versão do WA Web deixando mais limpo. Mas recomendo fazer testes primeiro.
    // ↑ FECHA ATUALIZAÇÃO AQUI ↑  ----------------------------------------------------------------------------------------------------

    puppeteer: {
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

// Eventos do client
client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', () => {
    console.log('🟢 Bot WhatsApp está pronto!');
    clientReady = true;

    // Caso a fila tenha itens antes do ready, processar agora
    if (!processando && filaDeExecucao.length > 0) {
        processarFila();
    }
});

client.on('authenticated', () => console.log('Sessão autenticada com sucesso.'));

client.on('loading_screen', (percent, message) => {
    console.log('TELA DE CARREGAMENTO: ', percent, message);
});

client.on('auth_failure', () => {
    console.error('❌ Falha na autenticação!');
});

client.on('disconnected', (reason) => {
    console.warn(`⚠️ Cliente desconectado: ${reason}. Tentando reconectar...`);
    clientReady = false;
    client.initialize();
    // desenvolvedor da automação - eudaverdgs@gmail.com
});

// Mensagem recebida
client.on('message', async (message) => {
    if (message.from === GRUPO_ID) {
        const texto = message.body.trim();

        if (/^\d+$/.test(texto)) {
            const codigoFornecedor = texto;
            console.log('Código recebido:', codigoFornecedor);
            await adicionarNaFila(codigoFornecedor, message.from);
        } else {
            console.log('❌ Mensagem inválida:', texto);
            await client.sendMessage(message.from, '⚠️ Por favor, envie apenas um código por mensagem, e o código deve ser numérico (sem letras, espaços ou símbolos).');
        }
    }
});

// Inicializa o client
client.initialize();
