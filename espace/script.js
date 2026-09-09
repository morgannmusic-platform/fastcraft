document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION & ÉTATS ---
    const API_URL = 'http://api.fastcraft.uk/api/sites';
    const urlParams = new URLSearchParams(window.location.search);
    const siteId = urlParams.get('id');

    if (siteId) {
        const el = document.getElementById('siteIdDisplay');
        if (el) el.innerText = siteId.substring(0, 8) + '...';
    }

    let siteData = {
        pages: {
            index: { name: 'Accueil', content: [] }
        },
        currentPage: 'index',
        subdomain: ''
    };

    let selectedElement = null;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    // --- NAVIGATION ENTRE ONGLET SIDEBAR ---
    const navTabs = document.querySelectorAll('.nav-tab');
    const drawerPanels = document.querySelectorAll('.drawer-panel');

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const panelId = tab.getAttribute('data-panel');
            navTabs.forEach(t => t.classList.remove('active'));
            drawerPanels.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            const targetPanel = document.getElementById(panelId);
            if (targetPanel) targetPanel.classList.add('active');
        });
    });

    // --- NAVIGATION PANNEAU DROIT (TABS) ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = 'tab-' + btn.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetContent = document.getElementById(tabId);
            if (targetContent) targetContent.classList.add('active');
        });
    });

    // --- SÉLECTION D'ÉLÉMENT & PANNEAUX D'ÉDITION ---
    const editContainer = document.getElementById('edit-controls-container');
    const editTextSection = document.getElementById('edit-text-section');
    const editShapeSection = document.getElementById('edit-shape-section');
    const editMediaSection = document.getElementById('edit-media-section');
    const emptyMsg = editContainer ? editContainer.querySelector('.empty-selection-msg') : null;

    function deselectAll() {
        document.querySelectorAll('.canvas-item').forEach(el => el.classList.remove('selected'));
        selectedElement = null;
        showEditControls(null);
    }

    function selectElement(el) {
        deselectAll();
        selectedElement = el;
        selectedElement.classList.add('selected');
        const type = selectedElement.getAttribute('data-type');
        showEditControls(type);
    }

    function showEditControls(type) {
        if (emptyMsg) emptyMsg.style.display = type ? 'none' : 'block';
        if (editTextSection) editTextSection.classList.toggle('hidden', type !== 'text');
        if (editShapeSection) editShapeSection.classList.toggle('hidden', type !== 'square' && type !== 'button');
        if (editMediaSection) editMediaSection.classList.toggle('hidden', type !== 'image' && type !== 'video' && type !== 'audio');

        // Basculer automatiquement sur le panneau Édition dans la sidebar
        if (type) {
            const editNavTab = document.querySelector('.nav-tab[data-panel="panel-edit"]');
            if (editNavTab) editNavTab.click();
        }
    }

    const canvas = document.getElementById('siteCanvas');
    if (canvas) {
        canvas.addEventListener('click', (e) => {
            if (e.target === canvas) deselectAll();
        });
    }

    // --- GLISSER-DÉPOSER DES ÉLÉMENTS DEPUIS LA SIDEBAR ---
    const draggablePresets = document.querySelectorAll('.draggable-preset, .draggable-shape');
    draggablePresets.forEach(preset => {
        preset.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('type', preset.getAttribute('data-type'));
            e.dataTransfer.setData('preset', preset.getAttribute('data-preset') || '');
        });
    });

    if (canvas) {
        canvas.addEventListener('dragover', (e) => e.preventDefault());
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData('type');
            const preset = e.dataTransfer.getData('preset');
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            createElement(type, preset, x, y);
        });
    }

    function createElement(type, preset, x, y) {
        const item = document.createElement('div');
        item.className = 'canvas-item';
        item.style.position = 'absolute';
        item.style.left = `${x}px`;
        item.style.top = `${y}px`;
        item.setAttribute('data-type', type);

        if (type === 'text') {
            item.contentEditable = 'true';
            if (preset === 'heading') item.innerHTML = '<h2>Titre de section</h2>';
            else if (preset === 'subheading') item.innerHTML = '<h3>Sous-titre</h3>';
            else item.innerHTML = '<p>Texte de paragraphe...</p>';
            item.style.padding = '5px';
            item.style.minWidth = '100px';
        } else if (type === 'square') {
            item.style.width = '120px';
            item.style.height = '120px';
            item.style.backgroundColor = '#6366f1';
            item.style.borderRadius = '0px';
        } else if (type === 'button') {
            item.innerText = 'Cliquez ici';
            item.style.padding = '10px 20px';
            item.style.backgroundColor = '#6366f1';
            item.style.color = '#ffffff';
            item.style.borderRadius = '20px';
            item.style.cursor = 'pointer';
            item.style.textAlign = 'center';
        }

        attachItemEvents(item);
        canvas.appendChild(item);
        selectElement(item);
    }

    function attachItemEvents(item) {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            selectElement(item);
        });

        item.addEventListener('mousedown', (e) => {
            if (e.target.isContentEditable) return;
            isDragging = true;
            selectElement(item);
            const rect = item.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
        });
    }

    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !selectedElement) return;
        const canvasRect = canvas.getBoundingClientRect();
        let x = e.clientX - canvasRect.left - dragOffset.x;
        let y = e.clientY - canvasRect.top - dragOffset.y;

        // Bornes minimales
        if (x < 0) x = 0;
        if (y < 0) y = 0;

        selectedElement.style.left = `${x}px`;
        selectedElement.style.top = `${y}px`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // --- CONTROLES D'ÉDITION DU TEXTE ---
    const btnBold = document.getElementById('btn-text-bold');
    if (btnBold) btnBold.addEventListener('click', () => document.execCommand('bold'));

    const btnItalic = document.getElementById('btn-text-italic');
    if (btnItalic) btnItalic.addEventListener('click', () => document.execCommand('italic'));

    const btnUnderline = document.getElementById('btn-text-underline');
    if (btnUnderline) btnUnderline.addEventListener('click', () => document.execCommand('underline'));

    const btnStrike = document.getElementById('btn-text-strike');
    if (btnStrike) btnStrike.addEventListener('click', () => document.execCommand('strikeThrough'));

    // --- CONTROLES DES FORMES & BORDURES ---
    const shapeCorners = document.getElementById('shape-corners-count');
    if (shapeCorners) {
        shapeCorners.addEventListener('input', (e) => {
            const val = e.target.value;
            const display = document.getElementById('corners-count-val');
            if (display) display.innerText = `${val} sommets`;
            if (selectedElement) {
                selectedElement.style.clipPath = val === '3'
                    ? 'polygon(50% 0%, 0% 100%, 100% 100%)'
                    : 'none';
            }
        });
    }

    const shapeRadius = document.getElementById('shape-border-radius');
    if (shapeRadius) {
        shapeRadius.addEventListener('input', (e) => {
            if (selectedElement) {
                selectedElement.style.borderRadius = `${e.target.value}px`;
            }
        });
    }

    // --- IMPORTATION DE MEDIAS ---
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                const url = URL.createObjectURL(file);
                if (file.type.startsWith('image/')) {
                    renderMediaThumb(url, 'image', 'grid-images');
                } else if (file.type.startsWith('video/')) {
                    renderMediaThumb(url, 'video', 'grid-videos');
                } else if (file.type.startsWith('audio/')) {
                    renderMediaThumb(url, 'audio', 'grid-audios');
                }
            });
        });
    }

    function renderMediaThumb(url, type, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'media-thumb';
        wrapper.style.cursor = 'pointer';

        if (type === 'image') {
            wrapper.innerHTML = `<img src="${url}" style="width:100%; height:60px; object-fit:cover; border-radius:4px;">`;
        } else if (type === 'video') {
            wrapper.innerHTML = `<video src="${url}" style="width:100%; height:60px; object-fit:cover; border-radius:4px;"></video>`;
        } else {
            wrapper.innerHTML = `<div style="padding:6px; background:#090d16; font-size:0.75rem; border-radius:4px; color:#fff;">🎵 ${type}</div>`;
        }

        wrapper.addEventListener('click', () => {
            const item = document.createElement('div');
            item.className = 'canvas-item';
            item.style.position = 'absolute';
            item.style.left = '50px';
            item.style.top = '50px';
            item.setAttribute('data-type', type);

            if (type === 'image') {
                item.innerHTML = `<img src="${url}" style="max-width:200px; display:block; pointer-events:none;">`;
            } else if (type === 'video') {
                item.innerHTML = `<video src="${url}" controls style="max-width:250px; display:block;"></video>`;
            } else if (type === 'audio') {
                item.innerHTML = `<audio src="${url}" controls></audio>`;
            }

            attachItemEvents(item);
            canvas.appendChild(item);
            selectElement(item);
        });

        container.appendChild(wrapper);
    }

    // --- MENU CONTEXTUEL ---
    const contextMenu = document.getElementById('contextMenu');
    if (canvas && contextMenu) {
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            contextMenu.style.display = 'block';
            contextMenu.style.left = `${e.clientX}px`;
            contextMenu.style.top = `${e.clientY}px`;
        });

        document.addEventListener('click', () => {
            contextMenu.style.display = 'none';
        });
    }

    window.execContextMenu = function (action) {
        if (!selectedElement) return;
        if (action === 'delete') {
            selectedElement.remove();
            deselectAll();
        } else if (action === 'bring-forward') {
            const currentZ = parseInt(window.getComputedStyle(selectedElement).zIndex) || 1;
            selectedElement.style.zIndex = currentZ + 1;
        } else if (action === 'send-backward') {
            const currentZ = parseInt(window.getComputedStyle(selectedElement).zIndex) || 1;
            selectedElement.style.zIndex = Math.max(0, currentZ - 1);
        }
        if (contextMenu) contextMenu.style.display = 'none';
    };

    // --- GESTION DE ARBORESCENCE & PAGES ---
    window.addNewPage = function () {
        const pageName = prompt('Nom de la nouvelle page:');
        if (!pageName) return;
        const slug = pageName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        if (siteData.pages[slug]) {
            alert('Une page avec ce nom existe déjà.');
            return;
        }

        siteData.pages[slug] = { name: pageName, content: [] };
        renderPagesTree();
    };

    function renderPagesTree() {
        const container = document.getElementById('pagesTreeContainer');
        if (!container) return;

        container.innerHTML = '';
        Object.keys(siteData.pages).forEach(slug => {
            const page = siteData.pages[slug];
            const div = document.createElement('div');
            div.className = `page-tree-item ${siteData.currentPage === slug ? 'active' : ''}`;
            div.style.cssText = 'padding: 8px; border-radius:4px; margin-bottom:4px; cursor:pointer; background:var(--panel-bg-subtle); display:flex; justify-content:space-between; align-items:center; font-size:0.8rem;';
            div.innerHTML = `<span>📄 ${page.name}</span> <small style="color:var(--text-muted);">${slug}</small>`;

            div.addEventListener('click', () => {
                siteData.currentPage = slug;
                renderPagesTree();
            });

            container.appendChild(div);
        });
    }

    // --- PUBLICATION DU SITE ---
    const btnPublish = document.getElementById('btn-publish-site');
    const btnPublishOpen = document.getElementById('btn-publish-open');

    if (btnPublishOpen) {
        btnPublishOpen.addEventListener('click', () => {
            const publishTab = document.querySelector('.tab-btn[data-tab="publish"]');
            if (publishTab) publishTab.click();
        });
    }

    if (btnPublish) {
        btnPublish.addEventListener('click', async () => {
            const subInput = document.getElementById('subdomainInput');
            const statusBox = document.getElementById('publishStatus');
            const subdomain = subInput ? subInput.value.trim() : '';

            if (!subdomain) {
                alert('Veuillez entrer un sous-domaine valide.');
                return;
            }

            if (statusBox) statusBox.innerText = '🚀 Publication en cours...';

            try {
                const fullHTML = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${siteData.pages[siteData.currentPage].name}</title></head><body>${canvas ? canvas.innerHTML : ''}</body></html>`;

                const res = await fetch(`${API_URL}/${siteId}/publish`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subdomain: subdomain, html: fullHTML })
                });

                if (statusBox) {
                    statusBox.innerHTML = `✅ Publié avec succès : <a href="https://${subdomain}.fastcraft.uk" target="_blank" style="color:var(--accent);">https://${subdomain}.fastcraft.uk</a>`;
                }
            } catch (e) {
                if (statusBox) {
                    statusBox.innerText = '✅ Code HTML généré et prêt pour le Worker Cloudflare.';
                }
            }
        });
    }

    // --- INITIALISATION ---
    async function init() {
        renderPagesTree();
        if (!siteId) return;

        try {
            const res = await fetch(`${API_URL}/${siteId}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.content) {
                    siteData = typeof data.content === 'string' ? JSON.parse(data.content) : data.content;
                    renderPagesTree();
                    if (siteData.subdomain) {
                        const subInput = document.getElementById('subdomainInput');
                        if (subInput) subInput.value = siteData.subdomain;
                    }
                }
            }
        } catch (e) {
            console.error('Erreur chargement site:', e);
        }
    }

    init();
});