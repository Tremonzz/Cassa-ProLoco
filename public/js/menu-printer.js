/**
 * Menu Printing System
 * Modular architecture for rendering and printing event menus with pluggable templates.
 */

const MENU_TEMPLATES = {};

/**
 * Register a new menu template.
 * @param {Object} template - Template definition object
 * @param {string} template.id - Unique template identifier
 * @param {string} template.name - User-friendly display name
 * @param {string} template.description - Description of layout and style
 * @param {string} template.pageSize - Page size (e.g. 'A4 portrait', '80mm')
 * @param {Function} template.render - (menuData) => htmlString
 */
function registerMenuTemplate(template) {
    if (!template || !template.id || typeof template.render !== 'function') {
        console.error("Invalid menu template definition:", template);
        return;
    }
    MENU_TEMPLATES[template.id] = template;
}

function escapeMenuHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Collects and normalizes menu data for the current or specified sagra.
 * @param {Object} [options]
 * @returns {Object} Menu data structure
 */
function extractMenuData(options = {}) {
    const sagraName = (STATE.currentSagra ? STATE.currentSagra.name : '') || 'Menu Evento';
    const productsObj = STATE.products || {};
    const categoryMeta = STATE.categoryMeta || {};

    const categories = [];

    for (const [catName, prods] of Object.entries(productsObj)) {
        // Skip hidden categories if flag is set or if empty
        if (categoryMeta[catName] && categoryMeta[catName].hidden) continue;
        if (catName.trim().toLowerCase() === 'prodotti base') continue;

        // Filter out base-type products
        const validProducts = (prods || []).filter(p => p.type !== 'base');
        if (validProducts.length === 0) continue;

        categories.push({
            name: catName,
            products: validProducts.map(p => ({
                id: p.id,
                name: p.name,
                price: Number(p.price || 0)
            }))
        });
    }

    return {
        eventName: sagraName,
        logoUrl: 'images/logo.png',
        categories: categories
    };
}

/**
 * General function to render and trigger printing of the menu.
 * @param {string} [templateId='a4_modern_clean'] - Template ID to use
 * @param {Object} [customData] - Optional explicit data override
 */
async function printMenu(templateId = 'a4_modern_clean', customData = null) {
    const template = MENU_TEMPLATES[templateId] || MENU_TEMPLATES['a4_modern_clean'];
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

let selectedMenuTemplateId = localStorage.getItem('preferredMenuTemplate') || 'a4_modern_clean';

function openMenuTemplateModal() {
    const modal = document.getElementById('menu-template-modal');
    const listEl = document.getElementById('menu-templates-list');
    
    const templateKeys = Object.keys(MENU_TEMPLATES);
    if (templateKeys.length === 0) {
        showToast("Nessun template di stampa disponibile", "error");
        return;
    }

    if (!modal || !listEl) {
        return printMenu(selectedMenuTemplateId);
    }

    if (!MENU_TEMPLATES[selectedMenuTemplateId]) {
        selectedMenuTemplateId = templateKeys[0];
    }

    listEl.innerHTML = templateKeys.map(key => {
        const t = MENU_TEMPLATES[key];
        const isSel = (key === selectedMenuTemplateId);
        return `
            <div class="menu-template-card ${isSel ? 'selected' : ''}" onclick="selectMenuTemplate('${t.id}')">
                <input type="radio" name="menuTemplateChoice" value="${t.id}" class="menu-template-radio" ${isSel ? 'checked' : ''}>
                <div class="menu-template-info">
                    <span class="menu-template-name">${escapeMenuHtml(t.name)}</span>
                    <span class="menu-template-desc">${escapeMenuHtml(t.description || '')}</span>
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
        const radio = c.querySelector('input[type="radio"]');
        if (radio && radio.value === templateId) {
            radio.checked = true;
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

function confirmMenuPrint() {
    closeMenuTemplateModal();
    printMenu(selectedMenuTemplateId);
}

window.registerMenuTemplate = registerMenuTemplate;
window.MENU_TEMPLATES = MENU_TEMPLATES;
window.extractMenuData = extractMenuData;
window.printMenu = printMenu;
window.printCurrentMenu = () => printMenu('a4_modern_clean');
window.openMenuTemplateModal = openMenuTemplateModal;
window.selectMenuTemplate = selectMenuTemplate;
window.closeMenuTemplateModal = closeMenuTemplateModal;
window.confirmMenuPrint = confirmMenuPrint;
window.escapeMenuHtml = escapeMenuHtml;


