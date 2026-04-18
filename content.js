/**
 * X/Twitter Comment Scraper — Content Script
 *
 * Uses a MutationObserver to passively capture every article[data-testid="tweet"]
 * that X injects into the DOM as the user scrolls.  X virtualises its feed
 * (removes nodes from the top, adds to the bottom), so the same tweet can
 * re-enter the DOM when the user scrolls back up — the seen-map deduplicates
 * purely by tweetId, so each comment is stored exactly once.
 *
 * States:  idle → watching → paused  (paused keeps data; reset returns to idle)
 */

if (!window.__xScraperInitialized) {
  window.__xScraperInitialized = true;

  /* ─── In-memory "database" ───────────────────────────────── */
  const db = {
    seen: new Map(),   // tweetId/fallbackKey → tweet object
    list: [],          // insertion-ordered array (what gets exported)
  };

  /* ─── State ──────────────────────────────────────────────── */
  const state = {
    status: 'idle',   // 'idle' | 'watching' | 'paused'
    get count() { return db.seen.size; },
  };

  let observer = null;

  /* ─── Helpers ────────────────────────────────────────────── */
  function parseCount(ariaLabel, pattern) {
    const m = ariaLabel.match(new RegExp('([\\d,]+)\\s+' + pattern, 'i'));
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
  }

  /** ID of the root tweet (the post we're reading replies to). */
  function getRootTweetId() {
    return window.location.pathname.match(/\/status\/(\d+)/)?.[1] ?? null;
  }

  /* ─── Parse one <article> into a plain object ────────────── */
  function parseTweet(article) {
    // ── Username / display name ───────────────────────────────
    const userNameDiv = article.querySelector('[data-testid="User-Name"]');
    let displayName = '';
    let username = '';

    if (userNameDiv) {
      // Prefer the span that starts with '@' — most reliable
      for (const span of userNameDiv.querySelectorAll('span')) {
        const t = span.textContent.trim();
        if (t.startsWith('@') && /^@\w+$/.test(t)) {
          username = t.slice(1);
          break;
        }
      }
      // Display name: first link → first nested span>span
      const firstLink = userNameDiv.querySelector('a[role="link"]');
      if (firstLink) {
        const nameSpan = firstLink.querySelector('span > span');
        displayName = nameSpan?.textContent?.trim() || '';
        if (!username) {
          // Fallback: pull from href
          username = (firstLink.getAttribute('href') || '')
            .replace(/^\//, '').split('/')[0];
        }
      }
    }

    // ── Tweet text ────────────────────────────────────────────
    const textEl = article.querySelector('[data-testid="tweetText"]');
    const tweetText = textEl?.innerText?.trim() ?? '';

    // ── Timestamp & permalink ─────────────────────────────────
    const timeEl   = article.querySelector('time');
    const timestamp     = timeEl?.getAttribute('datetime') ?? '';
    const timeFormatted = timeEl?.textContent?.trim() ?? '';
    const tweetLink = timeEl?.closest('a');
    const hrefPath  = tweetLink?.getAttribute('href') ?? '';
    const tweetId   = hrefPath.match(/\/status\/(\d+)/)?.[1] ?? '';
    const tweetUrl  = hrefPath ? `https://x.com${hrefPath}` : '';

    // ── Engagement stats ──────────────────────────────────────
    const statsEl   = article.querySelector('[role="group"][aria-label]');
    const ariaLabel = statsEl?.getAttribute('aria-label') ?? '';

    // ── Blue verified ─────────────────────────────────────────
    const isVerified =
      !!article.querySelector('svg[aria-label="Verified account"]') ||
      !!article.querySelector('[data-testid="icon-verified"]');

    return {
      tweetId,
      tweetUrl,
      displayName,
      username,
      isVerified,
      tweetText,
      timestamp,
      timeFormatted,
      replies:   parseCount(ariaLabel, 'repl(?:y|ies)'),
      retweets:  parseCount(ariaLabel, 'repost'),
      likes:     parseCount(ariaLabel, 'like'),
      bookmarks: parseCount(ariaLabel, 'bookmark'),
      views:     parseCount(ariaLabel, 'view'),
    };
  }

  /* ─── Attempt to store one article ──────────────────────────
     Returns true if it was new, false if skipped / duplicate.    */
  function ingest(article) {
    // Must have some text — skip half-painted nodes
    const textEl = article.querySelector('[data-testid="tweetText"]');
    if (!textEl || !textEl.textContent.trim()) return false;

    // Build the dedup key before full parse (cheaper)
    const timeEl    = article.querySelector('time');
    const hrefPath  = timeEl?.closest('a')?.getAttribute('href') ?? '';
    const tweetId   = hrefPath.match(/\/status\/(\d+)/)?.[1] ?? '';

    // Skip the root / original post
    if (tweetId && tweetId === getRootTweetId()) return false;

    // Fallback key when we can't get a tweetId
    const fallback = `${
      article.querySelector('[data-testid="User-Name"] a')?.getAttribute('href') ?? '?'
    }::${textEl.textContent.slice(0, 100)}`;
    const key = tweetId || fallback;

    if (db.seen.has(key)) return false; // already stored — dedup

    const tweet = parseTweet(article);
    db.seen.set(key, tweet);
    db.list.push(tweet);
    return true;
  }

  /* ─── Scan all currently visible articles ────────────────── */
  function scanDOM() {
    document.querySelectorAll('article[data-testid="tweet"]')
      .forEach(a => ingest(a));
  }

  /* ─── MutationObserver callback ──────────────────────────── */
  function onMutation(mutations) {
    const candidates = new Set();

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        // The added node might itself be an article …
        if (node.matches?.('article[data-testid="tweet"]')) {
          candidates.add(node);
        } else {
          // … or wrap one or more articles inside
          node.querySelectorAll?.('article[data-testid="tweet"]')
            .forEach(a => candidates.add(a));
        }
      }
    }

    if (candidates.size === 0) return;

    // Small delay: give React/X a tick to finish painting the node
    setTimeout(() => candidates.forEach(a => ingest(a)), 80);
  }

  /* ─── Start / stop the observer ─────────────────────────────*/
  function startWatching() {
    if (observer) return; // already running

    state.status = 'watching';

    // Capture anything already rendered on the page
    scanDOM();

    observer = new MutationObserver(onMutation);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function pauseWatching() {
    if (observer) { observer.disconnect(); observer = null; }
    state.status = 'paused';
  }

  function resetDB() {
    pauseWatching();
    db.seen.clear();
    db.list.length = 0;
    state.status = 'idle';
  }

  /* ─── Message handler ────────────────────────────────────── */
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.action) {

      case 'start':
        startWatching();
        sendResponse({ ok: true, status: state.status, count: state.count });
        break;

      case 'stop':
        pauseWatching();
        sendResponse({ ok: true, status: state.status, count: state.count });
        break;

      case 'reset':
        resetDB();
        sendResponse({ ok: true, status: state.status, count: 0 });
        break;

      case 'status':
        sendResponse({
          status: state.status,
          count:  state.count,
          data:   message.includeData ? db.list : undefined,
        });
        break;

      default:
        sendResponse({ error: 'unknown action' });
    }
    return true; // keep channel open
  });
}
