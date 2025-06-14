const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('path');
const fs = require('fs');
require('chromedriver');

const downloadDir = path.resolve(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
    console.log(`📁 Pasta de download criada: ${downloadDir}`);
}

const chromeOptions = new chrome.Options();
chromeOptions.addArguments('--headless=new');
chromeOptions.addArguments(
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security',
    '--safebrowsing-disable-download-protection',
    '--allow-running-insecure-content'
);
chromeOptions.setUserPreferences({
    'plugins.always_open_pdf_externally': true,
    'download.prompt_for_download': false,
    'download.directory_upgrade': true,
    'download.default_directory': downloadDir,
    'safebrowsing.enabled': true,
});

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const delayPadrao = 80;

async function renomearCrdownloadParaPdf(novoNome, timeoutMs = 30000) {
    const inicio = Date.now();
    while (Date.now() - inicio < timeoutMs) {
        const arquivos = fs.readdirSync(downloadDir);
        const crdownload = arquivos.find(f => f.endsWith('.crdownload'));
        if (crdownload) {
            const origem = path.join(downloadDir, crdownload);
            const destino = path.join(downloadDir, `${novoNome}.pdf`);
            fs.renameSync(origem, destino);
            console.log(`✅ Arquivo renomeado: ${destino}`);
            return destino;
        }
        await delay(delayPadrao);
    }
    throw new Error('⏳ Timeout: arquivo .crdownload não apareceu a tempo.');
}

async function fazerLogin(driver) {
    await driver.wait(until.elementLocated(By.id('login-fld-usr')), 10000).sendKeys('5353181');
    await driver.findElement(By.id('login-fld-pwd')).sendKeys('ZZxpoijkl09?');
    await driver.findElement(By.id('login-vbtn-loginbtn')).click();
    console.log('🔐 Login realizado.');
    await delay(delayPadrao);
}

async function aplicarFiltros(driver, codigoFornecedor) {
    await driver.wait(until.elementLocated(By.id('master-vbtn-optionsdialogopenbutton')), 10000).click();
    console.log('⏳ Botão filtro clicado.');
    await delay(delayPadrao);

    const selectFiltro = await driver.wait(until.elementLocated(By.css('select.addNewFilter')), 10000);
    await selectFiltro.sendKeys('E');
    console.log('⏳ Filtro Estoque selecionado.');
    await delay(delayPadrao);

    await driver.findElement(By.css('select.operator')).sendKeys('m0');
    console.log('⏳ Operador "maior que zero" selecionado.');
    await delay(delayPadrao);

    const filtroFornecedor = await driver.findElement(By.css('select.addNewFilter'));
    await filtroFornecedor.sendKeys(`F${codigoFornecedor}`);
    console.log(`⏳ Código do fornecedor "${codigoFornecedor}" inserido.`);
    await delay(delayPadrao);

    await driver.findElement(By.css('a.btnApply')).click();
    console.log('🔎 Filtros aplicados.');
    await delay(delayPadrao);
}

const xPathPDF = '//*[@id="mainview"]/div[1]/div/div[1]/div/div[3]/div[3]/ul[2]/li[3]/a';

async function removerFiltroMaiorQueZero(driver) {
    try {
        await driver.wait(until.elementLocated(By.id('master-vbtn-optionsdialogopenbutton')), 10000).click();
        console.log('⏳ Botão filtro clicado para remover filtro maior que zero.');
        await delay(delayPadrao);

        const botoes = await driver.findElements(By.css("a.btn"));
        const botoesDelete = [];

        for (let botao of botoes) {
            const html = await botao.getAttribute("innerHTML");
            if (html.includes("#delete")) {
                botoesDelete.push(botao);
            }
        }

        if (botoesDelete.length >= 2) {
            console.log('🗑️ Clicando no segundo botão de delete...');
            await botoesDelete[1].click(); // segundo botão
        } else if (botoesDelete.length === 1) {
            console.log('🗑️ Só encontrou um botão delete, clicando nele...');
            await botoesDelete[0].click();
        } else {
            console.warn('⚠️ Nenhum botão delete encontrado.');
        }

        await driver.findElement(By.css('a.btnApply')).click();
        console.log('🔎 Filtros aplicados após remover filtro maior que zero.');
        await delay(delayPadrao);
        await delay(1000);

        try {
            const btnPDF = await driver.wait(until.elementLocated(By.xpath(xPathPDF)), 5000);
            console.log('👍 Botão PDF localizado após remover filtro maior que zero.');
            await delay(delayPadrao);
            console.log('🖱️ Clicando no botão PDF...');
            await btnPDF.click();
            console.log('📥 PDF solicitado com sucesso após remover filtro.');
            return 'PDF_SOLICITADO';
        } catch (error) {
            console.warn('🚫 Botão PDF não encontrado após remover filtro maior que zero.');
            return 'PDF_NAO_ENCONTRADO';
        }
    } catch (e) {
        console.error('⚠️ Erro ao remover filtro maior que zero:', e.message);
        return 'ERRO_REMOVER_FILTRO';
    }
}

async function gerarPDF(driver, tentativas = 1) {
    for (let i = 1; i <= tentativas; i++) {
        try {
            console.log(`⏳ Tentando localizar botão PDF... (tentativa ${i})`);
            const btnPDF = await driver.wait(until.elementLocated(By.xpath(xPathPDF)), 1000);
            console.log('👍 Botão PDF localizado com sucesso.');
            await delay(delayPadrao);
            console.log('🖱️ Clicando no botão PDF...');
            await btnPDF.click();
            console.log('📥 PDF solicitado com sucesso, aguardando download...');
            return { status: 'PDF_SOLICITADO' };
        } catch (err) {
            console.warn(`⚠️ Tentativa ${i} falhou ao clicar no botão PDF: ${err.message}`);

            if (i === tentativas) {
                console.log('❌ Todas as tentativas falharam. Tentando remover filtro maior que zero...');

                const resultadoRemocao = await removerFiltroMaiorQueZero(driver);

                if (resultadoRemocao === 'PDF_SOLICITADO') {
                    return { status: 'ESTOQUE_ZERADO' };
                } else if (resultadoRemocao === 'PDF_NAO_ENCONTRADO') {
                    return { status: 'CODIGO_INVALIDO' };
                } else {
                    return { status: 'ERRO_REMOVER_FILTRO' };
                }
            }

            await delay(1000);
        }
    }
}

async function limparDownloads() {
    if (!fs.existsSync(downloadDir)) return;

    const arquivos = fs.readdirSync(downloadDir);
    for (const arquivo of arquivos) {
        try {
            fs.unlinkSync(path.join(downloadDir, arquivo));
        } catch (e) {
            console.warn(`⚠️ Erro ao limpar arquivo ${arquivo}: ${e.message}`);
        }
    }
    console.log('🧹 Downloads limpos.');
}

async function executar() {
    const codigoFornecedor = process.argv[2];
    if (!codigoFornecedor) {
        console.error('❌ Código do fornecedor não informado!');
        console.log(JSON.stringify({ status: 'ERRO', mensagem: 'Código do fornecedor não informado!' }));
        process.exit(1);
    }

    const IP_RUB = '10.48.69.146';

    const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions)
        .build();

    try {
        await limparDownloads();

        console.log(`\n🌐 Iniciando processo para código: ${codigoFornecedor}`);

        await driver.get(`http://${IP_RUB}/vue/#/core/op/produto`);

        await fazerLogin(driver);
        await aplicarFiltros(driver, codigoFornecedor);

        const resultadoPDF = await gerarPDF(driver);

        if (resultadoPDF.status !== 'PDF_SOLICITADO') {
            // Retorna o status para o index.js interpretar
            console.log(JSON.stringify(resultadoPDF));
            return;
        }

        await renomearCrdownloadParaPdf(codigoFornecedor);

        console.log(`✅ Processo concluído para o código: ${codigoFornecedor}`);

        // Retorna sucesso com caminho do PDF
        const caminhoPDF = path.join(downloadDir, `${codigoFornecedor}.pdf`);
        console.log(JSON.stringify({ status: 'SUCESSO', caminhoPDF }));

    } catch (err) {
        console.error(`❌ Erro no código ${codigoFornecedor}:`, err.stack || err.message);
        console.log(JSON.stringify({ status: 'ERRO', mensagem: err.message }));
    } finally {
        await driver.quit();
        console.log('🧹 Navegador fechado.');
    }
}

executar();
