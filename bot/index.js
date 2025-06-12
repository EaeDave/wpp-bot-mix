const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const GRUPO_ID = '120363402234740964@g.us';  // Seu grupo

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
        });
    });
}

// --- Implementação da fila ---
const filaDeExecucao = [];
let processando = false;

async function adicionarNaFila(codigo, message) {
    filaDeExecucao.push({ codigo, message });
    if (!processando) {
        await processarFila();
    }
}

async function processarFila() {
    processando = true;

    while (filaDeExecucao.length > 0) {
        const { codigo, message } = filaDeExecucao.shift();

        try {
            await message.reply(`🔄 Código recebido: ${codigo}. Iniciando automação...`);
            const caminhoPDF = await executarAutomacao(codigo);

            if (!fs.existsSync(caminhoPDF)) {
                await message.reply(`⚠️ PDF não encontrado, confirme se o código "${codigo}" está correto ou se o estoque está zerado.`);
                continue;
            }

            const media = MessageMedia.fromFilePath(caminhoPDF);
            await message.reply(media, undefined, {
                caption: `📄 Resultado do código ${codigo}`,
                sendMediaAsDocument: true,
            });

            console.log('📤 PDF enviado com sucesso!');
        } catch (err) {
            console.error('Erro ao rodar automação:', err);
            await message.reply('❌ Erro ao gerar o PDF. Verifique os dados ou tente novamente.');
        }
    }

    processando = false;
}

// --- Setup WhatsApp ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('🟢 Bot WhatsApp está pronto!'));

client.on('message', async message => {
    if (message.from === GRUPO_ID) {
        const texto = message.body.trim();

        if (/^\d+$/.test(texto)) {
            const codigoFornecedor = texto;
            await adicionarNaFila(codigoFornecedor, message);
        } else {
            console.log('❌ Mensagem inválida:', texto);
            await message.reply('⚠️ Por favor, envie apenas o código numérico (sem letras, espaços ou símbolos).');
        }
    }
});

client.initialize();
