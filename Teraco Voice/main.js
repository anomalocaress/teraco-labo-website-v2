const electron = require('electron');
const { app, BrowserWindow, ipcMain, clipboard } = electron;
const path = require('path');
const fs = require('fs');
const os = require('os');
const { uIOhook, UiohookKey } = require('uiohook-napi');
const robot = require('robotjs');
const { spawn } = require('child_process');

let mainWindow;
let welcomeWindow;
let isRecording = false;
let pythonProcess = null;

// Python path (in venv)
let pythonPath;
let scriptPath;

// app.isPackaged is available after app module is imported, 
// but it's safer to check it inside a function or after we are sure 'app' is defined.
// Since we require('electron') at the top, 'app' is defined.
// However, let's move the path assignment into a function or check it safely.

function setupPaths() {
    if (app.isPackaged) {
        // In production, resources are in Contents/Resources
        pythonPath = path.join(process.resourcesPath, 'venv', 'bin', 'python3');
        scriptPath = path.join(process.resourcesPath, 'transcribe_service.py');
    } else {
        // In development, resources are in project root
        pythonPath = path.join(__dirname, 'venv', 'bin', 'python3');
        scriptPath = path.join(__dirname, 'transcribe_service.py');
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 200,
        height: 40,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        alwaysOnTop: true,
        frame: false,
        transparent: true,
        resizable: false,
        hasShadow: false,
        skipTaskbar: false,  // Show in dock (macOS) and taskbar (Windows)
        x: 0, // Will be centered later
        y: 0  // Will be positioned at bottom later
    });

    // Position at bottom center
    const { screen } = electron;
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const winWidth = 200;
    const winHeight = 40;

    mainWindow.setPosition(
        Math.round((width - winWidth) / 2),
        Math.round(height - winHeight - 20) // 20px padding from bottom
    );

    // Set highest possible level
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

    mainWindow.loadFile('index.html');

    // Show welcome screen on first launch
    checkFirstLaunch();
}

function createWelcomeWindow() {
    welcomeWindow = new BrowserWindow({
        width: 700,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        frame: true,
        transparent: false,
        resizable: false,
        alwaysOnTop: true,
        title: 'Teraco Voice - ようこそ'
    });

    welcomeWindow.loadFile('welcome.html');

    welcomeWindow.on('closed', () => {
        welcomeWindow = null;
    });
}

function checkFirstLaunch() {
    const userDataPath = app.getPath('userData');
    const flagFile = path.join(userDataPath, '.first-launch-done');

    if (!fs.existsSync(flagFile)) {
        // First launch
        createWelcomeWindow();
    }
}

function markFirstLaunchDone() {
    const userDataPath = app.getPath('userData');
    const flagFile = path.join(userDataPath, '.first-launch-done');

    try {
        fs.writeFileSync(flagFile, new Date().toISOString());
    } catch (err) {
        console.error('Failed to create first launch flag:', err);
    }
}

function sendLogToRenderer(message) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('log-message', message);
    }
}

function startPythonService() {
    console.log('Starting Python service...');
    sendLogToRenderer('Starting Python service...');
    pythonProcess = spawn(pythonPath, [scriptPath]);

    pythonProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            line = line.trim();
            if (!line) return;

            console.log('Python:', line);

            if (line === 'READY') {
                console.log('Whisper model is ready!');
                sendLogToRenderer('Whisper model is ready!');
                if (mainWindow) mainWindow.webContents.send('status-update', 'idle');
            } else if (line.startsWith('RESULT:')) {
                const text = line.substring(7);
                if (text) {
                    pasteText(text);
                    sendLogToRenderer('Transcribed: ' + text);
                } else {
                    sendLogToRenderer('Transcribed: (empty)');
                }
                if (mainWindow) mainWindow.webContents.send('status-update', 'idle');
            } else if (line.startsWith('ERROR:')) {
                const errMsg = line.substring(6);
                console.error('Python Logic Error:', errMsg);
                sendLogToRenderer('Python Error: ' + errMsg);
                if (mainWindow) mainWindow.webContents.send('status-update', 'error');
            }
        });
    });

    pythonProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        console.error('Python Stderr:', msg);
        // Don't send all stderr to UI log as it might be too noisy (e.g. loading bars), 
        // but maybe useful for debugging now.
        if (msg.includes('Error') || msg.includes('Exception')) {
            sendLogToRenderer('Python Stderr: ' + msg);
        }
    });

    pythonProcess.on('close', (code) => {
        console.log(`Python process exited with code ${code}`);
        sendLogToRenderer(`Python process exited with code ${code}`);
    });
}

// Handle welcome window close
ipcMain.on('close-welcome', (event, dontShowAgain) => {
    if (dontShowAgain) {
        markFirstLaunchDone();
    }
    if (welcomeWindow) {
        welcomeWindow.close();
    }
});

app.whenReady().then(() => {
    setupPaths();
    createWindow();
    startPythonService();

    uIOhook.start();

    if (process.platform === 'darwin') {
        const { systemPreferences } = require('electron');
        systemPreferences.askForMediaAccess('microphone');
    }
});

app.on('window-all-closed', () => {
    if (pythonProcess) {
        pythonProcess.kill();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    if (pythonProcess) {
        pythonProcess.kill();
    }
});

// Global Keyboard Hook
uIOhook.on('keydown', (e) => {
    if ((e.keycode === UiohookKey.Shift || e.keycode === UiohookKey.ShiftRight) && !isRecording) {
        startRecording();
    }
});

uIOhook.on('keyup', (e) => {
    if ((e.keycode === UiohookKey.Shift || e.keycode === UiohookKey.ShiftRight) && isRecording) {
        stopRecording();
    }
});

let recordingStartTime = 0;

function startRecording() {
    isRecording = true;
    recordingStartTime = Date.now();
    mainWindow.webContents.send('status-update', 'listening');
    mainWindow.webContents.send('start-recording');
    console.log('Started recording...');
}

function stopRecording() {
    if (!isRecording) return;

    const duration = Date.now() - recordingStartTime;
    isRecording = false;

    if (duration < 300) {
        console.log(`Recording too short (${duration}ms). Ignoring.`);
        mainWindow.webContents.send('status-update', 'idle');
        mainWindow.webContents.send('cancel-recording'); // New event to cancel
        return;
    }

    mainWindow.webContents.send('status-update', 'processing');
    mainWindow.webContents.send('stop-recording');
    console.log('Stopped recording...');
}

ipcMain.on('audio-data', (event, buffer) => {
    const tempPath = path.join(os.tmpdir(), `teraco_voice_${Date.now()}.webm`);

    try {
        fs.writeFileSync(tempPath, buffer);
        if (pythonProcess) {
            pythonProcess.stdin.write(`TRANSCRIBE:${tempPath}\n`);
        }
    } catch (e) {
        console.error('File write error:', e);
        mainWindow.webContents.send('status-update', 'error');
    }
});

ipcMain.on('recording-error', (event, msg) => {
    console.error(msg);
    mainWindow.webContents.send('status-update', 'error');
});

function pasteText(text) {
    clipboard.writeText(text);
    const modifier = process.platform === 'darwin' ? 'command' : 'control';
    robot.keyTap('v', [modifier]);
}
