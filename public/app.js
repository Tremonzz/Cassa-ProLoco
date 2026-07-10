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
    loadSagras();
}

async function unarchiveSagra(e, id) {
    e.stopPropagation();
    if (!await showConfirm("Riportare questo evento tra quelli attivi?")) return;
    await fetch(`/api/sagras/${id}/unarchive`, { method: 'PUT' });
    loadSagras();
}

async function deleteSagra(e, id) {
    e.stopPropagation();
    if (!await showConfirm("ATTENZIONE: Eliminazione definitiva (Ordini, Menu, Statistiche).\nContinuare?")) return;
    await fetch(`/api/sagras/${id}`, { method: 'DELETE' });
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
window.createNewSagra = createNewSagra;

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
    STATE.products = await res.json();
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

function renderEditor() {
    editorContainer.innerHTML = '';
    const categories = Object.keys(STATE.products).length > 0
        ? Object.keys(STATE.products)
        : [];

    if (categories.length === 0) {
        addCategoryUI();
    } else {
        categories.forEach(catName => {
            addCategoryUI(catName, STATE.products[catName]);
        });
    }
}

function addCategoryUI(name = '', products = []) {
    const div = document.createElement('div');
    div.className = 'editor-section';
    div.innerHTML = `
    <div class="cat-row">
      <input type="text" class="cat-name-input" placeholder="Nome Categoria" value="${name}">
      <button class="btn-small btn-del" onclick="this.closest('.editor-section').remove()">Elimina Cat.</button>
    </div>
    <div class="products-list"></div>
    <div style="margin-top:10px; margin-left:30px;">
      <button class="btn-small btn-add" onclick="addProductUI(this.parentElement.previousElementSibling)">+ Prodotto</button>
    </div>
  `;
    editorContainer.appendChild(div);

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
    <input type="text" class="input-field" placeholder="Nome Prodotto" value="${name}">
    <input type="number" class="input-field" placeholder="Prezzo" value="${price}" step="0.10" style="width:80px;">
    <input type="number" class="input-field" placeholder="Q.tà" value="${qtyVal}" style="width:60px;" title="Lascia vuoto per infinito">
    <button class="btn-small btn-del" onclick="this.parentElement.remove()">x</button>
  `;
    container.appendChild(row);
}

async function saveMenu() {
    if (!STATE.currentSagra) return;

    const sections = editorContainer.querySelectorAll('.editor-section');
    const payload = { categories: [] };

    sections.forEach(sec => {
        const catName = sec.querySelector('.cat-name-input').value.trim();
        if (!catName) return;

        const products = [];
        sec.querySelectorAll('.product-row').forEach(row => {
            const inputs = row.querySelectorAll('input');
            const pName = inputs[0].value.trim();
            const pPrice = parseFloat(inputs[1].value);
            const pQtyStr = inputs[2].value.trim();

            if (pName && !isNaN(pPrice)) {
                // Handle Quantity: Empty = null, 0 = null (infinite), >0 = limit
                let pQty = null;
                if (pQtyStr && !isNaN(parseInt(pQtyStr))) {
                    const parsed = parseInt(pQtyStr);
                    if (parsed > 0) pQty = parsed;
                }
                products.push({ name: pName, price: pPrice, quantity: pQty });
            }
        });

        payload.categories.push({ name: catName, products });
    });

    try {
        const res = await fetch(`/api/sagras/${STATE.currentSagra.id}/menu`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            await showAlert("Menu Salvato!");
            await loadSagraResources();
            showView('pos');
        } else {
            alert("Errore salvataggio");
        }
    } catch (e) {
        console.error(e);
        alert("Errore comunicazione");
    }
}

// --- POS LOGIC ---
function renderProducts() {
    productsEl.innerHTML = '';
    if (Object.keys(STATE.products).length === 0) {
        productsEl.innerHTML = '<div style="padding:20px; text-align:center;">Nessun prodotto. <br>Clicca "Modifica Menu" per aggiungere.</div>';
        return;
    }

    for (const [category, products] of Object.entries(STATE.products)) {
        const section = document.createElement('div');
        section.className = 'category-section';

        section.innerHTML = `
      <div class="category-title">${category}</div>
      <div class="product-grid">
        ${products.map(p => {
            const hasLimit = (p.quantity !== null && p.quantity !== undefined);
            const isOOS = hasLimit && p.quantity <= 0;
            const qtyLabel = hasLimit ? `<span class="qty-badge ${isOOS ? 'oos' : ''}">${p.quantity}</span>` : '';

            return `
          <button class="product-btn" ${isOOS ? 'disabled' : ''} onclick="addToCart(${p.id}, '${p.name}', ${p.price}, '${category}', ${hasLimit ? p.quantity : 'null'})">
            ${qtyLabel}
            <span class="product-name">${p.name}</span>
            <span class="product-price">€ ${p.price.toFixed(2)}</span>
          </button>
        `}).join('')}
      </div>
    `;
        productsEl.appendChild(section);
    }
}

function addToCart(id, name, price, category = 'Altro', maxQty = null) {
    const existing = STATE.cart.find(i => i.name === name && i.price === price);
    let currentCartQty = existing ? existing.quantity : 0;

    // Check Limit
    if (maxQty !== null && (currentCartQty + 1) > maxQty) {
        // Simple visual feedback could be improved, but alert is effective
        alert(`Scorte esaurite per: ${name}`);
        return;
    }

    if (existing) {
        existing.quantity++;
    } else {
        STATE.cart.push({ id, name, price, quantity: 1, category });
    }
    renderCart();
}

function removeFromCart(idx) {
    STATE.cart.splice(idx, 1);
    renderCart();
}





function renderCart() {
    cartEl.innerHTML = '';
    let total = 0;

    STATE.cart.forEach((item, idx) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        const div = document.createElement('div');
        div.className = 'order-item';

        // Conditional Button Rendering
        const decreaseBtn = item.quantity > 1
            ? `<button class="btn-decrease" onclick="decreaseQuantity(${idx})">-</button>`
            : '';

        div.innerHTML = `
      <div class="item-left">
        <button class="btn-remove" onclick="removeFromCart(${idx})">×</button>
        ${decreaseBtn}
        <div>
          <b>${item.name}</b><br>
          ${item.quantity} x €${item.price.toFixed(2)}
        </div>
      </div>
      <div>€${itemTotal.toFixed(2)}</div>
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
    
    if (!cashInput || !changeEl) return;
    
    const cashReceived = parseFloat(cashInput.value);
    if (isNaN(cashReceived) || cashReceived <= 0) {
        changeEl.innerText = '€ 0.00';
        changeEl.classList.remove('has-change');
        return;
    }
    
    const change = cashReceived - total;
    if (change >= 0) {
        changeEl.innerText = `€ ${change.toFixed(2)}`;
        changeEl.classList.add('has-change');
    } else {
        changeEl.innerText = '€ 0.00';
        changeEl.classList.remove('has-change');
    }
}

function decreaseQuantity(idx) {
    if (STATE.cart[idx].quantity > 1) {
        STATE.cart[idx].quantity--;
        renderCart();
    }
}

async function clearCart() {
    if (STATE.cart.length === 0) return;
    if (await showConfirm("Svuotare il carrello?")) {
        STATE.cart = [];
        const cashInput = document.getElementById('cash-received');
        if (cashInput) cashInput.value = '';
        renderCart();
    }
}

async function printOrder() {
    if (STATE.cart.length === 0) return alert('Ordine vuoto!');
    const total = STATE.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    // Get stored printer name and template
    const printerName = localStorage.getItem('thermalPrinterName');
    const template = localStorage.getItem('receiptTemplate') || 'compact';

    const payload = {
        sagraId: STATE.currentSagra.id,
        items: STATE.cart,
        total: total,
        printerName: printerName,
        template: template
    };

    try {
        const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && data.success) {
            // Success
            if (data.warning) {
                showAlert(`Nota: ${data.warning}`);
            } else {
                // Silent success per user request
                console.log(`Ordine #${data.orderId} Stampato!`);
                // Optional: distinct sound or quick toast?
                // showAlert("Ordine inviato!", 1000); 
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

async function showHistory() {
    // Simple check for Sagra
    if (!STATE.currentSagra) return;

    const res = await fetch(`/api/history?sagraId=${STATE.currentSagra.id}`);
    STATE.history = await res.json();

    if (STATE.history.length === 0) {
        historyListEl.innerHTML = '<div style="padding:20px;">Nessun ordine.</div>';
    } else {
        historyListEl.innerHTML = STATE.history.map(o => `
      <div class="history-item" style="flex-direction: column; align-items: flex-start;">
        <div style="display:flex; justify-content:space-between; width:100%; border-bottom:1px solid #ddd; padding-bottom:5px; margin-bottom:5px;">
          <span><b>#${o.seq || o.id}</b> - ${new Date(o.created_at).toLocaleString()}</span>
          <b>€ ${o.total.toFixed(2)}</b>
        </div>
        <div style="font-size: 0.9rem; color: #555;">
          ${o.items.map(i => `<div>${i.quantity}x ${i.name} (€${i.price.toFixed(2)})</div>`).join('')}
        </div>
      </div>
    `).join('');
    }
    modalEl.style.display = 'flex';
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

        document.getElementById('stat-revenue').innerText = `€ ${data.totalRevenue.toFixed(2)}`;
        document.getElementById('stat-orders').innerText = data.ordersCount;

        const topList = document.getElementById('top-products');
        if (data.topItems.length === 0) {
            topList.innerHTML = '<div style="text-align:center; padding:10px; color:#777;">Nessun dato.</div>';
        } else {
            topList.innerHTML = data.topItems.map((item, index) => `
                <div class="top-product-item">
                    <div class="top-product-name">
                        <span class="top-badge">#${index + 1}</span> ${item.product_name}
                    </div>
                    <div class="top-product-stats">
                        <b>${item.qty}</b> venduti<br>
                        <small>€ ${item.revenue.toFixed(2)}</small>
                    </div>
                </div>
            `).join('');
        }

        statsModalEl.style.display = 'flex';
    } catch (e) {
        console.error(e);
        showAlert("Errore caricamento statistiche");
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
// --- SETTINGS LOGIC ---
const settingsModal = document.getElementById('settings-modal');
const printerSelect = document.getElementById('printer-select');
const settingsPasswordInput = document.getElementById('settings-password');

window.openSettings = async function () {
    settingsModal.style.display = 'flex';
    printerSelect.innerHTML = '<option>Caricamento...</option>';

    // Load Password & Template
    settingsPasswordInput.value = localStorage.getItem('appPassword') || "";
    document.getElementById('template-select').value = localStorage.getItem('receiptTemplate') || 'compact';

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
    } catch (e) {
        console.error(e);
        printerSelect.innerHTML = '<option>Errore caricamento</option>';
    }
}

window.closeSettings = function () {
    settingsModal.style.display = 'none';
}

window.saveSettings = function () {
    const selectedPrinter = printerSelect.value;
    const newPassword = settingsPasswordInput.value.trim();
    const selectedTemplate = document.getElementById('template-select').value;

    if (selectedPrinter) {
        localStorage.setItem('thermalPrinterName', selectedPrinter);
    }

    // Save Password & Template
    localStorage.setItem('appPassword', newPassword);
    localStorage.setItem('receiptTemplate', selectedTemplate);

    showAlert("Impostazioni salvate!");
    closeSettings();
}

window.checkLogin = checkLogin;
window.showAlert = showAlert;

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
