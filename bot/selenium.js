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
chromeOptions.setUserPreferences({
  'plugins.always_open_pdf_externally': true,
  'download.prompt_for_download': false,
  'download.directory_upgrade': true,
  'download.default_directory': downloadDir,
  'safebrowsing.enabled': true,
});

// Acrescentando headless
chromeOptions.addArguments('--no-sandbox');
chromeOptions.addArguments('--disable-dev-shm-usage');
chromeOptions.addArguments('--headless=new'); // para Chrome mais recente

chromeOptions.addArguments('--safebrowsing-disable-download-protection');
chromeOptions.addArguments('--disable-web-security');
chromeOptions.addArguments('--allow-running-insecure-content');
chromeOptions.addArguments('--no-sandbox');
chromeOptions.addArguments('--disable-dev-shm-usage');

const IP_RUB = '10.48.69.146';
const USUARIO = '5172519';
const SENHA = 'Prevencao@2026';

const idCampoLogin = 'login-fld-usr';
const idCampoSenha = 'login-fld-pwd';
const idBtnLogin = 'login-vbtn-loginbtn';
const idBtnFiltro = 'master-vbtn-optionsdialogopenbutton';
const classSelectNewFilter = 'select.addNewFilter';
const classSelectOperator = 'select.operator';
const classBtnApply = 'a.btnApply';
const xPathPDF = '//*[@id="mainview"]/div[1]/div/div[1]/div/div[3]/div[3]/ul[2]/li[3]/a';

/**
 * Espera até que um arquivo .crdownload apareça e renomeia ele para {novoNome}.pdf
 * @param {string} novoNome nome final sem extensão
 * @param {number} timeoutMs máximo tempo para esperar (ms)
 */
async function renomearCrdownloadParaPdf(novoNome, timeoutMs = 30000) {
  const inicio = Date.now();

  while (Date.now() - inicio < timeoutMs) {
    const arquivos = fs.readdirSync(downloadDir);

    // Procura arquivo .crdownload
    const crdownloadFile = arquivos.find(f => f.endsWith('.crdownload'));

    if (crdownloadFile) {
      const caminhoAntigo = path.join(downloadDir, crdownloadFile);
      const caminhoNovo = path.join(downloadDir, novoNome + '.pdf');

      // Renomeia o arquivo (mesmo que continue incompleto)
      fs.renameSync(caminhoAntigo, caminhoNovo);
      console.log(`✅ Arquivo .crdownload renomeado para: ${caminhoNovo}`);
      return caminhoNovo;
    }

    // Se não encontrou .crdownload, espera 500ms e tenta de novo
    await new Promise(r => setTimeout(r, 500));
  }

  throw new Error('⏳ Timeout esperando arquivo .crdownload aparecer para renomear');
}

(async function testSeleniumRUB() {
  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(chromeOptions)
    .build();

  try {
    console.log('🔍 Acessando sistema...');
    await driver.get(`http://${IP_RUB}/vue/#/core/op/produto`);

    // Etapa de login
    await driver.wait(until.elementLocated(By.id(idCampoLogin)), 10000);
    await driver.findElement(By.id(idCampoLogin)).sendKeys(USUARIO);
    await driver.findElement(By.id(idCampoSenha)).sendKeys(SENHA);
    await driver.findElement(By.id(idBtnLogin)).click();

    // Adicionando filtro
    const btnFiltro = await driver.wait(until.elementLocated(By.id(idBtnFiltro)), 10000);
    await btnFiltro.click();

    // Filtro de Estoque
    await driver.findElement(By.css(classSelectNewFilter)).sendKeys('E');

    // Maior que 0
    await driver.findElement(By.css(classSelectOperator)).sendKeys('m0');

    // Adiciona filtro de Fornecedor + o código do fornecedor desejado
    await driver.findElement(By.css(classSelectNewFilter)).sendKeys(`F${codigoFornecedor}`);

    // Aplica o filtro
    const btnApply = await driver.wait(until.elementLocated(By.css(classBtnApply)), 10000);
    await btnApply.click();

    // Gera o PDF do MIX
    const btnPDF = await driver.wait(until.elementLocated(By.xpath(xPathPDF)), 10000);
    await btnPDF.click();

    console.log('📥 PDF solicitado. Aguardando arquivo .crdownload...');

    // Espera o .crdownload aparecer e renomeia ele para .pdf
    await renomearCrdownloadParaPdf(codigoFornecedor);

  } catch (err) {
    console.error('❌ Erro no Selenium:', err);
  } finally {
    await driver.quit();
    console.log('🧹 Navegador fechado.');
  }
})();
