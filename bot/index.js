const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// const GRUPO_ID = '120363402234740964@g.us';  // Grupo de testes
const GRUPO_ID = '120363405454590223@g.us';  // Grupo de produção

function executarAutomacao(codigo) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.resolve(__dirname, 'selenium.js');
        const comando = `node "${scriptPath}" ${codigo}`;

        exec(comando, (error, stdout, stderr) => {
            if (error) {
                console.error(`Erro ao executar Selenium: ${stderr}`);
                return reject(error);
            }

            // Extrair a última linha JSON válida do stdout
            const linhas = stdout.trim().split('\n');
            let jsonStr = null;

            for (let i = linhas.length - 1; i >= 0; i--) {
                const linha = linhas[i].trim();
                if (linha.startsWith('{') && linha.endsWith('}')) {
                    jsonStr = linha;
                    break;
                }
            }

            if (!jsonStr) {
                console.error('Nenhuma linha JSON válida encontrada no output do selenium.js');
                return reject(new Error('Nenhuma linha JSON válida encontrada no output'));
            }

            try {
                const resultado = JSON.parse(jsonStr);
                resolve(resultado);
            } catch (err) {
                console.error('Erro ao interpretar resultado da automação:', err);
                console.error('JSON inválido recebido:', jsonStr);
                reject(err);
            }
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

            const resultado = await executarAutomacao(codigo);

            if (resultado.status === 'SUCESSO') {
                const caminhoPDF = resultado.caminhoPDF;
                if (!fs.existsSync(caminhoPDF)) {
                    await message.reply(`⚠️ PDF não encontrado no caminho: ${caminhoPDF}`);
                    continue;
                }

                const media = MessageMedia.fromFilePath(caminhoPDF);
                await message.reply(media, undefined, {
                    caption: `📄 Resultado do código ${codigo}`,
                    sendMediaAsDocument: true,
                });
                console.log('📤 PDF enviado com sucesso!');
            } else if (resultado.status === 'ESTOQUE_ZERADO') {
                await message.reply(`ℹ️ Estoque zerado para o código ${codigo}.`);
            } else if (resultado.status === 'CODIGO_INVALIDO') {
                await message.reply(`❌ Código "${codigo}" inválido ou não existe no sistema.`);
            } else {
                await message.reply(`⚠️ Erro desconhecido ao processar o código ${codigo}.`);
            }

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
