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
function showDialog(title, message, isPrompt = false, isAlert = false) {
    return new Promise((resolve) => {
        // 1. Ensure Dialog Elements Exist (Auto-Repair)
        let dOverlay = document.getElementById('dialog-overlay');

        if (!dOverlay) {
            console.log("Re-creating Dialog DOM...");
            dOverlay = document.createElement('div');
            dOverlay.id = 'dialog-overlay';
            dOverlay.className = 'modal';
            dOverlay.style.zIndex = '99999'; // FORCE TOP
            dOverlay.innerHTML = `
                <div class="modal-content dialog-content" style="z-index:100000;">
                    <h3 id="dialog-title"></h3>
                    <p id="dialog-message"></p>
                    <input type="text" id="dialog-input" class="input-field" style="display:none; width:100%; margin: 15px 0; user-select: text !important; pointer-events: auto !important;">
                    <div class="dialog-actions" style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
                        <button id="dialog-cancel" class="btn-small">Annulla</button>
                        <button id="dialog-ok" class="btn-save" style="padding: 10px 20px;">OK</button>
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

        // 3. Setup Content
        dTitle.innerText = title;
        dMessage.innerText = message;
        dInput.value = '';

        // Show/Hide Input
        if (isPrompt) {
            dInput.style.display = 'block';
            setTimeout(() => dInput.focus(), 100);
        } else {
            dInput.style.display = 'none';
        }

        // Show/Hide Cancel
        if (isAlert) {
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
            const val = isPrompt ? dInput.value : true;
            if (isPrompt && !val.trim()) return;
            cleanup();
            resolve(val);
        };

        dCancel.onclick = () => {
            cleanup();
            resolve(isPrompt ? null : false);
        };

        dInput.onkeydown = (e) => {
            if (e.key === 'Enter') dOk.click();
            if (e.key === 'Escape') dCancel.click();
        };
    });
}

function showConfirm(message) {
    return showDialog("Conferma", message, false, false);
}

function showPrompt(message) {
    return showDialog("Nuovo Evento", message, true, false);
}

function showAlert(message) {
    return showDialog("Avviso", message, false, true);
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

    showView('auth');
}

// --- AUTH LOGIC ---
const authPasswordInput = document.getElementById('auth-password');
const authErrorEl = document.getElementById('auth-error');

function checkLogin() {
    const savedPassword = localStorage.getItem('appPassword') || "";
    const inputPassword = authPasswordInput.value;

    if (savedPassword === "" || inputPassword === savedPassword) {
        // Login Success
        authPasswordInput.value = ''; // clear
        authErrorEl.innerText = '';
        loadSagras();
        showView('login');
    } else {
        authErrorEl.innerText = "Password Errata!";
        authPasswordInput.value = '';
        authPasswordInput.focus();

        // Shake animation effect (optional simple inline)
        authPasswordInput.style.borderColor = 'var(--danger)';
        setTimeout(() => authPasswordInput.style.borderColor = '', 500);
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
    if (activeSagras.length === 0 && archivedSagras.length === 0) {
        views.login.querySelector('h1').innerText = "Benvenuto! Crea il tuo primo Evento.";
    } else {
        views.login.querySelector('h1').innerText = "Gestione Ordini";
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
    return `
    <div class="sagra-card" onclick="selectSagra(${s.id}, '${safeName}')" style="cursor: pointer;">
      <div class="sagra-card-content">
        ${s.name} ${isArchived ? '(Archiviata)' : ''}
      </div>
      <div class="sagra-actions">
        ${!isArchived
            ? `<button class="btn-icon" title="Archivia" onclick="archiveSagra(event, ${s.id})"><span class="material-symbols-rounded">inventory_2</span></button>`
            : `<button class="btn-icon" title="Ripristina" onclick="unarchiveSagra(event, ${s.id})"><span class="material-symbols-rounded">restore_from_trash</span></button>`
        }
        <button class="btn-icon" title="Elimina" onclick="deleteSagra(event, ${s.id})"><span class="material-symbols-rounded">delete</span></button>
      </div>
    </div>
  `;
}

async function archiveSagra(e, id) {
    e.stopPropagation();
    if (!await showConfirm("Vuoi archiviare questo evento?")) return;
    await fetch(`/api/sagras/${id}/archive`, { method: 'PUT' });
    showToast("Evento archiviato", "info");
    loadSagras();
}

async function unarchiveSagra(e, id) {
    e.stopPropagation();
    if (!await showConfirm("Riportare questo evento tra quelli attivi?")) return;
    await fetch(`/api/sagras/${id}/unarchive`, { method: 'PUT' });
    showToast("Evento ripristinato con successo", "success");
    loadSagras();
}

async function deleteSagra(e, id) {
    e.stopPropagation();
    if (!await showConfirm("ATTENZIONE: Eliminazione definitiva (Ordini, Menu, Statistiche).\nContinuare?")) return;
    await fetch(`/api/sagras/${id}`, { method: 'DELETE' });
    showToast("Evento eliminato", "error");
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
            <input type="text" class="cat-name-input" placeholder="Nome Categoria (es. Sconto, Gadget)" value="${name}">
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
      <input type="text" class="input-field col-name" placeholder="es. Panino con Salamella" value="${name}">
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

init();
