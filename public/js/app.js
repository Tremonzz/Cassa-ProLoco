let STATE = {
    currentSagra: null,
    products: {}, // grouped by category
    cart: [],
    history: []
};

// DOM Elements
const views = {
    auth: document.getElementById('view-auth'),
    login: document.getElementById('view-login'),
    editor: document.getElementById('view-editor'),
    pos: document.getElementById('view-pos')
};

const sagraListEl = document.getElementById('sagra-list');
const editorContainer = document.getElementById('editor-container');
const productsEl = document.getElementById('products-container');
const cartEl = document.getElementById('cart-items');
const totalEl = document.getElementById('total-amount');
const modalEl = document.getElementById('history-modal');
const historyListEl = document.getElementById('history-list');

// Dialog Elements
const dialogOverlay = document.getElementById('dialog-overlay');
const dialogTitle = document.getElementById('dialog-title');
const dialogMessage = document.getElementById('dialog-message');
const dialogInput = document.getElementById('dialog-input');
const dialogOk = document.getElementById('dialog-ok');
const dialogCancel = document.getElementById('dialog-cancel');

// --- GENERIC DIALOG ---
function showDialog(optsOrTitle, messageStr = '', isPrompt = false, isAlert = false, defaultValue = '') {
    let opts = {};
    if (typeof optsOrTitle === 'object' && optsOrTitle !== null) {
        opts = optsOrTitle;
    } else {
        opts = {
            title: optsOrTitle,
            message: messageStr,
            isPrompt: isPrompt,
            isAlert: isAlert,
            defaultValue: defaultValue
        };
    }

    const title = opts.title || 'Messaggio';
    const message = opts.message || '';
    const icon = opts.icon || (opts.isPrompt ? 'edit_note' : (opts.isDanger ? 'delete' : (opts.isAlert ? 'info' : 'help_outline')));
    const isDanger = !!opts.isDanger;
    const okText = opts.okText || 'Conferma';
    const cancelText = opts.cancelText || 'Annulla';

    return new Promise((resolve) => {
        // 1. Ensure Dialog Elements Exist (Auto-Repair)
        let dOverlay = document.getElementById('dialog-overlay');

        if (!dOverlay) {
            dOverlay = document.createElement('div');
            dOverlay.id = 'dialog-overlay';
            dOverlay.className = 'modal';
            dOverlay.style.zIndex = '99999'; // FORCE TOP
            dOverlay.innerHTML = `
                <div class="modal-content dialog-content" style="z-index:100000;">
                    <div class="dialog-header">
                        <span class="material-symbols-rounded dialog-header-icon" id="dialog-icon">help_outline</span>
                        <h3 id="dialog-title"></h3>
                    </div>
                    <p id="dialog-message" class="dialog-message"></p>
                    <input type="text" id="dialog-input" class="input-field dialog-input" style="display:none; width:100%; user-select: text !important; pointer-events: auto !important;">
                    <div class="dialog-actions">
                        <button id="dialog-cancel" class="btn-dialog-cancel">Annulla</button>
                        <button id="dialog-ok" class="btn-dialog-ok">Conferma</button>
                    </div>
                </div>
            `;
            document.body.appendChild(dOverlay);
        }

        // 2. Refresh References
        const dTitle = document.getElementById('dialog-title');
        const dMessage = document.getElementById('dialog-message');
        const dInput = document.getElementById('dialog-input');
        const dOk = document.getElementById('dialog-ok');
        const dCancel = document.getElementById('dialog-cancel');
        const dIcon = document.getElementById('dialog-icon');

        // 3. Setup Content & Icons
        dTitle.innerText = title;
        if (dMessage) dMessage.innerText = message;
        if (dInput) dInput.value = opts.defaultValue || '';
        if (dOk) dOk.innerText = okText;
        if (dCancel) dCancel.innerText = cancelText;

        if (dIcon) {
            dIcon.innerText = icon;
            if (isDanger) dIcon.classList.add('danger');
            else dIcon.classList.remove('danger');
        }

        if (dOk) {
            if (isDanger) dOk.classList.add('danger');
            else dOk.classList.remove('danger');
        }

        // Show/Hide Input
        if (opts.isPrompt) {
            dInput.style.display = 'block';
            setTimeout(() => {
                dInput.focus();
                if (opts.defaultValue) dInput.select();
            }, 100);
        } else {
            dInput.style.display = 'none';
        }

        // Show/Hide Cancel
        if (opts.isAlert) {
            dCancel.style.display = 'none';
        } else {
            dCancel.style.display = 'block';
        }

        // Show Modal
        dOverlay.style.display = 'flex';

        // 4. Handlers
        const cleanup = () => {
            dOk.onclick = null;
            dCancel.onclick = null;
            dInput.onkeydown = null;
            dOverlay.style.display = 'none';
        };

        dOk.onclick = () => {
            const val = opts.isPrompt ? dInput.value : true;
            if (opts.isPrompt && !val.trim()) return;
            cleanup();
            resolve(val);
        };

        dCancel.onclick = () => {
            cleanup();
            resolve(opts.isPrompt ? null : false);
        };

        dInput.onkeydown = (e) => {
            if (e.key === 'Enter') dOk.click();
            if (e.key === 'Escape') dCancel.click();
        };
    });
}

function showConfirm(titleOrMessage, messageStr = '', isDanger = false) {
    if (typeof titleOrMessage === 'object' && titleOrMessage !== null) {
        return showDialog(titleOrMessage);
    }
    if (!messageStr) {
        return showDialog({ title: "Conferma Operazione", message: titleOrMessage, isDanger });
    }
    return showDialog({ title: titleOrMessage, message: messageStr, isDanger });
}

function showPrompt(titleOrMessage, messageOrDefault = '', defaultValueStr = '') {
    if (typeof messageOrDefault === 'string' && defaultValueStr !== '') {
        return showDialog({ title: titleOrMessage, message: messageOrDefault, isPrompt: true, defaultValue: defaultValueStr });
    } else if (typeof messageOrDefault === 'string' && messageOrDefault !== '') {
        return showDialog({ title: titleOrMessage, message: messageOrDefault, isPrompt: true, defaultValue: '' });
    } else {
        return showDialog({ title: "Nuovo Evento", message: titleOrMessage, isPrompt: true, defaultValue: '' });
    }
}

function showAlert(message) {
    return showDialog({ title: "Avviso", message, isAlert: true });
}


// --- APP INIT ---
async function init() {
    // Check password existence
    const savedPassword = localStorage.getItem('appPassword');
    const authContainer = document.getElementById('auth-input-container');

    if (!savedPassword) {
        // No password set -> Hide input
        authContainer.style.display = 'none';
        // Auto-focus button not needed but cleaner UI
    } else {
        authContainer.style.display = 'flex'; // or block/flex based on css, form-group is usually block or flex column
    }

    // Add change calculator input listener
    const cashInput = document.getElementById('cash-received');
    if (cashInput) {
        cashInput.addEventListener('input', updateChange);
    }

    initKeyboardShortcuts();
    showView('auth');
    checkAppUpdateSilent();
}

function initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        // 1. Check if any modal or dialog is open
        const dialogOverlay = document.getElementById('dialog-overlay');
        const isDialogVisible = dialogOverlay && (dialogOverlay.style.display === 'flex' || getComputedStyle(dialogOverlay).display === 'flex');

        if (isDialogVisible) {
            return;
        }

        const modals = ['history-modal', 'stats-modal', 'settings-modal', 'sagra-options-modal', 'receipt-preview-modal'];
        const openModalId = modals.find(id => {
            const el = document.getElementById(id);
            return el && (el.style.display === 'flex' || getComputedStyle(el).display === 'flex');
        });

        if (openModalId) {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (openModalId === 'history-modal') closeHistory();
                else if (openModalId === 'stats-modal') closeStats();
                else if (openModalId === 'settings-modal') closeSettings();
                else if (openModalId === 'sagra-options-modal') closeSagraOptions();
                else if (openModalId === 'receipt-preview-modal') closeReceiptPreviewModal();
            }
            return;
        }

        // 2. POS View Shortcuts
        const isPosView = views.pos && views.pos.classList.contains('active');
        if (!isPosView) return;

        // F1 -> Storico Ordini
        if (e.key === 'F1') {
            e.preventDefault();
            showHistory();
            return;
        }

        // F2 -> Statistiche Evento
        if (e.key === 'F2') {
            e.preventDefault();
            showStats();
            return;
        }

        // F3 -> Modifica Menu
        if (e.key === 'F3') {
            e.preventDefault();
            showEditor();
            return;
        }

        // Escape -> Svuota Carrello
        if (e.key === 'Escape') {
            e.preventDefault();
            clearCart();
            return;
        }

        // Enter -> Stampa / Conferma Ordine
        if (e.key === 'Enter') {
            const activeEl = document.activeElement;
            const isCashInput = activeEl && activeEl.id === 'cash-received';
            const isOtherInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);

            if (isCashInput || !isOtherInput) {
                e.preventDefault();
                printOrder();
            }
            return;
        }

        // Auto-focus cash input if typing a digit without active input
        const isDigit = (e.key >= '0' && e.key <= '9') || e.key === '.' || e.key === ',';
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        const isInputFocused = activeTag === 'INPUT' || activeTag === 'TEXTAREA';

        if (isDigit && !isInputFocused) {
            const cashInput = document.getElementById('cash-received');
            if (cashInput) {
                cashInput.focus();
            }
        }
    });
}

// --- AUTH LOGIC ---
const authPasswordInput = document.getElementById('auth-password');
const authErrorBanner = document.getElementById('auth-error-banner');

function togglePasswordVisibility() {
    const pwdInput = document.getElementById('auth-password');
    const toggleIcon = document.getElementById('auth-password-toggle-icon');
    if (!pwdInput || !toggleIcon) return;

    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        toggleIcon.innerText = 'visibility_off';
    } else {
        pwdInput.type = 'password';
        toggleIcon.innerText = 'visibility';
    }
}
window.togglePasswordVisibility = togglePasswordVisibility;

function checkLogin() {
    const savedPassword = localStorage.getItem('appPassword') || "";
    const pwdInput = document.getElementById('auth-password');
    const errBanner = document.getElementById('auth-error-banner');
    const inputPassword = pwdInput ? pwdInput.value : "";

    if (savedPassword === "" || inputPassword === savedPassword) {
        // Login Success
        if (pwdInput) pwdInput.value = '';
        if (errBanner) errBanner.classList.remove('visible');
        loadSagras();
        showView('login');
    } else {
        if (errBanner) errBanner.classList.add('visible');
        if (pwdInput) {
            pwdInput.value = '';
            pwdInput.focus();
            const wrapper = pwdInput.closest('.password-input-wrapper');
            if (wrapper) {
                wrapper.classList.add('error');
                setTimeout(() => wrapper.classList.remove('error'), 600);
            }
        }
    }
}

// --- VIEW NAVIGATION ---
function showView(viewName) {
    Object.values(views).forEach(el => el.classList.remove('active'));
    if (views[viewName]) {
        views[viewName].classList.add('active');
    }
}

function showLogin() {
    STATE.currentSagra = null;
    loadSagras();
    showView('login');
}

// --- SAGRA MANAGEMENT ---
let showArchivedState = false;

async function loadSagras() {
    const res = await fetch('/api/sagras');
    const allSagras = await res.json();

    const activeSagras = allSagras.filter(s => s.status !== 'archived');
    const archivedSagras = allSagras.filter(s => s.status === 'archived');

    let html = '';

    // Active List
    const titleEl = views.login.querySelector('.login-title') || views.login.querySelector('h1');
    if (activeSagras.length === 0 && archivedSagras.length === 0) {
        if (titleEl) titleEl.innerText = "Benvenuto! Crea il tuo primo Evento.";
    } else {
        if (titleEl) titleEl.innerText = "Gestione Ordini";
    }

    html += activeSagras.map(s => renderSagraCard(s, false)).join('');

    // Archived List
    if (archivedSagras.length > 0) {
        html += `
      <div class="archived-section">
        <button class="btn-toggle-archive" onclick="toggleArchived()">
          ${showArchivedState ? 'Nascondi Archiviate' : 'Mostra Archiviate'} (${archivedSagras.length})
        </button>
        <div class="archived-list ${showArchivedState ? 'visible' : ''}">
          ${archivedSagras.map(s => renderSagraCard(s, true)).join('')}
        </div>
      </div>
    `;
    }

    sagraListEl.innerHTML = html;
}

function toggleArchived() {
    showArchivedState = !showArchivedState;
    loadSagras();
}

function renderSagraCard(s, isArchived) {
    const safeName = encodeURIComponent(s.name);
    const dateFormatted = s.created_at ? new Date(s.created_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    }) : '';

    return `
    <div class="sagra-card ${isArchived ? 'is-archived' : ''}" onclick="selectSagra(${s.id}, '${safeName}')">
      <div class="sagra-card-content">
        <div class="sagra-card-info">
          <span class="sagra-card-title">${s.name} ${isArchived ? '(Archiviata)' : ''}</span>
          ${dateFormatted ? `<span class="sagra-card-date"><span class="material-symbols-rounded" style="font-size: 0.85rem;">calendar_today</span> Creato il ${dateFormatted}</span>` : ''}
        </div>
      </div>
      <div class="sagra-actions" onclick="event.stopPropagation()">
        <button class="sagra-action-btn btn-settings" title="Opzioni Evento" onclick="openSagraOptions(event, ${s.id}, '${safeName}', ${isArchived})">
          <span class="material-symbols-rounded">settings</span>
        </button>
      </div>
    </div>
  `;
}

function openSagraOptions(event, id, nameEncoded, isArchived) {
    if (event) event.stopPropagation();
    const sagraName = decodeURIComponent(nameEncoded);

    const modalEl = document.getElementById('sagra-options-modal');
    const titleEl = document.getElementById('sagra-options-title-text');
    const bodyEl = document.getElementById('sagra-options-body');

    if (titleEl) titleEl.innerText = sagraName;

    if (bodyEl) {
        bodyEl.innerHTML = `
            <button class="sagra-option-item" onclick="renameSagra(${id}, '${nameEncoded}')">
                <span class="material-symbols-rounded">edit</span>
                <span>Rinomina Evento</span>
            </button>
            <button class="sagra-option-item" onclick="duplicateSagra(${id})">
                <span class="material-symbols-rounded">content_copy</span>
                <span>Duplica Evento</span>
            </button>
            <button class="sagra-option-item" onclick="${isArchived ? `unarchiveSagra(${id})` : `archiveSagra(${id})`}">
                <span class="material-symbols-rounded">${isArchived ? 'unarchive' : 'inventory_2'}</span>
                <span>${isArchived ? 'Ripristina Evento' : 'Archivia Evento'}</span>
            </button>
            <button class="sagra-option-item danger" onclick="deleteSagra(${id})">
                <span class="material-symbols-rounded">delete</span>
                <span>Elimina Evento</span>
            </button>
        `;
    }

    if (modalEl) modalEl.style.display = 'flex';
}

function closeSagraOptions() {
    const modalEl = document.getElementById('sagra-options-modal');
    if (modalEl) modalEl.style.display = 'none';
}
window.openSagraOptions = openSagraOptions;
window.closeSagraOptions = closeSagraOptions;

async function renameSagra(id, currentNameEncoded) {
    closeSagraOptions();
    const currentName = decodeURIComponent(currentNameEncoded);
    const newName = await showPrompt("Rinomina Evento", "Inserisci il nuovo nome dell'evento:", currentName);
    if (!newName || !newName.trim() || newName.trim() === currentName) return;

    try {
        const res = await fetch(`/api/sagras/${id}/rename`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.trim() })
        });
        if (res.ok) {
            showToast("Evento rinominato con successo!", "success");
            loadSagras();
        } else {
            const err = await res.text();
            showToast("Errore rinomina: " + err, "error");
        }
    } catch (e) {
        showToast("Errore di connessione", "error");
    }
}
window.renameSagra = renameSagra;

async function duplicateSagra(eOrId, id) {
    const targetId = typeof eOrId === 'number' ? eOrId : id;
    if (eOrId && typeof eOrId === 'object' && eOrId.stopPropagation) eOrId.stopPropagation();
    closeSagraOptions();
    try {
        const res = await fetch(`/api/sagras/${targetId}/duplicate`, { method: 'POST' });
        if (res.ok) {
            showToast("Evento duplicato con successo!", "success");
            loadSagras();
        } else {
            const err = await res.text();
            showToast("Errore durante la duplicazione: " + err, "error");
        }
    } catch (err) {
        showToast("Errore di connessione", "error");
    }
}
window.duplicateSagra = duplicateSagra;

async function archiveSagra(eOrId, id) {
    const targetId = typeof eOrId === 'number' ? eOrId : id;
    if (eOrId && typeof eOrId === 'object' && eOrId.stopPropagation) eOrId.stopPropagation();
    closeSagraOptions();

    const confirmed = await showDialog({
        title: "Archivia Evento",
        message: "Sei sicuro di voler archiviare questo evento? Potrai ripristinarlo in qualsiasi momento dalla sezione archiviati.",
        icon: "inventory_2",
        okText: "Archivia"
    });
    if (!confirmed) return;

    await fetch(`/api/sagras/${targetId}/archive`, { method: 'PUT' });
    showToast("Evento archiviato", "info");
    loadSagras();
}

async function unarchiveSagra(eOrId, id) {
    const targetId = typeof eOrId === 'number' ? eOrId : id;
    if (eOrId && typeof eOrId === 'object' && eOrId.stopPropagation) eOrId.stopPropagation();
    closeSagraOptions();

    const confirmed = await showDialog({
        title: "Ripristina Evento",
        message: "Vuoi riportare questo evento tra quelli attivi?",
        icon: "unarchive",
        okText: "Ripristina"
    });
    if (!confirmed) return;

    await fetch(`/api/sagras/${targetId}/unarchive`, { method: 'PUT' });
    showToast("Evento ripristinato con successo", "success");
    loadSagras();
}

async function deleteSagra(eOrId, id) {
    const targetId = typeof eOrId === 'number' ? eOrId : id;
    if (eOrId && typeof eOrId === 'object' && eOrId.stopPropagation) eOrId.stopPropagation();
    closeSagraOptions();

    const confirmed = await showDialog({
        title: "Elimina Evento",
        message: "Sei sicuro di voler eliminare definitivamente questo evento? Verranno rimossi anche gli ordini, il menu e le relative statistiche.",
        icon: "delete",
        isDanger: true,
        okText: "Elimina"
    });
    if (!confirmed) return;

    await fetch(`/api/sagras/${targetId}`, { method: 'DELETE' });
    showToast("Evento eliminato", "warning");
    loadSagras();
}

async function createNewSagra() {
    const name = await showPrompt("Inserisci il nome del nuovo evento:");
    if (!name) return;

    try {
        const res = await fetch('/api/sagras', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const newSagra = await res.json();

        // Select it directly
        selectSagra(newSagra.id, newSagra.name);

        // No full reload needed if state is managed well, but safe to reload list
        // window.location.reload(); 
    } catch (e) {
        showAlert("Errore: " + e.message);
    }
}

async function selectSagra(id, name) {
    try {
        const decodedName = decodeURIComponent(name);
        STATE.currentSagra = { id, name: decodedName };
        document.getElementById('pos-sagra-name').innerText = decodedName;
        await loadSagraResources();
        showView('pos');
    } catch (e) {
        console.error("selectSagra Error:", e);
        alert("Errore apertura evento: " + e.message);
    }
}

async function loadSagraResources() {
    const res = await fetch(`/api/sagras/${STATE.currentSagra.id}/products`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    if (data && data.products) {
        STATE.products = data.products;
        STATE.categoryMeta = data.meta || {};
    } else {
        STATE.products = data;
        STATE.categoryMeta = {};
    }
    STATE.cart = [];
    const cashInput = document.getElementById('cash-received');
    if (cashInput) cashInput.value = '';
    renderProducts();
    renderCart();
}

// --- MENU EDITOR ---
function switchToEditor() {
    if (STATE.currentSagra) {
        document.getElementById('editor-title').innerText = `Modifica Menù ${STATE.currentSagra.name}`;
    }
    renderEditor();
    showView('editor');
}

function toggleHideCategory(btn) {
    const sec = btn.closest('.editor-section');
    if (!sec) return;

    const isHidden = sec.classList.toggle('is-hidden-category');
    const iconEl = btn.querySelector('.material-symbols-rounded');
    const textEl = btn.querySelector('.hide-text');

    if (isHidden) {
        if (iconEl) iconEl.innerText = 'visibility';
        if (textEl) textEl.innerText = 'Mostra Categoria';
    } else {
        if (iconEl) iconEl.innerText = 'visibility_off';
        if (textEl) textEl.innerText = 'Nascondi Categoria';
    }
}
window.toggleHideCategory = toggleHideCategory;

function renderEditor() {
    const listEl = document.getElementById('editor-sections-list') || editorContainer;
    listEl.innerHTML = '';

    const categories = Object.keys(STATE.products);

    // Guarantee Cibo and Bevande always exist at top
    if (!categories.includes('Cibo')) categories.unshift('Cibo');
    if (!categories.includes('Bevande')) {
        const ciboIdx = categories.indexOf('Cibo');
        categories.splice(ciboIdx + 1, 0, 'Bevande');
    }

    categories.forEach(catName => {
        const prods = STATE.products[catName] || [];
        const meta = STATE.categoryMeta ? STATE.categoryMeta[catName] : null;
        let isHidden = false;
        if (meta && meta.is_hidden === 1) {
            isHidden = true;
        } else if (prods.length > 0 && prods[0].category_is_hidden === 1) {
            isHidden = true;
        }
        addCategoryUI(catName, prods, isHidden);
    });
}

function addCategoryUI(name = '', products = [], isHidden = false) {
    const listEl = document.getElementById('editor-sections-list') || editorContainer;
    const div = document.createElement('div');
    div.className = `editor-section ${isHidden ? 'is-hidden-category' : ''}`;

    const trimmedName = name.trim();
    const isCibo = (trimmedName === 'Cibo');
    const isBevande = (trimmedName === 'Bevande');
    const isFixedCategory = isCibo || isBevande;

    let categoryIcon = 'category';
    if (isCibo) {
        categoryIcon = 'restaurant';
    } else if (isBevande) {
        categoryIcon = 'local_bar';
    }

    let headerTitleHTML = '';
    let actionBtnHTML = '';

    if (isFixedCategory) {
        headerTitleHTML = `
            <span class="material-symbols-rounded" style="font-size: 1.4rem; color: var(--primary);">${categoryIcon}</span>
            <span class="fixed-cat-title-text" style="font-size: 1.15rem; font-weight: 700; color: var(--primary);">${trimmedName}</span>
            <input type="hidden" class="cat-name-input" value="${trimmedName}">
        `;
        actionBtnHTML = `
            <button type="button" class="btn-hide-cat" onclick="toggleHideCategory(this)">
                <span class="material-symbols-rounded" style="font-size: 1.1rem;">${isHidden ? 'visibility' : 'visibility_off'}</span>
                <span class="hide-text">${isHidden ? 'Mostra Categoria' : 'Nascondi Categoria'}</span>
            </button>
        `;
    } else {
        headerTitleHTML = `
            <span class="material-symbols-rounded" style="font-size: 1.4rem; color: var(--primary);">${categoryIcon}</span>
            <input type="text" class="cat-name-input" placeholder="Nome Categoria (es. Dolci)" value="${name}">
        `;
        actionBtnHTML = `
            <button type="button" class="btn-del-cat" onclick="this.closest('.editor-section').remove()">
                <span class="material-symbols-rounded" style="font-size: 1.1rem;">delete</span> Elimina Categoria
            </button>
        `;
    }

    div.innerHTML = `
      <div class="cat-row">
        <div class="cat-input-group">
          ${headerTitleHTML}
        </div>
        ${actionBtnHTML}
      </div>

      <div class="product-table-header">
        <span class="col-name">Nome Prodotto</span>
        <span class="col-price">Prezzo (€)</span>
        <span class="col-qty">Scorta (Vuoto = ∞)</span>
        <span class="col-action"></span>
      </div>

      <div class="products-list"></div>

      <div class="editor-card-footer">
        <button type="button" class="btn-add-product" onclick="addProductUI(this.parentElement.previousElementSibling)">
          <span class="material-symbols-rounded" style="font-size: 1.1rem;">add</span> Aggiungi Prodotto
        </button>
      </div>
    `;
    listEl.appendChild(div);

    const pList = div.querySelector('.products-list');
    if (products.length > 0) {
        products.forEach(p => addProductUI(pList, p.name, p.price, p.quantity));
    } else {
        addProductUI(pList);
    }
}

function addProductUI(container, name = '', price = '', quantity = '') {
    const row = document.createElement('div');
    row.className = 'product-row';
    const qtyVal = (quantity !== null && quantity !== undefined) ? quantity : '';
    row.innerHTML = `
      <input type="text" class="input-field col-name" placeholder="es. Panino con salsiccia" value="${name}">
      <input type="number" class="input-field col-price" placeholder="0.00" value="${price}" step="0.10" min="0">
      <input type="number" class="input-field col-qty" placeholder="Illimitata" value="${qtyVal}" min="0" title="Lascia vuoto per scorte illimitate">
      <button type="button" class="btn-del-product" title="Elimina Prodotto" onclick="this.parentElement.remove()">
        <span class="material-symbols-rounded" style="font-size: 1.2rem;">delete_outline</span>
      </button>
    `;
    container.appendChild(row);
}

async function saveMenu() {
    if (!STATE.currentSagra) return;

    const sections = document.querySelectorAll('.editor-section');
    const payload = { categories: [] };

    sections.forEach(sec => {
        let catName = '';
        const nameInput = sec.querySelector('.cat-name-input');
        if (nameInput) {
            catName = nameInput.value.trim();
        } else {
            const titleEl = sec.querySelector('.fixed-cat-title-text');
            if (titleEl) catName = titleEl.innerText.trim();
        }

        if (!catName) return;

        const isHidden = sec.classList.contains('is-hidden-category');
        const products = [];

        // Always preserve and save products even when category is hidden
        sec.querySelectorAll('.product-row').forEach(row => {
            const inputs = row.querySelectorAll('input');
            const pName = inputs[0].value.trim();
            const pPrice = parseFloat(inputs[1].value);
            const pQtyStr = inputs[2].value.trim();

            if (pName && !isNaN(pPrice)) {
                let pQty = null;
                if (pQtyStr && !isNaN(parseInt(pQtyStr))) {
                    const parsed = parseInt(pQtyStr);
                    if (parsed > 0) pQty = parsed;
                }
                products.push({ name: pName, price: pPrice, quantity: pQty });
            }
        });

        payload.categories.push({ name: catName, is_hidden: isHidden, products });
    });

    try {
        const res = await fetch(`/api/sagras/${STATE.currentSagra.id}/menu`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            showToast("Menu salvato con successo!", "success");
            await loadSagraResources();
            showView('pos');
        } else {
            showToast("Errore durante il salvataggio del menu", "error");
        }
    } catch (e) {
        console.error(e);
        showToast("Errore di comunicazione col server", "error");
    }
}

function setQuickCash(amount) {
    const cashInput = document.getElementById('cash-received');
    if (!cashInput) return;

    if (amount === 'exact') {
        const total = STATE.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        cashInput.value = total > 0 ? total.toFixed(2) : '';
    } else {
        cashInput.value = parseFloat(amount).toFixed(2);
    }

    updateChange();
}
window.setQuickCash = setQuickCash;

// --- POS LOGIC ---
function renderProducts() {
    productsEl.innerHTML = '';

    const categories = Object.entries(STATE.products);
    if (categories.length === 0) {
        productsEl.innerHTML = '<div style="padding:20px; text-align:center; color: var(--text-light);">Nessun prodotto. <br>Clicca "Modifica Menu" per aggiungere.</div>';
        return;
    }

    let renderedCount = 0;

    for (const [category, products] of categories) {
        // Skip hidden category in POS Cassa view
        const meta = STATE.categoryMeta ? STATE.categoryMeta[category] : null;
        const isCatHidden = (meta && meta.is_hidden === 1) || (products.length > 0 && products[0].category_is_hidden === 1);
        if (isCatHidden) continue;

        // Skip empty category (0 products) in POS Cassa view
        if (!products || products.length === 0) continue;

        renderedCount++;

        const trimmedName = category.trim();
        let catIcon = 'category';
        if (trimmedName === 'Cibo') catIcon = 'restaurant';
        if (trimmedName === 'Bevande') catIcon = 'local_bar';

        const section = document.createElement('div');
        section.className = 'category-section';

        section.innerHTML = `
      <div class="category-title">
        <span class="material-symbols-rounded" style="font-size: 1.3rem;">${catIcon}</span>
        ${category}
      </div>
      <div class="product-grid">
        ${products.map(p => {
            const hasLimit = (p.quantity !== null && p.quantity !== undefined);

            // Calculate current quantity of this product already in cart
            const inCartItem = STATE.cart.find(item => item.id === p.id || item.name === p.name);
            const inCartQty = inCartItem ? inCartItem.quantity : 0;

            // Real-time remaining available stock
            const remainingStock = hasLimit ? (p.quantity - inCartQty) : null;
            const isOOS = hasLimit && remainingStock <= 0;
            const qtyLabel = hasLimit ? `<span class="qty-badge ${isOOS ? 'oos' : ''}">${Math.max(0, remainingStock)}</span>` : '';

            return `
          <button class="product-btn" ${isOOS ? 'disabled' : ''} onclick="addToCart(${p.id})">
            ${qtyLabel}
            <span class="product-name">${p.name}</span>
            <span class="product-price">€ ${p.price.toFixed(2)}</span>
          </button>
        `}).join('')}
      </div>
    `;
        productsEl.appendChild(section);
    }

    if (renderedCount === 0) {
        productsEl.innerHTML = '<div style="padding:20px; text-align:center; color: var(--text-light);">Nessun prodotto disponibile in cassa. <br>Clicca "Modifica Menu" per aggiungere.</div>';
    }
}

function addToCart(productId) {
    let foundProduct = null;
    let foundCategory = 'Altro';

    for (const [cat, prods] of Object.entries(STATE.products)) {
        const prod = prods.find(p => p.id === productId);
        if (prod) {
            foundProduct = prod;
            foundCategory = cat;
            break;
        }
    }

    if (!foundProduct) return;

    const maxQty = foundProduct.quantity;
    const existing = STATE.cart.find(i => i.id === productId || i.name === foundProduct.name);
    let currentCartQty = existing ? existing.quantity : 0;

    // Check Limit against original DB stock
    if (maxQty !== null && maxQty !== undefined && (currentCartQty + 1) > maxQty) {
        showToast(`Scorte esaurite per: ${foundProduct.name}`, "error");
        return;
    }

    if (existing) {
        existing.id = foundProduct.id; // Ensure ID is present
        existing.quantity++;
    } else {
        STATE.cart.push({
            id: foundProduct.id,
            name: foundProduct.name,
            price: foundProduct.price,
            quantity: 1,
            category: foundCategory
        });
    }

    renderCart();
    renderProducts();
}

function removeFromCart(idx) {
    STATE.cart.splice(idx, 1);
    renderCart();
    renderProducts();
}

function renderCart() {
    cartEl.innerHTML = '';
    let total = 0;

    if (STATE.cart.length === 0) {
        cartEl.innerHTML = `
            <div class="empty-cart-state">
                <span class="material-symbols-rounded">shopping_cart</span>
                <p>Carrello vuoto</p>
                <small>Seleziona i prodotti a sinistra per iniziare l'ordine</small>
            </div>
        `;
        totalEl.innerText = `€ 0.00`;
        updateChange();
        return;
    }

    STATE.cart.forEach((item, idx) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        const div = document.createElement('div');
        div.className = 'order-item';

        div.innerHTML = `
          <div class="order-item-controls">
            <button type="button" class="btn-cart-action btn-cart-remove" title="Rimuovi dal carrello" onclick="removeFromCart(${idx})">
              <span class="material-symbols-rounded" style="font-size: 0.95rem;">close</span>
            </button>
            <button type="button" class="btn-cart-action btn-cart-decrease" title="Riduci di 1" onclick="decreaseQuantity(${idx})">
              <span class="material-symbols-rounded" style="font-size: 0.95rem;">remove</span>
            </button>
            <span class="order-item-qty">${item.quantity}</span>
          </div>
          <div class="order-item-info">
            <span class="order-item-name">${item.name}</span>
            <span class="order-item-unit-price">€ ${item.price.toFixed(2)} cad.</span>
          </div>
          <span class="order-item-total">€${itemTotal.toFixed(2)}</span>
        `;
        cartEl.appendChild(div);
    });

    totalEl.innerText = `€ ${total.toFixed(2)}`;
    updateChange();
}

function updateChange() {
    const total = STATE.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cashInput = document.getElementById('cash-received');
    const changeEl = document.getElementById('change-amount');
    const changeRow = changeEl ? changeEl.closest('.change-row') : null;
    
    if (!cashInput || !changeEl) return;
    
    const cashReceived = parseFloat(cashInput.value);
    if (isNaN(cashReceived) || cashReceived <= 0) {
        changeEl.innerText = '€ 0.00';
        if (changeRow) changeRow.classList.remove('has-change');
        return;
    }
    
    const change = cashReceived - total;
    if (change >= 0) {
        changeEl.innerText = `€ ${change.toFixed(2)}`;
        if (changeRow) changeRow.classList.add('has-change');
    } else {
        changeEl.innerText = '€ 0.00';
        if (changeRow) changeRow.classList.remove('has-change');
    }
}

function decreaseQuantity(idx) {
    if (STATE.cart[idx].quantity > 1) {
        STATE.cart[idx].quantity--;
    } else {
        STATE.cart.splice(idx, 1);
    }
    renderCart();
    renderProducts();
}

async function clearCart() {
    if (STATE.cart.length === 0) return;
    if (await showConfirm("Svuotare il carrello?")) {
        STATE.cart = [];
        const cashInput = document.getElementById('cash-received');
        if (cashInput) cashInput.value = '';
        renderCart();
        renderProducts();
    }
}


async function printOrder() {
    if (STATE.cart.length === 0) return showToast("Il carrello è vuoto", "error");
    const total = STATE.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    // Get stored printer name and template
    const printerName = localStorage.getItem('thermalPrinterName');
    const template = localStorage.getItem('receiptTemplate') || 'compact';

        const payload = {
            sagraId: STATE.currentSagra.id,
            items: STATE.cart,
            total: total,
            printerName: printerName,
            template: template,
            testMode: (localStorage.getItem('appTestMode') === 'true')
        };

        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (res.ok && data.success) {
                if (data.testMode && data.preview) {
                    showReceiptPreviewModal(data.preview);
                } else if (data.warning) {
                    showAlert(`Nota: ${data.warning}`);
                } else {
                    console.log(`Ordine #${data.orderId} Stampato!`);
                }

                STATE.cart = [];
                const cashInput = document.getElementById('cash-received');
                if (cashInput) cashInput.value = '';
                renderCart();

                // Refresh Inventory from Server
                await loadSagraResources();
                renderProducts();
            } else {
            // Error (likely inventory)
            const msg = data.error || 'Sconosciuto';
            alert('Errore: ' + msg);
        }
    } catch (e) {
        console.error(e);
        alert('Errore di connessione');
    }
}

async function reprintOrderFromHistory(orderId) {
    const order = STATE.history.find(o => o.id === orderId || o.seq === orderId);
    if (!order) return showToast("Ordine non trovato", "error");

    const printerName = localStorage.getItem('thermalPrinterName');
    const template = localStorage.getItem('receiptTemplate') || 'compact';

    const payload = {
        sagraId: STATE.currentSagra.id,
        items: order.items,
        total: order.total,
        orderId: order.seq || order.id,
        printerName: printerName,
        template: template,
        isReprint: true,
        testMode: (localStorage.getItem('appTestMode') === 'true')
    };

    try {
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok && data.success) {
            if (data.testMode && data.preview) {
                showReceiptPreviewModal(data.preview);
            } else {
                showToast(`Ristampato Ordine #${order.seq || order.id}`, "success");
            }
        } else {
            showToast(data.error || "Errore durante la ristampa", "error");
        }
    } catch (e) {
        showToast("Errore di connessione", "error");
    }
}
window.reprintOrderFromHistory = reprintOrderFromHistory;

async function showHistory() {
    if (!STATE.currentSagra) return;

    try {
        const res = await fetch(`/api/history?sagraId=${STATE.currentSagra.id}`);
        STATE.history = await res.json();

        const summaryBarEl = document.getElementById('history-summary-bar');
        const historyListEl = document.getElementById('history-list');

        if (!STATE.history || STATE.history.length === 0) {
            if (summaryBarEl) summaryBarEl.innerHTML = '';
            if (historyListEl) historyListEl.innerHTML = '<div class="empty-history-state"><span class="material-symbols-rounded">history</span><p>Nessun ordine nello storico</p></div>';
        } else {
            const totalRevenue = STATE.history.reduce((sum, o) => sum + (o.total || 0), 0);
            const totalOrders = STATE.history.length;

            if (summaryBarEl) {
                summaryBarEl.innerHTML = `
                    <div class="history-summary-pill">
                        <span class="material-symbols-rounded">receipt_long</span>
                        <span>Ordini Totali: <b>${totalOrders}</b></span>
                    </div>
                    <div class="history-summary-pill highlight">
                        <span class="material-symbols-rounded">payments</span>
                        <span>Incasso Totale: <b>€ ${totalRevenue.toFixed(2)}</b></span>
                    </div>
                `;
            }

            if (historyListEl) {
                // Reverse order so most recent is first
                const displayOrders = [...STATE.history].reverse();

                historyListEl.innerHTML = displayOrders.map(o => {
                    const formattedDate = new Date(o.created_at).toLocaleString('it-IT', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit'
                    });

                    return `
                      <div class="history-card">
                        <div class="history-card-header">
                          <div class="history-card-info">
                            <span class="history-order-badge">#${o.seq || o.id}</span>
                            <span class="history-order-date">
                              <span class="material-symbols-rounded" style="font-size: 1rem;">schedule</span>
                              ${formattedDate}
                            </span>
                          </div>
                          <div style="display:flex; align-items:center; gap: 10px;">
                            <span class="history-order-total">€ ${o.total.toFixed(2)}</span>
                            <button type="button" class="btn-reprint-order" onclick="reprintOrderFromHistory(${o.id})" title="Ristampa Scontrino">
                              <span class="material-symbols-rounded" style="font-size: 0.95rem;">print</span> Ristampa
                            </button>
                          </div>
                        </div>
                        <div class="history-card-body">
                          ${o.items.map(i => `
                            <div class="history-item-row">
                              <span class="history-item-qty">${i.quantity}x</span>
                              <span class="history-item-name">${i.name}</span>
                              <span class="history-item-price">€ ${(i.price * i.quantity).toFixed(2)}</span>
                            </div>
                          `).join('')}
                        </div>
                      </div>
                    `;
                }).join('');
            }
        }

        const modalEl = document.getElementById('history-modal');
        if (modalEl) modalEl.style.display = 'flex';
    } catch (e) {
        console.error(e);
        showToast("Errore durante il recupero dello storico", "error");
    }
}

function exportData() {
    window.location.href = `/api/export?sagraId=${STATE.currentSagra.id}`;
}

const statsModalEl = document.getElementById('stats-modal');

async function showStats() {
    if (!STATE.currentSagra) return;

    try {
        const res = await fetch(`/api/stats?sagraId=${STATE.currentSagra.id}`);
        const data = await res.json();

        const revEl = document.getElementById('stat-revenue');
        const ordEl = document.getElementById('stat-orders');
        const avgEl = document.getElementById('stat-avg-order');

        if (revEl) revEl.innerText = `€ ${data.totalRevenue.toFixed(2)}`;
        if (ordEl) ordEl.innerText = data.ordersCount;

        const avgOrder = data.ordersCount > 0 ? (data.totalRevenue / data.ordersCount) : 0;
        if (avgEl) avgEl.innerText = `€ ${avgOrder.toFixed(2)}`;

        const topContainer = document.getElementById('top-products');
        if (!topContainer) return;

        if (!data.topItems || data.topItems.length === 0) {
            topContainer.innerHTML = '<div class="empty-stats-state"><span class="material-symbols-rounded">bar_chart</span><p>Nessun dato di vendita disponibile.</p></div>';
        } else {
            // Group items by category using STATE.products
            const categoryGroups = {};

            // Initialize categories from STATE.products to maintain menu order
            if (STATE.products) {
                for (const catName of Object.keys(STATE.products)) {
                    categoryGroups[catName] = [];
                }
            }

            data.topItems.forEach(item => {
                let matchedCat = 'Altro';
                if (STATE.products) {
                    for (const [catName, prods] of Object.entries(STATE.products)) {
                        if (prods.some(p => p.name === item.product_name)) {
                            matchedCat = catName;
                            break;
                        }
                    }
                }
                if (!categoryGroups[matchedCat]) categoryGroups[matchedCat] = [];
                categoryGroups[matchedCat].push(item);
            });

            let html = '';
            for (const [catName, items] of Object.entries(categoryGroups)) {
                if (items.length === 0) continue; // Skip empty categories in stats

                const trimmed = catName.trim();
                let catIcon = 'category';
                if (trimmed === 'Cibo') catIcon = 'restaurant';
                if (trimmed === 'Bevande') catIcon = 'local_bar';

                html += `
                    <div class="stats-category-group">
                        <div class="stats-category-title">
                            <span class="material-symbols-rounded" style="font-size: 1.2rem;">${catIcon}</span>
                            ${catName}
                        </div>
                        <div class="top-products-list">
                            ${items.map(item => `
                                <div class="top-product-item">
                                    <span class="top-product-name">${item.product_name}</span>
                                    <div class="top-product-right">
                                        <span class="top-qty-pill"><b>${item.qty}</b> venduti</span>
                                        <span class="top-revenue-tag">€ ${item.revenue.toFixed(2)}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            topContainer.innerHTML = html || '<div class="empty-stats-state"><span class="material-symbols-rounded">bar_chart</span><p>Nessun dato di vendita disponibile.</p></div>';
        }

        statsModalEl.style.display = 'flex';
    } catch (e) {
        console.error(e);
        showToast("Errore durante il caricamento delle statistiche", "error");
    }
}

function closeStats() {
    statsModalEl.style.display = 'none';
}

function closeHistory() {
    modalEl.style.display = 'none';
}

window.selectSagra = selectSagra;
window.createNewSagra = createNewSagra;
window.archiveSagra = archiveSagra;
window.unarchiveSagra = unarchiveSagra;
window.deleteSagra = deleteSagra;
window.toggleArchived = toggleArchived;
window.showLogin = showLogin;
window.switchToEditor = switchToEditor;
window.saveMenu = saveMenu;
window.addCategoryUI = addCategoryUI;
window.addProductUI = addProductUI;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.decreaseQuantity = decreaseQuantity;
window.clearCart = clearCart;
window.printOrder = printOrder;
window.showHistory = showHistory;
window.exportData = exportData;
window.closeHistory = closeHistory;
window.showStats = showStats;
window.closeStats = closeStats;
// --- CUSTOM SELECT DROPDOWN COMPONENT ---
function syncCustomSelect(selectId) {
    const selectEl = document.getElementById(selectId);
    if (!selectEl) return;

    let container = selectEl.previousElementSibling;
    if (!container || !container.classList.contains('custom-select-container')) {
        container = document.createElement('div');
        container.className = 'custom-select-container';
        selectEl.parentNode.insertBefore(container, selectEl);
        selectEl.classList.add('hidden-native-select');

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'custom-select-trigger';
        trigger.innerHTML = `
            <span class="custom-select-value"></span>
            <span class="material-symbols-rounded custom-select-icon">expand_more</span>
        `;
        container.appendChild(trigger);

        const dropdown = document.createElement('div');
        dropdown.className = 'custom-select-dropdown';
        container.appendChild(dropdown);

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = container.classList.contains('open');
            document.querySelectorAll('.custom-select-container.open').forEach(c => c.classList.remove('open'));
            if (!isOpen) container.classList.add('open');
        });
    }

    const valueEl = container.querySelector('.custom-select-value');
    const dropdownEl = container.querySelector('.custom-select-dropdown');
    dropdownEl.innerHTML = '';

    const options = Array.from(selectEl.options);
    const selectedOpt = options.find(o => o.selected) || options[0];

    if (selectedOpt) {
        valueEl.innerText = selectedOpt.text;
    }

    options.forEach(opt => {
        const item = document.createElement('div');
        item.className = 'custom-select-option' + (opt.selected ? ' selected' : '');
        item.innerHTML = `
            <span>${opt.text}</span>
            <span class="material-symbols-rounded check-icon">check</span>
        `;
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            selectEl.value = opt.value;
            selectEl.dispatchEvent(new Event('change'));
            container.classList.remove('open');
            syncCustomSelect(selectId);
        });
        dropdownEl.appendChild(item);
    });
}

document.addEventListener('click', () => {
    document.querySelectorAll('.custom-select-container.open').forEach(c => c.classList.remove('open'));
});

// --- SETTINGS LOGIC ---
const settingsModal = document.getElementById('settings-modal');
const printerSelect = document.getElementById('printer-select');
const settingsPasswordInput = document.getElementById('settings-password');

function showTestStatus(type, text) {
    const statusEl = document.getElementById('test-printer-status');
    if (!statusEl) return;

    if (!type || !text) {
        statusEl.className = 'status-banner';
        statusEl.innerHTML = '';
        return;
    }

    let iconName = 'info';
    if (type === 'loading') iconName = 'hourglass_top';
    if (type === 'success') iconName = 'check_circle';
    if (type === 'error') iconName = 'error';

    statusEl.className = `status-banner visible status-${type}`;
    statusEl.innerHTML = `<span class="material-symbols-rounded">${iconName}</span><span>${text}</span>`;
}

window.openSettings = async function () {
    settingsModal.style.display = 'flex';
    showTestStatus(null);

    // Dynamic Version Fetch
    try {
        const verRes = await fetch('/api/version');
        const verData = await verRes.json();
        const verEl = document.getElementById('current-app-version');
        if (verEl && verData.version) verEl.innerText = verData.version;
    } catch (e) {
        console.error("Errore caricamento versione:", e);
    }

    // Load Password, Template & Test Mode
    settingsPasswordInput.value = localStorage.getItem('appPassword') || "";
    document.getElementById('template-select').value = localStorage.getItem('receiptTemplate') || 'compact';
    document.getElementById('test-mode-toggle').checked = (localStorage.getItem('appTestMode') === 'true');

    syncCustomSelect('template-select');

    try {
        const res = await fetch('/api/printers');
        const printers = await res.json();

        printerSelect.innerHTML = '<option value="">-- Seleziona Stampante --</option>';
        const savedPrinter = localStorage.getItem('thermalPrinterName');

        if (Array.isArray(printers)) {
            printers.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.innerText = p;
                if (p === savedPrinter) opt.selected = true;
                printerSelect.appendChild(opt);
            });
        }
        syncCustomSelect('printer-select');
    } catch (e) {
        console.error(e);
        printerSelect.innerHTML = '<option>Errore caricamento</option>';
        syncCustomSelect('printer-select');
    }
}

window.closeSettings = function () {
    settingsModal.style.display = 'none';
}

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'success', duration = 3000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconName = 'check_circle';
    if (type === 'error') iconName = 'error';
    if (type === 'info') iconName = 'info';

    toast.innerHTML = `
        <span class="material-symbols-rounded toast-icon">${iconName}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}
window.showToast = showToast;

window.saveSettings = function () {
    const selectedPrinter = printerSelect.value;
    const newPassword = settingsPasswordInput.value.trim();
    const selectedTemplate = document.getElementById('template-select').value;
    const isTestMode = document.getElementById('test-mode-toggle').checked;

    if (selectedPrinter) {
        localStorage.setItem('thermalPrinterName', selectedPrinter);
    }

    // Save Password, Template & Test Mode
    localStorage.setItem('appPassword', newPassword);
    localStorage.setItem('receiptTemplate', selectedTemplate);
    localStorage.setItem('appTestMode', isTestMode ? 'true' : 'false');

    showToast("Impostazioni salvate con successo!", "success");
    closeSettings();
}

async function testPrinter() {
    const printerSelect = document.getElementById('printer-select');
    const printerName = printerSelect ? printerSelect.value : '';

    if (!printerName) {
        showTestStatus('error', 'Seleziona prima una stampante dal menu');
        return;
    }

    showTestStatus('loading', 'Stampa di prova in corso...');

    try {
        const res = await fetch('/api/print-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ printerName })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            showTestStatus('success', 'Stampa di prova inviata con successo');
        } else {
            throw new Error(data.error || 'Errore durante la stampa');
        }
    } catch (e) {
        showTestStatus('error', e.message);
    }
}
window.testPrinter = testPrinter;

window.checkLogin = checkLogin;
window.showAlert = showAlert;

// --- RECEIPT PREVIEW MODAL ---
function showReceiptPreviewModal(preview) {
    const container = document.getElementById('receipt-preview-container');
    if (!container || !preview || !preview.receipts) return;

    let html = '<div class="thermal-paper-wrapper" style="width:100%; display:flex; flex-direction:column; align-items:center;">';
    html += '<div class="thermal-paper">';

    preview.receipts.forEach((receipt, index) => {
        if (index > 0) {
            html += `
                <div class="paper-cut-indicator">
                    <span class="paper-cut-label">✂ TAGLIO CARTA ✂</span>
                </div>
            `;
        }

        if (receipt.hasHeaderImage) {
            html += `<img src="/receipt_header_resized.png" class="thermal-header-img" alt="Header Logo">`;
        }

        if (receipt.title) {
            html += `<div class="thermal-title">${receipt.title}</div>`;
        }

        if (receipt.headerLines && receipt.headerLines.length > 0) {
            html += `<div class="thermal-text-center">`;
            receipt.headerLines.forEach(line => {
                html += `<div>${line}</div>`;
            });
            html += `</div>`;
        }

        html += `<div class="thermal-divider"></div>`;

        if (receipt.items && receipt.items.length > 0) {
            receipt.items.forEach(item => {
                const boldStyle = item.isBold ? 'thermal-bold' : '';
                html += `
                    <div class="thermal-row ${boldStyle}">
                        <span>${item.left}</span>
                        <span>${item.right}</span>
                    </div>
                `;
            });
        }

        html += `<div class="thermal-divider"></div>`;

        if (receipt.totalLabel && receipt.totalValue) {
            html += `
                <div class="thermal-row thermal-row-bold">
                    <span>${receipt.totalLabel}</span>
                    <span>${receipt.totalValue}</span>
                </div>
            `;
        }

        if (receipt.footerLines && receipt.footerLines.length > 0) {
            html += `<div class="thermal-divider"></div>`;
            html += `<div class="thermal-text-center">`;
            receipt.footerLines.forEach(line => {
                html += `<div>${line}</div>`;
            });
            html += `</div>`;
        }
    });

    html += '</div></div>';
    container.innerHTML = html;
    document.getElementById('receipt-modal').style.display = 'flex';
}

function closeReceiptModal() {
    document.getElementById('receipt-modal').style.display = 'none';
}
window.closeReceiptModal = closeReceiptModal;

// --- DATABASE FUNCTIONS ---
window.exportDB = function () {
    window.location.href = '/api/database/export';
};

window.importDB = async function (input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];

        if (!await showConfirm("ATTENZIONE: Importando il database, tutti i dati attuali verranno SOVRASCRITTI.\nContinuare?")) {
            input.value = ''; // Reset
            return;
        }

        const formData = new FormData(); // Not used if using raw body, but good practice usually. 
        // We implemented raw binary upload in server for simplicity without multer.

        try {
            showAlert("Caricamento in corso... attendere.");

            const res = await fetch('/api/database/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream' // Binary stream
                },
                body: file // Send file directly as body
            });

            if (res.ok) {
                alert("Database importato con successo!\nIl sistema verrà ricaricato.");
                window.location.reload();
            } else {
                alert("Errore durante l'importazione.");
            }
        } catch (e) {
            console.error(e);
            alert("Errore di rete durante l'importazione.");
        }

        input.value = ''; // Reset
    }
};

async function checkAppUpdate() {
    const btn = document.getElementById('btn-check-update');
    const banner = document.getElementById('update-result-banner');

    if (btn) btn.disabled = true;
    if (banner) {
        banner.style.display = 'block';
        banner.className = 'status-banner status-info';
        banner.innerText = 'Verifica aggiornamenti su GitHub in corso...';
    }

    try {
        const res = await fetch('/api/check-update');
        const data = await res.json();

        if (!res.ok || data.error) {
            if (banner) {
                banner.className = 'status-banner status-error';
                banner.innerText = data.error || 'Errore durante la verifica';
            }
            return;
        }

        // Dynamically update displayed version
        const verEl = document.getElementById('current-app-version');
        if (verEl && data.currentVersion) verEl.innerText = data.currentVersion;

        if (data.hasUpdate) {
            if (banner) {
                banner.className = 'status-banner status-success';
                banner.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">
                        <span><b>Nuova versione v${data.latestVersion} disponibile!</b> (Installata: v${data.currentVersion})</span>
                        <button type="button" onclick="startAutoUpdate('${data.downloadUrl}')" class="btn-update-action" style="display:inline-flex; align-items:center; gap:6px; padding:8px 16px; background:var(--primary); color:white; border:none; border-radius:8px; font-weight:700; cursor:pointer;">
                            <span class="material-symbols-rounded" style="font-size:1.1rem;">system_update</span> Aggiorna Ora
                        </button>
                    </div>
                `;
            }
        } else {
            if (banner) {
                banner.className = 'status-banner status-info';
                banner.innerText = `L'applicazione è già aggiornata all'ultima versione (v${data.currentVersion}).`;
            }
        }
    } catch (e) {
        if (banner) {
            banner.className = 'status-banner status-error';
            banner.innerText = 'Impossibile verificare gli aggiornamenti.';
        }
    } finally {
        if (btn) btn.disabled = false;
    }
}
window.checkAppUpdate = checkAppUpdate;

async function startAutoUpdate(downloadUrl) {
    const banner = document.getElementById('update-result-banner');
    if (banner) {
        banner.className = 'status-banner status-info';
        banner.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; gap:10px; padding:4px;">
                <span class="material-symbols-rounded" style="animation: spin 1s linear infinite;">sync</span>
                <span><b>Download dell'aggiornamento in corso...</b> Si prega di non chiudere l'applicazione.</span>
            </div>
        `;
    }

    try {
        const res = await fetch('/api/download-and-install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ downloadUrl })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            if (banner) {
                banner.className = 'status-banner status-success';
                banner.innerText = 'Download completato! Avvio dell\'installatore e chiusura dell\'applicazione...';
            }
        } else if (data.redirectUrl) {
            window.open(data.redirectUrl, '_blank');
        } else {
            if (banner) {
                banner.className = 'status-banner status-error';
                banner.innerText = data.error || 'Errore durante il download.';
            }
        }
    } catch (e) {
        if (banner) {
            banner.className = 'status-banner status-error';
            banner.innerText = 'Errore di rete durante il download dell\'aggiornamento.';
        }
    }
}
window.startAutoUpdate = startAutoUpdate;

let latestUpdateData = null;

async function checkAppUpdateSilent() {
    try {
        const res = await fetch('/api/check-update');
        if (!res.ok) return;
        const data = await res.json();

        // Dynamically update current version in settings if element exists
        const verEl = document.getElementById('current-app-version');
        if (verEl && data.currentVersion) verEl.innerText = data.currentVersion;

        if (data.hasUpdate) {
            latestUpdateData = data;
            const dismissedTag = sessionStorage.getItem('dismissUpdateTag');
            if (dismissedTag !== data.latestVersion) {
                showUpdateToast(data);
            }
        }
    } catch (e) {
        console.log("Silent update check skipped (offline or network error)");
    }
}

function showUpdateToast(data) {
    const toast = document.getElementById('update-toast-banner');
    const verEl = document.getElementById('update-toast-ver');
    const btn = document.getElementById('update-toast-btn');
    if (!toast || !verEl || !btn) return;

    verEl.innerText = `v${data.latestVersion}`;
    btn.onclick = function() {
        if (data.downloadUrl) {
            startAutoUpdate(data.downloadUrl);
        }
    };
    toast.classList.add('visible');
}

function dismissUpdateToast() {
    const toast = document.getElementById('update-toast-banner');
    if (toast) toast.classList.remove('visible');
    if (latestUpdateData && latestUpdateData.latestVersion) {
        sessionStorage.setItem('dismissUpdateTag', latestUpdateData.latestVersion);
    }
}
window.dismissUpdateToast = dismissUpdateToast;
window.checkAppUpdateSilent = checkAppUpdateSilent;

init();
