# WPP Bot UI — completo (2025)

Bot WhatsApp com **UI web** e **CLI**, fluxo **“Sabe o ID do grupo?”**, suporte a **link de convite**, **persistência** (grupo + IP da loja), fila de execução, **aviso de manutenção** (CLI e UI) e integração para rodar `selenium.js` e **enviar PDF** no grupo.

**funciona com o seu Chrome**, sem depender de baixar Chromium.

---

## ⚙️ Requisitos

- **Windows** (PowerShell) ou Linux/Mac (bash)
- **Node.js 18 LTS** (recomendado: 18.20.4)  
  > Em Windows: `winget install CoreyButler.NVMforWindows` → `nvm install 18.20.4` → `nvm use 18.20.4`
- **Google Chrome** instalado  
  - Windows: `C:\Program Files\Google\Chrome\Application\chrome.exe`
  - Linux: `/usr/bin/google-chrome` ou `/usr/bin/google-chrome-stable`
  - Mac: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`

> Dica: **não apague** a pasta `wwebjs_auth/` (é sua sessão logada).

---

## 🧱 Instalação (Windows/PowerShell)

No diretório do projeto (ex.: `C:\Users\SEU_USUARIO\Downloads\wpp-bot-ui`):

```powershell
nvm use 18.20.4

# 1) Instale dependências (sem baixar Chromium)
npm i --no-audit --no-fund

# 2) Use o Chrome do sistema (torna permanente)
setx PUPPETEER_EXECUTABLE_PATH "C:\Program Files\Google\Chrome\Application\chrome.exe"
# FECHAR e REABRIR o PowerShell após este comando

# 3) Corrigir lib oficial (bug do evento 'ready'): usar fork com fix
npm remove whatsapp-web.js
Remove-Item -Force .\package-lock.json -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\node_modules -ErrorAction SilentlyContinue
npm i github:BenyFilho/whatsapp-web.js#fix_event_ready --no-audit --no-fund
```

> O `package.json` ficará com:
> ```json
> "dependencies": {
>   "whatsapp-web.js": "github:BenyFilho/whatsapp-web.js#fix_event_ready",
>   ...
> }
> ```

### (Opcional) Estabilizar versões do WhatsApp Web
Se a versão do WA Web mudar e bagunçar tudo:
```powershell
# usa cache remoto de versão mantido pela comunidade
setx WWEBJS_USE_REMOTE_CACHE 1
# feche e reabra o PowerShell antes de rodar
```
Para voltar ao padrão local:
```powershell
setx WWEBJS_USE_REMOTE_CACHE ""
```

---

## 🚀 Como rodar

### Modo **UI Web** (recomendado)
```powershell
npm run start:ui
```
Abra: **http://localhost:3000**

Passos rápidos na UI:
1. **Escaneie o QR**.
2. Em **Loja/IP**, salve o IP (ex.: `10.60.5.146`) e apelido/nome.
3. Em **Grupo**, escolha:
   - **Sei o ID** → cole `1203...@g.us`.
   - **Não sei** → **Atualizar lista** → selecione → **Salvar seleção**.
   - **Tem convite?** → cole `https://chat.whatsapp.com/XXXX...` em **Entrar pelo convite**, atualize a lista e salve.
4. Em **Automação**: ligue o modo automático e deixe a regex (padrão `^\d{4,}$`).
5. **Enviar mensagem de teste** → deve chegar no grupo.

### Modo **Terminal/CLI** (sem UI)
```powershell
npm start
```
Na primeira execução ele pergunta IP, grupo, etc, e salva em `data/config.json`.

---

## 🤖 Fluxo automático (grupo → PDF no grupo)

- O bot **monitora apenas o grupo salvo**.
- Se a mensagem combinar com a **regex** (padrão `^\d{4,}$`):
  1. Avisa no grupo: “Recebi o código X, gerando PDF…”
  2. Executa `node selenium.js <codigo>` com ENV `STORE_IP`, `STORE_NAME`, `RUB_USER`, `RUB_PASS` (se salvos)
  3. Procura `downloads/<codigo>.pdf` **ou** o **PDF mais novo** criado após a execução
  4. Envia o PDF (3 tentativas com retry)

> Seu `selenium.js` pode manter o padrão antigo. Só garanta que o PDF caia em `downloads/`.

---

## 🧩 Endpoints & Integrações

### Disparar Selenium + enviar PDF
```http
POST /run-selenium
Content-Type: application/json

{ "codigo": "12345" }
```
- O servidor roda `node selenium.js 12345` e tenta enviar `downloads/12345.pdf`.
- Alternativa (PDF já pronto em outro lugar):
```json
{ "pdfPath": "C:/meus/relatorios/xpto.pdf" }
```

### Aviso de manutenção (UI)
```http
POST /announce-maintenance
Content-Type: application/json

{ "at": "em 30m", "message": "🚧 Manutenção em 30 minutos", "exitAfter": false }
```
- `at`: `"agora"`, `"em 30m"`, `"em 2h"`, ou `"YYYY-MM-DD HH:mm"`.
- `exitAfter`: encerra o processo após enviar o aviso.

### Aviso de manutenção (CLI no modo terminal)
```powershell
npm start -- --announce "2025-09-01 22:00" "🚧 Manutenção às 22h"
npm start -- --announce agora "🚧 Entrando em manutenção" --exit-after
npm start -- --announce "em 45m" "🚧 Manutenção em 45 minutos"
```

### API rápida (para acoplar outro front)
- `GET /status` → `{ ready, authenticated, qr, savedGroup, store, autoMode, codeRegex }`
- `POST /set-ip` `{ ip, name? }`
- `POST /clear-ip`
- `GET /groups` → lista grupos
- `POST /set-group` `{ groupId }`
- `POST /select-group` `{ groupId }`
- `POST /clear-group`
- `POST /join-invite` `{ invite }` (`https://chat.whatsapp.com/...`)
- `POST /send-test`
- `POST /run-selenium` `{ codigo? , pdfPath? }`
- `POST /announce-maintenance` `{ at, message?, exitAfter? }`

---

## 🗂️ Estrutura

```
wpp-bot-ui/
  public/
    index.html
    style.css
    app.js
  downloads/                 ← PDFs caem aqui
  data/
    config.json              ← persistência (não versionar)
  .wwebjs_cache/             ← cache da versão WA Web (pode limpar)
  wwebjs_auth/               ← sessão logada (NÃO apagar)
  index.js                   ← modo terminal/CLI
  server.js                  ← UI Web + API
  storage.js                 ← helper de persistência p/ UI
  selenium.js                ← sua automação (você edita)
  package.json
  README.md
```

**`data/config.json`** (exemplo):
```json
{
  "groupId": "1203...@g.us",
  "groupName": "Compras",
  "storeIP": "10.60.5.146",
  "storeName": "Loja Centro",
  "autoMode": true,
  "codeRegex": "^\d{4,}$",
  "rubUser": "5353181",
  "rubPass": "********"
}
```

---

## 🛠️ Ajustes complementares

- **Chrome corporativo bloqueado?** Já estamos usando o seu Chrome com `PUPPETEER_EXECUTABLE_PATH`.
- **Regex**: troque em **Automação** na UI (`^\d{4,}$` por padrão).
- **Pasta de PDF**: o servidor procura primeiro `downloads/<codigo>.pdf` e, se não achar, envia o **PDF mais novo** após a execução. Ajuste em `server.js` se quiser outra lógica.
- **Mensagens**: personalize textos em `server.js` e `public/app.js`.
- **Porta**: mude `PORT` (env) se quiser outra porta.
- **Permissões**

---

## 🧪 Selenium

O projeto aceita seu `selenium.js` (como você já usava). Use as ENV que o servidor injeta:

```js
const storeIP   = process.env.STORE_IP;    // ex: "10.60.5.146"
const storeName = process.env.STORE_NAME;  // ex: "Loja Centro"
const user      = process.env.RUB_USER;    // opcional
const pass      = process.env.RUB_PASS;    // opcional
const codigo    = process.argv[2];         // "12345" ou "12345,67890"
```

Se precisar instalar as libs:
```powershell
npm i selenium-webdriver chromedriver
```

---

## Troubleshooting

- **QR fica em loop / não chega em “pronto”**  
  Você já está no **fork com fix**. Se ainda travar:
  ```powershell
  Remove-Item -Recurse -Force .\.wwebjs_cache
  npm run start:ui
  ```
  Em último caso, use:
  ```powershell
  setx WWEBJS_USE_REMOTE_CACHE 1
  # fechar e reabrir PowerShell
  npm run start:ui
  ```

- **“LocalAuth is not compatible with userDataDir.”**  
  Já corrigido no código (não usamos `userDataDir` com `LocalAuth`). Atualize seus arquivos.

- **“Execution context destroyed / Protocol error”**  
  Geralmente ambiente/Chrome. Rodar **com janela** (já padrão `headless: false`) ajuda.

- **PDF não chega no grupo**  
  1) Confirme que `selenium.js` realmente gerou o PDF em `downloads/`.  
  2) Teste manual:  
     ```powershell
     curl -X POST http://localhost:3000/run-selenium -H "Content-Type: application/json" -d "{ \"codigo\": \"12345\" }"
     ```
  3) Veja os **logs** na UI (ou console).

- **logs limpos (só do grupo salvo)**  
  Já ajustado: `message_create` e `message` ignoram status/DM e focam no grupo salvo.

---

## 🧾 .gitignore sugerido

```
node_modules
.wwebjs_auth
.wwebjs_cache
downloads
data
*.pdf
```

> `data/` e `downloads/` não devem ir para o repositório.

---

## 👤 Créditos e Licença

- **© 2025 Urich**  
- **Ideia**: DAVID  
- **Automação RUB (Selenium)**: eudaverdgs@gmail.com  
- **Melhorias/Ajustes**: leozinho.yukih@gmail.com  
- **Licença**: MIT (veja `LICENSE`)

---

## TL;DR (checklist)

1. `nvm use 18.20.4`  
2. `npm i --no-audit --no-fund`  
3. `setx PUPPETEER_EXECUTABLE_PATH "C:\Program Files\Google\Chrome\Application\chrome.exe"` (feche/reabra o PowerShell)  
4. `npm i github:BenyFilho/whatsapp-web.js#fix_event_ready --no-audit --no-fund`  
5. `npm run start:ui` → http://localhost:3000 → QR → salvar IP/Grupo → **Enviar mensagem de teste**  
6. No grupo, mande `12345` → PDF aparece.  
7. Manutenção: UI ou `npm start -- --announce "em 30m" "🚧 Manutenção em 30 minutos"`.

É isso... Dúvidas? Entrar em contato com os respectivos e-mails.
