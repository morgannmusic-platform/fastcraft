/* ==========================================
   FASTCRAFT - ÉDITEUR VISUEL AVANCÉ (JS)
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'https://api.fastcraft.uk/api/sites';
    const urlParams = new URLSearchParams(window.location.search);
    const siteId = urlParams.get('id');

    const siteIdDisplay = document.getElementById('siteIdDisplay');
    if (siteIdDisplay) {
        siteIdDisplay.innerText = siteId || 'Local';
    }

    // --- ÉTAT DU SITE ---
    let siteData = {
        currentPage: 'index',
        pages: {
            'index': { name: 'Accueil', inNavbar: true, inFooter: true, elements: [] }
        },
        navbarVisible: true,
        footerVisible: true,
        subdomain: ''
    };

    let selectedElement = null;
    let clipboardData = null;
    let targetColorMode = 'text'; // 'text' ou 'bg'
    let autoSaveTimeout = null;

    // DOM Elements
    const siteCanvas = document.getElementById('siteCanvas');
    const floatingToolbar = document.getElementById('floatingToolbar');
    const pageFrame = document.getElementById('pageFrame');
    const resizeHandle = document.getElementById('resizeHandle');
    const contextMenu = document.getElementById('contextMenu');

    // Palette de couleurs sauvegardées
    let savedColors = ['#ffffff', '#000000', '#3b82f6', '#9333ea', '#ef4444'];

    // --- SÉCURISATION DES TAMPONS HTML / SCRIPTS ---
    function escapeHtml(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/<\/script/gi, '<\\x3C/script');
    }

    function escapeAttribute(value = '') {
        return escapeHtml(value)
            .replace(/`/g, '\\`')
            .replace(/\$\{/g, '\\${');
    }

    // --- AUTO-SAVE DEBOUNCE ---
    function triggerAutoSave() {
        const saveStatus = document.getElementById('saveStatus');
        if (saveStatus) saveStatus.innerText = '⏳ Enregistrement...';
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(saveToServer, 1000);
    }

    async function saveToServer() {
        if (!siteId) return;
        saveCurrentCanvasToMemory();

        try {
            const res = await fetch(`${API_URL}/${siteId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: siteData })
            });
            if (res.ok) {
                const saveStatus = document.getElementById('saveStatus');
                if (saveStatus) saveStatus.innerText = '☁️ Synchro auto active';
            }
        } catch (err) {
            const saveStatus = document.getElementById('saveStatus');
            if (saveStatus) saveStatus.innerText = '⚠️ Erreur synchro';
        }
    }

    // --- DRAG & DROP ÉLÉMENTS ---
    document.querySelectorAll('.draggable-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('type', item.dataset.type);
        });
    });

    if (siteCanvas) {
        siteCanvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            siteCanvas.classList.add('drag-over');
        });

        siteCanvas.addEventListener('dragleave', () => siteCanvas.classList.remove('drag-over'));

        siteCanvas.addEventListener('drop', (e) => {
            e.preventDefault();
            siteCanvas.classList.remove('drag-over');
            const type = e.dataTransfer.getData('type');
            if (type) {
                const newEl = createCanvasElement(type);
                siteCanvas.appendChild(newEl);
                selectElement(newEl);
                triggerAutoSave();
            }
        });
    }

    // --- CRÉATION DES COMPOSANTS DANS LE CANEVAS ---
    function createCanvasElement(type, data = {}) {
        const el = document.createElement('div');
        el.className = 'canvas-element';
        el.dataset.type = type;
        el.style.position = 'relative';
        el.style.margin = '10px 0';

        if (data.style) el.style.cssText = data.style;

        switch (type) {
            case 'text': {
                const textValue = typeof data.text === 'string' ? data.text : (typeof data.html === 'string' ? data.html : 'Cliquez ici pour éditer le texte...');
                el.innerHTML = `<div contenteditable="true" style="outline:none; padding:8px;">${escapeHtml(textValue)}</div>`;
                break;
            }
            case 'button': {
                const buttonText = typeof data.text === 'string' ? data.text : (typeof data.html === 'string' ? data.html : 'Mon Bouton');
                el.innerHTML = `<button style="padding:0.6rem 1.2rem; background:#3b82f6; color:#fff; border:none; border-radius:4px; cursor:pointer;" contenteditable="true">${escapeHtml(buttonText)}</button>`;
                break;
            }
            case 'image': {
                const src = data.src || 'https://via.placeholder.com/400x200';
                el.innerHTML = `<img src="${src}" style="max-width:100%; display:block; border-radius:inherit;" alt="Image">`;
                el.addEventListener('dblclick', () => {
                    openCustomPrompt("URL de l'image :", el.querySelector('img').src, (newUrl) => {
                        if (newUrl) {
                            el.querySelector('img').src = newUrl;
                            triggerAutoSave();
                        }
                    });
                });
                break;
            }
            case 'shape':
                el.style.width = data.width || '100%';
                el.style.height = data.height || '100px';
                el.style.backgroundColor = data.bgColor || '#e2e8f0';
                break;
        }

        el.addEventListener('click', (e) => {
            e.stopPropagation();
            selectElement(el);
        });

        el.addEventListener('input', () => triggerAutoSave());

        return el;
    }

    // --- SÉLECTION D'ÉLÉMENT ET BARRE FLOTTANTE ---
    function selectElement(el) {
        if (selectedElement) selectedElement.classList.remove('selected');
        selectedElement = el;
        selectedElement.classList.add('selected');

        if (floatingToolbar) {
            floatingToolbar.style.top = `${el.offsetTop - 50}px`;
            floatingToolbar.classList.add('active');

            // Masquer/Afficher les options selon le type de bloc
            const type = el.dataset.type;
            const groupText = document.getElementById('groupTextTools');
            const groupShape = document.getElementById('groupShapeTools');

            if (groupText) groupText.style.display = (type === 'text' || type === 'button') ? 'flex' : 'none';
            if (groupShape) groupShape.style.display = (type === 'shape' || type === 'image') ? 'flex' : 'none';
        }
    }

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.canvas-element') &&
            !e.target.closest('#floatingToolbar') &&
            !e.target.closest('.custom-modal-overlay') &&
            !e.target.closest('.sidebar-left')) {
            if (selectedElement) selectedElement.classList.remove('selected');
            selectedElement = null;
            if (floatingToolbar) floatingToolbar.classList.remove('active');
        }
    });

    // --- APPLICATION DES STYLES ---
    window.applyStyle = function (property, value) {
        if (selectedElement) {
            selectedElement.style[property] = value;
            triggerAutoSave();
        }
    };

    window.applyTextFormat = function (command) {
        document.execCommand(command, false, null);
        triggerAutoSave();
    };

    window.changeZIndex = function (delta) {
        if (!selectedElement) return;
        const current = parseInt(window.getComputedStyle(selectedElement).zIndex) || 0;
        selectedElement.style.zIndex = current + delta;
        triggerAutoSave();
    };

    window.updateShapeSides = function (sides) {
        if (!selectedElement) return;
        if (sides == 3) {
            selectedElement.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
        } else if (sides == 5) {
            selectedElement.style.clipPath = 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)';
        } else {
            selectedElement.style.clipPath = 'none';
        }
        triggerAutoSave();
    };

    // --- NAVIGATION DU SIDEBAR GAUCHE (COULEURS & ÉLÉMENTS) ---
    window.openBgColorSidebar = function () {
        const viewElem = document.getElementById('elementsSidebarView');
        const viewColor = document.getElementById('colorSidebarView');
        const header = document.getElementById('sidebarLeftHeader');

        if (viewElem && viewColor) {
            viewElem.style.display = 'none';
            viewColor.style.display = 'flex';
            if (header) header.innerText = 'Remplissage & Fond';
            renderPaletteGrid();
        }
    };

    window.switchBgType = function (type) {
        document.getElementById('solidColorPanel').style.display = type === 'solid' ? 'block' : 'none';
        document.getElementById('linearGradientPanel').style.display = type === 'linear' ? 'block' : 'none';
        document.getElementById('radialGradientPanel').style.display = type === 'radial' ? 'block' : 'none';
    };

    window.setLinearAngle = function (deg) {
        const c1 = document.getElementById('linearColor1').value;
        const c2 = document.getElementById('linearColor2').value;
        const grad = `linear-gradient(${deg}deg, ${c1}, ${c2})`;

        if (selectedElement) {
            selectedElement.style.background = grad;
        } else if (siteCanvas) {
            siteCanvas.style.background = grad;
        }
        triggerAutoSave();
    };

    window.applyLinearGradient = function () {
        window.setLinearAngle(0);
    };

    window.saveCurrentColorToPalette = function () {
        let colorToSave = '#ffffff';
        if (selectedElement) {
            colorToSave = window.getComputedStyle(selectedElement).backgroundColor;
        }
        if (!savedColors.includes(colorToSave)) {
            savedColors.push(colorToSave);
            renderPaletteGrid();
        }
    };

    function renderPaletteGrid() {
        const grid = document.getElementById('savedPaletteGrid');
        if (!grid) return;
        grid.innerHTML = '';
        savedColors.forEach(c => {
            const div = document.createElement('div');
            div.className = 'palette-color';
            div.style.background = c;
            div.onclick = () => {
                if (selectedElement) {
                    selectedElement.style.backgroundColor = c;
                    triggerAutoSave();
                }
            };
            grid.appendChild(div);
        });
    }

    // --- MENU CONTEXTUEL ---
    document.addEventListener('contextmenu', (e) => {
        const targetEl = e.target.closest('.canvas-element');
        if (targetEl && contextMenu) {
            e.preventDefault();
            selectElement(targetEl);
            contextMenu.style.top = `${e.clientY}px`;
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.style.display = 'block';
        } else if (contextMenu) {
            contextMenu.style.display = 'none';
        }
    });

    document.addEventListener('click', () => {
        if (contextMenu) contextMenu.style.display = 'none';
    });

    window.execContextMenu = function (action) {
        if (!selectedElement) return;

        switch (action) {
            case 'copy':
                clipboardData = selectedElement.cloneNode(true);
                break;
            case 'cut':
                clipboardData = selectedElement.cloneNode(true);
                selectedElement.remove();
                if (floatingToolbar) floatingToolbar.classList.remove('active');
                triggerAutoSave();
                break;
            case 'paste':
                if (clipboardData && siteCanvas) {
                    const clone = clipboardData.cloneNode(true);
                    clone.addEventListener('click', (e) => { e.stopPropagation(); selectElement(clone); });
                    siteCanvas.appendChild(clone);
                    selectElement(clone);
                    triggerAutoSave();
                }
                break;
            case 'align-left': window.applyStyle('textAlign', 'left'); break;
            case 'align-center': window.applyStyle('textAlign', 'center'); break;
            case 'align-right': window.applyStyle('textAlign', 'right'); break;
            case 'delete':
                selectedElement.remove();
                if (floatingToolbar) floatingToolbar.classList.remove('active');
                triggerAutoSave();
                break;
        }
    };

    // --- AGRANDISSEMENT DU BAS DE PAGE ---
    let isResizing = false;
    if (resizeHandle && pageFrame) {
        resizeHandle.addEventListener('mousedown', () => {
            isResizing = true;
            document.body.style.cursor = 'ns-resize';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            const rect = pageFrame.getBoundingClientRect();
            const newHeight = e.clientY - rect.top;
            if (newHeight > 400) {
                pageFrame.style.minHeight = `${newHeight}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = 'default';
                triggerAutoSave();
            }
        });
    }

    // --- MODALES ET COULEURS / DÉGRADÉS ---
    window.openColorModal = function (mode) {
        targetColorMode = mode;
        const title = document.getElementById('colorModalTitle');
        if (title) title.innerText = mode === 'text' ? 'Couleur & Dégradé du Texte' : 'Couleur & Dégradé du Fond';
        const modal = document.getElementById('colorModal');
        if (modal) modal.classList.add('active');
    };

    window.toggleGradientOptions = function (val) {
        document.getElementById('solidColorGroup').style.display = val === 'solid' ? 'block' : 'none';
        document.getElementById('gradientGroup').style.display = val !== 'solid' ? 'block' : 'none';
    };

    window.applyColorStyle = function () {
        if (!selectedElement) return;
        const type = document.getElementById('colorTypeSelect').value;

        if (type === 'solid') {
            const color = document.getElementById('solidColorInput').value;
            if (targetColorMode === 'text') {
                selectedElement.style.color = color;
                selectedElement.style.backgroundImage = 'none';
                selectedElement.style.webkitBackgroundClip = 'initial';
            } else {
                selectedElement.style.backgroundColor = color;
                selectedElement.style.backgroundImage = 'none';
            }
        } else {
            const angle = document.getElementById('gradAngle').value;
            const c1 = document.getElementById('gradColor1').value;
            const p1 = document.getElementById('gradPos1').value;
            const c2 = document.getElementById('gradColor2').value;
            const p2 = document.getElementById('gradPos2').value;

            const gradStr = `linear-gradient(${angle}deg, ${c1} ${p1}%, ${c2} ${p2}%)`;

            if (targetColorMode === 'text') {
                selectedElement.style.backgroundImage = gradStr;
                selectedElement.style.webkitBackgroundClip = 'text';
                selectedElement.style.webkitTextFillColor = 'transparent';
            } else {
                selectedElement.style.backgroundImage = gradStr;
            }
        }
        window.closeModal('colorModal');
        triggerAutoSave();
    };

    window.openAdvancedModal = function () {
        const modal = document.getElementById('advancedModal');
        if (modal) modal.classList.add('active');
    };

    window.applyAdvancedStylesLive = function () {
        if (!selectedElement) return;
        const radius = document.getElementById('advBorderRadius').value;
        const opacity = document.getElementById('advOpacity').value;
        const blur = document.getElementById('advBlur').value;

        selectedElement.style.borderRadius = `${radius}px`;
        selectedElement.style.opacity = opacity;
        selectedElement.style.backdropFilter = blur > 0 ? `blur(${blur}px)` : 'none';
        triggerAutoSave();
    };

    window.openCssModal = function () {
        const modal = document.getElementById('cssModal');
        if (modal && selectedElement) {
            document.getElementById('customCssInput').value = selectedElement.style.cssText;
            modal.classList.add('active');
        }
    };

    window.applyCustomCss = function () {
        if (selectedElement) {
            selectedElement.style.cssText = document.getElementById('customCssInput').value;
            triggerAutoSave();
        }
        window.closeModal('cssModal');
    };

    window.openLinkModal = function () {
        const modal = document.getElementById('linkModal');
        if (modal) modal.classList.add('active');
    };

    window.applyLink = function () {
        const url = document.getElementById('linkUrlInput').value;
        if (url) {
            document.execCommand('createLink', false, url);
            triggerAutoSave();
        }
        window.closeModal('linkModal');
    };

    window.closeModal = function (id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('active');
    };

    function openCustomPrompt(title, defaultVal, callback) {
        const modal = document.getElementById('linkModal');
        if (!modal) return;
        modal.querySelector('h3').innerText = title;
        const input = document.getElementById('linkUrlInput');
        input.value = defaultVal || '';
        modal.classList.add('active');

        const btn = modal.querySelector('button[style*="accent"]');
        const oldClick = btn.onclick;
        btn.onclick = () => {
            callback(input.value);
            window.closeModal('linkModal');
            btn.onclick = oldClick;
        };
    }

    // --- GESTION DES ONGLETS DE LA SIDEBAR DROITE ---
    window.switchTab = function (tabId, eventArg = null) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        const activeButton = eventArg?.currentTarget || document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
        if (activeButton) activeButton.classList.add('active');

        const targetTab = document.getElementById(`tab-${tabId}`);
        if (targetTab) targetTab.classList.add('active');
    };

    function renderPagesList() {
        const container = document.getElementById('pagesContainer');
        const navLinks = document.getElementById('navbarLinks');
        if (!container || !navLinks) return;

        container.innerHTML = '';
        navLinks.innerHTML = '';

        Object.keys(siteData.pages).forEach(key => {
            const page = siteData.pages[key];
            const safeName = escapeAttribute(page.name);
            const safeKey = escapeAttribute(key);

            if (page.inNavbar) {
                const a = document.createElement('a');
                a.innerText = page.name;
                a.href = `#${key}`;
                a.style.marginLeft = '1rem';
                navLinks.appendChild(a);
            }

            const item = document.createElement('div');
            item.className = 'page-list-item';
            item.style.marginBottom = '10px';
            item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:5px;">
          <input type="text" class="tb-input" value="${safeName}" onchange="updatePageName('${safeKey}', this.value)">
          <button class="tb-btn" onclick="switchPage('${safeKey}')">${key === siteData.currentPage ? '👁️' : 'Ouvrir'}</button>
          ${key !== 'index' ? `<button class="tb-btn" style="color:#ef4444;" onclick="deletePage('${safeKey}')">✕</button>` : ''}
        </div>
      `;
            container.appendChild(item);
        });
    }

    window.addNewPage = function () {
        openCustomPrompt("Nom de la page :", "Nouvelle Page", (name) => {
            if (!name) return;
            const normalizedName = name.trim();
            const key = normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'nouvelle-page';
            if (!siteData.pages[key]) {
                siteData.pages[key] = { name: normalizedName, inNavbar: true, inFooter: true, elements: [] };
                window.switchPage(key);
                triggerAutoSave();
            }
        });
    };

    window.updatePageName = function (key, newName) {
        siteData.pages[key].name = newName;
        renderPagesList();
        triggerAutoSave();
    };

    window.deletePage = function (key) {
        if (key === 'index') return;
        delete siteData.pages[key];
        window.switchPage('index');
        triggerAutoSave();
    };

    window.switchPage = function (key) {
        saveCurrentCanvasToMemory();
        siteData.currentPage = key;
        renderPagesList();
        loadCanvasFromMemory(key);
    };

    window.toggleSection = function (id, displayVal) {
        const el = document.getElementById(id);
        if (el) el.style.display = displayVal;
        if (id === 'siteNavbar') siteData.navbarVisible = displayVal !== 'none';
        if (id === 'siteFooter') siteData.footerVisible = displayVal !== 'none';
        triggerAutoSave();
    };

    window.updateSectionStyle = function (id, prop, val) {
        const el = document.getElementById(id);
        if (el) el.style[prop] = val;
        triggerAutoSave();
    };

    function saveCurrentCanvasToMemory() {
        if (!siteCanvas) return;
        const elementsData = [];
        siteCanvas.querySelectorAll('.canvas-element').forEach(el => {
            const textValue = el.dataset.type === 'text'
                ? el.querySelector('[contenteditable="true"]')?.textContent || ''
                : el.dataset.type === 'button'
                    ? el.querySelector('button')?.textContent || ''
                    : '';

            elementsData.push({
                type: el.dataset.type,
                style: el.style.cssText,
                html: textValue || el.innerHTML,
                text: textValue,
                src: el.querySelector('img')?.src || null
            });
        });
        if (siteData.pages[siteData.currentPage]) {
            siteData.pages[siteData.currentPage].elements = elementsData;
        }
    }

    function loadCanvasFromMemory(key) {
        if (!siteCanvas) return;
        siteCanvas.innerHTML = '';
        const page = siteData.pages[key];
        if (page && page.elements) {
            page.elements.forEach(data => {
                const el = createCanvasElement(data.type, data);
                siteCanvas.appendChild(el);
            });
        }
    }

    // --- PUBLICATION ET CONVERSION HTML ---
    window.publishSite = function () {
        const subInput = document.getElementById('subdomainInput');
        const sub = subInput ? subInput.value.trim() : '';
        const publishStatus = document.getElementById('publishStatus');

        if (!sub) {
            if (publishStatus) publishStatus.innerText = '⚠️ Entrez un sous-domaine valide.';
            return;
        }

        siteData.subdomain = sub;
        saveCurrentCanvasToMemory();

        const pageTitle = escapeHtml(siteData.pages['index']?.name || 'Mon Site FastCraft');
        const navbarHtml = siteData.navbarVisible ? document.getElementById('siteNavbar').outerHTML.replace(/<\/script/gi, '<\\x3C/script') : '';
        const footerHtml = siteData.footerVisible ? document.getElementById('siteFooter').outerHTML.replace(/<\/script/gi, '<\\x3C/script') : '';
        const canvasHtml = siteCanvas ? siteCanvas.innerHTML.replace(/<\/script/gi, '<\\x3C/script') : '';

        const fullHTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${pageTitle}</title>
  <style>
    body { margin:0; font-family:'Inter', sans-serif; }
    nav a { margin-left: 1rem; text-decoration:none; color:inherit; }
  </style>
</head>
<body>
  ${navbarHtml}
  <main style="padding:2rem;">${canvasHtml}</main>
  ${footerHtml}
</body>
</html>`;

        if (publishStatus) publishStatus.innerText = '🚀 Publication en cours...';

        fetch(`${API_URL}/${siteId}/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subdomain: sub, html: fullHTML })
        }).then(() => {
            if (publishStatus) {
                publishStatus.innerHTML = `✅ Publié sur : <a href="https://${sub}.fastcraft.uk" target="_blank" style="color:var(--accent);">https://${sub}.fastcraft.uk</a>`;
            }
        }).catch(() => {
            if (publishStatus) publishStatus.innerText = '✅ HTML généré (Prêt pour liaison Cloudflare Worker).';
        });
    };

    window.saveMetaSettings = function () {
        triggerAutoSave();
    };

    // --- CHARGEMENT INITIAL ---
    async function init() {
        if (!siteId) return;
        try {
            const res = await fetch(`${API_URL}/${siteId}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.content) {
                    siteData = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
                    renderPagesList();
                    loadCanvasFromMemory(siteData.currentPage || 'index');
                    if (siteData.subdomain && document.getElementById('subdomainInput')) {
                        document.getElementById('subdomainInput').value = siteData.subdomain;
                    }
                }
            }
        } catch (e) {
            console.error('Erreur lors du chargement initial:', e);
        }
        renderPagesList();
    }

    init();
});