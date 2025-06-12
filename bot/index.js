const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
require('chromedriver');
const { exec } = require('child_process');
const { MessageMedia } = require('whatsapp-web.js');



const GRUPO_ID = '120363402234740964@g.us';  // OLD
// const GRUPO_ID = '120363405454590223@g.us';

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
            const codigoFornecedor = texto;
            await message.reply(`🔄 Código recebido: ${codigoFornecedor}. Iniciando automação...`);

            try {
                const caminhoPDF = await executarAutomacao(codigoFornecedor);

                if (!fs.existsSync(caminhoPDF)) {
                await message.reply(`⚠️ PDF não encontrado, confirme se o código "${codigoFornecedor}" está correto, se estiver. O estoque pode estar zerado.`);
                return;
}



                if (fs.existsSync(caminhoPDF)) {
                    const media = MessageMedia.fromFilePath(caminhoPDF);
                await message.reply(media, undefined, {
                    caption: `📄 Resultado do código ${codigoFornecedor}`,
                    sendMediaAsDocument: true
                });

                    console.log('📤 PDF enviado com sucesso!');
    } else {
        await message.reply('⚠️ PDF não foi encontrado após a automação.');
    }
} catch (err) {
    console.error('Erro ao rodar automação:', err);
    await message.reply('❌ Erro ao gerar o PDF. Verifique os dados ou tente novamente.');
}

            
        } else {
            console.log('❌ Mensagem inválida:', texto);
            await message.reply('⚠️ Por favor, envie apenas o código numérico (sem letras, espaços ou símbolos).');
        }
    }
});

client.initialize();