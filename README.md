# 📦 wpp-bot-mix  
Automação de relatórios de estoque do **RUB** via **WhatsApp**  

Este projeto tem como objetivo facilitar o processo de consulta e envio de relatórios de estoque para empresas atacadistas que utilizam a solução **RUB (GIC)**.  
De forma automática, a aplicação recebe um **código de fornecedor via WhatsApp**, gera um relatório em PDF no sistema RUB e envia o arquivo de volta no grupo designado.

---

## 📑 Índice
- [Visão Geral](#visão-geral)
- [Tecnologias e Dependências](#tecnologias-e-dependências)
- [Pré-Requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Como Funciona](#como-funciona)
- [Execução](#execução)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Contribuições](#contribuições)
- [Licença](#licença)

---

## 🚀 Visão Geral
- Escuta mensagens em um grupo específico do WhatsApp.  
- Valida se a mensagem contém **apenas números** (código de fornecedor - exemplo: código referente a Coca-Cola.).
- Executa fila de requisições, processando **um código por vez**.  
- Acessa o sistema RUB, realiza login e aplica filtros:  
  - Estoque maior que zero.  
  - Código do fornecedor.  
- Gera relatório em **PDF**:  
  - Se houver estoque → envia o PDF no grupo.  
  - Se não houver estoque ou código inválido → envia mensagem de aviso no grupo.  

---

## 🛠️ Tecnologias e Dependências
O projeto utiliza as seguintes bibliotecas e ferramentas:

- [chromedriver](https://chromedriver.chromium.org/) → automação do navegador.  
- [dotenv](https://www.npmjs.com/package/dotenv) → gerenciamento de variáveis de ambiente.  
- [qrcode-terminal](https://www.npmjs.com/package/qrcode-terminal) → exibição do QR Code para login no WhatsApp Web.  
- [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) → integração com o WhatsApp.  
- [selenium-webdriver](https://www.npmjs.com/package/selenium-webdriver) → automação do sistema RUB.  
- [nodemon](https://www.npmjs.com/package/nodemon) (dev) → hot reload em ambiente de desenvolvimento.  

---

## 📋 Pré-Requisitos
- [Node.js](https://nodejs.org/) **>= 18.x**  
- [npm](https://www.npmjs.com/)  
- Navegador **Google Chrome** instalado.  
- Dependências listadas no `package.json`.  

---

## ⚙️ Configuração
Antes de rodar a aplicação, edite o arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
WHATSAPP_GROUP_ID= # ID do grupo WhatsApp onde a automação vai atuar
RUB_IP=            # Endereço do sistema RUB - Ex: 10.48.69.146
RUB_USER=          # Usuário de login no RUB - Ex: Matrícula
RUB_PASSWORD=      # Senha de login no RUB - Ex: SuaSenhaManeira123
```
Essas credenciais serão usadas para autenticação e acesso ao sistema interno RUB.

# 🔄 Como Funciona

O bot inicia e gera um **QR Code** no terminal para autenticação no WhatsApp Web.  

Após autenticado, o grupo definido no `.env` fica em modo de **escuta**.  

Quando alguém envia uma mensagem:

- ✅ **Se a mensagem contiver somente números** → é considerada um **código válido de fornecedor** e adicionada à **fila de execução**.  
- ❌ **Se a mensagem contiver letras, símbolos ou múltiplos códigos** → o bot envia um **reply automático** avisando que deve ser enviado **apenas um código numérico por vez**.  

Cada código na fila é processado em ordem:

1. Login no sistema RUB com as credenciais do `.env`.  
2. Abertura da página de produtos.  
3. Aplicação dos filtros:  
   - Estoque **maior do que zero**.  
   - Código do fornecedor.  
4. Validação dos resultados:  
   - ✅ Se houver estoque → download do PDF e envio no grupo como **reply** da mensagem original.  
   - ❌ Se não houver estoque ou o código for inválido → envio de um **reply de aviso** no grupo.  

➡️ O próximo código da fila só é processado **após a execução anterior terminar completamente**.  

---

# ▶️ Execução

Instale as dependências e inicie a aplicação:

```bash
# instalar dependências
npm install

# rodar o bot
npm start
```

Caso esteja em ambiente corporativo e o proxy ou firewall bloqueie o Puppeteer (navegador), utilize:
```bash
# pulando puppeteer:
$env:SKIP_PUPPETEER_DOWNLOAD="true"

# instalar dependências
npm install

# rodar o bot
npm start
```

Durante a primeira execução, será exibido um QR Code no terminal.
Escaneie com o WhatsApp para autenticar o bot.

# 📂 Estrutura do Projeto

```bash
wpp-bot-mix/
├── .wwebjs_auth/      # Cache de autenticação do WhatsApp Web (É criado automaticamente)
├── .wwebjs_cache/     # Cache do WhatsApp Web (É criado automaticamente)
├── bot/               # Código principal do bot
│   ├── downloads/     # Relatórios gerados em PDF
│   │   └── 35559.pdf  # Exemplo de relatório baixado (É baixado de acordo com a demanda, é limpado assim que outro é solicitado)
│   ├── index.js       # Ponto de entrada da automação (Responsável pelo WhatsApp Web)
│   └── selenium.js    # Automação do sistema RUB via Selenium
├── node_modules/      # Dependências do projeto (É gerado automaticamente depois do npm install)
├── .env               # Variáveis de ambiente
├── .gitignore         # Arquivos/dirs ignorados pelo Git
├── package-lock.json  # Lock das dependências
├── package.json       # Scripts e dependências do projeto
└── README.md          # Documentação do projeto
```

# 🤝 Contribuições

Contribuições são bem-vindas!  
Para colaborar:

Faça um fork do projeto.

Crie uma branch com sua feature/bugfix:

```git checkout -b minha-feature```

Commit suas alterações:

```git commit -m 'feat: minha nova feature'```

Push para a branch:

```git push origin minha-feature```

Abra um Pull Request.

# 📜 Licença

Este projeto é distribuído sob a licença MIT.  
Sinta-se livre para usar, modificar e contribuir.

