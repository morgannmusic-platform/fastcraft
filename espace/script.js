document.addEventListener('DOMContentLoaded', () => {
    // --- ÉLÉMENTS DU DOM ---
    const canvas = document.getElementById('site-canvas');
    const siteBody = document.getElementById('site-body');
    const floatingToolbar = document.getElementById('floating-toolbar');
    const colorSidebar = document.getElementById('color-sidebar');
    const closeColorSidebarBtn = document.getElementById('close-color-sidebar');
    const cssModal = document.getElementById('css-editor-modal');
    const closeCssModalBtn = document.getElementById('close-css-modal');
    const btnApplyCss = document.getElementById('btn-apply-css');
    const btnCancelCss = document.getElementById('btn-cancel-css');
    const radialHandle = document.getElementById('radial-center-handle');

    // State de sélection
    let selectedElement = null;
    let currentToolContext = 'canvas'; // 'canvas', 'shape', 'image', 'text', 'header', 'footer'
    let activeColorProperty = 'backgroundColor'; // Prop CSS ciblée par la palette

    // State pour la palette de couleur
    let currentColorType = 'solid'; // 'solid', 'linear', 'radial'
    let currentSolidColor = 'rgba(255, 255, 255, 1)';
    let linearAngle = 90;
    let linearStops = [
        { color: '#3b82f6', pos: 0 },
        { color: '#8b5cf6', pos: 100 }
    ];
    let radialStops = [
        { color: '#ffffff', pos: 0 },
        { color: '#000000', pos: 100 }
    ];
    let radialPos = { x: 50, y: 50 };
    let savedColors = JSON.parse(localStorage.getItem('fastcraft_saved_colors') || '["#ffffff", "#000000", "#3b82f6", "#ef4444", "#10b981", "#f59e0b"]');

    // ==========================================================================
    // 1. DÉPLACEMENT LIBRE & SÉLECTION DES ÉLÉMENTS (CANVA-LIKE)
    // ==========================================================================
    let isDraggingElement = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    // Déplacer les éléments dans le Body
    siteBody.addEventListener('mousedown', (e) => {
        const target = e.target.closest('.editable-element');
        if (target && !e.target.isContentEditable) {
            isDraggingElement = true;
            selectedElement = target;
            selectElement(target);

            const rect = target.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;

            e.stopPropagation();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isDraggingElement && selectedElement && selectedElement.parentElement === siteBody) {
            const bodyRect = siteBody.getBoundingClientRect();
            let newX = e.clientX - bodyRect.left - dragOffsetX;
            let newY = e.clientY - bodyRect.top - dragOffsetY;

            // Placement direct sans grille ni alignement contraint
            selectedElement.style.left = `${newX}px`;
            selectedElement.style.top = `${newY}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isDraggingElement = false;
    });

    // Clic sur le fond (Canvas) : Aucun popup, juste affichage des outils canvas
    canvas.addEventListener('click', (e) => {
        if (e.target === canvas || e.target === siteBody) {
            deselectAll();
            currentToolContext = 'canvas';
            showToolbarFor('canvas');
            updateColorPreviewCircle();
        }
    });

    function selectElement(el) {
        deselectAll();
        selectedElement = el;
        selectedElement.classList.add('selected');

        const type = selectedElement.dataset.type || 'text';
        currentToolContext = type;
        showToolbarFor(type);
        syncToolbarInputs(selectedElement);
    }

    function deselectAll() {
        document.querySelectorAll('.editable-element').forEach(el => el.classList.remove('selected'));
        selectedElement = null;
    }

    // ==========================================================================
    // 2. BARRE D'ÉDITION FLOTTANTE ADAPTATIVE
    // ==========================================================================
    function showToolbarFor(context) {
        floatingToolbar.classList.remove('hidden');
        document.querySelectorAll('.floating-toolbar .tool-group').forEach(group => {
            if (group.classList.contains('common-tools')) return;
            if (group.dataset.for === context) {
                group.classList.remove('hidden');
            } else {
                group.classList.add('hidden');
            }
        });
    }

    // Rendre la barre d'édition elle-même déplaçable
    const dragHandle = floatingToolbar.querySelector('.toolbar-drag-handle');
    let isDraggingToolbar = false;
    let tbOffsetX = 0, tbOffsetY = 0;

    dragHandle.addEventListener('mousedown', (e) => {
        isDraggingToolbar = true;
        const rect = floatingToolbar.getBoundingClientRect();
        tbOffsetX = e.clientX - rect.left;
        tbOffsetY = e.clientY - rect.top;
    });

    document.addEventListener('mousemove', (e) => {
        if (isDraggingToolbar) {
            floatingToolbar.style.left = `${e.clientX - tbOffsetX}px`;
            floatingToolbar.style.top = `${e.clientY - tbOffsetY}px`;
            floatingToolbar.style.transform = 'none';
        }
    });

    document.addEventListener('mouseup', () => { isDraggingToolbar = false; });

    // Synchronisation des valeurs des inputs selon l'élément sélectionné
    function syncToolbarInputs(el) {
        const style = window.getComputedStyle(el);

        if (el.dataset.type === 'shape') {
            document.getElementById('shape-radius').value = parseInt(style.borderRadius) || 0;
            document.getElementById('shape-opacity').value = style.opacity || 1;
        } else if (el.dataset.type === 'image') {
            document.getElementById('img-opacity').value = style.opacity || 1;
            document.getElementById('img-radius').value = parseInt(style.borderRadius) || 0;
        } else if (el.dataset.type === 'text') {
            document.getElementById('text-font-size').value = parseInt(style.fontSize) || 16;
            document.getElementById('text-font-family').value = style.fontFamily.replace(/"/g, '') || 'Arial';
        }
    }

    // ==========================================================================
    // 3. ÉDITION DE TEXTE COMPLET & OPTION CANVA
    // ==========================================================================
    // Changement de taille, police, alignement
    document.getElementById('text-font-size').addEventListener('input', (e) => {
        if (selectedElement) selectedElement.style.fontSize = `${e.target.value}px`;
    });

    document.getElementById('text-font-family').addEventListener('change', (e) => {
        if (selectedElement) selectedElement.style.fontFamily = e.target.value;
    });

    document.getElementById('btn-bold').addEventListener('click', () => {
        document.execCommand('bold', false, null);
    });
    document.getElementById('btn-italic').addEventListener('click', () => {
        document.execCommand('italic', false, null);
    });
    document.getElementById('btn-underline').addEventListener('click', () => {
        document.execCommand('underline', false, null);
    });

    ['left', 'center', 'right', 'justify'].forEach(align => {
        document.getElementById(`btn-align-${align}`).addEventListener('click', () => {
            if (selectedElement) selectedElement.style.textAlign = align;
        });
    });

    // Formes Canva : Opacité, Flou d'arrière plan (Webkit), Border Radius
    document.getElementById('shape-radius').addEventListener('input', (e) => {
        if (selectedElement) selectedElement.style.borderRadius = `${e.target.value}px`;
    });
    document.getElementById('shape-opacity').addEventListener('input', (e) => {
        if (selectedElement) selectedElement.style.opacity = e.target.value;
    });
    document.getElementById('shape-blur').addEventListener('input', (e) => {
        if (selectedElement) {
            const val = `blur(${e.target.value}px)`;
            selectedElement.style.backdropFilter = val;
            selectedElement.style.webkitBackdropFilter = val;
        }
    });

    // Calques (z-index)
    document.getElementById('btn-layer-up').addEventListener('click', () => {
        if (selectedElement) {
            let current = parseInt(window.getComputedStyle(selectedElement).zIndex) || 0;
            selectedElement.style.zIndex = current + 1;
        }
    });

    document.getElementById('btn-layer-down').addEventListener('click', () => {
        if (selectedElement) {
            let current = parseInt(window.getComputedStyle(selectedElement).zIndex) || 0;
            selectedElement.style.zIndex = Math.max(0, current - 1);
        }
    });

    // Suppression
    document.getElementById('btn-delete').addEventListener('click', () => {
        if (selectedElement && selectedElement.dataset.type !== 'header' && selectedElement.dataset.type !== 'footer') {
            selectedElement.remove();
            selectedElement = null;
            showToolbarFor('canvas');
        }
    });

    // ==========================================================================
    // 4. SIDEBAR COULEUR & DÉGRADÉS SUR MESURE
    // ==========================================================================
    // Déclencheurs pour ouvrir la sidebar couleur
    document.getElementById('btn-bg-color-picker').addEventListener('click', () => {
        activeColorProperty = 'background';
        openColorSidebar();
    });
    document.getElementById('btn-shape-color').addEventListener('click', () => {
        activeColorProperty = 'background';
        openColorSidebar();
    });
    document.getElementById('btn-text-color').addEventListener('click', () => {
        activeColorProperty = 'color';
        openColorSidebar();
    });
    document.getElementById('btn-nav-bg').addEventListener('click', () => {
        activeColorProperty = 'background';
        openColorSidebar();
    });
    document.getElementById('btn-footer-bg').addEventListener('click', () => {
        activeColorProperty = 'background';
        openColorSidebar();
    });

    function openColorSidebar() {
        colorSidebar.classList.remove('hidden');
        renderSavedColors();
    }

    closeColorSidebarBtn.addEventListener('click', () => {
        colorSidebar.classList.add('hidden');
        radialHandle.classList.add('hidden');
    });

    // Gestion des onglets de la sidebar
    const tabs = document.querySelectorAll('.color-type-tabs .tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            currentColorType = tab.dataset.tab;
            document.getElementById(`tab-${currentColorType}`).classList.add('active');
            applyColorToTarget();
        });
    });

    // Appliquer la couleur / dégradé au composant ou canvas sélectionné
    function applyColorToTarget() {
        let cssValue = '';

        if (currentColorType === 'solid') {
            cssValue = currentSolidColor;
        } else if (currentColorType === 'linear') {
            const stopsStr = linearStops.map(s => `${s.color} ${s.pos}%`).join(', ');
            cssValue = `linear-gradient(${linearAngle}deg, ${stopsStr})`;
        } else if (currentColorType === 'radial') {
            const stopsStr = radialStops.map(s => `${s.color} ${s.pos}%`).join(', ');
            cssValue = `radial-gradient(circle at ${radialPos.x}% ${radialPos.y}%, ${stopsStr})`;
        }

        const target = selectedElement || canvas;

        if (activeColorProperty === 'color' && currentColorType !== 'solid') {
            // Dégradé sur le texte via webkit
            target.style.backgroundImage = cssValue;
            target.style.webkitBackgroundClip = 'text';
            target.style.webkitTextFillColor = 'transparent';
        } else {
            if (activeColorProperty === 'color') {
                target.style.webkitBackgroundClip = 'initial';
                target.style.webkitTextFillColor = 'initial';
            }
            target.style[activeColorProperty] = cssValue;
        }

        updateColorPreviewCircle();
        updateGradientPreviews();
    }

    function updateColorPreviewCircle() {
        const bgPreview = document.getElementById('bg-color-preview');
        const target = selectedElement || canvas;
        bgPreview.style.background = target.style.background || target.style.backgroundColor || '#ffffff';
    }

    // Orientation Dégradé Linéaire (Roue + Boutons rapide)
    document.querySelectorAll('.angle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            linearAngle = btn.dataset.angle;
            document.getElementById('angle-value').innerText = `${linearAngle}°`;
            document.getElementById('angle-pointer').style.transform = `rotate(${linearAngle}deg)`;
            applyColorToTarget();
        });
    });

    // Points de couleur Linéaire
    document.getElementById('add-linear-stop').addEventListener('click', () => {
        linearStops.push({ color: '#000000', pos: 100 });
        renderLinearStops();
        applyColorToTarget();
    });

    function renderLinearStops() {
        const list = document.getElementById('linear-stops-list');
        list.innerHTML = '';
        linearStops.forEach((stop, index) => {
            const row = document.createElement('div');
            row.className = 'stop-row';
            row.innerHTML = `
                <input type="color" value="${stop.color}" data-index="${index}">
                <input type="number" min="0" max="100" value="${stop.pos}" data-index="${index}"> %
            `;
            row.querySelector('input[type="color"]').addEventListener('input', (e) => {
                linearStops[index].color = e.target.value;
                applyColorToTarget();
            });
            row.querySelector('input[type="number"]').addEventListener('input', (e) => {
                linearStops[index].pos = e.target.value;
                applyColorToTarget();
            });
            list.appendChild(row);
        });
    }
    renderLinearStops();

    // DÉGRADÉ RADIAL INTERACTIF DIRECTEMENT SUR LE SITE
    const btnToggleRadial = document.getElementById('btn-toggle-radial-interactive');
    let isPlacingRadial = false;

    btnToggleRadial.addEventListener('click', () => {
        isPlacingRadial = !isPlacingRadial;
        if (isPlacingRadial) {
            radialHandle.classList.remove('hidden');
            btnToggleRadial.classList.add('active');
            updateRadialHandlePos();
        } else {
            radialHandle.classList.add('hidden');
            btnToggleRadial.classList.remove('active');
        }
    });

    function updateRadialHandlePos() {
        const target = selectedElement || canvas;
        const rect = target.getBoundingClientRect();
        const px = rect.left + (rect.width * (radialPos.x / 100));
        const py = rect.top + (rect.height * (radialPos.y / 100));

        radialHandle.style.left = `${px}px`;
        radialHandle.style.top = `${py}px`;
    }

    // Déplacement interactif de la poignée du dégradé radial sur le site
    let isDraggingRadialHandle = false;

    radialHandle.addEventListener('mousedown', () => {
        isDraggingRadialHandle = true;
    });

    document.addEventListener('mousemove', (e) => {
        if (isDraggingRadialHandle) {
            const target = selectedElement || canvas;
            const rect = target.getBoundingClientRect();

            let x = ((e.clientX - rect.left) / rect.width) * 100;
            let y = ((e.clientY - rect.top) / rect.height) * 100;

            radialPos.x = Math.max(0, Math.min(100, Math.round(x)));
            radialPos.y = Math.max(0, Math.min(100, Math.round(y)));

            updateRadialHandlePos();
            applyColorToTarget();
        }
    });

    document.addEventListener('mouseup', () => {
        isDraggingRadialHandle = false;
    });

    function updateGradientPreviews() {
        const linearStr = linearStops.map(s => `${s.color} ${s.pos}%`).join(', ');
        document.getElementById('linear-preview').style.background = `linear-gradient(${linearAngle}deg, ${linearStr})`;

        const radialStr = radialStops.map(s => `${s.color} ${s.pos}%`).join(', ');
        document.getElementById('radial-preview').style.background = `radial-gradient(circle, ${radialStr})`;
    }

    // Enregistrement des couleurs
    document.getElementById('btn-save-current-color').addEventListener('click', () => {
        let valToSave = (currentColorType === 'solid') ? currentSolidColor :
            (currentColorType === 'linear') ? `linear-gradient(${linearAngle}deg, ${linearStops.map(s => `${s.color} ${s.pos}%`).join(', ')})` :
                `radial-gradient(circle, ${radialStops.map(s => `${s.color} ${s.pos}%`).join(', ')})`;

        savedColors.push(valToSave);
        localStorage.setItem('fastcraft_saved_colors', JSON.stringify(savedColors));
        renderSavedColors();
    });

    function renderSavedColors() {
        const grid = document.getElementById('saved-colors-grid');
        grid.innerHTML = '';
        savedColors.forEach(colorStr => {
            const swatch = document.createElement('div');
            swatch.className = 'saved-color-swatch';
            swatch.style.background = colorStr;
            swatch.addEventListener('click', () => {
                const target = selectedElement || canvas;
                target.style[activeColorProperty] = colorStr;
                updateColorPreviewCircle();
            });
            grid.appendChild(swatch);
        });
    }

    // ==========================================================================
    // 5. MODALE ÉDITEUR CSS (TOUT PUBLIC)
    // ==========================================================================
    document.getElementById('btn-edit-css').addEventListener('click', () => {
        if (!selectedElement && currentToolContext !== 'canvas') return;
        cssModal.classList.remove('hidden');

        const target = selectedElement || canvas;
        document.getElementById('css-box-shadow').value = target.style.boxShadow || '';
        document.getElementById('css-margin').value = target.style.margin || '';
        document.getElementById('css-padding').value = target.style.padding || '';
        document.getElementById('css-filter').value = target.style.filter || '';
        document.getElementById('raw-css-input').value = target.style.cssText || '';
    });

    closeCssModalBtn.addEventListener('click', () => cssModal.classList.add('hidden'));
    btnCancelCss.addEventListener('click', () => cssModal.classList.add('hidden'));

    btnApplyCss.addEventListener('click', () => {
        const target = selectedElement || canvas;

        const boxShadow = document.getElementById('css-box-shadow').value;
        const margin = document.getElementById('css-margin').value;
        const padding = document.getElementById('css-padding').value;
        const filter = document.getElementById('css-filter').value;
        const rawCss = document.getElementById('raw-css-input').value;

        if (boxShadow) target.style.boxShadow = boxShadow;
        if (margin) target.style.margin = margin;
        if (padding) target.style.padding = padding;
        if (filter) target.style.filter = filter;

        if (rawCss.trim() !== '') {
            target.style.cssText += ';' + rawCss;
        }

        cssModal.classList.add('hidden');
    });
});