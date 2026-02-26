const { chromium } = require('playwright');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');

const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
];

function loadProxies(filePath) {
    const proxies = [];
    try {
        const cleanPath = filePath.replace(/['"]/g, '');
        const data = fs.readFileSync(cleanPath, 'utf8');
        for (const line of data.split('\n')) {
            const p = line.trim().split(':');
            if (p.length >= 4) {
                const proxyObj = { server: `http://${p[0]}:${p[1]}` };
                const userPass = p.slice(2).join(':');
                const lastColonIndex = userPass.lastIndexOf(':');
                if (lastColonIndex !== -1) {
                    proxyObj.username = userPass.substring(0, lastColonIndex);
                    proxyObj.password = userPass.substring(lastColonIndex + 1).replace(/\r$/, '');
                } else {
                    proxyObj.username = p[2];
                    proxyObj.password = p[3] ? p[3].replace(/\r$/, '') : undefined;
                }
                proxies.push(proxyObj);
            }
        }
    } catch (e) {
        console.log("[-] Could not read proxy file.");
    }
    return proxies;
}

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Arras Bots Control</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: rgba(10, 10, 18, 0.72);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            color: #f8fafc;
            font-family: 'Inter', sans-serif;
            display: flex; flex-direction: column;
            height: 100vh; overflow: hidden; user-select: none;
        }

        /* ── Header ── */
        .header {
            padding: 10px 14px 6px;
            display: flex; align-items: center; justify-content: space-between;
        }
        h1 {
            font-size: 15px; font-weight: 700;
            background: linear-gradient(135deg, #38bdf8, #818cf8);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .bot-count {
            font-size: 11px; color: #4ade80; font-weight: 600;
            background: rgba(74,222,128,0.1); padding: 2px 8px; border-radius: 20px;
            border: 1px solid rgba(74,222,128,0.25);
        }

        /* ── Setup Panel ── */
        #setup-view { flex: 0 0 auto; padding: 0 10px 8px; }

        .input-group { display: flex; flex-direction: column; margin-bottom: 7px; }
        .input-group label {
            font-size: 10px; font-weight: 500; color: rgba(255,255,255,0.55);
            margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        input[type="text"], input[type="number"] {
            background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
            color: #fff; padding: 5px 9px; border-radius: 7px; font-size: 11px;
            font-family: 'Inter', sans-serif; outline: none; transition: all 0.2s; width: 100%;
        }
        input[type="text"]:focus, input[type="number"]:focus {
            border-color: #38bdf8; box-shadow: 0 0 0 2px rgba(56,189,248,0.18);
            background: rgba(255,255,255,0.1);
        }
        .row { display: flex; gap: 8px; }
        .row > div { flex: 1; display: flex; flex-direction: column; }

        .toggle-group {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 7px; background: rgba(255,255,255,0.04); padding: 5px 9px;
            border-radius: 7px; border: 1px solid rgba(255,255,255,0.1);
        }
        .toggle-group span.label { font-size: 11px; font-weight: 500; }

        /* Switch */
        .switch { position: relative; display: inline-block; width: 36px; height: 20px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider {
            position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
            background-color: rgba(255,255,255,0.18); transition: .3s; border-radius: 34px;
        }
        .slider:before {
            position: absolute; content: ""; height: 14px; width: 14px;
            left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;
        }
        input:checked + .slider { background-color: #38bdf8; }
        input:checked + .slider:before { transform: translateX(16px); }

        #proxy-panel {
            display: none; background: rgba(0,0,0,0.2); border: 1px dashed rgba(255,255,255,0.15);
            padding: 7px; border-radius: 7px; margin-bottom: 7px; text-align: center;
        }
        #proxy-btn {
            background: rgba(255,255,255,0.08); color: white; border: 1px solid rgba(255,255,255,0.18);
            padding: 4px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;
            transition: background 0.2s; margin-bottom: 4px;
        }
        #proxy-btn:hover { background: #475569; }
        #proxy-path-display { font-size: 10px; color: #94a3b8; word-break: break-all; }

        /* ── Action Buttons ── */
        .actions { display: flex; gap: 6px; padding: 0 10px 6px; flex-wrap: wrap; }
        .btn {
            flex: 1; border: none; padding: 7px 4px; border-radius: 8px;
            font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s ease;
            min-width: 60px;
        }
        .btn-spawn {
            background: linear-gradient(135deg, #3b82f6, #6366f1);
            color: white; box-shadow: 0 3px 12px rgba(99,102,241,0.35);
        }
        .btn-spawn:hover { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(99,102,241,0.5); }
        .btn-spawn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-disconnect {
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: white; box-shadow: 0 3px 12px rgba(239,68,68,0.3);
        }
        .btn-disconnect:hover { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(239,68,68,0.45); }
        .btn-disconnect:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-autorespawn {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: white; box-shadow: 0 3px 12px rgba(245,158,11,0.3);
        }
        .btn-autorespawn:hover { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(245,158,11,0.5); }
        .btn-autorespawn.active {
            background: linear-gradient(135deg, #4ade80, #22c55e);
            box-shadow: 0 3px 12px rgba(74,222,128,0.4);
            animation: pulse-green 1.5s infinite;
        }
        @keyframes pulse-green {
            0%,100% { box-shadow: 0 3px 12px rgba(74,222,128,0.4); }
            50%      { box-shadow: 0 3px 20px rgba(74,222,128,0.75); }
        }

        /* ── Log Panel ── */
        #log-panel {
            flex: 1 1 auto;
            margin: 0 10px 10px;
            background: rgba(0,0,0,0.35);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            overflow: hidden;
            display: flex; flex-direction: column;
        }
        .log-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 4px 8px;
            background: rgba(255,255,255,0.04);
            border-bottom: 1px solid rgba(255,255,255,0.08);
            font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.5);
            text-transform: uppercase; letter-spacing: 0.5px;
        }
        .log-clear { cursor: pointer; color: #64748b; font-size: 10px; transition: color 0.2s; }
        .log-clear:hover { color: #ef4444; }
        #log-output {
            flex: 1 1 auto; overflow-y: auto; padding: 6px 8px;
            font-size: 10px; font-family: 'Consolas', monospace; color: #cbd5e1;
            line-height: 1.55;
        }
        #log-output::-webkit-scrollbar { width: 4px; }
        #log-output::-webkit-scrollbar-track { background: transparent; }
        #log-output::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
        .log-info  { color: #94a3b8; }
        .log-ok    { color: #4ade80; }
        .log-error { color: #f87171; }
        .log-warn  { color: #fbbf24; }

        /* ── Loading overlay ── */
        #loading-bar {
            display: none; height: 2px;
            background: linear-gradient(90deg, #38bdf8, #818cf8);
            animation: loading-slide 1.2s ease-in-out infinite;
            margin: 0 10px 6px; border-radius: 2px;
        }
        @keyframes loading-slide {
            0%   { transform: scaleX(0); transform-origin: left; }
            50%  { transform: scaleX(1); transform-origin: left; }
            51%  { transform: scaleX(1); transform-origin: right; }
            100% { transform: scaleX(0); transform-origin: right; }
        }

        /* Status dot */
        .status-dot {
            display: inline-block; width: 5px; height: 5px; border-radius: 50%;
            background: #4ade80; margin-right: 5px; animation: blink 2s infinite;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .status-dot.inactive { background: #f87171; animation: none; }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚡ Arras Bots</h1>
        <span class="bot-count" id="alive-badge">0 bots</span>
    </div>

    <div id="setup-view">
        <div class="input-group">
            <label>Target URL</label>
            <div style="display:flex; gap:6px;">
                <input type="text" id="url" value="https://arras.io/" autocomplete="off" style="flex:1;"/>
                <button type="button" id="paste-btn" style="background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.16); color:white; border-radius:7px; padding:0 10px; cursor:pointer; font-family:'Inter',sans-serif; font-size:11px; transition:background 0.2s; white-space:nowrap;">Paste</button>
            </div>
        </div>
        <div class="input-group">
            <label>Bot Name (in-game)</label>
            <input type="text" id="botname" value="" placeholder="Bot Name" autocomplete="off"/>
        </div>
        <div class="input-group row">
            <div>
                <label>Bots</label>
                <input type="number" id="bots" value="2" min="1" max="50"/>
            </div>
            <div>
                <label>Concurrency</label>
                <input type="number" id="concurrency" value="3" min="1" max="10"/>
            </div>
        </div>
        <div class="input-group row">
            <div>
                <label>Respawn Delay (s)</label>
                <input type="number" id="respawn-delay" value="5" min="1" max="120"/>
            </div>
            <div style="justify-content:flex-end; align-items:flex-end;">
            </div>
        </div>
        <div class="toggle-group">
            <span class="label">Headless Mode</span>
            <label class="switch"><input type="checkbox" id="headless" checked><span class="slider"></span></label>
        </div>
        <div class="toggle-group">
            <span class="label">Use Proxies</span>
            <label class="switch"><input type="checkbox" id="use-proxies"><span class="slider"></span></label>
        </div>
        <div id="proxy-panel">
            <button id="proxy-btn">Browse Proxy File</button>
            <div id="proxy-path-display">No file selected</div>
        </div>
    </div>

    <div id="loading-bar"></div>

    <div class="actions">
        <button class="btn btn-spawn" id="spawn-btn">▶ Spawn</button>
        <button class="btn btn-disconnect" id="disconnect-btn" disabled>✕ DC</button>
        <button class="btn btn-autorespawn" id="autorespawn-btn">🔄 Auto</button>
    </div>

    <div id="log-panel">
        <div class="log-header">
            <span><span class="status-dot inactive" id="status-dot"></span>Log</span>
            <span class="log-clear" id="log-clear-btn" title="Clear log">✕ clear</span>
        </div>
        <div id="log-output"></div>
    </div>

    <script>
        const proxyCheck = document.getElementById('use-proxies');
        const proxyPanel = document.getElementById('proxy-panel');
        const proxyBtn = document.getElementById('proxy-btn');
        const proxyDisplay = document.getElementById('proxy-path-display');
        const spawnBtn = document.getElementById('spawn-btn');
        const disconnectBtn = document.getElementById('disconnect-btn');
        const autoRespawnBtn = document.getElementById('autorespawn-btn');
        const loadingBar = document.getElementById('loading-bar');
        const aliveBadge = document.getElementById('alive-badge');
        const statusDot = document.getElementById('status-dot');
        const logOutput = document.getElementById('log-output');
        let selectedProxyPath = null;
        let aliveCount = 0;
        let autoRespawnActive = false;

        proxyCheck.addEventListener('change', (e) => {
            proxyPanel.style.display = e.target.checked ? 'block' : 'none';
        });

        proxyBtn.addEventListener('click', async () => {
            const p = await window.selectProxyFile();
            if (p) {
                selectedProxyPath = p;
                proxyDisplay.innerText = p.split('\\\\').pop().split('/').pop();
                proxyBtn.innerText = 'File Selected ✓';
            }
        });

        document.getElementById('paste-btn').addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                document.getElementById('url').value = text;
            } catch (err) {
                addLog('Clipboard-Zugriff verweigert!', 'error');
            }
        });

        document.getElementById('log-clear-btn').addEventListener('click', () => {
            logOutput.innerHTML = '';
        });

        function addLog(msg, type = 'info') {
            const ts = new Date().toLocaleTimeString('de-DE');
            const el = document.createElement('div');
            el.className = 'log-' + type;
            el.textContent = '[' + ts + '] ' + msg;
            logOutput.appendChild(el);
            logOutput.scrollTop = logOutput.scrollHeight;
        }

        function buildConfig() {
            return {
                url: document.getElementById('url').value.trim(),
                bots: parseInt(document.getElementById('bots').value) || 1,
                concurrency: parseInt(document.getElementById('concurrency').value) || 3,
                headless: document.getElementById('headless').checked,
                useProxies: proxyCheck.checked,
                proxyPath: selectedProxyPath,
                botName: document.getElementById('botname').value.trim(),
                respawnDelay: parseInt(document.getElementById('respawn-delay').value) || 5
            };
        }

        function setAlive(n) {
            aliveCount = n;
            aliveBadge.textContent = n + ' bot' + (n !== 1 ? 's' : '');
            statusDot.className = 'status-dot' + (n > 0 ? '' : ' inactive');
            disconnectBtn.disabled = n === 0;
        }

        function setLoading(on) {
            loadingBar.style.display = on ? 'block' : 'none';
            spawnBtn.disabled = on;
        }

        spawnBtn.addEventListener('click', () => {
            const cfg = buildConfig();
            if (!cfg.url.startsWith('http')) { addLog('URL muss mit http:// oder https:// beginnen', 'error'); return; }
            setLoading(true);
            addLog('Spawne ' + cfg.bots + ' Bots' + (cfg.botName ? ' als "' + cfg.botName + '"' : '') + '...', 'warn');
            window.triggerSpawn(cfg);
        });

        disconnectBtn.addEventListener('click', () => {
            disconnectBtn.disabled = true;
            addLog('Disconnecting all bots...', 'warn');
            window.triggerDisconnect();
        });

        autoRespawnBtn.addEventListener('click', () => {
            autoRespawnActive = !autoRespawnActive;
            if (autoRespawnActive) {
                autoRespawnBtn.textContent = '⏹ Stop Auto';
                autoRespawnBtn.classList.add('active');
                addLog('Auto-Respawn aktiviert!', 'ok');
                window.triggerAutoRespawn(buildConfig());
            } else {
                autoRespawnBtn.textContent = '🔄 Auto';
                autoRespawnBtn.classList.remove('active');
                addLog('Auto-Respawn gestoppt.', 'warn');
                window.triggerStopAutoRespawn();
            }
        });

        // exposed from Node
        window.onBotReady = (i, total) => {
            setAlive(i);
            addLog('Bot ' + i + '/' + total + ' ready', 'ok');
        };
        window.onBotFailed = (i, msg) => {
            addLog('Bot ' + i + ' failed: ' + msg, 'error');
        };
        window.onSpawnDone = (total) => {
            setLoading(false);
            addLog('Alle ' + total + ' Bots aktiv!', 'ok');
        };
        window.onDisconnectDone = (count) => {
            setAlive(0);
            disconnectBtn.disabled = true;
            spawnBtn.disabled = false;
            addLog(count + ' Bots getrennt. IPs rotiert.', 'warn');
        };
        window.onAutoRespawnStopped = () => {
            autoRespawnActive = false;
            autoRespawnBtn.textContent = '🔄 Auto';
            autoRespawnBtn.classList.remove('active');
            addLog('Auto-Respawn beendet.', 'info');
        };
        window.onBotRespawned = () => {
            addLog('↺ Bot respawned!', 'ok');
        };
        window.onLog = (msg, type) => addLog(msg, type || 'info');

        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            if (window.mirrorKeyDown) window.mirrorKeyDown(e.key);
        });
        window.addEventListener('keyup', (e) => {
            if (e.target.tagName === 'INPUT') return;
            if (window.mirrorKeyUp) window.mirrorKeyUp(e.key);
        });
    </script>
</body>
</html>
`;

async function main() {
    console.log("[*] Opening Interface...");

    const profilePath = path.join(os.tmpdir(), 'arras_ui_' + Date.now());
    let controllerCtx;
    try {
        controllerCtx = await chromium.launchPersistentContext(profilePath, {
            headless: !!process.env.GITHUB_ACTIONS, // Use headless if on GitHub Actions
            noViewport: true,
            args: [
                '--app=data:text/html,<html><head><title>Arras Bots</title></head><body style="background:#0a0a12;"></body></html>',
                '--window-size=310,500',
                ...(process.env.GITHUB_ACTIONS ? [] : ['--enable-transparent-titlebar', '--transparent-title-bar'])
            ]
        });
    } catch (err) {
        console.error("Failed to launch UI context:", err);
        process.exit(1);
    }

    await controllerCtx.grantPermissions(['clipboard-read', 'clipboard-write']);
    const controllerPage = controllerCtx.pages().length > 0
        ? controllerCtx.pages()[0]
        : await controllerCtx.newPage();

    controllerPage.on('close', () => {
        console.log("Controller closed. Exiting...");
        process.exit(0);
    });

    // ── State ────────────────────────────────────────────────────────────────
    let activeBotCtxs = [];   // array of { ctx, page, watcherActive }
    let proxies = [];
    let proxyIndex = 0;    // auto-iterates through the list
    let browser = null;
    let globalAutoRespawn = false; // when true, each bot gets a death-watcher

    // ── Helper: get next proxy from list ─────────────────────────────────────
    function nextProxy() {
        if (proxies.length === 0) return undefined;
        const p = proxies[proxyIndex % proxies.length];
        proxyIndex++;
        return p;
    }

    function uiLog(msg, type) {
        console.log(`[ui] ${msg}`);
        controllerPage.evaluate(({ m, t }) => {
            if (window.onLog) window.onLog(m, t);
        }, { m: msg, t: type }).catch(() => { });
    }

    // ── Helper: enter game (fill name + press Enter) ──────────────────────────────
    async function enterGame(page, botName) {
        try {
            // No fixed delay, jump straight to checking
            let nameInput = await page.$('input');

            if (!nameInput) {
                // Short wait to see if it appears
                try { await page.waitForSelector('input', { timeout: 2000 }); } catch (_) { }
                nameInput = await page.$('input');
            }

            if (nameInput) {
                await nameInput.click({ clickCount: 3 });
                await nameInput.press('Control+A');
                await nameInput.press('Backspace');
                if (botName) {
                    await nameInput.type(botName, { delay: 10 });
                }
                await nameInput.press('Enter');
            } else {
                // Fallback: Click the center
                const size = page.viewportSize() || { width: 1280, height: 720 };
                await page.mouse.click(size.width / 2, size.height / 2);
            }
        } catch (e) {
            try { await page.mouse.click(640, 360); } catch (_) { }
        }
    }

    // ── Per-bot death watcher ─────────────────────────────────────────────────
    // Polls every 3s; if the bot is on the start/death screen it auto-clicks Play.
    async function watchBotRespawn(botEntry, botIndex, config) {
        botEntry.watcherActive = true;
        uiLog(`Bot ${botIndex + 1}: Auto-Respawn aktiv 👁`, 'info');

        const delay = (config.respawnDelay || 5) * 1000;

        while (botEntry.watcherActive) {
            try {
                if (!botEntry.watcherActive) break;
                if (botEntry.page.isClosed()) break;

                // Status des Bots prüfen: Menü, Disconnected oder Aktiv
                const botState = await botEntry.page.evaluate(() => {
                    const inputs = Array.from(document.querySelectorAll('input'));
                    const hasMenu = inputs.some(inp => {
                        const r = inp.getBoundingClientRect();
                        return r.width > 0 && r.height > 0;
                    });
                    if (hasMenu) return 'menu';

                    const bodyText = document.body.innerText;
                    const indicators = ['Disconnected', 'Connecting', 'Socket closed', 'Connecting...', 'You were kicked'];
                    if (indicators.some(txt => bodyText.includes(txt))) {
                        return 'disconnected';
                    }
                    return 'alive';
                }).catch(() => 'error');

                if (botState === 'menu' && botEntry.watcherActive) {
                    uiLog(`Bot ${botIndex + 1}: Tod erkannt – warte ${config.respawnDelay}s...`, 'warn');
                    await new Promise(r => setTimeout(r, delay));

                    if (!botEntry.watcherActive) break;

                    uiLog(`Bot ${botIndex + 1}: Respawne!`, 'ok');
                    await enterGame(botEntry.page, config.botName);

                    controllerPage.evaluate(() => {
                        if (window.onBotRespawned) window.onBotRespawned();
                    }).catch(() => { });

                    // Kurze Pause nach dem Klick
                    await new Promise(r => setTimeout(r, 2000));
                } else if (botState === 'disconnected' && botEntry.watcherActive) {
                    uiLog(`Bot ${botIndex + 1}: Verbindung verloren! Lade Seite neu (gleiche IP)...`, 'error');
                    await botEntry.page.reload({ waitUntil: 'commit' }).catch(() => { });
                    await new Promise(r => setTimeout(r, 5000));

                    if (!botEntry.watcherActive) break;

                    await enterGame(botEntry.page, config.botName);
                    await new Promise(r => setTimeout(r, 2000));
                } else {
                    // Bot scheint am Leben zu sein – in 3s erneut prüfen
                    await new Promise(r => setTimeout(r, 3000));
                }
            } catch (e) {
                if (botEntry.page.isClosed()) break;
                await new Promise(r => setTimeout(r, 3000));
            }
        }
        uiLog(`Bot ${botIndex + 1}: Watcher beendet`, 'info');
    }

    // ── Exposed: file picker ──────────────────────────────────────────────────
    await controllerPage.exposeFunction('selectProxyFile', async () => {
        try {
            const tempVbs = path.join(os.tmpdir(), 'proxy_picker.vbs');
            const vbsScript = `
Set objExec = CreateObject("WScript.Shell").Exec("powershell.exe -NoProfile -Command ""Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.OpenFileDialog; $f.Filter = 'Text Files (*.txt)|*.txt|All Files (*.*)|*.*'; $f.Title = 'Select Proxy File (DOMAIN:PORT:USER:PASS)'; $f.ShowHelp = $true; if($f.ShowDialog() -eq 'OK'){ Write-Output $f.FileName }""")
strOutput = objExec.StdOut.ReadAll()
WScript.Echo strOutput
            `;
            fs.writeFileSync(tempVbs, vbsScript);
            const proxyPath = execSync(`cscript //nologo "${tempVbs}"`, { encoding: 'utf-8' }).trim();
            try { fs.unlinkSync(tempVbs); } catch (e) { }
            return proxyPath || null;
        } catch (e) {
            return null;
        }
    });

    // ── Exposed: key mirror ───────────────────────────────────────────────────
    await controllerPage.exposeFunction('mirrorKeyDown', async (key) => {
        const k = key === " " ? "Space" : key;
        activeBotCtxs.forEach(b => b.page.keyboard.down(k).catch(() => { }));
    });
    await controllerPage.exposeFunction('mirrorKeyUp', async (key) => {
        const k = key === " " ? "Space" : key;
        activeBotCtxs.forEach(b => b.page.keyboard.up(k).catch(() => { }));
    });

    // ── Exposed: spawn ────────────────────────────────────────────────────────
    await controllerPage.exposeFunction('triggerSpawn', async (config) => {
        try {
            currentConfig = config;
            const { url, bots, concurrency, headless } = config;

            if (config.useProxies && config.proxyPath) {
                proxies = loadProxies(config.proxyPath);
                uiLog(`${proxies.length} Proxies geladen. Starte bei Index ${proxyIndex}.`, 'info');
            } else {
                proxies = [];
            }

            if (!browser || !browser.isConnected()) {
                browser = await chromium.launch({
                    headless: process.env.GITHUB_ACTIONS ? true : headless,
                    args: [
                        "--disable-blink-features=AutomationControlled",
                        "--no-sandbox",
                        "--disable-gpu"
                    ]
                });
            }

            async function launchOne(i) {
                const proxy = nextProxy();
                if (proxy) uiLog(`Bot ${i + 1} → IP: ${proxy.server}`, 'info');
                const ctx = await browser.newContext({
                    proxy: proxy,
                    userAgent: USER_AGENTS[i % USER_AGENTS.length],
                    viewport: { width: 1280, height: 720 },
                    deviceScaleFactor: 1
                });
                const page = await ctx.newPage();
                await page.addInitScript("delete navigator.__proto__.webdriver");
                try {
                    await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
                    await page.waitForSelector('canvas', { timeout: 30000 });

                    // Join game
                    await enterGame(page, config.botName);

                    const botEntry = { ctx, page, watcherActive: false };
                    activeBotCtxs.push(botEntry);

                    // Signal UI immediately after trying to join
                    await controllerPage.evaluate(({ i, total }) => {
                        if (window.onBotReady) window.onBotReady(i, total);
                    }, { i: activeBotCtxs.length, total: bots });

                    if (globalAutoRespawn) {
                        setTimeout(() => watchBotRespawn(botEntry, activeBotCtxs.length - 1, config), 2000);
                    }
                } catch (e) {
                    console.log(`[-] Bot ${i + 1} failed: ${e.message}`);
                    await controllerPage.evaluate(({ i, m }) => {
                        if (window.onBotFailed) window.onBotFailed(i, m);
                    }, { i: i + 1, m: e.message.substring(0, 80) });
                    try { await ctx.close(); } catch (_) { }
                }
            }

            const indices = Array.from({ length: bots }, (_, i) => i);
            for (let i = 0; i < bots; i += concurrency) {
                const chunk = indices.slice(i, i + concurrency);
                await Promise.all(chunk.map(launchOne));
                // Minimal break between chunks to keep the browser responsive
                await new Promise(r => setTimeout(r, 500));
            }

            console.log("[*] Spawn done.");
            await controllerPage.evaluate((total) => {
                if (window.onSpawnDone) window.onSpawnDone(total);
            }, activeBotCtxs.length);

        } catch (e) {
            console.error("Spawn failed:", e);
            uiLog('Spawn error: ' + e.message, 'error');
        }
    });

    // ── Exposed: disconnect ───────────────────────────────────────────────────
    await controllerPage.exposeFunction('triggerDisconnect', async () => {
        try {
            const count = activeBotCtxs.length;
            console.log(`[*] Disconnecting ${count} bots...`);
            await Promise.all(activeBotCtxs.map(b => b.ctx.close().catch(() => { })));
            activeBotCtxs = [];
            console.log("[*] All bots disconnected.");
            await controllerPage.evaluate((c) => {
                if (window.onDisconnectDone) window.onDisconnectDone(c);
            }, count);
        } catch (e) {
            console.error("Disconnect failed:", e);
            uiLog('Disconnect error: ' + e.message, 'error');
        }
    });

    // ── Exposed: auto-respawn ─────────────────────────────────────────────────
    // Enables per-bot death-watching: each alive bot gets a watcher,
    // and new bots spawned while active also get one automatically.

    await controllerPage.exposeFunction('triggerAutoRespawn', async (config) => {
        globalAutoRespawn = true;
        uiLog(`Auto-Respawn aktiviert! Bots werden nach dem Tod automatisch respawnen.`, 'ok');

        // Start watcher for every currently running bot
        activeBotCtxs.forEach((botEntry, idx) => {
            if (!botEntry.watcherActive) {
                watchBotRespawn(botEntry, idx, config);
            }
        });
    });

    await controllerPage.exposeFunction('triggerStopAutoRespawn', async () => {
        globalAutoRespawn = false;
        // Signal all running watchers to stop
        activeBotCtxs.forEach(b => { b.watcherActive = false; });
        uiLog('Auto-Respawn deaktiviert. Bots laufen weiter, respawnen aber nicht mehr.', 'warn');
        await controllerPage.evaluate(() => {
            if (window.onAutoRespawnStopped) window.onAutoRespawnStopped();
        }).catch(() => { });
    });

    await controllerPage.setContent(htmlContent);

    // If running in GitHub Actions, automatically trigger the spawn since we can't click the UI
    if (process.env.GITHUB_ACTIONS) {
        console.log("[*] GitHub Actions automatically triggering spawn in 5 seconds...");
        setTimeout(() => {
            const githubConfig = {
                url: process.env.TARGET_URL || "https://arras.io/",
                bots: parseInt(process.env.BOT_COUNT) || 10,
                concurrency: parseInt(process.env.CONCURRENCY) || 3,
                headless: true,
                useProxies: false,
                botName: process.env.BOT_NAME || "GitHub_Afk",
                respawnDelay: 5
            };
            // Directly trigger spawn to avoid UI issues
            controllerPage.evaluate((cfg) => window.triggerSpawn(cfg), githubConfig)
                .catch(e => console.error("Auto-spawn failed:", e));
        }, 5000);

        // Keep the process alive indefinitely
        setInterval(() => { }, 1000000);
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
