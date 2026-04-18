/**
 * X/Twitter Comment Scraper — Popup Script
 *
 * Polls the content script every 600 ms to refresh the live counter.
 * Export is available at any time once count > 0.
 */

/* ── DOM refs ──────────────────────────────────────────────── */
const card         = document.getElementById('card');
const dot          = document.getElementById('dot');
const statusLabel  = document.getElementById('status-label');
const newBadge     = document.getElementById('new-badge');
const countDisplay = document.getElementById('count-display');
const btnStart     = document.getElementById('btn-start');
const btnStop      = document.getElementById('btn-stop');
const btnReset     = document.getElementById('btn-reset');
const btnJson      = document.getElementById('btn-json');
const btnCsv       = document.getElementById('btn-csv');
const notOnTweet   = document.getElementById('not-on-tweet');

/* ── Local state ───────────────────────────────────────────── */
let pollTimer    = null;
let lastCount    = 0;
let newBadgeTimer = null;

/* ── UI renderer ───────────────────────────────────────────── */
function setUI(status, count) {
  // ── Counter ───────────────────────────────────────────────
  const changed = count !== lastCount;
  countDisplay.textContent = count;

  if (changed && count > 0) {
    // Animate the number
    countDisplay.classList.remove('bump');
    void countDisplay.offsetWidth; // reflow to restart animation
    countDisplay.classList.add('bump');

    // Flash the "+new" badge
    newBadge.textContent = `+${count - lastCount}`;
    newBadge.classList.add('visible');
    clearTimeout(newBadgeTimer);
    newBadgeTimer = setTimeout(() => newBadge.classList.remove('visible'), 1800);
  }
  lastCount = count;

  // ── Status dot & label ────────────────────────────────────
  dot.className         = `dot ${status}`;
  statusLabel.className = `status-label ${status}`;
  card.className        = status === 'watching' ? 'card watching' : 'card';

  const labels = { idle: 'Idle', watching: 'Watching…', paused: 'Paused' };
  statusLabel.textContent = labels[status] ?? status;

  // ── Button states ─────────────────────────────────────────
  const isWatching = status === 'watching';
  const hasData    = count > 0;

  btnStart.disabled = isWatching;
  btnStart.textContent = (status === 'paused' && hasData)
    ? '▶ Resume'
    : '👁 Start Watching';

  btnStop.disabled  = !isWatching;
  btnReset.disabled = status === 'idle' || isWatching; // can't reset while watching
  btnJson.disabled  = !hasData;
  btnCsv.disabled   = !hasData;
}

/* ── Tab / messaging helpers ───────────────────────────────── */
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function msg(action, extra = {}) {
  const tab = await getActiveTab();
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tab.id, { action, ...extra }, res => {
      resolve(chrome.runtime.lastError ? null : res);
    });
  });
}

async function ensureContentScript() {
  if (await msg('status')) return true; // already alive
  try {
    const tab = await getActiveTab();
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    return true;
  } catch (e) {
    console.error('Injection failed:', e);
    return false;
  }
}

/* ── Page guard ────────────────────────────────────────────── */
async function checkPage() {
  const tab = await getActiveTab();
  const isTweetPage = /^https:\/\/(x|twitter)\.com\/.+\/status\/\d+/.test(tab?.url ?? '');
  notOnTweet.style.display = isTweetPage ? 'none' : 'block';
  if (!isTweetPage) btnStart.disabled = true;
  return isTweetPage;
}

/* ── Polling ───────────────────────────────────────────────── */
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    const res = await msg('status');
    if (res) setUI(res.status, res.count);
  }, 600);
}

function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}

/* ── Button handlers ───────────────────────────────────────── */
btnStart.addEventListener('click', async () => {
  if (!(await checkPage())) return;
  if (!(await ensureContentScript())) {
    alert('Could not inject scraper — try refreshing the page.');
    return;
  }
  const res = await msg('start');
  if (res) setUI(res.status, res.count);
  startPolling();
});

btnStop.addEventListener('click', async () => {
  const res = await msg('stop');
  if (res) setUI(res.status, res.count);
  // Keep polling so the count stays live (user might resume)
});

btnReset.addEventListener('click', async () => {
  if (!confirm('Clear all collected comments?')) return;
  stopPolling();
  const res = await msg('reset');
  lastCount = 0;
  if (res) setUI(res.status, 0);
});

/* ── Export ─────────────────────────────────────────────────── */
async function fetchData() {
  const res = await msg('status', { includeData: true });
  return res?.data ?? [];
}

btnJson.addEventListener('click', async () => {
  const data = await fetchData();
  if (!data.length) return;
  download(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    filename('json')
  );
});

btnCsv.addEventListener('click', async () => {
  const data = await fetchData();
  if (!data.length) return;

  const COLS = [
    'tweetId','tweetUrl','displayName','username','isVerified',
    'tweetText','timestamp','timeFormatted',
    'replies','retweets','likes','bookmarks','views',
  ];
  const esc  = v => '"' + String(v ?? '').replace(/"/g,'""').replace(/\n/g,' ') + '"';
  const rows = data.map(t => COLS.map(c => esc(t[c])).join(','));
  const csv  = [COLS.join(','), ...rows].join('\r\n');

  download(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename('csv'));
});

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function filename(ext) {
  return `x-comments-${new Date().toISOString().slice(0,10)}.${ext}`;
}

/* ── Init ───────────────────────────────────────────────────── */
(async () => {
  const onTweet = await checkPage();
  if (!onTweet) { setUI('idle', 0); return; }

  // Re-attach to an in-progress session (popup was closed and reopened)
  const res = await msg('status');
  if (res) {
    lastCount = res.count;
    setUI(res.status, res.count);
    if (res.status === 'watching') startPolling();
  } else {
    setUI('idle', 0);
  }
})();
