document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const currentSiteId = urlParams.get('id') || localStorage.getItem('fastcraft-last-site-id') || `site-${(crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36))}`;
  const siteIdDisplay = document.getElementById('siteIdDisplay');
  const saveStatus = document.getElementById('saveStatus');
  const siteCanvas = document.getElementById('siteCanvas');
  const contextMenu = document.getElementById('contextMenu');
  const publishStatus = document.getElementById('publishStatus');
  const publishButton = document.getElementById('btn-publish-site');
  const metaTitle = document.getElementById('metaTitle');
  const subdomainInput = document.getElementById('subdomainInput');

  const API_BASE = (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
    ? 'http://127.0.0.1:8787'
    : 'https://api.fastcraft.uk';

  const SITE_API_URL = `${API_BASE}/api/sites`;
  let activeElement = null;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let saveTimer = null;
  let clipboard = null;

  if (siteIdDisplay) siteIdDisplay.textContent = currentSiteId;
  localStorage.setItem('fastcraft-last-site-id', currentSiteId);

  function setSaveStatus(label) {
    if (saveStatus) saveStatus.textContent = label;
  }

  function requestSave() {
    clearTimeout(saveTimer);
    setSaveStatus('💾 Enregistrement...');
    saveTimer = setTimeout(() => saveCurrentSite(), 600);
  }

  function normalizeContent(raw) {
    if (!raw) return '';
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') return parsed;
      } catch (err) {
        return raw;
      }
      return raw;
    }
    return String(raw);
  }

  function serializeCanvas() {
    if (!siteCanvas) return '';
    return Array.from(siteCanvas.querySelectorAll('.canvas-element')).map(node => node.outerHTML).join('');
  }

  function saveLocalDraft(data) {
    localStorage.setItem(`fastcraft-site-${currentSiteId}`, JSON.stringify(data));
  }

  function readLocalDraft() {
    try {
      return JSON.parse(localStorage.getItem(`fastcraft-site-${currentSiteId}`) || 'null');
    } catch (err) {
      return null;
    }
  }

  function restoreCanvas(content) {
    if (!siteCanvas) return;
    const safe = normalizeContent(content);
    siteCanvas.querySelectorAll('.canvas-element').forEach(node => node.remove());
    if (!safe) {
      createElementOnCanvas('text', 'heading', 80, 80, '<h2>Bienvenue</h2>');
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = safe;
    Array.from(wrapper.children).forEach(node => {
      if (node.classList && node.classList.contains('canvas-element')) {
        siteCanvas.appendChild(node);
        attachElementEvents(node);
      }
    });

    if (!siteCanvas.querySelector('.canvas-element')) {
      createElementOnCanvas('text', 'heading', 80, 80, '<h2>Bienvenue</h2>');
    }
  }

  async function ensureSiteExists() {
    try {
      const response = await fetch(`${SITE_API_URL}/${currentSiteId}`);
      if (response.ok) return true;
    } catch (err) {
      console.warn('Site absent de l’API.', err);
    }

    try {
      const payload = {
        id: currentSiteId,
        name: (metaTitle && metaTitle.value.trim()) || 'Mon site',
        content: serializeCanvas(),
        subdomain: subdomainInput ? subdomainInput.value.trim() : ''
      };
      const response = await fetch(SITE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        return true;
      }
    } catch (err) {
      console.warn('Création API impossible, fallback local.', err);
    }

    saveLocalDraft({
      id: currentSiteId,
      name: (metaTitle && metaTitle.value.trim()) || 'Mon site',
      content: serializeCanvas(),
      subdomain: subdomainInput ? subdomainInput.value.trim() : ''
    });
    return false;
  }

  async function saveCurrentSite() {
    try {
      await ensureSiteExists();
      const payload = {
        id: currentSiteId,
        name: (metaTitle && metaTitle.value.trim()) || 'Mon site',
        content: serializeCanvas(),
        subdomain: subdomainInput ? subdomainInput.value.trim() : ''
      };

      const response = await fetch(`${SITE_API_URL}/${currentSiteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Erreur sauvegarde ${response.status}`);
      }

      const data = await response.json();
      saveLocalDraft(data || payload);
      setSaveStatus('☁️ Enregistré');
      return true;
    } catch (err) {
      console.warn('Sauvegarde locale seulement.', err);
      saveLocalDraft({
        id: currentSiteId,
        name: (metaTitle && metaTitle.value.trim()) || 'Mon site',
        content: serializeCanvas(),
        subdomain: subdomainInput ? subdomainInput.value.trim() : ''
      });
      setSaveStatus('💾 Enregistré localement');
      return false;
    }
  }

  function buildPublishedHtml() {
    const navbar = document.getElementById('siteNavbar') ? document.getElementById('siteNavbar').outerHTML : '<header><div>MonSite</div></header>';
    const footer = document.getElementById('siteFooter') ? document.getElementById('siteFooter').outerHTML : '<footer><p>© 2026 Tous droits réservés</p></footer>';
    const previewCanvas = siteCanvas.cloneNode(true);
    previewCanvas.querySelectorAll('.alignment-guides').forEach(node => node.remove());
    const title = (metaTitle && metaTitle.value.trim()) || 'Mon site';

    return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body { margin: 0; font-family: Arial, sans-serif; background: #f5f5f5; }
      .site-canvas { position: relative; min-height: 520px; background: #fff; }
      .canvas-element { position: absolute; }
      .canvas-element h2, .canvas-element h3, .canvas-element p { margin: 0; }
      .element-button { display: flex; align-items: center; justify-content: center; }
    </style>
  </head>
  <body>
    <div style="max-width: 1200px; margin: 0 auto; padding: 24px;">
      ${navbar}
      <main class="site-canvas">${previewCanvas.innerHTML}</main>
      ${footer}
    </div>
  </body>
</html>`;
  }

  async function publishCurrentSite() {
    if (!publishStatus) return;
    try {
      await ensureSiteExists();
      const subdomain = (subdomainInput && subdomainInput.value.trim()) || `site-${currentSiteId.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase()}`;
      const html = buildPublishedHtml();
      const response = await fetch(`${SITE_API_URL}/${currentSiteId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subdomain, html })
      });

      if (!response.ok) {
        throw new Error(`Publication impossible ${response.status}`);
      }

      const data = await response.json();
      publishStatus.textContent = `✅ Site publié : ${data.subdomain || subdomain}.fastcraft.uk`;
      setSaveStatus('🚀 Publié');
      return true;
    } catch (err) {
      console.error(err);
      publishStatus.textContent = '⚠️ Publication impossible, sauvegarde locale conservée.';
      return false;
    }
  }

  function attachElementEvents(node) {
    node.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      selectElement(node);
      isDragging = true;
      const rect = node.getBoundingClientRect();
      dragOffset.x = event.clientX - rect.left;
      dragOffset.y = event.clientY - rect.top;
      node.classList.add('dragging');
    });

    node.addEventListener('input', () => requestSave());
  }

  function selectElement(node) {
    document.querySelectorAll('.canvas-element').forEach(el => el.classList.remove('selected'));
    activeElement = node;
    if (!node) return;
    node.classList.add('selected');
    updateEditPanel();
  }

  function updateEditPanel() {
    const emptyMsg = document.querySelector('.empty-selection-msg');
    const textSec = document.getElementById('edit-text-section');
    const shapeSec = document.getElementById('edit-shape-section');
    const mediaSec = document.getElementById('edit-media-section');

    if (textSec) textSec.classList.add('hidden');
    if (shapeSec) shapeSec.classList.add('hidden');
    if (mediaSec) mediaSec.classList.add('hidden');

    if (!activeElement) {
      if (emptyMsg) emptyMsg.style.display = 'block';
      return;
    }

    if (emptyMsg) emptyMsg.style.display = 'none';

    if (activeElement.classList.contains('element-text') && textSec) {
      textSec.classList.remove('hidden');
    } else if ((activeElement.classList.contains('element-shape') || activeElement.classList.contains('element-button')) && shapeSec) {
      shapeSec.classList.remove('hidden');
    }
  }

  function createElementOnCanvas(type, preset, x, y, customHtml = null) {
    const el = document.createElement('div');
    el.classList.add('canvas-element');
    el.style.position = 'absolute';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.zIndex = '10';

    if (type === 'text') {
      el.classList.add('element-text');
      if (preset === 'heading') {
        el.innerHTML = customHtml || '<h2>Nouveau titre</h2>';
      } else if (preset === 'subheading') {
        el.innerHTML = customHtml || '<h3>Sous-titre</h3>';
      } else {
        el.innerHTML = customHtml || '<p>Texte de paragraphe à modifier...</p>';
      }
    } else if (type === 'square') {
      el.classList.add('element-shape');
      el.style.width = '120px';
      el.style.height = '120px';
      el.style.backgroundColor = '#6366f1';
      el.style.borderRadius = '0px';
    } else if (type === 'button') {
      el.classList.add('element-button');
      el.style.width = '140px';
      el.style.height = '45px';
      el.style.backgroundColor = '#10b981';
      el.style.color = '#fff';
      el.style.borderRadius = '6px';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.innerHTML = '<span>Cliquez ici</span>';
    }

    siteCanvas.appendChild(el);
    attachElementEvents(el);
    selectElement(el);
    requestSave();
    return el;
  }

  function bindSidebarTabs() {
    const navTabs = document.querySelectorAll('.nav-tab');
    const drawerPanels = document.querySelectorAll('.drawer-panel');
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        navTabs.forEach(el => el.classList.remove('active'));
        drawerPanels.forEach(panel => panel.classList.remove('active'));
        tab.classList.add('active');
        const panel = document.getElementById(tab.dataset.panel);
        if (panel) panel.classList.add('active');
      });
    });

    const rightTabButtons = document.querySelectorAll('.sidebar-right .tab-btn');
    const tabContents = document.querySelectorAll('.sidebar-right .tab-content');
    rightTabButtons.forEach(button => {
      button.addEventListener('click', () => {
        rightTabButtons.forEach(el => el.classList.remove('active'));
        tabContents.forEach(el => el.classList.remove('active'));
        button.classList.add('active');
        const target = document.getElementById(`tab-${button.dataset.tab}`);
        if (target) target.classList.add('active');
      });
    });
  }

  function bindCanvasInteractions() {
    const draggablePresets = document.querySelectorAll('.draggable-preset, .draggable-shape');
    draggablePresets.forEach(preset => {
      preset.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', JSON.stringify({
          type: preset.dataset.type,
          preset: preset.dataset.preset || null
        }));
      });
    });

    siteCanvas.addEventListener('dragover', (event) => {
      event.preventDefault();
      siteCanvas.classList.add('drag-over');
    });

    siteCanvas.addEventListener('dragleave', () => {
      siteCanvas.classList.remove('drag-over');
    });

    siteCanvas.addEventListener('drop', (event) => {
      event.preventDefault();
      siteCanvas.classList.remove('drag-over');
      const raw = event.dataTransfer.getData('text/plain');
      if (!raw) return;
      try {
        const payload = JSON.parse(raw);
        const rect = siteCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        createElementOnCanvas(payload.type, payload.preset, x, y);
      } catch (err) {
        console.error('Erreur drag & drop', err);
      }
    });

    siteCanvas.addEventListener('click', (event) => {
      if (event.target === siteCanvas) selectElement(null);
    });

    siteCanvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      const node = event.target.closest('.canvas-element');
      if (node) selectElement(node);
      if (contextMenu) {
        contextMenu.style.top = `${event.clientY}px`;
        contextMenu.style.left = `${event.clientX}px`;
        contextMenu.style.display = 'block';
      }
    });

    document.addEventListener('click', () => {
      if (contextMenu) contextMenu.style.display = 'none';
    });

    document.addEventListener('mousemove', (event) => {
      if (!isDragging || !activeElement || !siteCanvas) return;
      const rect = siteCanvas.getBoundingClientRect();
      let left = event.clientX - rect.left - dragOffset.x;
      let top = event.clientY - rect.top - dragOffset.y;
      left = Math.max(0, Math.min(left, rect.width - activeElement.offsetWidth));
      top = Math.max(0, Math.min(top, rect.height - activeElement.offsetHeight));
      activeElement.style.left = `${left}px`;
      activeElement.style.top = `${top}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging && activeElement) {
        activeElement.classList.remove('dragging');
        isDragging = false;
        requestSave();
      }
    });

    const textButtons = {
      bold: document.getElementById('btn-text-bold'),
      italic: document.getElementById('btn-text-italic'),
      underline: document.getElementById('btn-text-underline'),
      strike: document.getElementById('btn-text-strike')
    };

    Object.entries(textButtons).forEach(([action, button]) => {
      if (button) {
        button.addEventListener('click', () => {
          if (!activeElement || !activeElement.classList.contains('element-text')) return;
          if (action === 'bold') {
            activeElement.style.fontWeight = activeElement.style.fontWeight === '700' ? 'normal' : '700';
          }
          if (action === 'italic') {
            activeElement.style.fontStyle = activeElement.style.fontStyle === 'italic' ? 'normal' : 'italic';
          }
          if (action === 'underline') {
            activeElement.style.textDecoration = activeElement.style.textDecoration === 'underline' ? 'none' : 'underline';
          }
          if (action === 'strike') {
            const current = activeElement.style.textDecoration || '';
            activeElement.style.textDecoration = current.includes('line-through') ? current.replace('line-through', '').trim() : `${current} line-through`.trim();
          }
          requestSave();
        });
      }
    });
  }

  window.execContextMenu = function (action) {
    if (!activeElement && action !== 'paste') return;
    if (contextMenu) contextMenu.style.display = 'none';

    switch (action) {
      case 'copy':
        clipboard = activeElement.cloneNode(true);
        break;
      case 'cut':
        clipboard = activeElement.cloneNode(true);
        activeElement.remove();
        selectElement(null);
        break;
      case 'paste':
        if (clipboard) {
          const clone = clipboard.cloneNode(true);
          clone.style.left = `${parseInt(clipboard.style.left || 0) + 20}px`;
          clone.style.top = `${parseInt(clipboard.style.top || 0) + 20}px`;
          siteCanvas.appendChild(clone);
          attachElementEvents(clone);
          selectElement(clone);
        }
        break;
      case 'bring-forward':
        activeElement.style.zIndex = `${Number(activeElement.style.zIndex || 10) + 1}`;
        break;
      case 'send-backward':
        activeElement.style.zIndex = `${Math.max(1, Number(activeElement.style.zIndex || 10) - 1)}`;
        break;
      case 'delete':
        activeElement.remove();
        selectElement(null);
        break;
    }
    requestSave();
  };

  function initEditor() {
    bindSidebarTabs();
    bindCanvasInteractions();

    const openButton = document.getElementById('btn-publish-open');
    if (openButton) {
      openButton.addEventListener('click', () => {
        const publishTab = document.querySelector('.tab-btn[data-tab="publish"]');
        if (publishTab) publishTab.click();
      });
    }

    if (publishButton) {
      publishButton.addEventListener('click', publishCurrentSite);
    }

    if (metaTitle) {
      metaTitle.addEventListener('input', () => {
        document.title = metaTitle.value.trim() || 'Mon site';
        requestSave();
      });
    }

    if (subdomainInput) {
      subdomainInput.addEventListener('input', () => requestSave());
    }

    const draft = readLocalDraft();
    if (draft && draft.content) {
      restoreCanvas(draft.content);
      if (metaTitle && draft.name) metaTitle.value = draft.name;
      if (subdomainInput && draft.subdomain) subdomainInput.value = draft.subdomain;
    }

    fetch(`${SITE_API_URL}/${currentSiteId}`)
      .then(response => {
        if (!response.ok) {
          if (!siteCanvas || !siteCanvas.querySelector('.canvas-element')) {
            createElementOnCanvas('text', 'heading', 80, 80, '<h2>Bienvenue</h2>');
          }
          return;
        }
        return response.json();
      })
      .then(data => {
        if (!data) return;
        if (data.content) restoreCanvas(data.content);
        if (metaTitle && data.name) metaTitle.value = data.name;
        if (subdomainInput && data.subdomain) subdomainInput.value = data.subdomain;
        saveLocalDraft(data);
      })
      .catch(() => {
        if (!siteCanvas || !siteCanvas.querySelector('.canvas-element')) {
          createElementOnCanvas('text', 'heading', 80, 80, '<h2>Bienvenue</h2>');
        }
      });

    window.addNewPage = function () {
      const container = document.getElementById('pagesTreeContainer');
      if (!container) return;
      const item = document.createElement('div');
      item.className = 'page-item';
      item.textContent = `Page ${container.children.length + 1}`;
      container.appendChild(item);
    };
  }

  initEditor();
});
