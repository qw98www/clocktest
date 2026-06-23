const timerNode = document.getElementById('timer');
const endNowBtn = document.getElementById('endNowBtn');

function formatMsAsClock(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function render(state) {
  if (!state.isOnBreak || !state.breakEndAt) {
    timerNode.textContent = '00:00';
    return;
  }
  timerNode.textContent = formatMsAsClock(state.breakEndAt - state.now);
}

endNowBtn.addEventListener('click', async () => {
  await window.desktopApi.endBreakNow();
});

window.desktopApi.onStateUpdate((state) => {
  render(state);
});

window.desktopApi.getState().then(render);
