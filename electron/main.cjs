const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
try {
    if (require('electron-squirrel-startup')) {
        app.quit();
    }
} catch (e) {
    // electron-squirrel-startup not available on macOS - ignore
}

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.cjs'),
        },
        icon: path.join(__dirname, 'public/icon.png'),
        titleBarStyle: 'hiddenInset', // macOS style
        backgroundColor: '#0D1117',
        show: false,
    });

    // Load the app
    if (isDev) {
        // In development, load from Vite dev server
        mainWindow.loadURL('http://localhost:5173');
        // Open DevTools
        mainWindow.webContents.openDevTools();
    } else {
        // In production, load the built files from project root dist folder
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Open external links in browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    // Handle window close
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Create menu
function createMenu() {
    const template = [
        {
            label: 'LogisPro',
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
                { type: 'separator' },
                { role: 'toggleDevTools' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                { role: 'front' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Documentation',
                    click: async () => {
                        await shell.openExternal('https://logispro.app/docs');
                    }
                },
                {
                    label: 'Report Issue',
                    click: async () => {
                        await shell.openExternal('https://github.com/rosette/logispro/issues');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// ============================================
// DEVICE ID GENERATION (for hardware fingerprint)
// ============================================

function generateDeviceId() {
    const components = [];

    // 1. CPU info
    const cpus = os.cpus();
    if (cpus && cpus.length > 0) {
        components.push(cpus[0].model);
        components.push(`cores:${cpus.length}`);
    }

    // 2. Hostname
    components.push(os.hostname());

    // 3. Platform and architecture
    components.push(os.platform());
    components.push(os.arch());

    // 4. Primary MAC address
    const networkInterfaces = os.networkInterfaces();
    let macAddress = '';

    for (const [name, interfaces] of Object.entries(networkInterfaces)) {
        if (!interfaces) continue;

        for (const iface of interfaces) {
            if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
                macAddress = iface.mac;
                break;
            }
        }
        if (macAddress) break;
    }

    if (macAddress) {
        components.push(macAddress);
    }

    // Combine and hash
    const combined = components.join('|');
    const hash = crypto.createHash('sha256').update(combined).digest('hex');

    return hash;
}

function getDeviceInfo() {
    const platform = os.platform();
    const release = os.release();

    let osName = '';
    switch (platform) {
        case 'darwin':
            osName = 'macOS';
            break;
        case 'win32':
            osName = 'Windows';
            break;
        case 'linux':
            osName = 'Linux';
            break;
        default:
            osName = platform;
    }

    return {
        deviceId: generateDeviceId(),
        deviceName: os.hostname(),
        osInfo: `${osName} ${release}`,
    };
}

// IPC Handlers
ipcMain.handle('get-device-info', async () => {
    return getDeviceInfo();
});

// App lifecycle
app.whenReady().then(() => {
    createWindow();
    createMenu();

    app.on('activate', () => {
        // On macOS, re-create window when dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Security: Prevent navigation to external sites
app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.origin !== 'http://localhost:5173' && !navigationUrl.startsWith('file://')) {
            event.preventDefault();
        }
    });
});
