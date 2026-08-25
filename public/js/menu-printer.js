/**
 * Menu Printing Engine & Customizer
 * Gestisce l'estrazione dati, la selezione del template, la personalizzazione e la stampa A4.
 */

const MENU_TEMPLATES = {};

/**
 * Register a new menu template.
 * @param {Object} config - { id, name, description, pageSize, render: (data) => string }
 */
function registerMenuTemplate(config) {
    if (!config || !config.id || typeof config.render !== 'function') {
        console.error("Invalid menu template config:", config);
        return;
    }
    MENU_TEMPLATES[config.id] = config;
}

/**
 * Extract active menu data cleanly from STATE and the active DOM editor.
 */
function extractMenuData() {
    let eventName = "Menu Evento";

    // 1. Get clean event name from STATE.currentSagra
    if (typeof STATE !== 'undefined' && STATE && STATE.currentSagra && STATE.currentSagra.name) {
        eventName = STATE.currentSagra.name;
    } else {
        const headerTitle = document.querySelector('.pos-header h1, #view-editor h2, header h1');
        if (headerTitle && headerTitle.innerText.trim()) {
            eventName = headerTitle.innerText.trim()
                .replace(/^Modifica\s+Men[ùu]\s+/i, '')
                .replace(/^Menu\s+/i, '');
        }
    }

    let categories = [];

    // 2. Try reading from DOM editor sections first (captures live/unsaved inputs)
    const editorSections = document.querySelectorAll('.editor-section');
    if (editorSections && editorSections.length > 0) {
        editorSections.forEach(sec => {
            let catName = '';
            const nameInput = sec.querySelector('.cat-name-input');
            if (nameInput) {
                catName = nameInput.value.trim();
            } else {
                const titleEl = sec.querySelector('.fixed-cat-title-text, .cat-title');
                if (titleEl) catName = titleEl.innerText.trim();
            }
            if (!catName || catName === 'Prodotti Base') return;

            const isHidden = sec.classList.contains('is-hidden-category');
            if (isHidden) return;

            const products = [];
            sec.querySelectorAll('.product-row').forEach(row => {
                const nameInput = row.querySelector('.col-name input') || row.querySelector('input[type="text"]');
                const priceInput = row.querySelector('input.col-price') || row.querySelectorAll('input')[1];
                const pName = nameInput ? nameInput.value.trim() : '';
                const pPrice = priceInput ? parseFloat(priceInput.value) : NaN;
                const pId = row.dataset.productId || row.dataset.id || (catName + '_' + pName);

                if (pName && !isNaN(pPrice)) {
                    products.push({
                        id: String(pId),
                        name: pName,
                        price: pPrice
                    });
                }
            });

            if (products.length > 0) {
                categories.push({
                    id: String(catName),
                    name: catName,
                    products
                });
            }
        });
    }

    // 3. Fallback to STATE.products if DOM was empty
    if (categories.length === 0 && typeof STATE !== 'undefined' && STATE && STATE.products) {
        for (const [catName, prods] of Object.entries(STATE.products)) {
            if (catName === 'Prodotti Base') continue;
            if (!prods || prods.length === 0) continue;

            const validProds = prods
                .filter(p => !p.is_deleted && p.name && p.price !== undefined)
                .map(p => ({
                    id: String(p.id || (catName + '_' + p.name)),
                    name: p.name,
                    price: p.price
                }));

            if (validProds.length > 0) {
                categories.push({
                    id: String(catName),
                    name: catName,
                    products: validProds
                });
            }
        }
    }

    return {
        eventName,
        logoUrl: 'images/logo.png',
        categories
    };
}

function escapeMenuHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * General function to render and trigger printing of the menu.
 * @param {string} [templateId='a4_modern'] - Template ID to use
 * @param {Object} [customData] - Optional explicit data override
 */
async function printMenu(templateId = 'a4_modern', customData = null) {
    const template = MENU_TEMPLATES[templateId] || MENU_TEMPLATES['a4_modern'] || Object.values(MENU_TEMPLATES)[0];
    if (!template) {
        showToast("Template di stampa non trovato", "error");
        return;
    }

    const menuData = customData || extractMenuData();

    if (!menuData.categories || menuData.categories.length === 0) {
        showToast("Nessun prodotto disponibile nel menu da stampare.", "info");
        return;
    }

    const htmlContent = template.render(menuData);

    // Create an invisible printing iframe for crisp, seamless printing
    let printFrame = document.getElementById('menu-print-frame');
    if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'menu-print-frame';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);
    }

    const frameDoc = printFrame.contentWindow.document;
    frameDoc.open();
    frameDoc.write(htmlContent);
    frameDoc.close();

    // Wait for assets/fonts to be ready then trigger print
    setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
    }, 250);
}

// -------------------------------------------------------------
// TEMPLATE SELECTION MODAL (STEP 1)
// -------------------------------------------------------------

let selectedMenuTemplateId = localStorage.getItem('preferredMenuTemplate') || 'a4_modern';

function openMenuTemplateModal() {
    const modal = document.getElementById('menu-template-modal');
    const listEl = document.getElementById('menu-templates-list');
    
    const templateKeys = Object.keys(MENU_TEMPLATES);
    if (templateKeys.length === 0) {
        showToast("Nessun template di stampa disponibile", "error");
        return;
    }

    if (!modal || !listEl) {
        return goToMenuCustomizer();
    }

    if (!MENU_TEMPLATES[selectedMenuTemplateId]) {
        selectedMenuTemplateId = templateKeys[0];
    }

    const menuData = extractMenuData();

    listEl.innerHTML = templateKeys.map(key => {
        const t = MENU_TEMPLATES[key];
        const isSel = (key === selectedMenuTemplateId);

        let renderedHtml = "";
        try {
            renderedHtml = t.render(menuData);
        } catch (e) {
            console.error("Error rendering preview for template:", key, e);
        }

        const srcdocAttr = renderedHtml ? renderedHtml.replace(/"/g, '&quot;') : '';

        return `
            <div class="menu-template-card ${isSel ? 'selected' : ''}" data-template-id="${t.id}" onclick="selectMenuTemplate('${t.id}')">
                <div class="menu-template-preview-box">
                    <iframe class="menu-template-mini-frame" srcdoc="${srcdocAttr}"></iframe>
                </div>
                <div class="menu-template-footer">
                    <span class="menu-template-name">${escapeMenuHtml(t.name)}</span>
                </div>
            </div>
        `;
    }).join('');

    modal.style.display = 'flex';
}

function selectMenuTemplate(templateId) {
    selectedMenuTemplateId = templateId;
    localStorage.setItem('preferredMenuTemplate', templateId);
    const cards = document.querySelectorAll('.menu-template-card');
    cards.forEach(c => {
        if (c.getAttribute('data-template-id') === templateId) {
            c.classList.add('selected');
        } else {
            c.classList.remove('selected');
        }
    });
}

function closeMenuTemplateModal() {
    const modal = document.getElementById('menu-template-modal');
    if (modal) modal.style.display = 'none';
}

// -------------------------------------------------------------
// MENU CUSTOMIZER & FULL LIVE PREVIEW (STEP 2)
// -------------------------------------------------------------

let customMenuState = {
    topLabel: 'MENU EVENTO',
    eventName: '',
    notes: '',
    density: 'normal',
    excludedProductIds: new Set(),
    excludedCategoryIds: new Set()
};

function goToMenuCustomizer() {
    closeMenuTemplateModal();

    const customizerModal = document.getElementById('menu-customizer-modal');
    if (!customizerModal) {
        return printMenu(selectedMenuTemplateId);
    }

    const menuData = extractMenuData();

    // Set clean event name from active menu data
    customMenuState.eventName = menuData.eventName;
    customMenuState.topLabel = customMenuState.topLabel || 'MENU EVENTO';

    // Populate inputs
    const topLabelInput = document.getElementById('menu-custom-toplabel');
    if (topLabelInput) topLabelInput.value = customMenuState.topLabel;

    const eventNameInput = document.getElementById('menu-custom-eventname');
    if (eventNameInput) eventNameInput.value = customMenuState.eventName;

    const notesInput = document.getElementById('menu-custom-notes');
    if (notesInput) notesInput.value = customMenuState.notes;

    // Density buttons
    updateDensityButtonsUI(customMenuState.density);

    // Template badge
    const badge = document.getElementById('menu-customizer-template-badge');
    const currentTpl = MENU_TEMPLATES[selectedMenuTemplateId];
    if (badge) badge.innerText = currentTpl ? currentTpl.name : 'A4';

    // Populate products list tree
    renderCustomizerProductsTree(menuData);

    // Open customizer modal & render live preview
    customizerModal.style.display = 'flex';

    // Resize and render preview sheet
    setTimeout(() => {
        adjustA4PreviewScale();
        updateCustomizerLivePreview();
    }, 50);
}

function renderCustomizerProductsTree(menuData) {
    const container = document.getElementById('menu-custom-products-list');
    if (!container) return;

    const categories = menuData.categories || [];
    if (categories.length === 0) {
        container.innerHTML = `<div style="color:var(--text-light); padding:10px; text-align:center;">Nessun piatto disponibile nel menu.</div>`;
        return;
    }

    container.innerHTML = categories.map(cat => {
        const isCatExcluded = customMenuState.excludedCategoryIds.has(String(cat.id));
        const prods = cat.products || [];

        const prodsHtml = prods.map(p => {
            const isProdExcluded = isCatExcluded || customMenuState.excludedProductIds.has(String(p.id));
            return `
                <div class="menu-custom-prod-item">
                    <label style="display:flex; align-items:center; gap:6px; cursor:pointer; flex:1;">
                        <input type="checkbox" class="menu-custom-checkbox" 
                            data-prod-id="${p.id}" data-cat-id="${cat.id}"
                            ${!isProdExcluded ? 'checked' : ''} 
                            onchange="toggleCustomizerProduct('${p.id}', '${cat.id}', this.checked)">
                        <span>${escapeMenuHtml(p.name)}</span>
                    </label>
                    <span style="font-weight:600; color:var(--text-light);">€ ${Number(p.price || 0).toFixed(2)}</span>
                </div>
            `;
        }).join('');

        return `
            <div class="menu-custom-cat-group">
                <div class="menu-custom-cat-header">
                    <input type="checkbox" class="menu-custom-checkbox" 
                        data-cat-header-id="${cat.id}"
                        ${!isCatExcluded ? 'checked' : ''} 
                        onchange="toggleCustomizerCategory('${cat.id}', this.checked)">
                    <span onclick="this.previousElementSibling.click()">${escapeMenuHtml(cat.name)}</span>
                </div>
                <div class="menu-custom-prod-list">
                    ${prodsHtml}
                </div>
            </div>
        `;
    }).join('');
}

function toggleCustomizerProduct(prodId, catId, isChecked) {
    if (isChecked) {
        customMenuState.excludedProductIds.delete(String(prodId));
        customMenuState.excludedCategoryIds.delete(String(catId));
    } else {
        customMenuState.excludedProductIds.add(String(prodId));
    }
    syncTreeCheckboxesState();
    updateCustomizerLivePreview();
}

function toggleCustomizerCategory(catId, isChecked) {
    const menuData = extractMenuData();
    const cat = (menuData.categories || []).find(c => String(c.id) === String(catId));

    if (isChecked) {
        customMenuState.excludedCategoryIds.delete(String(catId));
        if (cat) {
            (cat.products || []).forEach(p => customMenuState.excludedProductIds.delete(String(p.id)));
        }
    } else {
        customMenuState.excludedCategoryIds.add(String(catId));
        if (cat) {
            (cat.products || []).forEach(p => customMenuState.excludedProductIds.add(String(p.id)));
        }
    }
    syncTreeCheckboxesState();
    updateCustomizerLivePreview();
}

function selectAllCustomizerProducts(selectAll) {
    const menuData = extractMenuData();
    if (selectAll) {
        customMenuState.excludedCategoryIds.clear();
        customMenuState.excludedProductIds.clear();
    } else {
        (menuData.categories || []).forEach(cat => {
            customMenuState.excludedCategoryIds.add(String(cat.id));
            (cat.products || []).forEach(p => customMenuState.excludedProductIds.add(String(p.id)));
        });
    }
    syncTreeCheckboxesState();
    updateCustomizerLivePreview();
}

function syncTreeCheckboxesState() {
    const catHeaders = document.querySelectorAll('[data-cat-header-id]');
    catHeaders.forEach(ch => {
        const catId = ch.getAttribute('data-cat-header-id');
        ch.checked = !customMenuState.excludedCategoryIds.has(String(catId));
    });

    const prodCheckboxes = document.querySelectorAll('[data-prod-id]');
    prodCheckboxes.forEach(pb => {
        const prodId = pb.getAttribute('data-prod-id');
        const catId = pb.getAttribute('data-cat-id');
        const isExcluded = customMenuState.excludedCategoryIds.has(String(catId)) || customMenuState.excludedProductIds.has(String(prodId));
        pb.checked = !isExcluded;
    });
}

function onCustomizerFieldChange(field, value) {
    customMenuState[field] = value;
    updateCustomizerLivePreview();
}

function onCustomizerDensityChange(density) {
    customMenuState.density = density;
    updateDensityButtonsUI(density);
    updateCustomizerLivePreview();
}

function updateDensityButtonsUI(density) {
    const btns = document.querySelectorAll('.btn-density');
    btns.forEach(b => {
        if (b.getAttribute('data-density') === density) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
}

function getCustomizedMenuData() {
    const baseData = extractMenuData();
    return {
        ...baseData,
        topLabel: customMenuState.topLabel || 'MENU EVENTO',
        eventName: customMenuState.eventName || baseData.eventName,
        notes: customMenuState.notes || '',
        density: customMenuState.density || 'normal',
        excludedCategoryIds: Array.from(customMenuState.excludedCategoryIds),
        excludedProductIds: Array.from(customMenuState.excludedProductIds)
    };
}

function adjustA4PreviewScale() {
    const viewport = document.querySelector('.menu-full-a4-viewport');
    const sheet = document.querySelector('.menu-full-a4-sheet');
    const iframe = document.getElementById('menu-customizer-iframe');
    if (!viewport || !sheet || !iframe) return;

    const vHeight = viewport.clientHeight - 40; // padding
    const vWidth = viewport.clientWidth - 40;
    if (vHeight <= 0 || vWidth <= 0) return;

    const a4Ratio = 210 / 297;
    let targetH = vHeight;
    let targetW = targetH * a4Ratio;

    if (targetW > vWidth) {
        targetW = vWidth;
        targetH = targetW / a4Ratio;
    }

    targetH = Math.max(300, Math.round(targetH));
    targetW = Math.round(targetH * a4Ratio);

    sheet.style.width = `${targetW}px`;
    sheet.style.height = `${targetH}px`;

    const scale = targetH / 1123;
    iframe.style.width = '794px';
    iframe.style.height = '1123px';
    iframe.style.transform = `scale(${scale})`;
    iframe.style.transformOrigin = 'top left';
}

window.addEventListener('resize', () => {
    const customizerModal = document.getElementById('menu-customizer-modal');
    if (customizerModal && customizerModal.style.display === 'flex') {
        adjustA4PreviewScale();
    }
});

function updateCustomizerLivePreview() {
    const iframe = document.getElementById('menu-customizer-iframe');
    if (!iframe) return;

    const template = MENU_TEMPLATES[selectedMenuTemplateId] || MENU_TEMPLATES['a4_modern'] || Object.values(MENU_TEMPLATES)[0];
    if (!template) return;

    const customizedData = getCustomizedMenuData();
    try {
        const html = template.render(customizedData);
        iframe.srcdoc = html;
    } catch (e) {
        console.error("Error updating customizer preview:", e);
    }
}

function backToTemplateSelector() {
    closeMenuCustomizerModal();
    openMenuTemplateModal();
}

function closeMenuCustomizerModal() {
    const modal = document.getElementById('menu-customizer-modal');
    if (modal) modal.style.display = 'none';
}

function printCustomMenu() {
    const customizedData = getCustomizedMenuData();
    closeMenuCustomizerModal();
    printMenu(selectedMenuTemplateId, customizedData);
}

/**
 * Export rendered menu directly as PDF file (skips print dialog, opens Save Dialog).
 */
async function exportMenuToPDF() {
    const template = MENU_TEMPLATES[selectedMenuTemplateId] || MENU_TEMPLATES['a4_modern'] || Object.values(MENU_TEMPLATES)[0];
    if (!template) {
        showToast("Template non valido per l'esportazione", "error");
        return;
    }

    const customizedData = getCustomizedMenuData();
    const htmlContent = template.render(customizedData);

    const safeName = (customizedData.eventName || 'Menu')
        .replace(/[/\\?%*:|"<>]/g, '_')
        .replace(/\s+/g, '_');

    const fileName = `Menu_${safeName}.pdf`;

    // 1. Electron Native PDF Export (No print dialog, directly opens Windows Save Dialog)
    if (window.electronAPI && typeof window.electronAPI.exportPDF === 'function') {
        try {
            if (typeof showToast === 'function') showToast("Generazione PDF in corso...", "info");
            const result = await window.electronAPI.exportPDF({
                html: htmlContent,
                defaultFileName: fileName
            });

            if (result && result.success) {
                if (typeof showToast === 'function') {
                    showToast("PDF salvato con successo!", "success");
                }
            } else if (result && result.error) {
                if (typeof showToast === 'function') {
                    showToast(`Errore esportazione PDF: ${result.error}`, "error");
                }
            }
            return;
        } catch (e) {
            console.error("Native PDF export error:", e);
            if (typeof showToast === 'function') {
                showToast("Errore durante l'esportazione PDF", "error");
            }
        }
    } else {
        // Web browser mode fallback
        if (typeof showToast === 'function') {
            showToast("Per salvare in PDF, seleziona 'Salva come PDF' nella destinazione", "info");
        }
        printCustomMenu();
    }
}

window.registerMenuTemplate = registerMenuTemplate;
window.MENU_TEMPLATES = MENU_TEMPLATES;
window.extractMenuData = extractMenuData;
window.printMenu = printMenu;
window.printCurrentMenu = () => printMenu('a4_modern');
window.openMenuTemplateModal = openMenuTemplateModal;
window.selectMenuTemplate = selectMenuTemplate;
window.closeMenuTemplateModal = closeMenuTemplateModal;
window.goToMenuCustomizer = goToMenuCustomizer;
window.backToTemplateSelector = backToTemplateSelector;
window.closeMenuCustomizerModal = closeMenuCustomizerModal;
window.onCustomizerFieldChange = onCustomizerFieldChange;
window.onCustomizerDensityChange = onCustomizerDensityChange;
window.toggleCustomizerProduct = toggleCustomizerProduct;
window.toggleCustomizerCategory = toggleCustomizerCategory;
window.selectAllCustomizerProducts = selectAllCustomizerProducts;
window.printCustomMenu = printCustomMenu;
window.exportMenuToPDF = exportMenuToPDF;
window.escapeMenuHtml = escapeMenuHtml;
