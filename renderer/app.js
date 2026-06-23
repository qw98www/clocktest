const enabledInput = document.getElementById('enabled');
const intervalInput = document.getElementById('intervalMinutes');
const breakInput = document.getElementById('breakMinutes');
const launchAtLoginInput = document.getElementById('launchAtLogin');
const statusText = document.getElementById('statusText');
const nextBreakText = document.getElementById('nextBreakText');

function formatMsAsClock(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function render(state) {
  enabledInput.checked = !!state.enabled;
  intervalInput.value = state.intervalMinutes;
  breakInput.value = state.breakMinutes;
  launchAtLoginInput.checked = !!state.launchAtLogin;

  if (!state.enabled) {
    statusText.textContent = 'Disabled';
    nextBreakText.textContent = '';
    return;
  }

  if (state.isOnBreak && state.breakEndAt) {
    statusText.textContent = 'On Break';
    nextBreakText.textContent = `Break remaining: ${formatMsAsClock(state.breakEndAt - state.now)}`;
    return;
  }

  if (state.isRunning && state.nextBreakAt) {
    statusText.textContent = 'Running';
    nextBreakText.textContent = `Next break in: ${formatMsAsClock(state.nextBreakAt - state.now)}`;
    return;
  }

  statusText.textContent = 'Paused';
  nextBreakText.textContent = '';
}

async function refresh() {
  const state = await window.desktopApi.getState();
  render(state);
}

document.getElementById('saveBtn').addEventListener('click', async () => {
  await window.desktopApi.saveSettings({
    enabled: enabledInput.checked,
    intervalMinutes: Number.parseInt(intervalInput.value, 10),
    breakMinutes: Number.parseInt(breakInput.value, 10),
    launchAtLogin: launchAtLoginInput.checked,
  });
  await refresh();
});

document.getElementById('startBtn').addEventListener('click', async () => {
  await window.desktopApi.startTimer();
  await refresh();
});

document.getElementById('pauseBtn').addEventListener('click', async () => {
  await window.desktopApi.pauseTimer();
  await refresh();
});

document.getElementById('skipBtn').addEventListener('click', async () => {
  await window.desktopApi.skipTimer();
  await refresh();
});

window.desktopApi.onStateUpdate((state) => {
  render(state);
});

refresh().catch((err) => {
  console.error('Failed to refresh initial state:', err);
  statusText.textContent = 'Error loading state';
});
