const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const path = require('path');
const fs = require('fs');
require('chromedriver');

const codigoFornecedor = process.argv[2];
if (!codigoFornecedor) {
    console.error('❌ Código do fornecedor não informado!');
    process.exit(1);
}

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

/**
 * Delay utilitário
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const delayPadrao = 300;

/**
 * Aguarda até aparecer um .crdownload e renomeia para .pdf
 */
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
    try {
        await driver.wait(until.elementLocated(By.id('login-fld-usr')), 10000).sendKeys('5353181');
        await driver.findElement(By.id('login-fld-pwd')).sendKeys('ZZxpoijkl09?');
        await driver.findElement(By.id('login-vbtn-loginbtn')).click();
        console.log('🔐 Login realizado.');
        await delay(delayPadrao);
    } catch (err) {
        throw new Error('Erro durante login: ' + err.message);
    }
}

async function aplicarFiltros(driver) {
    try {
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
    } catch (err) {
        throw new Error('Erro ao aplicar filtros: ' + err.message);
    }
}

const xPathPDF = '//*[@id="mainview"]/div[1]/div/div[1]/div/div[3]/div[3]/ul[2]/li[3]/a';

async function gerarPDF(driver) {
  try {
    console.log('⏳ Tentando localizar botão PDF...');
    const btnPDF = await driver.wait(until.elementLocated(By.xpath(xPathPDF)), 10000);
    console.log('👍 Botão PDF localizado com sucesso.');

    // Pequeno delay para garantir que o botão esteja pronto para clique
    await delay(delayPadrao);

    console.log('🖱️ Clicando no botão PDF...');
    await btnPDF.click();

    console.log('📥 PDF solicitado com sucesso, aguardando download...');
  } catch (err) {
    throw new Error('❌ Erro ao tentar clicar no botão PDF: ' + err.message);
  }
}

(async function executar() {
    const IP_RUB = '10.48.69.146';
    const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(chromeOptions)
        .build();

    try {
        console.log('🌐 Acessando o sistema...');
        await driver.get(`http://${IP_RUB}/vue/#/core/op/produto`);

        await fazerLogin(driver);
        await aplicarFiltros(driver);
        await gerarPDF(driver);

        console.log('⏳ Aguardando download...');
        await renomearCrdownloadParaPdf(codigoFornecedor);

    } catch (err) {
        console.error('❌ Erro:', err.message);
    } finally {
        await driver.quit();
        console.log('🧹 Navegador fechado.');
    }
})();
