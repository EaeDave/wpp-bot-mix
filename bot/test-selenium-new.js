const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
require('chromedriver');

const IP_RUB = '10.48.69.146';
const USUARIO = '5172519';
const SENHA = 'Prevencao@2026';

const idCampoLogin = 'login-fld-usr';
const idCampoSenha = 'login-fld-pwd';
const idBtnLogin = 'login-vbtn-loginbtn';
const idBtnFiltro = 'master-vbtn-optionsdialogopenbutton';

(async function testSeleniumRUB() {
  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(new chrome.Options()) // Remove se quiser ver a janela
    .build();

  try {
    console.log('🔍 Acessando sistema...');
    await driver.get(`http://${IP_RUB}/vue/#/core/op/produto`);

    // Aguarda o campo de login
    await driver.wait(until.elementLocated(By.id(idCampoLogin)), 10000);

    // Preenche login e senha
    await driver.findElement(By.id(idCampoLogin)).sendKeys(USUARIO);
    await driver.findElement(By.id(idCampoSenha)).sendKeys(SENHA);

    // Clica no botão de login
    await driver.findElement(By.id(idBtnLogin)).click();

    // Aguarda botão de filtro aparecer após login
    const btnFiltro = await driver.wait(
      until.elementLocated(By.id(idBtnFiltro)),
      10000
    );
    await btnFiltro.click();

    console.log('✅ Botão de filtro clicado com sucesso.');

    // Deixa o navegador aberto por 60 segundos para observação
    await driver.sleep(60000);

  } catch (err) {
    console.error('❌ Erro no Selenium:', err);
  } finally {
    await driver.quit();
    console.log('🧹 Navegador fechado.');
  }
})();
