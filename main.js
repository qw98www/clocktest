const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow = null;
let breakWindow = null;
let breakInterval = null;
let tickTimer = null;

const DEFAULT_SETTINGS = {
  enabled: true,
  intervalMinutes: 45,
  breakMinutes: 5,
};

const state = {
  ...DEFAULT_SETTINGS,
  isRunning: false,
  isOnBreak: false,
  nextBreakAt: null,
  breakEndAt: null,
};

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    state.enabled = parsed.enabled !== false;
    state.intervalMinutes = clampNumber(parsed.intervalMinutes, 1, 240, DEFAULT_SETTINGS.intervalMinutes);
    state.breakMinutes = clampNumber(parsed.breakMinutes, 1, 60, DEFAULT_SETTINGS.breakMinutes);
  } catch (_error) {
    saveSettings();
  }
}

function saveSettings() {
  const payload = {
    enabled: state.enabled,
    intervalMinutes: state.intervalMinutes,
    breakMinutes: state.breakMinutes,
  };
  fs.writeFileSync(settingsPath(), JSON.stringify(payload, null, 2), 'utf8');
}

function clampNumber(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function publicState() {
  return {
    enabled: state.enabled,
    intervalMinutes: state.intervalMinutes,
    breakMinutes: state.breakMinutes,
    isRunning: state.isRunning,
    isOnBreak: state.isOnBreak,
    nextBreakAt: state.nextBreakAt,
    breakEndAt: state.breakEndAt,
    now: Date.now(),
  };
}

function sendState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('state:update', publicState());
}

function resetNextBreak() {
  state.nextBreakAt = Date.now() + state.intervalMinutes * 60 * 1000;
}

function startTimer() {
  if (!state.enabled) return;
  state.isRunning = true;
  state.isOnBreak = false;
  state.breakEndAt = null;
  resetNextBreak();
  sendState();
}

function pauseTimer() {
  state.isRunning = false;
  sendState();
}

function skipToNextCycle() {
  state.isOnBreak = false;
  state.breakEndAt = null;
  resetNextBreak();
  closeBreakWindow();
  sendState();
}

function closeBreakWindow() {
  if (breakInterval) {
    clearInterval(breakInterval);
    breakInterval = null;
  }
  if (breakWindow && !breakWindow.isDestroyed()) {
    breakWindow.close();
  }
  breakWindow = null;
}

function finishBreak() {
  state.isOnBreak = false;
  state.breakEndAt = null;
  resetNextBreak();
  closeBreakWindow();
  sendState();
}

function showBreakWindow() {
  state.isOnBreak = true;
  state.breakEndAt = Date.now() + state.breakMinutes * 60 * 1000;

  closeBreakWindow();

  breakWindow = new BrowserWindow({
    width: 900,
    height: 600,
    alwaysOnTop: true,
    fullscreenable: true,
    autoHideMenuBar: true,
    title: 'Cat Break (Test)',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  breakWindow.loadFile(path.join(__dirname, 'renderer', 'break.html'));
  breakWindow.on('closed', () => {
    breakWindow = null;
    if (state.isOnBreak) {
      finishBreak();
    }
  });

  if (Notification.isSupported()) {
    new Notification({
      title: 'Cat Gatekeeper Desktop Test',
      body: 'Time to rest your eyes and body.',
    }).show();
  }

  breakInterval = setInterval(() => {
    if (!state.isOnBreak || !state.breakEndAt) return;
    if (Date.now() >= state.breakEndAt) {
      finishBreak();
    } else {
      sendState();
    }
  }, 1000);

  sendState();
}

function startTick() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    if (!state.enabled || !state.isRunning || state.isOnBreak) {
      return;
    }
    if (!state.nextBreakAt) {
      resetNextBreak();
      sendState();
      return;
    }
    if (Date.now() >= state.nextBreakAt) {
      showBreakWindow();
    } else {
      sendState();
    }
  }, 1000);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 560,
    autoHideMenuBar: true,
    title: 'Cat Gatekeeper Desktop Test',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  loadSettings();
  createMainWindow();
  startTick();
  startTimer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('state:get', () => publicState());

ipcMain.handle('settings:save', (_event, nextSettings) => {
  state.enabled = nextSettings.enabled !== false;
  state.intervalMinutes = clampNumber(nextSettings.intervalMinutes, 1, 240, DEFAULT_SETTINGS.intervalMinutes);
  state.breakMinutes = clampNumber(nextSettings.breakMinutes, 1, 60, DEFAULT_SETTINGS.breakMinutes);
  saveSettings();

  if (!state.enabled) {
    state.isRunning = false;
    closeBreakWindow();
  } else if (!state.isOnBreak) {
    resetNextBreak();
  }

  sendState();
  return publicState();
});

ipcMain.handle('timer:start', () => {
  startTimer();
  return publicState();
});

ipcMain.handle('timer:pause', () => {
  pauseTimer();
  return publicState();
});

ipcMain.handle('timer:skip', () => {
  skipToNextCycle();
  return publicState();
});

ipcMain.handle('break:endNow', () => {
  finishBreak();
  return publicState();
});
