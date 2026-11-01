(() => {
  'use strict';

  const HIDDEN_ATTR = 'data-nst-hidden';
  const HIDDEN_SELECTOR = `[${HIDDEN_ATTR}]`;

  // Если за один кадр накопилось больше изменений, дешевле один раз
  // просканировать документ целиком, чем обходить каждое поддерево.
  const FULL_SCAN_THRESHOLD = 150;

  // Признаки Shorts: ссылка на /shorts/, пункт меню, вкладка мобильной панели.
  const TARGETS = [
    'a[href^="/shorts/"]',
    'ytd-rich-shelf-renderer[is-shorts]',
    'ytd-guide-entry-renderer a[title="Shorts"]',
    '.pivot-shorts',
  ].join(',');

  // Полки — прячем целиком, вместе с заголовком.
  const SHELVES = [
    'ytd-reel-shelf-renderer',
    'ytd-rich-shelf-renderer[is-shorts]',
    'ytm-reel-shelf-renderer',
    'grid-shelf-view-model',
  ].join(',');

  // Отдельные карточки и пункты меню.
  const ITEMS = [
    // десктоп: главная, поиск, подписки, рекомендации справа от видео
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-reel-item-renderer',
    'yt-lockup-view-model',
    'ytd-guide-entry-renderer',
    // мобильная версия (m.youtube.com)
    'ytm-rich-item-renderer',
    'ytm-video-with-context-renderer',
    'ytm-compact-video-renderer',
    'ytm-shorts-lockup-view-model',
    'ytm-shorts-lockup-view-model-v2',
    'ytm-pivot-bar-item-renderer',
  ].join(',');

  const addedRoots = new Set();
  const changedNodes = new Set();
  let fullScan = true; // первый проход — по всему документу
  let scheduled = false;
  let lastPath = '';

  function containerFor(el) {
    const shelf = el.closest(SHELVES);
    if (shelf) {
      // На главной полка лежит в обёртке-секции с отступами — прячем её.
      return shelf.closest('ytd-rich-section-renderer') || shelf;
    }
    return el.closest(ITEMS);
  }

  function hideFor(el) {
    const container = containerFor(el);
    if (container && !container.hasAttribute(HIDDEN_ATTR)) {
      container.setAttribute(HIDDEN_ATTR, '');
    }
  }

  function scan(root) {
    if (root.matches(TARGETS)) hideFor(root);
    for (const el of root.querySelectorAll(TARGETS)) hideFor(el);
  }

  // YouTube переиспользует DOM-элементы: карточка, где был Shorts,
  // может получить обычное видео. Тогда её нужно показать обратно.
  function recheck(container) {
    if (!container.matches(TARGETS) && !container.querySelector(TARGETS)) {
      container.removeAttribute(HIDDEN_ATTR);
    }
  }

  // /shorts/ID -> /watch?v=ID, если Shorts всё-таки открыли.
  function checkUrl() {
    const path = location.pathname;
    if (path === lastPath) return;
    lastPath = path;

    const match = path.match(/^\/shorts\/([\w-]+)/);
    if (match) {
      location.replace(`/watch?v=${match[1]}`);
    }
  }

  function flush() {
    scheduled = false;
    checkUrl();

    if (fullScan) {
      fullScan = false;
      addedRoots.clear();
      changedNodes.clear();
      for (const el of document.querySelectorAll(HIDDEN_SELECTOR)) recheck(el);
      scan(document.documentElement);
      return;
    }

    for (const node of changedNodes) {
      if (!node.isConnected) continue;
      const hidden = node.closest(HIDDEN_SELECTOR);
      if (hidden) recheck(hidden);
    }
    for (const node of addedRoots) {
      if (node.isConnected) scan(node);
    }
    for (const node of changedNodes) {
      if (node.isConnected) scan(node);
    }
    addedRoots.clear();
    changedNodes.clear();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    // Срабатывает перед следующей отрисовкой: изменения за кадр
    // обрабатываются пачкой, а Shorts не успевают мелькнуть.
    requestAnimationFrame(flush);
  }

  const observer = new MutationObserver((records) => {
    if (!fullScan) {
      for (const record of records) {
        if (record.type === 'attributes') {
          changedNodes.add(record.target);
        } else {
          for (const node of record.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) addedRoots.add(node);
          }
        }
      }
      if (addedRoots.size + changedNodes.size > FULL_SCAN_THRESHOLD) {
        fullScan = true;
        addedRoots.clear();
        changedNodes.clear();
      }
    }
    schedule();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    // Следим только за нужными атрибутами — свой data-nst-hidden
    // сюда не входит, поэтому скрипт не реагирует сам на себя.
    attributeFilter: ['href', 'is-shorts'],
  });

  window.addEventListener('popstate', checkUrl);
  document.addEventListener('yt-navigate-finish', checkUrl);

  checkUrl();
  schedule();
})();
