const { app, Menu, BrowserWindow, ipcMain } = require('electron')
const parseArgs = require('electron-args');
const path = require('path');
const https = require('https');
const http = require('http');
const i18n = require('i18n');

i18n.configure({
    directory: __dirname + '/locales',
    defaultLocale: 'en'
});

const cli = parseArgs(`
    voice-changer-native-client

    Usage
      $ <command> <url>

    Options
      --help       show help
      --version    show version
      --url,-u  open client

    Examples
      $ voice-changer-native-client http://127.0.0.1:18888/
`, {
    alias: {
        u: 'url'
    },
    default: {
        url: "http://127.0.0.1:18888/"
    }
});


const url = cli.flags["url"]
// console.log(cli.flags);
// console.log(cli.flags["url"]);



// 実行環境がmacOSならtrue
const isMac = (process.platform === 'darwin');  // 'darwin' === macOS

//------------------------------------
// メニュー
//------------------------------------
// メニューを準備する
const createMenuTemplate = () => {
    const template = Menu.buildFromTemplate([
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about', label: `${i18n.__("about")} ${app.name}` },
                { type: 'separator' },
                { role: 'services', label: i18n.__("service") },
                { type: 'separator' },
                { role: 'hide', label: i18n.__("hide") },
                { role: 'hideothers', label: i18n.__("hide-others") },
                { role: 'unhide', label: i18n.__("unhide") },
                { type: 'separator' },
                { role: 'quit', label: i18n.__("quit") }
            ]
        }] : []),
        {
            label: i18n.__("file"),
            submenu: [
                isMac ? { role: 'close', label: i18n.__("close") } : { role: 'quit', label: i18n.__("quit") }
            ]
        },
        {
            label: i18n.__("display"),
            submenu: [
                { role: 'reload', label: i18n.__("reload") },
                { role: 'forceReload', label: i18n.__("force-reload") },
                { role: 'toggleDevTools', label: i18n.__("show-dev-tool") },
                { type: 'separator' },
                { role: 'resetZoom', label: i18n.__("reset-zoom") },
                { role: 'zoomIn', label: i18n.__("zoom-in") },
                { role: 'zoomOut', label: i18n.__("zoom-out") },
                { type: 'separator' },
                { role: 'togglefullscreen', label: i18n.__("toggle-fullscreen") },
                { role: 'minimize', label: i18n.__("minimize") },
            ]
        },
        {
            label: i18n.__("window"),
            submenu: [
                ...(isMac ? [
                    { role: 'front', label: i18n.__("front") },
                    { type: 'separator' },
                    { role: 'window', label: i18n.__("window") }
                ] : [
                    { role: 'close', label: i18n.__("close") }
                ])
            ]
        }
    ]);
    return template;
}


const openVCPage = async (win) => {
    try {
        await win.loadURL(url).catch(err => {
            // console.log("", err)
        })
    } catch (err) {
        // console.log("", err)
    }
}

const createWindow = async () => {
    const win = new BrowserWindow({
        width: 760,
        height: 900,
        webPreferences: {
            //nodeIntegration: true,
            //preload: path.join(__dirname, 'preload.js')
            preload: path.join(app.getAppPath(), 'preload.js')
        }
    })

    app.on('certificate-error', function (event, webContents, url, error, certificate, callback) {
        event.preventDefault();
        callback(true);
    });

    ipcMain.on('open-browser', (e, url) => {
        require('electron').shell.openExternal(url);
    });

    win.webContents.on("did-fail-load", async function (event, errorCode, errorDescription, validatedURL) {
        console.log("Preparing your application. Please wait...")
        await new Promise((resolve) => {
            setTimeout(resolve, 1000)
        })
        openVCPage(win)
        console.log(errorCode, errorDescription, validatedURL)
        event.preventDefault();
    });
    console.log("[VCClient] Access", url)

    if (url.startsWith("https://")) {
        // ↓ httpsでクライアントを立ち上げることがないので今のところ動かしたことがない。
        // https.get(url, (res) => {
        //     console.log('statusCode:', res.statusCode);
        //     console.log('headers:', res.headers);

        //     res.on('data', (d) => {
        //         process.stdout.write(d);
        //     });

        // }).on('error', (e) => {
        //     console.error(e);
        // });
    } else {
        let waitCount = 0
        while (true) {
            try {
                const p = new Promise((resolve, reject) => {
                    http.get(url, (res) => {
                        console.log("[VCClient] wait web server... done", res.statusCode)
                        resolve()
                    }).on('error', (e) => {
                        reject(e);
                    });
                })
                await p
                openVCPage(win)
                break
            } catch (e) {
                if (e.code == "ECONNREFUSED") {
                    if (waitCount % 10 == 0) {
                        console.log(`[VCClient] wait web server...${waitCount}`, url)
                    }
                    waitCount += 1
                } else {
                    console.log("[VCClient] wait web server...", url, e.code)
                }
                await new Promise((resolve) => {
                    setTimeout(resolve, 1000)
                })
            }
        }
    }
}

app.whenReady().then(() => {
    let locale = app.getLocale()
    i18n.setLocale(locale);
    const template = createMenuTemplate();
    Menu.setApplicationMenu(template);

    createWindow()
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
