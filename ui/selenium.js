/**
 * WPP Bot — © 2025 Urich
 * Ideia: DAVID
 * Automação RUB (Selenium): eudaverdgs@gmail.com
 * Melhorias/ajustes: leozinho.yukih@gmail.com
 * Licença: MIT (veja LICENSE)
 */


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
  'safebrowsing.enabled': true
});

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
const delayPadrao = 150;

async function renomearCrdownloadParaPdf(novoNome, timeoutMs = 30000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const arquivos = fs.readdirSync(downloadDir);
    const crdownload = arquivos.find(f => f.endsWith('.crdownload'));
    if (crdownload) {
      const origem = path.join(downloadDir, crdownload);
      const destino = path.join(downloadDir, `${novoNome}.pdf`);
      try {
        fs.renameSync(origem, destino);
        console.log(`✅ Arquivo renomeado: ${destino}`);
        return destino;
      } catch {}
    }
    await delay(delayPadrao);
  }
  throw new Error('⏳ Timeout: arquivo .crdownload não apareceu a tempo.');
}

// LOGIN NO RUB
async function fazerLogin(driver) {
  const user = process.env.RUB_USER || 'MATRICULA_AQUI';   // ou troque aqui fixo
  const pass = process.env.RUB_PASS || 'SENHA_AQUI';       // ou troque aqui fixo

  await driver.wait(until.elementLocated(By.id('login-fld-usr')), 10000).sendKeys(user);
  await driver.findElement(By.id('login-fld-pwd')).sendKeys(pass);
  await driver.findElement(By.id('login-vbtn-loginbtn')).click();
  console.log('🔐 Login realizado.');
  await delay(delayPadrao);
}

async function aplicarFiltros(driver, codigoFornecedor) {
  await driver.wait(until.elementLocated(By.id('master-vbtn-optionsdialogopenbutton')), 10000).click();
  console.log('⏳ Botão filtro clicado.');
  await delay(delayPadrao);

  const selectFiltro = await driver.wait(until.elementLocated(By.css('select.addNewFilter')), 10000);
  await selectFiltro.sendKeys('E'); // Estoque
  console.log('⏳ Filtro Estoque selecionado.');
  await delay(delayPadrao);

  const maiorQueZero = await driver.wait(until.elementLocated(By.css('select.operator')), 10000);
  await maiorQueZero.sendKeys('m0'); // maior que zero
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

async function gerarPDF(driver, tentativas = 1) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      console.log(`⏳ Tentando localizar botão PDF... (tentativa ${i})`);
      const btnPDF = await driver.wait(until.elementLocated(By.xpath(xPathPDF)), 10000);
      console.log('👍 Botão PDF localizado com sucesso.');
      await delay(delayPadrao);
      console.log('🖱️ Clicando no botão PDF...');
      await btnPDF.click();
      console.log('📥 PDF solicitado com sucesso, aguardando download...');
      return;
    } catch (err) {
      console.warn(`⚠️ Tentativa ${i} falhou ao clicar no botão PDF: ${err.message}`);
      if (i === tentativas) throw err;
      await delay(1000);
    }
  }
}

async function limparDownloads() {
  if (!fs.existsSync(downloadDir)) return;
  for (const arquivo of fs.readdirSync(downloadDir)) {
    try { fs.unlinkSync(path.join(downloadDir, arquivo)); } catch {}
  }
  console.log('🧹 Pasta de downloads limpa.');
}

async function executar(codigoFornecedor) {
  if (!codigoFornecedor) throw new Error('Código do fornecedor não informado!');

  const IP_RUB = process.env.STORE_IP || '10.48.69.146';
  const driver = await new Builder().forBrowser('chrome').setChromeOptions(chromeOptions).build();

  try {
    await limparDownloads();

    console.log(`\n🌐 Iniciando processo para código: ${codigoFornecedor}`);
    await driver.get(`http://${IP_RUB}/vue/#/core/op/produto`);

    await fazerLogin(driver);
    await aplicarFiltros(driver, codigoFornecedor);
    await gerarPDF(driver);
    await delay(3000);
    await renomearCrdownloadParaPdf(codigoFornecedor);

    console.log(`✅ Processo concluído para o código: ${codigoFornecedor}`);
  } catch (err) {
    console.error(`❌ Erro no código ${codigoFornecedor}:`, err.stack || err.message);
  } finally {
    await driver.quit();
    console.log('🧹 Navegador fechado.');
  }
}

// Entrada
const codigosFornecedores = process.argv[2] ? process.argv[2].split(',') : [];
if (!codigosFornecedores.length) {
  console.error('❌ Informe ao menos um código de fornecedor (separados por vírgula).');
  process.exit(1);
}
(async () => {
  for (const codigo of codigosFornecedores) {
    await executar(codigo.trim());
  }
  console.log('\n🏁 Todos os processos finalizados.');
})();
