let STATE = {
    currentSagra: null,
    products: {}, // grouped by category
    cart: [],
    history: [],
    isMenuDirty: false,
    isPOSLocked: false
};

function markMenuDirty() {
    STATE.isMenuDirty = true;
}
window.markMenuDirty = markMenuDirty;

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

// --- VIEW NAVIGATION ---
async function showView(viewName) {
    if (viewName === 'auth') {
        const toast = document.getElementById('update-toast-banner');
        if (toast) {
            toast.style.display = 'none';
            toast.classList.remove('visible');
        }
    }
    if (viewName === 'auth' || viewName === 'login') {
        if (typeof closeAllModals === 'function') closeAllModals();
    }

    // Check if attempting to leave editor with unsaved changes
    if (views.editor && views.editor.classList.contains('active') && viewName !== 'editor' && STATE.isMenuDirty) {
        const confirmed = await showDialog({
            title: "Modifiche Non Salvate",
            message: "Hai effettuato delle modifiche al menu che non sono ancora state salvate. Vuoi davvero uscire senza salvare?",
            icon: "warning",
            isDanger: true,
            okText: "Esci Senza Salvare",
            cancelText: "Rimani nell'Editor"
        });
        if (!confirmed) return false;
        STATE.isMenuDirty = false;
    }

    Object.values(views).forEach(el => el.classList.remove('active'));
    if (views[viewName]) {
        views[viewName].classList.add('active');
    }
    if (viewName !== 'auth') {
        checkAppUpdateSilent();
    }
    return true;
}
window.showView = showView;

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
            if (opts.isPrompt && !opts.allowEmpty && !val.trim()) return;
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


function requestAppFullscreen() {
    if (window.electronAPI && typeof window.electronAPI.maximizeApp === 'function') {
        window.electronAPI.maximizeApp();
    }
    if (!document.fullscreenElement) {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
            docEl.msRequestFullscreen();
        }
    }
}



function closeApp() {
    showDialog({ title: "Conferma Uscita", message: "Sei sicuro di voler uscire dall'applicazione?", icon: "door_open" }).then(confirmed => {
        if (confirmed) {
            try {
                window.close();
            } catch (e) {}

            if (window.electronAPI && typeof window.electronAPI.closeApp === 'function') {
                window.electronAPI.closeApp();
            }

            if (document.fullscreenElement) {
                try { document.exitFullscreen(); } catch (e) {}
            }

            setTimeout(() => {
                showToast("L'applicazione è pronta per essere chiusa.", "info");
            }, 300);
        }
    });
}
window.closeApp = closeApp;

function forceCloseApp() {
    try {
        if (window.electronAPI && typeof window.electronAPI.closeApp === 'function') {
            window.electronAPI.closeApp();
        } else {
            window.close();
        }
    } catch (e) {
        window.close();
    }
}
window.forceCloseApp = forceCloseApp;

function isTimeInSchedule(startTimeStr, endTimeStr) {
    if (!startTimeStr || !endTimeStr) return false;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = startTimeStr.split(':').map(Number);
    const [endH, endM] = endTimeStr.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (isNaN(startMinutes) || isNaN(endMinutes) || startMinutes === endMinutes) return false;

    if (startMinutes < endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
}

let lastEvaluatedScheduleState = null;

function checkThemeSchedule() {
    const isScheduleEnabled = localStorage.getItem('themeScheduleEnabled') !== 'false';
    if (!isScheduleEnabled) {
        lastEvaluatedScheduleState = null;
        return;
    }

    const startTime = localStorage.getItem('themeScheduleStart') || '20:00';
    const endTime = localStorage.getItem('themeScheduleEnd') || '07:00';

    const shouldBeDark = isTimeInSchedule(startTime, endTime);
    const targetState = shouldBeDark ? 'dark' : 'light';

    if (lastEvaluatedScheduleState === null) {
        lastEvaluatedScheduleState = targetState;
        toggleTheme(shouldBeDark);
        const darkToggle = document.getElementById('dark-mode-toggle');
        if (darkToggle) darkToggle.checked = shouldBeDark;
    } else if (lastEvaluatedScheduleState !== targetState) {
        // Threshold crossed: auto-switch theme at boundary time
        lastEvaluatedScheduleState = targetState;
        toggleTheme(shouldBeDark);
        const darkToggle = document.getElementById('dark-mode-toggle');
        if (darkToggle) darkToggle.checked = shouldBeDark;
    }
}

function initTheme() {
    const isScheduleEnabled = localStorage.getItem('themeScheduleEnabled') !== 'false';
    if (isScheduleEnabled) {
        checkThemeSchedule();
    } else {
        const savedTheme = localStorage.getItem('appTheme') || 'light';
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }
}

function updateThemeSelectorButtons(theme) {
    const btnLight = document.getElementById('theme-btn-light');
    const btnDark = document.getElementById('theme-btn-dark');
    const pill = document.getElementById('theme-selector-pill');

    const currentTheme = theme || (document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

    if (btnLight && btnDark) {
        if (currentTheme === 'dark') {
            btnDark.classList.add('active');
            btnLight.classList.remove('active');
            if (pill) pill.style.transform = 'translateX(100%)';
        } else {
            btnLight.classList.add('active');
            btnDark.classList.remove('active');
            if (pill) pill.style.transform = 'translateX(0%)';
        }
    }
}
window.updateThemeSelectorButtons = updateThemeSelectorButtons;

function selectTheme(theme) {
    const isDark = (theme === 'dark');
    const scheduleToggle = document.getElementById('dark-mode-schedule-toggle');
    if (scheduleToggle && scheduleToggle.checked) {
        scheduleToggle.checked = false;
        toggleThemeSchedule(false);
        localStorage.setItem('themeScheduleEnabled', 'false');
    }
    toggleTheme(isDark);
}
window.selectTheme = selectTheme;

function toggleTheme(isDark) {
    if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('appTheme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('appTheme', 'light');
    }
    updateThemeSelectorButtons(isDark ? 'dark' : 'light');
}
window.toggleTheme = toggleTheme;

function toggleThemeSchedule(isEnabled) {
    const timeContainer = document.getElementById('schedule-time-container');
    if (timeContainer) {
        timeContainer.style.opacity = isEnabled ? '1' : '0.5';
        timeContainer.style.pointerEvents = isEnabled ? 'auto' : 'none';
    }
}
window.toggleThemeSchedule = toggleThemeSchedule;

setInterval(checkThemeSchedule, 30000);

// --- CHANGE CALCULATOR DISPLAY SETTING ---
function applyChangeCalcMode(mode) {
    const validMode = ['none', 'keyboard', 'full'].includes(mode) ? mode : 'full';
    localStorage.setItem('changeCalcMode', validMode);

    const calcContainer = document.getElementById('change-calculator-container');
    const quickBar = document.getElementById('quick-cash-bar');

    if (calcContainer) {
        if (validMode === 'none') {
            calcContainer.style.display = 'none';
        } else {
            calcContainer.style.display = 'block';
        }
    }

    if (quickBar) {
        if (validMode === 'full') {
            quickBar.style.display = 'flex';
        } else {
            quickBar.style.display = 'none';
        }
    }

    updateChangeCalcSelectorButtons(validMode);
}

function updateChangeCalcSelectorButtons(mode) {
    const pill = document.getElementById('change-calc-selector-pill');
    const btnNone = document.getElementById('change-calc-btn-none');
    const btnKeyboard = document.getElementById('change-calc-btn-keyboard');
    const btnFull = document.getElementById('change-calc-btn-full');

    [btnNone, btnKeyboard, btnFull].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });

    if (pill) {
        if (mode === 'none') {
            pill.style.transform = 'translateX(0%)';
            if (btnNone) btnNone.classList.add('active');
        } else if (mode === 'keyboard') {
            pill.style.transform = 'translateX(100%)';
            if (btnKeyboard) btnKeyboard.classList.add('active');
        } else {
            pill.style.transform = 'translateX(200%)';
            if (btnFull) btnFull.classList.add('active');
        }
    }
}

function selectChangeCalcMode(mode) {
    applyChangeCalcMode(mode);
}
window.selectChangeCalcMode = selectChangeCalcMode;
window.applyChangeCalcMode = applyChangeCalcMode;
window.updateChangeCalcSelectorButtons = updateChangeCalcSelectorButtons;

// --- APP INIT ---
async function init() {
    initTheme();
    const savedCalcMode = localStorage.getItem('changeCalcMode') || 'full';
    applyChangeCalcMode(savedCalcMode);
    // Check password existence
    const savedPassword = localStorage.getItem('appPassword');
    const authContainer = document.getElementById('auth-input-container');

    // Add change calculator input listener
    const cashInput = document.getElementById('cash-received');
    if (cashInput) {
        cashInput.addEventListener('input', updateChange);
    }

    initKeyboardShortcuts();
    initLogoLongPressUnlock();
    updateLiveClock();
    setInterval(updateLiveClock, 1000);
    await loadSagras();

    if (!savedPassword) {
        if (authContainer) authContainer.style.display = 'none';
    } else {
        if (authContainer) authContainer.style.display = 'flex';
    }

    showView('auth');

    // Check for post-update Whats New Changelog modal
    checkPostUpdateChangelog();

    // Check for updates silently on startup
    checkAppUpdateSilent();
    setTimeout(() => checkAppUpdateSilent(), 300);
}

function updateLiveClock() {
    const clockText = document.getElementById('pos-clock-text');
    if (!clockText) return;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    clockText.innerText = `${hours}:${minutes}`;
}

let logoPressTimer = null;

function initLogoLongPressUnlock() {
    const authLogo = document.getElementById('auth-logo-img');
    if (!authLogo) return;

    const startPress = (e) => {
        if (e.type === 'mousedown' && e.button !== 0) return;

        cancelPress();
        authLogo.classList.add('pressing');

        logoPressTimer = setTimeout(() => {
            cancelPress();
            // 5 SECONDS HELD -> SILENT EMERGENCY PASSWORD RESET!
            localStorage.removeItem('appPassword');
            const authContainer = document.getElementById('auth-input-container');
            if (authContainer) authContainer.style.display = 'none';
            const pwdInput = document.getElementById('auth-password');
            if (pwdInput) pwdInput.value = '';
            const errBanner = document.getElementById('auth-error-banner');
            if (errBanner) errBanner.classList.remove('visible');

            showToast("Password azzerata con successo (Sblocco di Emergenza)", "success", 3000);
        }, 5000);
    };

    const cancelPress = () => {
        if (logoPressTimer) {
            clearTimeout(logoPressTimer);
            logoPressTimer = null;
        }
        if (authLogo) authLogo.classList.remove('pressing');
    };

    authLogo.addEventListener('mousedown', startPress);
    authLogo.addEventListener('mouseup', cancelPress);
    authLogo.addEventListener('mouseleave', cancelPress);

    authLogo.addEventListener('touchstart', startPress, { passive: true });
    authLogo.addEventListener('touchend', cancelPress);
    authLogo.addEventListener('touchcancel', cancelPress);
}

function initKeyboardShortcuts() {
    // Disable default browser context menu globally
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    window.addEventListener('keydown', (e) => {
        // Intercept Escape key globally to prevent exiting Fullscreen (F11) mode
        if (e.key === 'Escape') {
            e.preventDefault();
        }

        // 1. Check if any modal or dialog is open
        const dialogOverlay = document.getElementById('dialog-overlay');
        const isDialogVisible = dialogOverlay && (dialogOverlay.style.display === 'flex' || getComputedStyle(dialogOverlay).display === 'flex');

        if (isDialogVisible) {
            return;
        }

        const modals = ['history-modal', 'stats-modal', 'settings-modal', 'sagra-options-modal', 'receipt-preview-modal', 'product-reorder-modal', 'linked-products-modal', 'pos-selection-modal', 'pos-product-options-modal'];
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
                else if (openModalId === 'receipt-preview-modal') closeReceiptModal();
                else if (openModalId === 'product-reorder-modal') closeProductReorderModal();
                else if (openModalId === 'linked-products-modal') closeLinkedProductsModal();
                else if (openModalId === 'pos-selection-modal') closePosSelectionModal();
                else if (openModalId === 'pos-product-options-modal') closePosProductOptionsModal();
            }
            return;
        }

        // Ctrl + Enter shortcut to add another product in Menu Editor
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const active = document.activeElement;
            if (active) {
                // Check if inside a base product row in drawer
                const baseRow = active.closest('.base-product-row');
                if (baseRow) {
                    e.preventDefault();
                    e.stopPropagation();
                    addBaseProductRowUI();
                    return;
                }

                // Check if inside a product row in editor
                const productRow = active.closest('.product-row');
                if (productRow) {
                    e.preventDefault();
                    e.stopPropagation();

                    const isComp = productRow.dataset.isComposite === "1";
                    const isSel = productRow.dataset.isSelection === "1";
                    const container = productRow.parentElement;

                    if (container) {
                        addProductUI(container, '', '', '', isComp, isSel);
                    }
                    return;
                }

                // Check if inside an editor section
                const editorSection = active.closest('.editor-section');
                if (editorSection) {
                    e.preventDefault();
                    e.stopPropagation();
                    const stdList = editorSection.querySelector('.products-list-standard');
                    const compList = editorSection.querySelector('.products-list-composite');
                    const selList = editorSection.querySelector('.products-list-selection');
                    if (active.closest('.composite-table') && compList) {
                        addProductUI(compList, '', '', '', true, false);
                    } else if (active.closest('.selection-table') && selList) {
                        addProductUI(selList, '', '', '', false, true);
                    } else if (stdList) {
                        addProductUI(stdList, '', '', '', false, false);
                    }
                    return;
                }
            }
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
            switchToEditor();
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
        // Login Success -> Activate Fullscreen on Accedi Click
        requestAppFullscreen();
        if (pwdInput) pwdInput.value = '';
        if (errBanner) errBanner.classList.remove('visible');

        if (STATE.isPOSLocked && STATE.currentSagra) {
            STATE.isPOSLocked = false;
            showView('pos');
            showToast("Cassa sbloccata!", "success");
        } else {
            STATE.isPOSLocked = false;
            loadSagras();
            showView('login');
        }
        checkAppUpdateSilent();
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
window.checkLogin = checkLogin;

function closeAllModals() {
    if (typeof closePosSelectionModal === 'function') closePosSelectionModal();
    if (typeof closeLinkedProductsModal === 'function') closeLinkedProductsModal();
    if (typeof closeProductReorderModal === 'function') closeProductReorderModal();
    if (typeof closeChangelogModal === 'function') closeChangelogModal();
    if (typeof closeProductAutocomplete === 'function') closeProductAutocomplete();

    document.querySelectorAll('.modal, .modal-backdrop, .dialog-overlay, [id$="-modal"]').forEach(modal => {
        if (modal.id === 'view-auth' || modal.id === 'view-login') return;
        modal.style.display = 'none';
    });
}
window.closeAllModals = closeAllModals;

// --- PRODUCT NAME AUTOCOMPLETE (Database Query) ---
let autocompleteTimeout = null;
let activeAutocompleteInput = null;

async function handleProductNameInput(e) {
    const input = e.target;
    if (!input || (!input.classList.contains('col-name') && !input.classList.contains('base-prod-name'))) return;

    const val = input.value.trim();
    clearTimeout(autocompleteTimeout);

    if (val.length < 3) {
        closeProductAutocomplete();
        return;
    }

    autocompleteTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`/api/products/suggestions?q=${encodeURIComponent(val)}`);
            if (!res.ok) {
                closeProductAutocomplete();
                return;
            }
            let suggestions = await res.json();
            if (Array.isArray(suggestions)) {
                // Filter out exact case-insensitive matches
                suggestions = suggestions.filter(name => name.trim().toLowerCase() !== val.trim().toLowerCase());
            }

            if (Array.isArray(suggestions) && suggestions.length > 0) {
                showProductAutocomplete(input, suggestions);
            } else {
                closeProductAutocomplete();
            }
        } catch (err) {
            closeProductAutocomplete();
        }
    }, 180);
}

function showProductAutocomplete(input, suggestions) {
    let popup = document.getElementById('product-autocomplete-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'product-autocomplete-popup';
        popup.className = 'product-autocomplete-popup';
    }

    let wrapper = input.closest('.product-name-wrapper') || input.parentElement;
    if (wrapper) {
        if (getComputedStyle(wrapper).position === 'static') {
            wrapper.style.position = 'relative';
        }
        if (popup.parentElement !== wrapper) {
            wrapper.appendChild(popup);
        }
    } else {
        document.body.appendChild(popup);
    }

    activeAutocompleteInput = input;

    popup.innerHTML = suggestions.map(name => `
        <div class="product-autocomplete-item" onclick="selectProductAutocomplete('${encodeURIComponent(name.replace(/'/g, "\\'"))}')">
            <span>${name}</span>
        </div>
    `).join('');

    popup.style.top = 'calc(100% + 3px)';
    popup.style.left = '0';
    popup.style.width = '100%';
    popup.style.display = 'flex';
}

function selectProductAutocomplete(encodedName) {
    const name = decodeURIComponent(encodedName);
    const input = activeAutocompleteInput;
    closeProductAutocomplete();
    if (input) {
        input.value = name;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof markMenuDirty === 'function') markMenuDirty();
        input.focus();
    }
}
window.selectProductAutocomplete = selectProductAutocomplete;

function closeProductAutocomplete() {
    const popup = document.getElementById('product-autocomplete-popup');
    if (popup) {
        popup.style.display = 'none';
        popup.innerHTML = '';
    }
    activeAutocompleteInput = null;
}
window.closeProductAutocomplete = closeProductAutocomplete;

document.addEventListener('input', handleProductNameInput);
document.addEventListener('click', (e) => {
    if (!e.target.closest('#product-autocomplete-popup') && !e.target.classList.contains('col-name') && !e.target.classList.contains('base-prod-name')) {
        closeProductAutocomplete();
    }
});

function lockPOS() {
    if (!STATE.currentSagra) return;
    STATE.isPOSLocked = true;

    closeAllModals();

    const savedPassword = localStorage.getItem('appPassword');
    const authContainer = document.getElementById('auth-input-container');

    if (!savedPassword) {
        if (authContainer) authContainer.style.display = 'none';
    } else {
        if (authContainer) authContainer.style.display = 'flex';
    }

    showToast("Cassa bloccata - Premi Accedi per riprendere", "info");
    showView('auth');
}
window.lockPOS = lockPOS;

function showLogin() {
    STATE.currentSagra = null;
    STATE.isPOSLocked = false;
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
          <span class="material-symbols-rounded" style="font-size: 1.1rem;">${showArchivedState ? 'unfold_less' : 'archive'}</span>
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
    <div class="sagra-card ${isArchived ? 'is-archived' : ''}" onclick="selectSagra(${s.id}, '${safeName}')" oncontextmenu="openSagraOptions(event, ${s.id}, '${safeName}', ${isArchived})">
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
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
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
        STATE.base_products = data.base_products || [];
    } else {
        STATE.products = data;
        STATE.categoryMeta = {};
        STATE.base_products = [];
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
    STATE.isMenuDirty = false;

    const editorView = document.getElementById('view-editor');
    if (editorView) {
        editorView.removeEventListener('input', markMenuDirty);
        editorView.removeEventListener('change', markMenuDirty);
        editorView.addEventListener('input', markMenuDirty);
        editorView.addEventListener('change', markMenuDirty);
    }

    showView('editor');
}

function toggleHideCategory(btn) {
    const sec = btn.closest('.editor-section');
    if (!sec) return;

    markMenuDirty();
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

    const categories = Object.keys(STATE.products).filter(c => c !== 'Prodotti Base');

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

    renderBaseProductsUI();
}
function sortCategoryProducts(btnEl, mode) {
    const sec = btnEl.closest('.editor-section');
    if (!sec) return;

    const stdList = sec.querySelector('.products-list-standard');
    if (!stdList) return;

    const rows = Array.from(stdList.querySelectorAll('.product-row'));
    if (rows.length <= 1) return;

    rows.sort((a, b) => {
        const nameA = (a.querySelector('.col-name input')?.value || '').trim().toLowerCase();
        const nameB = (b.querySelector('.col-name input')?.value || '').trim().toLowerCase();
        const priceA = parseFloat(a.querySelector('input.col-price')?.value) || 0;
        const priceB = parseFloat(b.querySelector('input.col-price')?.value) || 0;

        if (mode === 'name') {
            return nameA.localeCompare(nameB, 'it', { sensitivity: 'base' });
        } else if (mode === 'price') {
            if (priceA !== priceB) return priceA - priceB;
            return nameA.localeCompare(nameB, 'it', { sensitivity: 'base' });
        }
        return 0;
    });

    rows.forEach((row, idx) => {
        row.dataset.position = idx;
        stdList.appendChild(row);
    });

    markMenuDirty();

    if (mode === 'name') {
        showToast("Prodotti ordinati in ordine alfabetico (A-Z)", "info");
    } else {
        showToast("Prodotti ordinati per prezzo crescente", "info");
    }
}
window.sortCategoryProducts = sortCategoryProducts;

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

      <div class="products-list products-list-standard"></div>

      <div class="product-table-header composite-table-header">
        <span class="col-name">Nome Prodotto Composto</span>
        <span class="col-price">Prezzo (€)</span>
        <span class="col-qty">Prodotti Collegati</span>
        <span class="col-action"></span>
      </div>

      <div class="products-list products-list-composite"></div>

      <div class="product-table-header selection-table-header">
        <span class="col-name">Nome Prodotto con Selezione</span>
        <span class="col-price">Prezzo (€)</span>
        <span class="col-qty">Prodotti Collegati</span>
        <span class="col-action"></span>
      </div>

      <div class="products-list products-list-selection"></div>

      <div class="editor-card-footer" style="display:flex; gap:10px; flex-wrap:wrap;">
        <button type="button" class="btn-add-product" onclick="addProductUI(this.closest('.editor-section').querySelector('.products-list-standard'))">
          <span class="material-symbols-rounded" style="font-size: 1.1rem;">add</span> Aggiungi Prodotto
        </button>
        <button type="button" class="btn-add-product" onclick="addProductUI(this.closest('.editor-section').querySelector('.products-list-composite'), '', '', '', true)">
          <span class="material-symbols-rounded" style="font-size: 1.1rem;">add</span> Aggiungi Prodotto Composto
        </button>
        <button type="button" class="btn-add-product" onclick="addProductUI(this.closest('.editor-section').querySelector('.products-list-selection'), '', '', '', false, true)">
          <span class="material-symbols-rounded" style="font-size: 1.1rem;">add</span> Aggiungi Prodotto con Selezione
        </button>
      </div>
    `;
    listEl.appendChild(div);

    const stdList = div.querySelector('.products-list-standard');
    const compList = div.querySelector('.products-list-composite');
    const compHeader = div.querySelector('.composite-table-header');
    const selList = div.querySelector('.products-list-selection');
    const selHeader = div.querySelector('.selection-table-header');

    const stdProducts = products.filter(p => p.is_composite !== 1 && p.is_selection !== 1);
    const compProducts = products.filter(p => p.is_composite === 1);
    const selProducts = products.filter(p => p.is_selection === 1);

    if (stdProducts.length > 0) {
        stdProducts.forEach(p => addProductUI(stdList, p.name, p.price, p.quantity, false, false, [], p.position));
    } else {
        addProductUI(stdList);
    }

    if (compProducts.length > 0) {
        compHeader.style.display = 'flex';
        compProducts.forEach(p => addProductUI(compList, p.name, p.price, p.quantity, true, false, p.components || [], p.position));
    } else {
        compHeader.style.display = 'none';
    }

    if (selProducts.length > 0) {
        selHeader.style.display = 'flex';
        selProducts.forEach(p => addProductUI(selList, p.name, p.price, p.quantity, false, true, p.components || [], p.position));
    } else {
        selHeader.style.display = 'none';
    }
}

function deleteProductRow(btn) {
    const row = btn.closest('.product-row');
    if (!row) return;
    const container = row.parentElement;
    row.remove();
    if (container && container.classList.contains('products-list-composite')) {
        if (container.querySelectorAll('.product-row').length === 0) {
            const section = container.closest('.editor-section');
            if (section) {
                const header = section.querySelector('.composite-table-header');
                if (header) header.style.display = 'none';
            }
        }
    } else if (container && container.classList.contains('products-list-selection')) {
        if (container.querySelectorAll('.product-row').length === 0) {
            const section = container.closest('.editor-section');
            if (section) {
                const header = section.querySelector('.selection-table-header');
                if (header) header.style.display = 'none';
            }
        }
    }
}
window.deleteProductRow = deleteProductRow;

let currentEditingCompositeRow = null;

function getAllNestedComponentNames(compNames, visited = new Set()) {
    let result = [];
    if (!Array.isArray(compNames)) return result;

    compNames.forEach(compName => {
        if (!compName || visited.has(compName)) return;
        visited.add(compName);
        result.push(compName);

        let foundProd = null;
        for (const catProds of Object.values(STATE.products)) {
            foundProd = catProds.find(item => item.name === compName);
            if (foundProd) break;
        }

        if (foundProd && foundProd.components) {
            let subComps = foundProd.components;
            if (typeof subComps === 'string') {
                try { subComps = JSON.parse(subComps); } catch(e){}
            }
            if (Array.isArray(subComps) && subComps.length > 0) {
                const nested = getAllNestedComponentNames(subComps, visited);
                result = result.concat(nested);
            }
        }
    });

    return result;
}
window.getAllNestedComponentNames = getAllNestedComponentNames;

function openLinkedProductsModal(btn) {
    currentEditingCompositeRow = btn.closest('.product-row');
    if (!currentEditingCompositeRow) return;

    const nameInput = currentEditingCompositeRow.querySelector('.col-name') || currentEditingCompositeRow.querySelector('input[type="text"]');
    const compName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'Prodotto Composto';

    const subtitleEl = document.getElementById('linked-products-subtitle');
    if (subtitleEl) {
        subtitleEl.innerHTML = `Seleziona i prodotti del menu collegati a <b>${compName}</b>:`;
    }

    let linkedArray = [];
    if (currentEditingCompositeRow.dataset.linkedProducts) {
        try {
            linkedArray = JSON.parse(currentEditingCompositeRow.dataset.linkedProducts);
        } catch (e) {}
    }

    const listEl = document.getElementById('linked-products-list');
    listEl.innerHTML = '';

    const menuCategories = [];
    document.querySelectorAll('.editor-section').forEach(sec => {
        let catName = '';
        const nameInput = sec.querySelector('.cat-name-input');
        if (nameInput) catName = nameInput.value.trim();
        else {
            const titleEl = sec.querySelector('.fixed-cat-title-text');
            if (titleEl) catName = titleEl.innerText.trim();
        }
        if (!catName) catName = 'Categoria';

        const prods = [];
        sec.querySelectorAll('.products-list-standard .product-row, .products-list-composite .product-row').forEach(row => {
            if (row === currentEditingCompositeRow) return;
            const pInput = row.querySelector('.col-name') || row.querySelector('input[type="text"]');
            const priceInput = row.querySelector('.col-price') || row.querySelectorAll('input')[1];
            const pName = pInput ? pInput.value.trim() : '';
            const pPrice = priceInput ? (parseFloat(priceInput.value) || 0) : 0;
            const isCompRow = row.closest('.products-list-composite') !== null;
            let compSubItems = [];
            if (isCompRow && row.dataset.linkedProducts) {
                try { compSubItems = JSON.parse(row.dataset.linkedProducts); } catch(e){}
            }

            if (pName && pName.toLowerCase() !== compName.toLowerCase()) {
                prods.push({ name: pName, price: pPrice, is_composite: isCompRow, components: compSubItems });
            }
        });

        if (prods.length > 0) {
            menuCategories.push({ category: catName, products: prods });
        }
    });

    // Also include Base Products in linkable components selection list
    const baseProds = [];
    document.querySelectorAll('#base-products-list .base-product-row').forEach(row => {
        const pInput = row.querySelector('.base-name-input');
        const pName = pInput ? pInput.value.trim() : '';
        if (pName && pName.toLowerCase() !== compName.toLowerCase()) {
            baseProds.push({ name: pName, price: 0, is_composite: false });
        }
    });
    if (baseProds.length > 0) {
        menuCategories.push({ category: 'Prodotti Base', products: baseProds });
    }

    if (menuCategories.length === 0) {
        listEl.innerHTML = '<div style="padding:16px; text-align:center; color:var(--text-light);">Nessun altro prodotto trovato nel menu da collegare. Aggiungi prima dei prodotti nel menu per poterli collegare.</div>';
    } else {
        let html = '';
        menuCategories.forEach(cat => {
            html += `
                <div style="margin-bottom: 16px;">
                    <div style="font-weight: 700; color: var(--primary); font-size: 0.9rem; margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; text-transform: uppercase;">
                        ${cat.category}
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">
                        ${cat.products.map(p => {
                            const isChecked = linkedArray.includes(p.name);
                            let typeIconHTML = '';
                            let compDataAttr = '';
                            if (p.is_composite) {
                                typeIconHTML = `<span class="material-symbols-rounded" style="font-size: 1.05rem; vertical-align: middle; margin-right: 4px; color: var(--primary);" title="Prodotto Composto">link</span>`;
                                if (Array.isArray(p.components) && p.components.length > 0) {
                                    compDataAttr = `data-components="${encodeURIComponent(JSON.stringify(p.components))}"`;
                                }
                            }
                            return `
                                <label class="linked-prod-item" style="display: flex; align-items: center; padding: 6px 8px; border-radius: 6px; transition: background 0.15s;">
                                    <input type="checkbox" class="linked-prod-checkbox" value="${p.name}" ${compDataAttr} ${isChecked ? 'checked' : ''} onchange="updateLinkedProductsDisabling()" style="width: 18px; height: 18px; cursor: pointer; margin-right: 6px;">
                                    <span class="linked-prod-name" style="font-weight: 600; font-size: 0.9rem; display: inline-flex; align-items: center; flex: 1;">${typeIconHTML}${p.name}</span>
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        });
        listEl.innerHTML = html;
        updateLinkedProductsDisabling();
    }

    const modal = document.getElementById('linked-products-modal');
    if (modal) modal.style.display = 'flex';
}

function updateLinkedProductsDisabling() {
    const listEl = document.getElementById('linked-products-list');
    if (!listEl) return;

    const isEditingSelectionProduct = currentEditingCompositeRow && currentEditingCompositeRow.closest('.products-list-selection') !== null;

    const disabledMap = {}; // { subCompName: parentCompName }
    const checkboxes = listEl.querySelectorAll('.linked-prod-checkbox');

    // Pass 1: find all checked composite products and resolve sub-components
    checkboxes.forEach(cb => {
        if (cb.checked && !cb.disabled) {
            const compAttr = cb.dataset.components;
            if (compAttr) {
                try {
                    const comps = JSON.parse(decodeURIComponent(compAttr));
                    if (Array.isArray(comps) && comps.length > 0) {
                        const allNested = getAllNestedComponentNames(comps);
                        allNested.forEach(nestedName => {
                            const targetCb = Array.from(checkboxes).find(item => item.value === nestedName);
                            const isTargetComposite = targetCb && targetCb.hasAttribute('data-components');

                            // For Selection Products: block ONLY non-composite sub-products
                            // For Composite Products: block ALL sub-products (both composite and non-composite)
                            const shouldBlock = isEditingSelectionProduct ? !isTargetComposite : true;

                            if (shouldBlock && !disabledMap[nestedName]) {
                                disabledMap[nestedName] = cb.value;
                            }
                        });
                    }
                } catch(e) {}
            }
        }
    });

    // Pass 2: update checkboxes state and labels
    checkboxes.forEach(cb => {
        const itemLabel = cb.closest('.linked-prod-item');
        const parentComp = disabledMap[cb.value];

        if (parentComp && cb.value !== parentComp) {
            cb.disabled = true;
            cb.checked = false;
            cb.classList.add('inherited-disabled-cb');
            if (itemLabel) {
                itemLabel.style.opacity = '0.5';
                itemLabel.style.cursor = 'not-allowed';
                itemLabel.title = `Selezione bloccata: componente già incluso in "${parentComp}"`;
                let badge = itemLabel.querySelector('.inherited-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'inherited-badge';
                    badge.style.cssText = 'font-size: 0.72rem; color: #64748b; background: rgba(100, 116, 139, 0.12); border: 1px solid rgba(100, 116, 139, 0.25); border-radius: 4px; padding: 2px 6px; margin-left: 6px; font-weight: 600; white-space: nowrap;';
                    itemLabel.appendChild(badge);
                }
                badge.innerText = `Già incluso da ${parentComp}`;
            }
        } else {
            if (cb.classList.contains('inherited-disabled-cb')) {
                cb.disabled = false;
                cb.checked = false;
                cb.classList.remove('inherited-disabled-cb');
            } else if (!cb.dataset.components) {
                cb.disabled = false;
            } else {
                cb.disabled = false;
            }

            if (itemLabel) {
                itemLabel.style.opacity = '1';
                itemLabel.style.cursor = 'pointer';
                itemLabel.removeAttribute('title');
                const badge = itemLabel.querySelector('.inherited-badge');
                if (badge) badge.remove();
            }
        }
    });
}
window.updateLinkedProductsDisabling = updateLinkedProductsDisabling;

function closeLinkedProductsModal() {
    const modal = document.getElementById('linked-products-modal');
    if (modal) modal.style.display = 'none';
    currentEditingCompositeRow = null;
}

function saveLinkedProductsSelection() {
    if (!currentEditingCompositeRow) return;

    const selectedNames = [];
    document.querySelectorAll('#linked-products-list .linked-prod-checkbox:checked').forEach(cb => {
        selectedNames.push(cb.value);
    });

    currentEditingCompositeRow.dataset.linkedProducts = JSON.stringify(selectedNames);

    const btn = currentEditingCompositeRow.querySelector('.btn-linked-products');
    if (btn) {
        if (selectedNames.length > 0) {
            btn.classList.add('has-links');
            btn.querySelector('span:last-child').innerText = `${selectedNames.length} collegati`;
        } else {
            btn.classList.remove('has-links');
            btn.querySelector('span:last-child').innerText = `Collega`;
        }
    }

    closeLinkedProductsModal();
}

window.openLinkedProductsModal = openLinkedProductsModal;
window.closeLinkedProductsModal = closeLinkedProductsModal;
window.saveLinkedProductsSelection = saveLinkedProductsSelection;

let currentPosSelectionProduct = null;
let currentPosSelectionCategory = '';

function areArraysEqual(arr1, arr2) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
    if (arr1.length !== arr2.length) return false;
    const s1 = [...arr1].sort();
    const s2 = [...arr2].sort();
    return s1.every((val, index) => val === s2[index]);
}

function openPosSelectionModal(foundProduct, foundCategory) {
    currentPosSelectionProduct = foundProduct;
    currentPosSelectionCategory = foundCategory;

    const titleEl = document.getElementById('pos-selection-title');
    if (titleEl) titleEl.innerText = foundProduct.name;

    const subtitleEl = document.getElementById('pos-selection-subtitle');
    if (subtitleEl) subtitleEl.innerText = `Scegli i componenti per "${foundProduct.name}":`;

    const listEl = document.getElementById('pos-selection-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    let comps = foundProduct.components || [];
    if (typeof comps === 'string') {
        try { comps = JSON.parse(comps); } catch(e){}
    }

    if (!Array.isArray(comps) || comps.length === 0) {
        listEl.innerHTML = '<div style="color:var(--text-light); text-align:center; padding:12px;">Nessun prodotto collegato a questo elemento.</div>';
    } else {
        // Group components by Category
        const grouped = {};

        comps.forEach(compName => {
            let compProd = null;
            let compCat = 'Altro';
            for (const [catName, catProds] of Object.entries(STATE.products)) {
                const found = catProds.find(item => item.name === compName);
                if (found) {
                    compProd = found;
                    compCat = catName;
                    break;
                }
            }

            // Base products (type === 'base' or category === 'Prodotti Base') must NOT appear in the POS choice modal
            if (compCat === 'Prodotti Base' || (compProd && compProd.type === 'base')) {
                return;
            }

            let hasLimit = false;
            let remStock = null;
            let isOOS = false;

            if (compProd) {
                if (compProd.is_composite === 1) {
                    // Calculate composite product remaining stock dynamically from its sub-components
                    let subComps = compProd.components || [];
                    if (typeof subComps === 'string') {
                        try { subComps = JSON.parse(subComps); } catch(e){}
                    }

                    if (Array.isArray(subComps) && subComps.length > 0) {
                        let minRemaining = Infinity;
                        let foundLimit = false;
                        const allNested = getAllNestedComponentNames(subComps);

                        for (const subName of allNested) {
                            let subProd = null;
                            for (const catProds of Object.values(STATE.products)) {
                                subProd = catProds.find(item => item.name === subName);
                                if (subProd) break;
                            }

                            if (subProd && subProd.quantity !== null && subProd.quantity !== undefined) {
                                foundLimit = true;
                                let totalUsedInCart = 0;
                                STATE.cart.forEach(cartItem => {
                                    if (cartItem.id === subProd.id || cartItem.name === subProd.name) {
                                        totalUsedInCart += cartItem.quantity;
                                    } else if ((cartItem.is_composite === 1 || cartItem.is_selection === 1) && Array.isArray(cartItem.components) && getAllNestedComponentNames(cartItem.components).includes(subProd.name)) {
                                        totalUsedInCart += cartItem.quantity;
                                    }
                                });

                                const rem = subProd.quantity - totalUsedInCart;
                                if (rem < minRemaining) minRemaining = rem;
                            }
                        }

                        if (foundLimit && minRemaining !== Infinity) {
                            hasLimit = true;
                            remStock = minRemaining;
                        }
                    }
                    isOOS = hasLimit && remStock <= 0;
                } else {
                    hasLimit = (compProd.quantity !== null && compProd.quantity !== undefined);
                    if (hasLimit) {
                        let totalUsedInCart = 0;
                        STATE.cart.forEach(cartItem => {
                            if (cartItem.id === compProd.id || cartItem.name === compProd.name) {
                                totalUsedInCart += cartItem.quantity;
                            } else if ((cartItem.is_composite === 1 || cartItem.is_selection === 1) && Array.isArray(cartItem.components) && getAllNestedComponentNames(cartItem.components).includes(compProd.name)) {
                                totalUsedInCart += cartItem.quantity;
                            }
                        });
                        remStock = compProd.quantity - totalUsedInCart;
                        isOOS = remStock <= 0;
                    }
                }
            }

            if (!grouped[compCat]) grouped[compCat] = [];
            grouped[compCat].push({
                compName,
                hasLimit,
                remStock,
                isOOS,
                isComp: compProd && compProd.is_composite === 1,
                isSel: compProd && compProd.is_selection === 1
            });
        });

        // Render categories
        for (const [catName, items] of Object.entries(grouped)) {
            const catHeader = document.createElement('div');
            catHeader.style.cssText = 'font-weight: 700; color: var(--primary); font-size: 0.85rem; margin: 12px 0 6px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; text-transform: uppercase;';
            catHeader.innerText = catName;
            listEl.appendChild(catHeader);

            const grid = document.createElement('div');
            grid.className = 'pos-select-grid';

            const isSingleInCat = items.length === 1;

            items.forEach(item => {
                const isPreselected = isSingleInCat && !item.isOOS;

                const card = document.createElement('div');
                card.className = `pos-select-card ${item.isOOS ? 'is-oos' : (isPreselected ? 'selected' : '')}`;
                card.dataset.value = item.compName;
                card.onclick = function() { togglePosCardSelection(this); };

                const badgeHTML = item.hasLimit ? `<span class="qty-badge ${item.isOOS ? 'oos' : ''}">${Math.max(0, item.remStock)}</span>` : '';
                const iconHTML = item.isComp ? `<span class="material-symbols-rounded" style="font-size: 1.05rem; vertical-align: middle; margin-right: 4px; color: var(--primary);" title="Prodotto Composto">link</span>` : (item.isSel ? `<span class="material-symbols-rounded" style="font-size: 1.05rem; vertical-align: middle; margin-right: 4px; color: var(--primary);" title="Prodotto con Selezione">checklist</span>` : '');

                card.innerHTML = `
                    ${badgeHTML}
                    <span class="pos-select-card-name" style="display: inline-flex; align-items: center; justify-content: center; gap: 2px;">${iconHTML}${item.compName}</span>
                `;
                grid.appendChild(card);
            });

            listEl.appendChild(grid);
        }

        updatePosSelectionModalStockBadges();
    }

    const modal = document.getElementById('pos-selection-modal');
    if (modal) modal.style.display = 'flex';
}

function updatePosSelectionModalStockBadges() {
    const listEl = document.getElementById('pos-selection-list');
    if (!listEl || !currentPosSelectionProduct) return;

    // Collect all component names currently SELECTED in the popup
    const currentlySelectedCardValues = [];
    listEl.querySelectorAll('.pos-select-card.selected').forEach(card => {
        if (card.dataset.value) currentlySelectedCardValues.push(card.dataset.value);
    });

    // Calculate temporary component usage from popup selections
    const popupSelectionComponentCounts = {};
    const popupNestedComps = getAllNestedComponentNames(currentlySelectedCardValues);
    popupNestedComps.forEach(compName => {
        popupSelectionComponentCounts[compName] = (popupSelectionComponentCounts[compName] || 0) + 1;
    });

    // Re-evaluate stock badges for every card in popup
    listEl.querySelectorAll('.pos-select-card').forEach(card => {
        const compName = card.dataset.value;
        if (!compName) return;

        let compProd = null;
        for (const catProds of Object.values(STATE.products)) {
            compProd = catProds.find(item => item.name === compName);
            if (compProd) break;
        }

        if (!compProd) return;

        const isThisCardSelected = card.classList.contains('selected');

        let isBlockedBySelectedComposite = false;
        if (!isThisCardSelected && currentlySelectedCardValues.length > 0) {
            currentlySelectedCardValues.forEach(selectedName => {
                if (selectedName === compName) return;
                let selProd = null;
                for (const catProds of Object.values(STATE.products)) {
                    selProd = catProds.find(item => item.name === selectedName);
                    if (selProd) break;
                }

                if (selProd && selProd.is_composite === 1) {
                    let selComps = selProd.components || [];
                    if (typeof selComps === 'string') {
                        try { selComps = JSON.parse(selComps); } catch(e){}
                    }
                    const selNested = getAllNestedComponentNames(selComps);

                    let cardComps = compProd.components || [];
                    if (typeof cardComps === 'string') {
                        try { cardComps = JSON.parse(cardComps); } catch(e){}
                    }
                    const cardNested = getAllNestedComponentNames(cardComps);

                    if (selNested.includes(compName) || cardNested.includes(selectedName)) {
                        isBlockedBySelectedComposite = true;
                    }
                }
            });
        }

        let hasLimit = false;
        let remStock = null;
        let isOOS = false;

        if (compProd.is_composite === 1) {
            let subComps = compProd.components || [];
            if (typeof subComps === 'string') {
                try { subComps = JSON.parse(subComps); } catch(e){}
            }

            if (Array.isArray(subComps) && subComps.length > 0) {
                let minRemaining = Infinity;
                let foundLimit = false;
                const allNested = getAllNestedComponentNames(subComps);

                for (const subName of allNested) {
                    let subProd = null;
                    for (const catProds of Object.values(STATE.products)) {
                        subProd = catProds.find(item => item.name === subName);
                        if (subProd) break;
                    }

                    if (subProd && subProd.quantity !== null && subProd.quantity !== undefined) {
                        foundLimit = true;
                        let totalUsedInCart = 0;
                        STATE.cart.forEach(cartItem => {
                            if (cartItem.id === subProd.id || cartItem.name === subProd.name) {
                                totalUsedInCart += cartItem.quantity;
                            } else if ((cartItem.is_composite === 1 || cartItem.is_selection === 1) && Array.isArray(cartItem.components) && getAllNestedComponentNames(cartItem.components).includes(subProd.name)) {
                                totalUsedInCart += cartItem.quantity;
                            }
                        });

                        let popupUsed = popupSelectionComponentCounts[subProd.name] || 0;
                        if (isThisCardSelected) {
                            const thisCardNested = getAllNestedComponentNames([compName]);
                            if (thisCardNested.includes(subProd.name)) {
                                popupUsed = Math.max(0, popupUsed - 1);
                            }
                        }

                        const rem = subProd.quantity - (totalUsedInCart + popupUsed);
                        if (rem < minRemaining) minRemaining = rem;
                    }
                }

                if (foundLimit && minRemaining !== Infinity) {
                    hasLimit = true;
                    remStock = minRemaining;
                }
            }
            isOOS = (hasLimit && remStock <= 0 && !isThisCardSelected) || isBlockedBySelectedComposite;
        } else {
            hasLimit = (compProd.quantity !== null && compProd.quantity !== undefined);
            if (hasLimit) {
                let totalUsedInCart = 0;
                STATE.cart.forEach(cartItem => {
                    if (cartItem.id === compProd.id || cartItem.name === compProd.name) {
                        totalUsedInCart += cartItem.quantity;
                    } else if ((cartItem.is_composite === 1 || cartItem.is_selection === 1) && Array.isArray(cartItem.components) && getAllNestedComponentNames(cartItem.components).includes(compProd.name)) {
                        totalUsedInCart += cartItem.quantity;
                    }
                });
                let popupUsed = popupSelectionComponentCounts[compProd.name] || 0;
                if (isThisCardSelected) {
                    popupUsed = Math.max(0, popupUsed - 1);
                }
                remStock = compProd.quantity - (totalUsedInCart + popupUsed);
                isOOS = (remStock <= 0 && !isThisCardSelected) || isBlockedBySelectedComposite;
            } else if (isBlockedBySelectedComposite) {
                isOOS = true;
            }
        }

        let badgeEl = card.querySelector('.qty-badge');
        if (hasLimit) {
            const displayQty = Math.max(0, remStock);
            if (!badgeEl) {
                badgeEl = document.createElement('span');
                card.insertBefore(badgeEl, card.firstChild);
            }
            badgeEl.className = `qty-badge ${isOOS ? 'oos' : ''}`;
            badgeEl.innerText = displayQty;
        } else if (badgeEl) {
            badgeEl.remove();
        }

        if (isOOS) {
            card.classList.add('is-oos');
            card.classList.remove('selected');
        } else {
            card.classList.remove('is-oos');
        }
    });
}
window.updatePosSelectionModalStockBadges = updatePosSelectionModalStockBadges;

function togglePosCardSelection(card) {
    if (card.classList.contains('is-oos')) return;
    card.classList.toggle('selected');
    updatePosSelectionModalStockBadges();
}
window.togglePosCardSelection = togglePosCardSelection;

function closePosSelectionModal() {
    const modal = document.getElementById('pos-selection-modal');
    if (modal) modal.style.display = 'none';
    currentPosSelectionProduct = null;
    currentPosSelectionCategory = '';
}

function confirmPosSelection() {
    if (!currentPosSelectionProduct) return closePosSelectionModal();

    const selectedCards = document.querySelectorAll('#pos-selection-list .pos-select-card.selected');
    const selectedComps = Array.from(selectedCards).map(card => card.dataset.value);

    if (selectedComps.length === 0) {
        return showToast("Seleziona almeno un componente", "error");
    }

    // Check stock for each selected component
    for (const compName of selectedComps) {
        let compProd = null;
        for (const catProds of Object.values(STATE.products)) {
            compProd = catProds.find(item => item.name === compName);
            if (compProd) break;
        }

        if (compProd && compProd.quantity !== null && compProd.quantity !== undefined) {
            let totalUsedInCart = 0;
            STATE.cart.forEach(cartItem => {
                if (cartItem.id === compProd.id || cartItem.name === compProd.name) {
                    totalUsedInCart += cartItem.quantity;
                } else if (Array.isArray(cartItem.components) && cartItem.components.includes(compProd.name)) {
                    totalUsedInCart += cartItem.quantity;
                }
            });

            if ((totalUsedInCart + 1) > compProd.quantity) {
                showToast(`Scorte esaurite per: ${compProd.name}`, "error");
                return;
            }
        }
    }

    // Check if an item with exact same product ID and exact same selected components already exists in cart
    const existingInCart = STATE.cart.find(item => 
        item.id === currentPosSelectionProduct.id && 
        item.is_selection === 1 && 
        areArraysEqual(item.components, selectedComps)
    );

    if (existingInCart) {
        existingInCart.quantity++;
    } else {
        STATE.cart.push({
            id: currentPosSelectionProduct.id,
            name: currentPosSelectionProduct.name,
            price: currentPosSelectionProduct.price,
            quantity: 1,
            category: currentPosSelectionCategory,
            is_selection: 1,
            is_composite: 0,
            components: selectedComps,
            selectedComponents: selectedComps
        });
    }

    closePosSelectionModal();
    renderCart();
    renderProducts();
}

window.openPosSelectionModal = openPosSelectionModal;
window.closePosSelectionModal = closePosSelectionModal;
window.confirmPosSelection = confirmPosSelection;

// --- PRODUCT REORDER FUNCTIONS ---
function openProductReorderModal() {
    const container = document.getElementById('reorder-categories-container');
    if (!container) return;
    container.innerHTML = '';

    const sections = document.querySelectorAll('.editor-section');
    if (sections.length === 0) {
        return showToast("Nessuna categoria presente nel menu", "error");
    }

    let hasProducts = false;

    sections.forEach((sec, secIdx) => {
        let catName = '';
        const nameInput = sec.querySelector('.cat-name-input');
        if (nameInput) {
            catName = nameInput.value.trim();
        } else {
            const titleEl = sec.querySelector('.fixed-cat-title-text');
            if (titleEl) catName = titleEl.innerText.trim();
        }
        if (!catName) return;

        const productRows = Array.from(sec.querySelectorAll('.product-row'));
        if (productRows.length === 0) return;

        const stateProds = STATE.products ? STATE.products[catName] : null;
        const prods = [];

        function getRowId(row) {
            if (!row.id) {
                row.id = `prow-${secIdx}-${Math.random().toString(36).substr(2, 9)}`;
            }
            return row.id;
        }

        if (Array.isArray(stateProds) && stateProds.length > 0) {
            stateProds.forEach(sp => {
                const matchingRow = productRows.find(row => {
                    const isComp = row.dataset.isComposite === "1" || row.classList.contains('is-composite-row');
                    const isSel = row.dataset.isSelection === "1";
                    const nameInput = row.querySelector('.col-name input') || row.querySelector('input[type="text"]');
                    const pName = nameInput ? nameInput.value.trim() : '';
                    return pName === sp.name && (isComp === (sp.is_composite === 1)) && (isSel === (sp.is_selection === 1));
                });

                if (matchingRow) {
                    prods.push({
                        rowId: getRowId(matchingRow),
                        name: sp.name,
                        price: sp.price,
                        isComp: sp.is_composite === 1,
                        isSel: sp.is_selection === 1
                    });
                }
            });
        }

        productRows.forEach(row => {
            const nameInput = row.querySelector('.col-name input') || row.querySelector('input[type="text"]');
            const priceInput = row.querySelector('input.col-price') || row.querySelectorAll('input')[1];
            const pName = nameInput ? nameInput.value.trim() : '';
            const pPrice = priceInput ? parseFloat(priceInput.value) : 0;
            const isComp = row.dataset.isComposite === "1" || row.classList.contains('is-composite-row');
            const isSel = row.dataset.isSelection === "1";

            if (pName && !prods.some(p => p.name === pName)) {
                prods.push({
                    rowId: getRowId(row),
                    name: pName,
                    price: isNaN(pPrice) ? 0 : pPrice,
                    isComp,
                    isSel
                });
            }
        });

        if (prods.length > 0) {
            hasProducts = true;

            const trimmedName = catName.trim();
            let catIcon = 'category';
            if (trimmedName === 'Cibo') catIcon = 'restaurant';
            if (trimmedName === 'Bevande') catIcon = 'local_bar';

            const catSec = document.createElement('div');
            catSec.className = 'category-section reorder-cat-section';
            catSec.dataset.catName = catName;

            const gridHTML = prods.map(p => {
                let typeIcon = '';
                if (p.isSel) {
                    typeIcon = `<span class="material-symbols-rounded" style="font-size: 1.05rem; vertical-align: middle; margin-right: 4px; opacity: 0.85;">checklist</span>`;
                } else if (p.isComp) {
                    typeIcon = `<span class="material-symbols-rounded" style="font-size: 1.05rem; vertical-align: middle; margin-right: 4px; opacity: 0.85;">link</span>`;
                }

                return `
                    <div class="product-btn reorder-btn" draggable="true" data-row-id="${p.rowId}" data-name="${p.name.replace(/"/g, '&quot;')}" data-price="${p.price}">
                        <span class="material-symbols-rounded reorder-handle">drag_indicator</span>
                        <span class="product-name">${typeIcon}${p.name}</span>
                        <span class="product-price">€ ${p.price.toFixed(2)}</span>
                    </div>
                `;
            }).join('');

            catSec.innerHTML = `
                <div class="category-title" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span class="material-symbols-rounded" style="font-size: 1.3rem;">${catIcon}</span>
                        ${catName}
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button type="button" class="btn-sort-cat" onclick="sortReorderGrid(this, 'name')" title="Ordina A-Z in questa categoria">
                            <span class="material-symbols-rounded" style="font-size: 1.05rem;">sort_by_alpha</span> A-Z
                        </button>
                        <button type="button" class="btn-sort-cat" onclick="sortReorderGrid(this, 'price')" title="Ordina per prezzo in questa categoria">
                            <span class="material-symbols-rounded" style="font-size: 1.05rem;">attach_money</span> Prezzo
                        </button>
                    </div>
                </div>
                <div class="reorder-grid" data-cat-name="${catName}">
                    ${gridHTML}
                </div>
            `;

            container.appendChild(catSec);
        }
    });

    if (!hasProducts) {
        return showToast("Nessun prodotto presente da riordinare", "error");
    }

    setupReorderDragAndDrop();
    const modal = document.getElementById('product-reorder-modal');
    if (modal) modal.style.display = 'flex';
}

function sortReorderGrid(btnEl, mode) {
    const sec = btnEl.closest('.reorder-cat-section');
    if (!sec) return;

    const grid = sec.querySelector('.reorder-grid');
    if (!grid) return;

    const btns = Array.from(grid.querySelectorAll('.reorder-btn'));
    if (btns.length <= 1) return;

    btns.sort((a, b) => {
        const nameA = (a.dataset.name || '').trim().toLowerCase();
        const nameB = (b.dataset.name || '').trim().toLowerCase();
        const priceA = parseFloat(a.dataset.price) || 0;
        const priceB = parseFloat(b.dataset.price) || 0;

        if (mode === 'name') {
            return nameA.localeCompare(nameB, 'it', { sensitivity: 'base' });
        } else if (mode === 'price') {
            if (priceA !== priceB) return priceA - priceB;
            return nameA.localeCompare(nameB, 'it', { sensitivity: 'base' });
        }
        return 0;
    });

    btns.forEach(btn => grid.appendChild(btn));

    if (mode === 'name') {
        showToast("Tessere riordinate in ordine alfabetico (A-Z)", "info");
    } else {
        showToast("Tessere riordinate per prezzo crescente", "info");
    }
}
window.sortReorderGrid = sortReorderGrid;

function closeProductReorderModal() {
    const modal = document.getElementById('product-reorder-modal');
    if (modal) modal.style.display = 'none';
}

let reorderDraggedBtn = null;

function setupReorderDragAndDrop() {
    const btnList = document.querySelectorAll('.reorder-btn');
    btnList.forEach(btn => {
        btn.addEventListener('dragstart', (e) => {
            reorderDraggedBtn = btn;
            btn.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', btn.dataset.rowId);
        });

        btn.addEventListener('dragend', () => {
            btn.classList.remove('dragging');
            reorderDraggedBtn = null;
        });

        btn.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (!reorderDraggedBtn) return;

            const targetBtn = e.target.closest('.reorder-btn');
            if (targetBtn && targetBtn !== reorderDraggedBtn && targetBtn.parentNode === reorderDraggedBtn.parentNode) {
                const rect = targetBtn.getBoundingClientRect();
                const midX = rect.left + rect.width / 2;
                const midY = rect.top + rect.height / 2;
                const isAfter = (e.clientX > midX && e.clientY >= rect.top && e.clientY <= rect.bottom) || e.clientY > midY;
                if (isAfter) {
                    targetBtn.parentNode.insertBefore(reorderDraggedBtn, targetBtn.nextSibling);
                } else {
                    targetBtn.parentNode.insertBefore(reorderDraggedBtn, targetBtn);
                }
            }
        });
    });
}

async function saveProductReorder() {
    const grids = document.querySelectorAll('#reorder-categories-container .reorder-grid');

    grids.forEach(grid => {
        const reorderedBtns = grid.querySelectorAll('.reorder-btn');
        reorderedBtns.forEach((btn, idx) => {
            const rowId = btn.dataset.rowId;
            const rowEl = document.getElementById(rowId);
            if (rowEl) {
                rowEl.dataset.position = idx;
                if (rowEl.parentNode) {
                    rowEl.parentNode.appendChild(rowEl);
                }
            }
        });
    });

    closeProductReorderModal();
    markMenuDirty();
    await saveMenu(true, "Ordine prodotti salvato con successo!");
    renderEditor();
}

window.openProductReorderModal = openProductReorderModal;
window.closeProductReorderModal = closeProductReorderModal;
window.saveProductReorder = saveProductReorder;

// --- BASE PRODUCTS SIDE PANEL ---
function toggleBaseProductsDrawer(e) {
    if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
    }
    const panel = document.getElementById('base-products-drawer');
    if (!panel) return;
    if (panel.classList.contains('open')) {
        closeBaseProductsDrawer(e);
    } else {
        openBaseProductsDrawer(e);
    }
}

function openBaseProductsDrawer(e) {
    if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
    }
    const drawer = document.getElementById('base-products-drawer');
    if (!drawer) return;
    drawer.classList.add('open');
}

function closeBaseProductsDrawer(e) {
    if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
    }
    const drawer = document.getElementById('base-products-drawer');
    if (drawer) drawer.classList.remove('open');
}

// Global click handler: Click on peeking panel opens panel, click outside open panel closes panel
document.addEventListener('click', function(e) {
    const drawer = document.getElementById('base-products-drawer');
    if (!drawer) return;

    if (drawer.classList.contains('open')) {
        if (!drawer.contains(e.target)) {
            closeBaseProductsDrawer(e);
        }
    } else {
        if (drawer.contains(e.target)) {
            openBaseProductsDrawer(e);
        }
    }
});

function addBaseProductRowUI(name = '', quantity = '') {
    const list = document.getElementById('base-products-list');
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'base-product-row';

    const qtyVal = (quantity !== null && quantity !== undefined) ? quantity : '';

    row.innerHTML = `
      <div class="product-name-wrapper">
        <input type="text" class="input-field col-name base-name-input" placeholder="es. Pane" value="${name}">
      </div>
      <input type="number" class="input-field col-qty base-qty-input" placeholder="Illimitata" value="${qtyVal}" min="0" title="Lascia vuoto per scorte illimitate">
      <button type="button" class="btn-del-product" title="Elimina Prodotto Base" onclick="this.closest('.base-product-row').remove()">
        <span class="material-symbols-rounded" style="font-size: 1.2rem;">delete_outline</span>
      </button>
    `;

    list.appendChild(row);

    if (!name) {
        const nameInput = row.querySelector('.base-name-input');
        if (nameInput) nameInput.focus();
    }
}

function renderBaseProductsUI() {
    const list = document.getElementById('base-products-list');
    if (!list) return;
    list.innerHTML = '';

    const baseProds = [];
    if (STATE.products) {
        Object.values(STATE.products).forEach(prods => {
            if (Array.isArray(prods)) {
                prods.forEach(p => {
                    if (p.type === 'base') {
                        baseProds.push(p);
                    }
                });
            }
        });
    }

    if (baseProds.length > 0) {
        baseProds.forEach(bp => {
            addBaseProductRowUI(bp.name, bp.quantity);
        });
    } else {
        addBaseProductRowUI();
    }
}

window.toggleBaseProductsDrawer = toggleBaseProductsDrawer;
window.openBaseProductsDrawer = openBaseProductsDrawer;
window.closeBaseProductsDrawer = closeBaseProductsDrawer;
window.addBaseProductRowUI = addBaseProductRowUI;
window.renderBaseProductsUI = renderBaseProductsUI;

function addProductUI(container, name = '', price = '', quantity = '', isComposite = false, isSelection = false, linkedProducts = [], position = null) {
    const row = document.createElement('div');
    const isComp = !!isComposite;
    const isSel = !!isSelection;
    row.className = 'product-row';
    if (position !== null && position !== undefined) {
        row.dataset.position = position;
    }

    if (isComp) {
        row.dataset.isComposite = "1";
        const section = container.closest('.editor-section');
        if (section) {
            const compHeader = section.querySelector('.composite-table-header');
            if (compHeader) compHeader.style.display = 'flex';
        }
        if (Array.isArray(linkedProducts) && linkedProducts.length > 0) {
            row.dataset.linkedProducts = JSON.stringify(linkedProducts);
        }
    } else if (isSel) {
        row.dataset.isSelection = "1";
        const section = container.closest('.editor-section');
        if (section) {
            const selHeader = section.querySelector('.selection-table-header');
            if (selHeader) selHeader.style.display = 'flex';
        }
        if (Array.isArray(linkedProducts) && linkedProducts.length > 0) {
            row.dataset.linkedProducts = JSON.stringify(linkedProducts);
        }
    }

    const qtyVal = (quantity !== null && quantity !== undefined) ? quantity : '';

    let qtyFieldHTML = '';
    if (isComp || isSel) {
        let linksCount = 0;
        if (row.dataset.linkedProducts) {
            try { linksCount = JSON.parse(row.dataset.linkedProducts).length; } catch(e){}
        }
        const hasLinks = linksCount > 0;
        const btnLabel = hasLinks ? `${linksCount} collegati` : `Collega`;
        qtyFieldHTML = `
          <button type="button" class="btn-linked-products col-qty ${hasLinks ? 'has-links' : ''}" onclick="openLinkedProductsModal(this)" title="Seleziona i prodotti del menu collegati">
            <span class="material-symbols-rounded" style="font-size: 1.1rem;">link</span>
            <span>${btnLabel}</span>
          </button>
        `;
    } else {
        qtyFieldHTML = `
          <input type="number" class="input-field col-qty" placeholder="Illimitata" value="${qtyVal}" min="0" title="Lascia vuoto per scorte illimitate">
        `;
    }

    let namePlaceholder = "es. Panino con salsiccia";
    if (isComp) namePlaceholder = "es. Menu Grigliata";
    if (isSel) namePlaceholder = "es. Piatto con Selezione";

    row.innerHTML = `
      <div class="product-name-wrapper">
        <input type="text" class="input-field col-name" placeholder="${namePlaceholder}" value="${name}">
      </div>
      <input type="number" class="input-field col-price" placeholder="0.00" value="${price}" step="0.10" min="0">
      ${qtyFieldHTML}
      <button type="button" class="btn-del-product" title="Elimina Prodotto" onclick="deleteProductRow(this)">
        <span class="material-symbols-rounded" style="font-size: 1.2rem;">delete_outline</span>
      </button>
    `;
    container.appendChild(row);

    if (!name) {
        const nameInput = row.querySelector('.col-name');
        if (nameInput) {
            setTimeout(() => nameInput.focus(), 10);
        }
    }
}

async function saveMenu(stayInEditor = false, customToastMsg = null) {
    if (!STATE.currentSagra) return;

    // Validate incomplete product rows before saving
    let validationError = null;
    let errorInputToFocus = null;

    document.querySelectorAll('.editor-section').forEach(sec => {
        if (validationError) return;

        let catName = '';
        const catNameInput = sec.querySelector('.cat-name-input');
        if (catNameInput) catName = catNameInput.value.trim();
        else {
            const titleEl = sec.querySelector('.fixed-cat-title-text');
            if (titleEl) catName = titleEl.innerText.trim();
        }

        sec.querySelectorAll('.product-row').forEach(row => {
            if (validationError) return;

            const nameInput = row.querySelector('.col-name input') || row.querySelector('input[type="text"]');
            const priceInput = row.querySelector('input.col-price') || row.querySelectorAll('input')[1];

            const pName = nameInput ? nameInput.value.trim() : '';
            const rawPrice = priceInput ? priceInput.value.trim() : '';
            const pPrice = priceInput ? parseFloat(priceInput.value) : NaN;

            if (pName !== '' && (rawPrice === '' || isNaN(pPrice))) {
                validationError = `Inserisci un prezzo per il prodotto "${pName}" in ${catName || 'Categoria'}.`;
                errorInputToFocus = priceInput;
            } else if (pName === '' && rawPrice !== '' && !isNaN(pPrice)) {
                validationError = `Inserisci il nome per il prodotto con prezzo € ${pPrice.toFixed(2)} in ${catName || 'Categoria'}.`;
                errorInputToFocus = nameInput;
            }
        });
    });

    if (validationError) {
        showToast(validationError, "error");
        if (errorInputToFocus) {
            errorInputToFocus.focus();
            errorInputToFocus.style.borderColor = 'var(--danger)';
            setTimeout(() => { errorInputToFocus.style.borderColor = ''; }, 3000);
        }
        return false;
    }

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
        let prodIdx = 0;
        sec.querySelectorAll('.product-row').forEach(row => {
            const isComp = row.dataset.isComposite === "1" || row.classList.contains('is-composite-row');
            const isSel = row.dataset.isSelection === "1";
            const nameInput = row.querySelector('.col-name input') || row.querySelector('input[type="text"]');
            const priceInput = row.querySelector('input.col-price') || row.querySelectorAll('input')[1];
            const qtyInput = row.querySelector('input.col-qty');

            const pName = nameInput ? nameInput.value.trim() : '';
            const pPrice = priceInput ? parseFloat(priceInput.value) : NaN;

            if (pName && !isNaN(pPrice)) {
                let pQty = null;
                let components = [];
                if (!isComp && !isSel && qtyInput && qtyInput.type === 'number') {
                    const pQtyStr = qtyInput.value.trim();
                    if (pQtyStr && !isNaN(parseInt(pQtyStr))) {
                        const parsed = parseInt(pQtyStr);
                        if (parsed > 0) pQty = parsed;
                    }
                }
                if ((isComp || isSel) && row.dataset.linkedProducts) {
                    try { components = JSON.parse(row.dataset.linkedProducts); } catch(e){}
                }
                const pType = isSel ? 'selection' : (isComp ? 'composite' : 'simple');
                const posVal = (row.dataset.position !== undefined && row.dataset.position !== "") ? parseInt(row.dataset.position) : prodIdx;
                prodIdx++;
                products.push({ name: pName, price: pPrice, quantity: pQty, type: pType, is_composite: isComp ? 1 : 0, is_selection: isSel ? 1 : 0, components, position: posVal });
            }
        });

        // Sort products by position before saving so backend writes them in position order
        products.sort((a, b) => (a.position !== undefined ? a.position : 0) - (b.position !== undefined ? b.position : 0));

        payload.categories.push({ name: catName, is_hidden: isHidden, products });
    });

    // Gather Base Products for system category 'Prodotti Base' with type = 'base'
    const baseProducts = [];
    document.querySelectorAll('#base-products-list .base-product-row').forEach(row => {
        const nameInput = row.querySelector('.base-name-input');
        const qtyInput = row.querySelector('.base-qty-input');
        const name = nameInput ? nameInput.value.trim() : '';
        if (name) {
            let qty = null;
            if (qtyInput && qtyInput.value.trim() !== '') {
                const parsed = parseInt(qtyInput.value.trim());
                if (!isNaN(parsed) && parsed >= 0) qty = parsed;
            }
            baseProducts.push({ name, price: 0, quantity: qty, type: 'base' });
        }
    });

    if (baseProducts.length > 0) {
        payload.categories.push({ name: 'Prodotti Base', is_hidden: 1, products: baseProducts });
    }

    try {
        const res = await fetch(`/api/sagras/${STATE.currentSagra.id}/menu`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            STATE.isMenuDirty = false;
            const toastMsg = customToastMsg || "Menu salvato con successo!";
            showToast(toastMsg, "success");
            await loadSagraResources();
            if (!stayInEditor) {
                showView('pos');
            }
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
        // Skip hidden category or Prodotti Base in POS Cassa view
        const meta = STATE.categoryMeta ? STATE.categoryMeta[category] : null;
        const isCatHidden = (meta && meta.is_hidden === 1) || (products.length > 0 && products[0].category_is_hidden === 1) || category === 'Prodotti Base';
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
            const isComp = p.is_composite === 1;
            const isSel = p.is_selection === 1;
            let remainingStock = null;
            let hasLimit = false;
            let isOOS = false;

            let oosComponentsList = [];

            if (isComp) {
                // Composite product: min remaining stock of components
                let comps = p.components || [];
                if (typeof comps === 'string') {
                    try { comps = JSON.parse(comps); } catch(e){}
                }

                if (Array.isArray(comps) && comps.length > 0) {
                    let minRemaining = Infinity;
                    let foundLimit = false;

                    const allNestedComps = getAllNestedComponentNames(comps);

                    for (const compName of allNestedComps) {
                        let compProd = null;
                        for (const catProds of Object.values(STATE.products)) {
                            compProd = catProds.find(item => item.name === compName);
                            if (compProd) break;
                        }

                        if (compProd && compProd.quantity !== null && compProd.quantity !== undefined) {
                            foundLimit = true;
                            let totalUsedInCart = 0;
                            STATE.cart.forEach(cartItem => {
                                if (cartItem.id === compProd.id || cartItem.name === compProd.name) {
                                    totalUsedInCart += cartItem.quantity;
                                } else if ((cartItem.is_composite === 1 || cartItem.is_selection === 1) && Array.isArray(cartItem.components) && getAllNestedComponentNames(cartItem.components).includes(compProd.name)) {
                                    totalUsedInCart += cartItem.quantity;
                                }
                            });

                            const compRem = compProd.quantity - totalUsedInCart;
                            if (compRem < minRemaining) minRemaining = compRem;
                            if (compRem <= 0 && !oosComponentsList.includes(compProd.name)) {
                                oosComponentsList.push(compProd.name);
                            }
                        }
                    }

                    if (foundLimit && minRemaining !== Infinity) {
                        hasLimit = true;
                        remainingStock = minRemaining;
                    }
                }
                isOOS = hasLimit && remainingStock <= 0;
            } else if (isSel) {
                // Prodotto con Selezione: no stock badge on main button
                // Disabled ONLY if ALL linked components are out of stock
                let comps = p.components || [];
                if (typeof comps === 'string') {
                    try { comps = JSON.parse(comps); } catch(e){}
                }

                if (Array.isArray(comps) && comps.length > 0) {
                    let hasAtLeastOneAvailable = false;
                    const allNestedComps = getAllNestedComponentNames(comps);

                    for (const compName of allNestedComps) {
                        let compProd = null;
                        for (const catProds of Object.values(STATE.products)) {
                            compProd = catProds.find(item => item.name === compName);
                            if (compProd) break;
                        }

                        if (!compProd || compProd.quantity === null || compProd.quantity === undefined) {
                            hasAtLeastOneAvailable = true;
                        } else {
                            let totalUsedInCart = 0;
                            STATE.cart.forEach(cartItem => {
                                if (cartItem.id === compProd.id || cartItem.name === compProd.name) {
                                    totalUsedInCart += cartItem.quantity;
                                } else if (Array.isArray(cartItem.components) && getAllNestedComponentNames(cartItem.components).includes(compProd.name)) {
                                    totalUsedInCart += cartItem.quantity;
                                }
                            });

                            const rem = compProd.quantity - totalUsedInCart;
                            if (rem > 0) {
                                hasAtLeastOneAvailable = true;
                            } else if (!oosComponentsList.includes(compProd.name)) {
                                oosComponentsList.push(compProd.name);
                            }
                        }
                    }
                    if (!hasAtLeastOneAvailable) {
                        isOOS = true;
                    }
                }
                hasLimit = false; // No badge for selection product
            } else {
                hasLimit = (p.quantity !== null && p.quantity !== undefined);
                let totalUsedInCart = 0;
                STATE.cart.forEach(cartItem => {
                    if (cartItem.id === p.id || cartItem.name === p.name) {
                        totalUsedInCart += cartItem.quantity;
                    } else if ((cartItem.is_composite === 1 || cartItem.is_selection === 1) && Array.isArray(cartItem.components) && getAllNestedComponentNames(cartItem.components).includes(p.name)) {
                        totalUsedInCart += cartItem.quantity;
                    }
                });
                remainingStock = hasLimit ? (p.quantity - totalUsedInCart) : null;
                isOOS = hasLimit && remainingStock <= 0;
            }

            const qtyLabel = hasLimit ? `<span class="qty-badge ${isOOS ? 'oos' : ''}">${Math.max(0, remainingStock)}</span>` : '';
            let typeIcon = '';
            if (isSel) {
                typeIcon = `<span class="material-symbols-rounded" style="font-size: 1.05rem; vertical-align: middle; margin-right: 4px; opacity: 0.85;" title="Prodotto con Selezione">checklist</span>`;
            } else if (isComp) {
                typeIcon = `<span class="material-symbols-rounded" style="font-size: 1.05rem; vertical-align: middle; margin-right: 4px; opacity: 0.85;" title="Prodotto Composto">link</span>`;
            }

            let tooltipAttr = '';
            let titleAttr = '';
            if (isComp && oosComponentsList.length > 0) {
                const oosMsg = `Esaurito per mancanza di: ${oosComponentsList.join(', ')}`;
                tooltipAttr = `data-tooltip="${oosMsg}"`;
                titleAttr = `title="${oosMsg}"`;
            }

            return `
          <button class="product-btn" ${isOOS ? 'disabled' : ''} ${tooltipAttr} ${titleAttr} onclick="addToCart(${p.id})" oncontextmenu="handleProductRightClick(event, ${p.id})">
            ${qtyLabel}
            <span class="product-name">${typeIcon}${p.name}</span>
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

    if (foundProduct.is_selection === 1) {
        openPosSelectionModal(foundProduct, foundCategory);
        return;
    }

    if (foundProduct.is_composite === 1) {
        // Check components limits
        let comps = foundProduct.components || [];
        if (typeof comps === 'string') {
            try { comps = JSON.parse(comps); } catch(e){}
        }

        if (Array.isArray(comps)) {
            const allNestedComps = getAllNestedComponentNames(comps);

            for (const compName of allNestedComps) {
                let compProd = null;
                for (const catProds of Object.values(STATE.products)) {
                    compProd = catProds.find(item => item.name === compName);
                    if (compProd) break;
                }

                if (compProd && compProd.quantity !== null && compProd.quantity !== undefined) {
                    let totalUsedInCart = 0;
                    STATE.cart.forEach(cartItem => {
                        if (cartItem.id === compProd.id || cartItem.name === compProd.name) {
                            totalUsedInCart += cartItem.quantity;
                        } else if ((cartItem.is_composite === 1 || cartItem.is_selection === 1) && Array.isArray(cartItem.components) && getAllNestedComponentNames(cartItem.components).includes(compProd.name)) {
                            totalUsedInCart += cartItem.quantity;
                        }
                    });

                    if ((totalUsedInCart + 1) > compProd.quantity) {
                        showToast(`Scorte esaurite per il componente: ${compProd.name}`, "error");
                        return;
                    }
                }
            }
        }
    } else {
        // Standard product check
        if (foundProduct.quantity !== null && foundProduct.quantity !== undefined) {
            let totalUsedInCart = 0;
            STATE.cart.forEach(cartItem => {
                if (cartItem.id === foundProduct.id || cartItem.name === foundProduct.name) {
                    totalUsedInCart += cartItem.quantity;
                } else if ((cartItem.is_composite === 1 || cartItem.is_selection === 1) && Array.isArray(cartItem.components) && getAllNestedComponentNames(cartItem.components).includes(foundProduct.name)) {
                    totalUsedInCart += cartItem.quantity;
                }
            });

            if ((totalUsedInCart + 1) > foundProduct.quantity) {
                showToast(`Scorte esaurite per: ${foundProduct.name}`, "error");
                return;
            }
        }
    }

    const existing = STATE.cart.find(i => i.id === productId || i.name === foundProduct.name);

    if (existing) {
        existing.id = foundProduct.id; // Ensure ID is present
        existing.quantity++;
    } else {
        STATE.cart.push({
            id: foundProduct.id,
            name: foundProduct.name,
            price: foundProduct.price,
            quantity: 1,
            category: foundCategory,
            is_composite: foundProduct.is_composite || 0,
            is_selection: foundProduct.is_selection || 0,
            components: foundProduct.components || []
        });
    }

    renderCart();
    renderProducts();
}

let currentPpoProduct = null;
let currentPpoCategory = null;

async function syncStateToEditorAndSave(customToastMsg) {
    if (!STATE.currentSagra) return;

    const payload = { categories: [] };

    for (const [catName, prods] of Object.entries(STATE.products)) {
        if (!Array.isArray(prods)) continue;
        const isBaseCat = catName === 'Prodotti Base';
        const formattedProds = prods.map((p, idx) => ({
            name: p.name,
            price: p.price || 0,
            quantity: (p.quantity !== undefined && p.quantity !== null) ? p.quantity : null,
            type: p.type || (p.is_composite ? 'composite' : (p.is_selection ? 'selection' : 'simple')),
            components: p.components || [],
            position: p.position !== undefined ? p.position : idx
        }));

        payload.categories.push({
            name: catName,
            is_hidden: isBaseCat ? 1 : 0,
            products: formattedProds
        });
    }

    try {
        const res = await fetch(`/api/sagras/${STATE.currentSagra.id}/menu`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            STATE.isMenuDirty = false;
            if (customToastMsg) showToast(customToastMsg, "success");
            await loadSagraResources();
        } else {
            showToast("Errore durante il salvataggio del menu", "error");
        }
    } catch (e) {
        console.error(e);
        showToast("Errore di comunicazione col server", "error");
    }
}

function handleProductRightClick(e, productId) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

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

    currentPpoProduct = foundProduct;
    currentPpoCategory = foundCategory;

    const titleEl = document.getElementById('ppo-modal-title');
    const subtitleEl = document.getElementById('ppo-modal-subtitle');
    const qtyInput = document.getElementById('ppo-cart-qty-input');
    const linkedContainer = document.getElementById('ppo-linked-stock-container');

    if (titleEl) titleEl.innerText = foundProduct.name;
    if (subtitleEl) {
        const stockStr = (foundProduct.quantity !== null && foundProduct.quantity !== undefined) ? `${foundProduct.quantity} disponibili` : 'Scorte illimitate';
        subtitleEl.innerText = `Prezzo: € ${foundProduct.price.toFixed(2)} | Scorte attuali: ${stockStr}`;
    }
    if (qtyInput) qtyInput.value = "1";
    if (linkedContainer) linkedContainer.style.display = "none";

    const modal = document.getElementById('pos-product-options-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}
window.handleProductRightClick = handleProductRightClick;

function closePosProductOptionsModal() {
    const modal = document.getElementById('pos-product-options-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}
window.closePosProductOptionsModal = closePosProductOptionsModal;

function confirmPpoAddToCart() {
    if (!currentPpoProduct) return;
    const qtyInput = document.getElementById('ppo-cart-qty-input');
    const qtyToAdd = parseInt(qtyInput ? qtyInput.value : '1', 10);
    if (isNaN(qtyToAdd) || qtyToAdd <= 0) {
        showToast("Inserisci un numero di quantità valido", "error");
        return;
    }

    closePosProductOptionsModal();

    if (currentPpoProduct.is_selection === 1) {
        openPosSelectionModal(currentPpoProduct, currentPpoCategory);
        return;
    }

    if (currentPpoProduct.quantity !== null && currentPpoProduct.quantity !== undefined) {
        let totalUsedInCart = 0;
        STATE.cart.forEach(cartItem => {
            if (cartItem.id === currentPpoProduct.id || cartItem.name === currentPpoProduct.name) {
                totalUsedInCart += cartItem.quantity;
            } else if ((cartItem.is_composite === 1 || cartItem.is_selection === 1) && Array.isArray(cartItem.components) && getAllNestedComponentNames(cartItem.components).includes(currentPpoProduct.name)) {
                totalUsedInCart += cartItem.quantity;
            }
        });

        if ((totalUsedInCart + qtyToAdd) > currentPpoProduct.quantity) {
            const avail = Math.max(0, currentPpoProduct.quantity - totalUsedInCart);
            showToast(`Scorte insufficienti per "${currentPpoProduct.name}" (disponibili: ${avail})`, "error");
            return;
        }
    }

    const existing = STATE.cart.find(i => i.id === currentPpoProduct.id || i.name === currentPpoProduct.name);
    if (existing) {
        existing.id = currentPpoProduct.id;
        existing.quantity += qtyToAdd;
    } else {
        STATE.cart.push({
            id: currentPpoProduct.id,
            name: currentPpoProduct.name,
            price: currentPpoProduct.price,
            quantity: qtyToAdd,
            category: currentPpoCategory,
            is_composite: currentPpoProduct.is_composite || 0,
            is_selection: currentPpoProduct.is_selection || 0,
            components: currentPpoProduct.components || []
        });
    }

    showToast(`Aggiunti +${qtyToAdd}x ${currentPpoProduct.name} al carrello`, "success");
    renderCart();
    renderProducts();
}
window.confirmPpoAddToCart = confirmPpoAddToCart;

async function handlePpoEditPrice() {
    if (!currentPpoProduct) return;
    const prod = currentPpoProduct;

    const inputVal = await showDialog({
        title: `Modifica Prezzo: ${prod.name}`,
        message: `Inserisci il nuovo prezzo in EUR per "${prod.name}":`,
        icon: "euro",
        isPrompt: true,
        defaultValue: prod.price.toFixed(2),
        okText: "Aggiorna Prezzo",
        cancelText: "Annulla"
    });

    if (inputVal === null || inputVal === false) return;
    const newPrice = parseFloat(inputVal.replace(',', '.'));
    if (isNaN(newPrice) || newPrice < 0) {
        showToast("Inserisci un prezzo valido (es. 4.50)", "error");
        return;
    }

    prod.price = newPrice;

    STATE.cart.forEach(item => {
        if (item.id === prod.id || item.name === prod.name) {
            item.price = newPrice;
        }
    });

    closePosProductOptionsModal();
    await syncStateToEditorAndSave(`Prezzo di "${prod.name}" aggiornato a € ${newPrice.toFixed(2)}`);
    renderCart();
    renderProducts();
}
window.handlePpoEditPrice = handlePpoEditPrice;

async function handlePpoEditStock() {
    if (!currentPpoProduct) return;
    const prod = currentPpoProduct;

    const isComp = prod.is_composite === 1;
    const isSel = prod.is_selection === 1;
    let comps = prod.components || [];
    if (typeof comps === 'string') {
        try { comps = JSON.parse(comps); } catch(e){}
    }

    const hasLinkedComps = (isComp || isSel) && Array.isArray(comps) && comps.length > 0;

    if (hasLinkedComps) {
        const linkedContainer = document.getElementById('ppo-linked-stock-container');
        const linkedList = document.getElementById('ppo-linked-stock-list');
        if (!linkedContainer || !linkedList) return;

        linkedList.innerHTML = '';

        const allNestedNames = getAllNestedComponentNames(comps);
        const linkedProdsMap = new Map();

        allNestedNames.forEach(compName => {
            for (const catProds of Object.values(STATE.products)) {
                const found = catProds.find(item => item.name === compName);
                if (found) {
                    linkedProdsMap.set(found.id || found.name, found);
                    break;
                }
            }
        });

        if (linkedProdsMap.size === 0) {
            showToast("Nessun prodotto collegato trovato nel menu", "warning");
            return;
        }

        linkedProdsMap.forEach(compProd => {
            const row = document.createElement('div');
            row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px dashed var(--border-color);';
            const qtyVal = (compProd.quantity !== null && compProd.quantity !== undefined) ? compProd.quantity : '';

            row.innerHTML = `
                <div style="font-weight: 600; font-size: 0.9rem; flex: 1; text-align: left;">${compProd.name}</div>
                <input type="number" class="input-field ppo-linked-qty-input" data-prod-id="${compProd.id}" data-prod-name="${compProd.name}" placeholder="Illimitata" value="${qtyVal}" min="0" style="width: 110px; text-align: center;">
            `;
            linkedList.appendChild(row);
        });

        linkedContainer.style.display = 'block';

    } else {
        const currentQtyStr = (prod.quantity !== null && prod.quantity !== undefined) ? String(prod.quantity) : '';
        const inputVal = await showDialog({
            title: `Modifica Scorte: ${prod.name}`,
            message: `Inserisci la quantità di scorte rimanenti per "${prod.name}" (lascia vuoto per scorte illimitate):`,
            icon: "inventory_2",
            isPrompt: true,
            allowEmpty: true,
            defaultValue: currentQtyStr,
            okText: "Aggiorna Scorte",
            cancelText: "Annulla"
        });

        if (inputVal === null || inputVal === false) return;

        let newQty = null;
        if (inputVal.trim() !== '') {
            newQty = parseInt(inputVal.trim(), 10);
            if (isNaN(newQty) || newQty < 0) {
                showToast("Inserisci un numero di scorte valido (es. 50 o lascia vuoto)", "error");
                return;
            }
        }

        prod.quantity = newQty;

        closePosProductOptionsModal();
        await syncStateToEditorAndSave(`Scorte di "${prod.name}" aggiornate`);
        renderProducts();
    }
}
window.handlePpoEditStock = handlePpoEditStock;

async function savePpoLinkedStocks() {
    const inputs = document.querySelectorAll('.ppo-linked-qty-input');
    let updatedCount = 0;

    inputs.forEach(input => {
        const prodId = input.dataset.prodId;
        const prodName = input.dataset.prodName;
        const rawVal = input.value.trim();

        let newQty = null;
        if (rawVal !== '') {
            const parsed = parseInt(rawVal, 10);
            if (!isNaN(parsed) && parsed >= 0) {
                newQty = parsed;
            }
        }

        for (const catProds of Object.values(STATE.products)) {
            const prod = catProds.find(p => (prodId && String(p.id) === String(prodId)) || p.name === prodName);
            if (prod) {
                prod.quantity = newQty;
                updatedCount++;
                break;
            }
        }
    });

    closePosProductOptionsModal();
    await syncStateToEditorAndSave(`Scorte aggiornate per ${updatedCount} prodotti collegati`);
    renderProducts();
}
window.savePpoLinkedStocks = savePpoLinkedStocks;

async function handleCartItemRightClick(e, idx) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }

    const item = STATE.cart[idx];
    if (!item) return;

    const inputVal = await showDialog({
        title: `Modifica Quantità: ${item.name}`,
        message: `Inserisci la nuova quantità per "${item.name}":`,
        icon: "edit_note",
        isPrompt: true,
        defaultValue: String(item.quantity),
        okText: "Aggiorna Quantità",
        cancelText: "Annulla"
    });

    if (inputVal === null || inputVal === false) return;
    const newQty = parseInt(inputVal, 10);
    if (isNaN(newQty) || newQty < 0) {
        showToast("Inserisci un numero di quantità valido (es. 0 per rimuovere o maggiore)", "error");
        return;
    }

    if (newQty === 0) {
        removeFromCart(idx);
        showToast(`Rimosso "${item.name}" dal carrello`, "info");
        return;
    }

    // Check stock limits if increasing quantity
    let foundProduct = null;
    for (const catProds of Object.values(STATE.products)) {
        foundProduct = catProds.find(p => p.id === item.id || p.name === item.name);
        if (foundProduct) break;
    }

    if (foundProduct) {
        if (foundProduct.is_composite === 1) {
            let comps = foundProduct.components || [];
            if (typeof comps === 'string') {
                try { comps = JSON.parse(comps); } catch(err){}
            }

            if (Array.isArray(comps)) {
                const allNestedComps = getAllNestedComponentNames(comps);
                for (const compName of allNestedComps) {
                    let compProd = null;
                    for (const catProds of Object.values(STATE.products)) {
                        compProd = catProds.find(p => p.name === compName);
                        if (compProd) break;
                    }

                    if (compProd && compProd.quantity !== null && compProd.quantity !== undefined) {
                        let otherUsedInCart = 0;
                        STATE.cart.forEach((cartItem, cIdx) => {
                            if (cIdx === idx) return; // Exclude current cart row
                            if (cartItem.id === compProd.id || cartItem.name === compProd.name) {
                                otherUsedInCart += cartItem.quantity;
                            } else if ((cartItem.is_composite === 1 || cartItem.is_selection === 1) && Array.isArray(cartItem.components) && getAllNestedComponentNames(cartItem.components).includes(compProd.name)) {
                                otherUsedInCart += cartItem.quantity;
                            }
                        });

                        if ((otherUsedInCart + newQty) > compProd.quantity) {
                            const maxAvail = Math.max(0, compProd.quantity - otherUsedInCart);
                            showToast(`Scorte insufficienti per "${compProd.name}" (massimo impostabile: ${maxAvail})`, "error");
                            return;
                        }
                    }
                }
            }
        } else {
            if (foundProduct.quantity !== null && foundProduct.quantity !== undefined) {
                let otherUsedInCart = 0;
                STATE.cart.forEach((cartItem, cIdx) => {
                    if (cIdx === idx) return; // Exclude current cart row
                    if (cartItem.id === foundProduct.id || cartItem.name === foundProduct.name) {
                        otherUsedInCart += cartItem.quantity;
                    } else if ((cartItem.is_composite === 1 || cartItem.is_selection === 1) && Array.isArray(cartItem.components) && getAllNestedComponentNames(cartItem.components).includes(foundProduct.name)) {
                        otherUsedInCart += cartItem.quantity;
                    }
                });

                if ((otherUsedInCart + newQty) > foundProduct.quantity) {
                    const maxAvail = Math.max(0, foundProduct.quantity - otherUsedInCart);
                    showToast(`Scorte insufficienti per "${foundProduct.name}" (massimo impostabile: ${maxAvail})`, "error");
                    return;
                }
            }
        }
    }

    item.quantity = newQty;
    showToast(`Quantità impostata: ${item.name} x${newQty}`, "success");
    renderCart();
    renderProducts();
}
window.handleCartItemRightClick = handleCartItemRightClick;

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
        div.setAttribute('oncontextmenu', `handleCartItemRightClick(event, ${idx})`);
        div.setAttribute('title', 'Tasto destro per modificare la quantità');

        const isComp = item.is_composite === 1;
        const isSel = item.is_selection === 1;
        let typeIcon = '';
        if (isSel) {
            typeIcon = `<span class="material-symbols-rounded" style="font-size: 0.95rem; vertical-align: middle; margin-right: 3px; color: var(--primary);" title="Prodotto con Selezione">checklist</span>`;
        } else if (isComp) {
            typeIcon = `<span class="material-symbols-rounded" style="font-size: 0.95rem; vertical-align: middle; margin-right: 3px; color: var(--primary);" title="Prodotto Composto">link</span>`;
        }

        let selectionSubtext = '';
        if (isSel && Array.isArray(item.components) && item.components.length > 0) {
            selectionSubtext = `<small style="display:block; font-size:0.75rem; color:var(--text-light); margin-top:2px;">Scelti: ${item.components.join(', ')}</small>`;
        }

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
            <span class="order-item-name">${typeIcon}${item.name}</span>
            ${selectionSubtext}
            <span class="order-item-unit-price">€ ${item.price.toFixed(2)} cad.</span>
          </div>
          <span class="order-item-total">€${itemTotal.toFixed(2)}</span>
        `;
        cartEl.appendChild(div);
    });

    totalEl.innerText = `€ ${total.toFixed(2)}`;
    totalEl.classList.remove('total-amount-bump');
    void totalEl.offsetWidth;
    totalEl.classList.add('total-amount-bump');
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
        changeEl.classList.remove('change-amount-bump');
        void changeEl.offsetWidth;
        changeEl.classList.add('change-amount-bump');
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


let isPrintingOrder = false;

async function printOrder() {
    if (isPrintingOrder) return;
    if (STATE.cart.length === 0) return showToast("Il carrello è vuoto", "error");
    const total = STATE.cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    const printBtn = document.querySelector('.btn-print');
    isPrintingOrder = true;
    if (printBtn) printBtn.disabled = true;

    // Get stored printer name and template
    const printerName = localStorage.getItem('thermalPrinterName');
    const template = localStorage.getItem('receiptTemplate') || 'compact';

    const payload = {
        sagraId: STATE.currentSagra.id,
        items: STATE.cart,
        total: total,
        printerName: printerName,
        template: template,
        testMode: (localStorage.getItem('appTestMode') === 'true'),
        printEventName: (localStorage.getItem('appPrintEventName') !== 'false')
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
    } finally {
        isPrintingOrder = false;
        if (printBtn) printBtn.disabled = false;
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
        testMode: (localStorage.getItem('appTestMode') === 'true'),
        printEventName: (localStorage.getItem('appPrintEventName') !== 'false')
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

function parseOrderDate(dateStr) {
    if (!dateStr) return new Date();
    let s = String(dateStr).trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
        s = s.replace(' ', 'T') + 'Z';
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : d;
}
window.parseOrderDate = parseOrderDate;

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
                    const formattedDate = parseOrderDate(o.created_at).toLocaleString('it-IT', {
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

function showChartTooltip(e, hourSlot, orderText) {
    const tooltip = document.getElementById('chart-tooltip');
    if (!tooltip) return;

    tooltip.innerHTML = `
        <div class="tooltip-time">Ore ${hourSlot}</div>
        <div class="tooltip-val">
            <span class="material-symbols-rounded">receipt_long</span>
            <span>${orderText}</span>
        </div>
    `;

    const dot = e.target;
    const card = tooltip.closest('.stats-chart-card');
    if (dot && card) {
        const dotRect = dot.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();

        const left = dotRect.left - cardRect.left + (dotRect.width / 2);
        const top = dotRect.top - cardRect.top;

        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }

    tooltip.classList.add('visible');
}
window.showChartTooltip = showChartTooltip;

function hideChartTooltip() {
    const tooltip = document.getElementById('chart-tooltip');
    if (tooltip) tooltip.classList.remove('visible');
}
window.hideChartTooltip = hideChartTooltip;

function renderHourlyChart(hourlySales) {
    const chartContainer = document.getElementById('hourly-chart-container');
    if (!chartContainer) return;

    hideChartTooltip();

    if (!hourlySales || hourlySales.length === 0) {
        chartContainer.innerHTML = '<div class="empty-chart-text">Nessun ordine registrato nelle ultime ore</div>';
        return;
    }

    let maxOrders = 0;
    let peakSlot = '';

    hourlySales.forEach(slot => {
        if (slot.orders_count > maxOrders) {
            maxOrders = slot.orders_count;
            peakSlot = slot.hour_slot;
        }
    });

    const svgWidth = 600;
    const svgHeight = 120;
    const paddingX = 35;
    const paddingTop = 22;
    const paddingBottom = 20;

    const count = hourlySales.length;
    const usableWidth = svgWidth - (paddingX * 2);
    const usableHeight = svgHeight - paddingTop - paddingBottom;

    // Compute (x, y) coordinates based strictly on orders count
    const points = hourlySales.map((slot, i) => {
        const x = count === 1 ? svgWidth / 2 : paddingX + (i * (usableWidth / (count - 1)));
        const ratio = maxOrders > 0 ? (slot.orders_count / maxOrders) : 0;
        const y = (svgHeight - paddingBottom) - (ratio * usableHeight);
        return { x, y, slot };
    });

    // Build smooth cubic Bezier path
    let linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    if (points.length === 1) {
        linePath += ` L ${(points[0].x + 1).toFixed(1)} ${points[0].y.toFixed(1)}`;
    } else {
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i === 0 ? i : i - 1];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

            const cp1x = p1.x + (p2.x - p0.x) * 0.18;
            const cp1y = p1.y + (p2.y - p0.y) * 0.18;
            const cp2x = p2.x - (p3.x - p1.x) * 0.18;
            const cp2y = p2.y - (p3.y - p1.y) * 0.18;

            linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
        }
    }

    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    const bottomY = svgHeight - paddingBottom + 8;
    const areaPath = `${linePath} L ${lastX.toFixed(1)} ${bottomY} L ${firstX.toFixed(1)} ${bottomY} Z`;

    const dotsHtml = points.map(pt => {
        const isPeak = (pt.slot.hour_slot === peakSlot && maxOrders > 0);
        const orderText = pt.slot.orders_count === 1 ? '1 Ordine' : `${pt.slot.orders_count} Ordini`;
        return `
            <circle class="wave-dot ${isPeak ? 'peak-dot' : ''}" 
                    cx="${pt.x.toFixed(1)}" 
                    cy="${pt.y.toFixed(1)}"
                    onmouseenter="showChartTooltip(event, '${pt.slot.hour_slot}', '${orderText}')"
                    onmouseleave="hideChartTooltip()">
            </circle>
        `;
    }).join('');

    const labelsHtml = points.map(pt => `
        <span class="wave-time-label" style="position: absolute; left: ${(pt.x / svgWidth * 100).toFixed(2)}%; transform: translateX(-50%);">
            ${pt.slot.hour_slot}
        </span>
    `).join('');

    chartContainer.innerHTML = `
        <svg class="wave-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none">
            <defs>
                <linearGradient id="waveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--btn-bg)" stop-opacity="0.32" />
                    <stop offset="100%" stop-color="var(--btn-bg)" stop-opacity="0.0" />
                </linearGradient>
            </defs>
            <path class="wave-area-path" d="${areaPath}" />
            <path class="wave-line-path" d="${linePath}" />
            ${dotsHtml}
        </svg>
        <div style="position: relative; width: 100%; height: 22px; margin-top: 6px;">
            ${labelsHtml}
        </div>
    `;
}

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

        // Render Hourly Sales Chart
        renderHourlyChart(data.hourlySales);

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

function toggleSettingsPasswordVisibility() {
    const pwdInput = document.getElementById('settings-password');
    const toggleIcon = document.getElementById('settings-password-toggle-icon');
    if (!pwdInput || !toggleIcon) return;

    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        toggleIcon.innerText = 'visibility_off';
    } else {
        pwdInput.type = 'password';
        toggleIcon.innerText = 'visibility';
    }
}
window.toggleSettingsPasswordVisibility = toggleSettingsPasswordVisibility;

window.openSettings = async function () {
    const testToggle = document.getElementById('test-mode-toggle');
    const printEventToggle = document.getElementById('print-event-name-toggle');
    const darkToggle = document.getElementById('dark-mode-toggle');
    const scheduleToggle = document.getElementById('dark-mode-schedule-toggle');

    // Populate current saved password into settings input
    if (settingsPasswordInput) {
        settingsPasswordInput.value = localStorage.getItem('appPassword') || '';
        settingsPasswordInput.type = 'password';
        const toggleIcon = document.getElementById('settings-password-toggle-icon');
        if (toggleIcon) toggleIcon.innerText = 'visibility';
    }

    // Reset switches before displaying so CSS transition animates smoothly
    if (testToggle) testToggle.checked = false;
    if (printEventToggle) printEventToggle.checked = false;
    if (darkToggle) darkToggle.checked = false;
    if (scheduleToggle) scheduleToggle.checked = false;

    settingsModal.style.display = 'flex';
    showTestStatus(null);

    updateThemeSelectorButtons(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    updateChangeCalcSelectorButtons(localStorage.getItem('changeCalcMode') || 'full');

    // Animate switches into their actual saved state after modal layout is active
    setTimeout(() => {
        if (testToggle) testToggle.checked = (localStorage.getItem('appTestMode') === 'true');
        if (printEventToggle) printEventToggle.checked = (localStorage.getItem('appPrintEventName') !== 'false');

        const isScheduleEnabled = (localStorage.getItem('themeScheduleEnabled') !== 'false');
        if (scheduleToggle) scheduleToggle.checked = isScheduleEnabled;
        toggleThemeSchedule(isScheduleEnabled);
    }, 60);

    const startTimeInput = document.getElementById('dark-mode-start-time');
    if (startTimeInput) startTimeInput.value = localStorage.getItem('themeScheduleStart') || '20:00';

    const endTimeInput = document.getElementById('dark-mode-end-time');
    if (endTimeInput) endTimeInput.value = localStorage.getItem('themeScheduleEnd') || '07:00';

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
function showToast(message, type = 'success', duration = 3000, showIcon = true) {
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

    const iconHtml = showIcon ? `<span class="material-symbols-rounded toast-icon">${iconName}</span>` : '';

    toast.innerHTML = `
        ${iconHtml}
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-hide');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 400);
    }, duration);
}
window.showToast = showToast;

window.saveSettings = function () {
    const selectedPrinter = printerSelect.value;
    const newPassword = settingsPasswordInput.value.trim();
    const selectedTemplate = document.getElementById('template-select').value;
    const isTestMode = document.getElementById('test-mode-toggle').checked;
    const printEventName = document.getElementById('print-event-name-toggle').checked;

    const isScheduleEnabled = document.getElementById('dark-mode-schedule-toggle').checked;
    const scheduleStart = document.getElementById('dark-mode-start-time').value;
    const scheduleEnd = document.getElementById('dark-mode-end-time').value;

    if (selectedPrinter) {
        localStorage.setItem('thermalPrinterName', selectedPrinter);
    }

    // Save Password, Template, Test Mode & Print Event Name
    localStorage.setItem('appPassword', newPassword);
    localStorage.setItem('receiptTemplate', selectedTemplate);
    localStorage.setItem('appTestMode', isTestMode ? 'true' : 'false');
    localStorage.setItem('appPrintEventName', printEventName ? 'true' : 'false');

    // Save Scheduled Dark Mode
    localStorage.setItem('themeScheduleEnabled', isScheduleEnabled ? 'true' : 'false');
    if (scheduleStart) localStorage.setItem('themeScheduleStart', scheduleStart);
    if (scheduleEnd) localStorage.setItem('themeScheduleEnd', scheduleEnd);

    if (isScheduleEnabled) {
        const start = scheduleStart || localStorage.getItem('themeScheduleStart') || '20:00';
        const end = scheduleEnd || localStorage.getItem('themeScheduleEnd') || '07:00';
        lastEvaluatedScheduleState = isTimeInSchedule(start, end) ? 'dark' : 'light';
    } else {
        lastEvaluatedScheduleState = null;
    }

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

    showTestStatus('loading', 'Verifica connessione e invio stampa di prova...');

    try {
        const res = await fetch('/api/print-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ printerName })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            showTestStatus('success', `✓ Stampante collegata ed in linea! Scontrino di prova inviato.`);
        } else {
            showTestStatus('error', data.error || 'Errore durante la verifica della stampante');
        }
    } catch (e) {
        showTestStatus('error', 'Impossibile comunicare con il server di stampa');
    }
}
window.testPrinter = testPrinter;

window.checkLogin = checkLogin;
window.showAlert = showAlert;

// --- RECEIPT PREVIEW MODAL ---
function showReceiptPreviewModal(preview) {
    const container = document.getElementById('receipt-preview-container');
    if (!container || !preview || !preview.receipts) return;

    const dividerStyle = (currentReceiptConfig && currentReceiptConfig.body && currentReceiptConfig.body.dividerStyle) || 'dashed';
    let dividerHtml = '<div class="thermal-divider"></div>';
    if (dividerStyle === 'none') {
        dividerHtml = '<div class="thermal-divider" style="display: none;"></div>';
    } else if (dividerStyle === 'solid') {
        dividerHtml = '<div class="thermal-divider" style="border-top: 1.5px solid #000; margin: 12px 0;"></div>';
    } else if (dividerStyle === 'dotted') {
        dividerHtml = '<div class="thermal-divider" style="border-top: 1.5px dotted #000; margin: 12px 0;"></div>';
    } else if (dividerStyle === 'double') {
        dividerHtml = '<div class="thermal-divider" style="border-top: 3px double #000; margin: 12px 0;"></div>';
    } else if (dividerStyle === 'stars') {
        dividerHtml = '<div class="thermal-divider" style="border-top: none; text-align: center; font-size: 0.85rem; font-weight: bold; letter-spacing: 3px; margin: 8px 0;">* * * * * * * * * * * * * * * * *</div>';
    }

    let html = '<div class="thermal-paper-wrapper">';
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

        html += dividerHtml;

        if (receipt.items && receipt.items.length > 0) {
            receipt.items.forEach(item => {
                const boldClass = item.isBold ? 'thermal-bold' : '';
                const isSub = item.isSubitem || (item.left && item.left.trim().startsWith('-'));
                const subClass = isSub ? 'thermal-row-subitem' : '';
                const formattedLeft = isSub ? item.left.trim() : (item.left ? item.left.replace(/^ +/, (match) => '&nbsp;'.repeat(match.length)) : '');
                html += `
                    <div class="thermal-row ${boldClass} ${subClass}">
                        <span>${formattedLeft}</span>
                        <span>${item.right || ''}</span>
                    </div>
                `;
            });
        }

        html += dividerHtml;

        if (receipt.totalLabel && receipt.totalValue) {
            html += `
                <div class="thermal-row thermal-row-bold">
                    <span>${receipt.totalLabel}</span>
                    <span>${receipt.totalValue}</span>
                </div>
            `;
        }

        if (receipt.footerLines && receipt.footerLines.length > 0) {
            html += dividerHtml;
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
            latestUpdateData = data;
            if (banner) {
                banner.className = 'status-banner status-success';
                banner.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:10px; padding:4px;">
                        <span><b>Nuova versione v${data.latestVersion} disponibile!</b> (Installata: v${data.currentVersion})</span>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <button type="button" onclick="openChangelogModal()" style="display:inline-flex; align-items:center; gap:6px; padding:8px 16px; background:var(--bg-secondary); color:var(--text-main); border:1px solid var(--border-color); border-radius:8px; font-weight:600; cursor:pointer;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem;">article</span> Dettagli
                            </button>
                            <button type="button" onclick="startAutoUpdate('${data.downloadUrl}')" class="btn-update-action" style="display:inline-flex; align-items:center; gap:6px; padding:8px 16px; background:var(--primary); color:white; border:none; border-radius:8px; font-weight:700; cursor:pointer;">
                                <span class="material-symbols-rounded" style="font-size:1.1rem;">system_update</span> Aggiorna Ora
                            </button>
                        </div>
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
    if ((!downloadUrl || downloadUrl === 'null' || downloadUrl === 'undefined') && latestUpdateData && latestUpdateData.releaseUrl) {
        window.open(latestUpdateData.releaseUrl, '_blank');
        return;
    }

    const settingsBanner = document.getElementById('update-result-banner');
    const toastBanner = document.getElementById('update-toast-banner');

    window._isUpdateCancelled = false;
    if (window._activeUpdatePollInterval) {
        clearInterval(window._activeUpdatePollInterval);
        window._activeUpdatePollInterval = null;
    }

    const renderProgressUI = (percent, downloadedMb, totalMb, statusText) => {
        if (window._isUpdateCancelled) return;

        const progressHtml = `
            <div style="display:flex; flex-direction:column; gap:6px; width:100%; text-align:left; padding:4px 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; font-weight:700;">
                    <span>${statusText}</span>
                    <span style="color:var(--primary);">${percent}%</span>
                </div>
                <div class="update-progress-track">
                    <div class="update-progress-bar" style="width: ${percent}%;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-light); margin-top:2px;">
                    <span>${downloadedMb} MB / ${totalMb} MB</span>
                    <button type="button" onclick="cancelAutoUpdate()" style="padding:2px 8px; font-size:0.75rem; background:var(--subtle-hover); border:1px solid var(--border-color); border-radius:6px; color:var(--danger); cursor:pointer; font-weight:600;">Annulla</button>
                </div>
            </div>
        `;

        if (settingsBanner && settingsBanner.style.display !== 'none') {
            settingsBanner.className = 'status-banner status-info';
            settingsBanner.innerHTML = progressHtml;
        }

        if (toastBanner) {
            toastBanner.style.display = 'flex';
            toastBanner.classList.add('visible');

            // If toast DOM is not initialized with spinning icon yet, set static outer layout ONCE
            if (!toastBanner.querySelector('.spinning-icon')) {
                toastBanner.innerHTML = `
                    <div class="update-toast-content" style="width:100%;">
                        <div class="update-toast-icon">
                            <span class="material-symbols-rounded spinning-icon">sync</span>
                        </div>
                        <div style="display:flex; flex-direction:column; gap:6px; width:100%; text-align:left; padding:4px 0;">
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; font-weight:700;">
                                <span class="update-status-text">${statusText}</span>
                                <span class="update-percent-text" style="color:var(--primary);">${percent}%</span>
                            </div>
                            <div class="update-progress-track">
                                <div class="update-progress-bar" style="width: ${percent}%;"></div>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-light); margin-top:2px;">
                                <span class="update-mb-text">${downloadedMb} MB / ${totalMb} MB</span>
                                <button type="button" onclick="cancelAutoUpdate()" style="padding:2px 8px; font-size:0.75rem; background:var(--subtle-hover); border:1px solid var(--border-color); border-radius:6px; color:var(--danger); cursor:pointer; font-weight:600;">Annulla</button>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // Icon exists — update ONLY text and progress bar width so icon animation never resets
                const statusEl = toastBanner.querySelector('.update-status-text');
                const percentEl = toastBanner.querySelector('.update-percent-text');
                const barEl = toastBanner.querySelector('.update-progress-bar');
                const mbEl = toastBanner.querySelector('.update-mb-text');

                if (statusEl) statusEl.innerText = statusText;
                if (percentEl) percentEl.innerText = `${percent}%`;
                if (barEl) barEl.style.width = `${percent}%`;
                if (mbEl) mbEl.innerText = `${downloadedMb} MB / ${totalMb} MB`;
            }
        }
    };

    const renderErrorUI = (errMsg) => {
        if (window._isUpdateCancelled) return;

        if (settingsBanner && settingsBanner.style.display !== 'none') {
            settingsBanner.className = 'status-banner status-error';
            settingsBanner.innerText = errMsg;
        }

        if (toastBanner) {
            toastBanner.classList.add('visible');
            toastBanner.innerHTML = `
                <div class="update-toast-content" style="width:100%;">
                    <div class="update-toast-icon" style="color:var(--danger);">
                        <span class="material-symbols-rounded">error</span>
                    </div>
                    <div class="update-toast-info">
                        <div class="update-toast-title" style="color:var(--danger);">Errore Aggiornamento</div>
                        <div class="update-toast-sub" style="font-size:0.8rem;">${errMsg}</div>
                    </div>
                </div>
                <div class="update-toast-actions">
                    <button type="button" class="btn-update-close" onclick="dismissUpdateToast()">&times;</button>
                </div>
            `;
        }
    };

    renderProgressUI(0, '0.0', '...', 'Avvio download...');

    const pollInterval = setInterval(async () => {
        if (window._isUpdateCancelled) {
            clearInterval(pollInterval);
            return;
        }
        try {
            const pRes = await fetch('/api/update-progress');
            if (pRes.ok) {
                const pData = await pRes.json();
                if (pData.status === 'downloading') {
                    renderProgressUI(pData.percent, pData.downloadedMb, pData.totalMb, 'Download in corso...');
                } else if (pData.status === 'completed') {
                    renderProgressUI(100, pData.totalMb, pData.totalMb, 'Download completato! Avvio installazione...');
                    clearInterval(pollInterval);
                } else if (pData.status === 'error') {
                    renderErrorUI(pData.error || 'Errore durante il download');
                    clearInterval(pollInterval);
                }
            }
        } catch (e) {}
    }, 250);
    try {
        const totalBytes = (latestUpdateData && latestUpdateData.fileSize) ? latestUpdateData.fileSize : 0;
        const res = await fetch('/api/download-and-install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ downloadUrl, totalBytes })
        });
        const data = await res.json();
        clearInterval(pollInterval);

        if (res.ok && data.success) {
            renderProgressUI(100, '', '', 'Avvio installatore e chiusura app...');
        } else if (data.redirectUrl) {
            window.open(data.redirectUrl, '_blank');
            if (latestUpdateData) showUpdateToast(latestUpdateData);
        } else if (!window._isUpdateCancelled) {
            renderErrorUI(data.error || 'Errore durante il download.');
        }
    } catch (e) {
        clearInterval(pollInterval);
        if (!window._isUpdateCancelled) {
            renderErrorUI('Errore di rete durante il download dell\'aggiornamento.');
        }
    }
}
window.startAutoUpdate = startAutoUpdate;

async function cancelAutoUpdate() {
    window._isUpdateCancelled = true;

    if (window._activeUpdatePollInterval) {
        clearInterval(window._activeUpdatePollInterval);
        window._activeUpdatePollInterval = null;
    }

    const toast = document.getElementById('update-toast-banner');
    if (toast) {
        toast.style.display = 'none';
        toast.classList.remove('visible');
    }

    const settingsBanner = document.getElementById('update-result-banner');
    if (settingsBanner && settingsBanner.style.display !== 'none') {
        settingsBanner.className = 'status-banner status-info';
        settingsBanner.innerText = 'Download annullato.';
    }

    try {
        await fetch('/api/cancel-update', { method: 'POST' });
    } catch(e) {}
}
window.cancelAutoUpdate = cancelAutoUpdate;

let latestUpdateData = null;

async function checkAppUpdateSilent() {
    try {
        const res = await fetch('/api/check-update');
        if (!res.ok) return;
        const data = await res.json();

        const verEl = document.getElementById('current-app-version');
        if (verEl && data.currentVersion) verEl.innerText = data.currentVersion;

        if (data.hasUpdate) {
            latestUpdateData = data;
            showUpdateToast(data);
        }
    } catch (e) {
        console.log("Silent update check skipped (offline or network error)");
    }
}

function showUpdateToast(data) {
    if (!data || window._isUpdateToastDismissed) return;
    latestUpdateData = data;

    // Do NOT show toast ONLY on the initial password entry screen (view-auth)
    const authView = document.getElementById('view-auth');
    if (authView && authView.classList.contains('active')) {
        return;
    }

    const toast = document.getElementById('update-toast-banner');
    if (!toast) return;

    // Restore original toast structure in case it was overwritten by download progress
    toast.innerHTML = `
        <div class="update-toast-content">
            <span class="material-symbols-rounded update-toast-icon">system_update</span>
            <div class="update-toast-info">
                <div class="update-toast-title">Aggiornamento<br>disponibile <span style="font-size:0.85em; font-weight:600; opacity:0.85;">v${data.latestVersion}</span></div>
            </div>
        </div>
        <div class="update-toast-actions">
            <button type="button" class="btn-update-details" onclick="openChangelogModal()">Dettagli</button>
            <button type="button" class="btn-update-now" id="update-toast-btn">Aggiorna Ora</button>
            <button type="button" class="btn-update-close" onclick="dismissUpdateToast()">&times;</button>
        </div>
    `;

    // Re-acquire btn reference after innerHTML reset
    const newBtn = document.getElementById('update-toast-btn');
    if (newBtn) {
        newBtn.onclick = function() {
            if (data.downloadUrl) {
                startAutoUpdate(data.downloadUrl);
            } else if (data.releaseUrl) {
                // No .exe asset — open release page in browser
                window.open(data.releaseUrl, '_blank');
                dismissUpdateToast();
            }
        };
    }

    toast.style.display = 'flex';
    toast.classList.add('visible');
}

function dismissUpdateToast() {
    window._isUpdateToastDismissed = true;
    const toast = document.getElementById('update-toast-banner');
    if (toast) {
        toast.style.display = 'none';
        toast.classList.remove('visible');
    }
}

function formatReleaseNotes(text) {
    if (!text || !text.trim()) return '<div style="color:var(--text-light); text-align:center; padding:20px;">Nessuna nota di rilascio fornita per questa versione.</div>';

    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    // Convert markdown bold **text** -> <b>text</b>
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');

    // Convert markdown headings
    html = html.replace(/^### (.*$)/gim, '<h4 style="margin:12px 0 6px 0; color:var(--primary); font-size:1.05rem;">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 style="margin:14px 0 6px 0; color:var(--primary); font-size:1.15rem;">$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2 style="margin:16px 0 8px 0; color:var(--primary); font-size:1.25rem;">$1</h2>');

    // Convert list items - item -> <li>item</li>
    html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li style="margin-bottom:4px;">$1</li>');

    // Wrap continuous <li> in <ul>
    html = html.replace(/((?:<li[^>]*>.*?<\/li>\s*)+)/gs, '<ul style="margin:8px 0 12px 20px; padding-left:0;">$1</ul>');

    // Convert markdown horizontal rules ---
    html = html.replace(/^---$/gim, '<hr style="border:none; border-top:1px dashed var(--border-color); margin:20px 0;">');

    // Convert double newlines to breaks
    html = html.replace(/\n\n/g, '<br><br>');

    return html;
}

function openChangelogModal() {
    if (!latestUpdateData) return;

    const modal = document.getElementById('changelog-modal');
    const verEl = document.getElementById('changelog-modal-version');
    const bodyEl = document.getElementById('changelog-modal-body');
    const updateBtn = document.getElementById('changelog-modal-update-btn');

    if (verEl) verEl.innerText = `v${latestUpdateData.latestVersion}`;
    if (bodyEl) bodyEl.innerHTML = formatReleaseNotes(latestUpdateData.releaseNotes);

    if (updateBtn) {
        if (latestUpdateData.downloadUrl) {
            updateBtn.style.display = 'inline-flex';
            updateBtn.onclick = function() {
                closeChangelogModal();
                startAutoUpdate(latestUpdateData.downloadUrl);
            };
        } else {
            updateBtn.style.display = 'none';
        }
    }

    if (modal) modal.style.display = 'flex';
}

function closeChangelogModal() {
    const modal = document.getElementById('changelog-modal');
    if (modal) modal.style.display = 'none';
}

async function checkPostUpdateChangelog() {
    try {
        const res = await fetch('/api/current-changelog');
        if (!res.ok) return;
        const data = await res.json();

        const currentVersion = data.version;
        const lastSeenVersion = localStorage.getItem('lastSeenAppVersion');

        if (!lastSeenVersion) {
            localStorage.setItem('lastSeenAppVersion', currentVersion);
            return;
        }

        if (lastSeenVersion !== currentVersion) {
            localStorage.setItem('lastSeenAppVersion', currentVersion);

            const modal = document.getElementById('changelog-modal');
            const verEl = document.getElementById('changelog-modal-version');
            const bodyEl = document.getElementById('changelog-modal-body');
            const updateBtn = document.getElementById('changelog-modal-update-btn');

            if (verEl) verEl.innerText = `v${data.version}`;
            if (bodyEl) bodyEl.innerHTML = formatReleaseNotes(data.notes);
            if (updateBtn) updateBtn.style.display = 'none';

            if (modal) modal.style.display = 'flex';
        }
    } catch (e) {
        console.log("Post update changelog check skipped:", e);
    }
}

window.openChangelogModal = openChangelogModal;
window.closeChangelogModal = closeChangelogModal;
window.checkPostUpdateChangelog = checkPostUpdateChangelog;
window.dismissUpdateToast = dismissUpdateToast;
window.checkAppUpdateSilent = checkAppUpdateSilent;

let currentReceiptConfig = {
    header: {
        showLogo: true,
        companyName: "PROLOCO LORENZAGO",
        address: "Via Faureana 117 - Lorenzago (BL)",
        piva: "P.IVA 01089600256",
        title: "SCONTRINO NON FISCALE",
        showEventName: true,
        eventNamePrefix: "Evento: "
    },
    body: {
        showSubitems: true,
        subitemPrefix: "    - ",
        menuLabel: "MENU",
        currencySymbol: "EUR"
    },
    footer: {
        showThanks: true,
        thanksMessage: "Grazie e arrivederci!",
        showDate: true
    }
};

async function loadReceiptConfig() {
    try {
        const res = await fetch('/api/receipt-config');
        if (res.ok) {
            const data = await res.json();
            currentReceiptConfig = {
                header: { ...currentReceiptConfig.header, ...(data.header || {}) },
                body: { ...currentReceiptConfig.body, ...(data.body || {}) },
                footer: { ...currentReceiptConfig.footer, ...(data.footer || {}) }
            };
        }
    } catch (e) {
        console.log("Error loading receipt config:", e);
    }
}

function updateReceiptPreviewFromInputs() {
    const showLogo = document.getElementById('rc-show-logo')?.checked ?? true;
    const showCompanyName = document.getElementById('rc-show-company-name')?.checked ?? true;
    const companyName = document.getElementById('rc-company-name')?.value || '';
    const showAddress = document.getElementById('rc-show-address')?.checked ?? true;
    const address = document.getElementById('rc-address')?.value || '';
    const showPiva = document.getElementById('rc-show-piva')?.checked ?? true;
    const piva = document.getElementById('rc-piva')?.value || '';
    const showTitle = document.getElementById('rc-show-title')?.checked ?? true;
    const title = document.getElementById('rc-title')?.value || '';
    const showEventName = document.getElementById('rc-show-event-name')?.checked ?? true;
    const eventNamePrefix = document.getElementById('rc-event-name-prefix')?.value ?? '';
    const dividerStyle = document.getElementById('rc-divider-style')?.value || 'dashed';
    const showThanks = document.getElementById('rc-show-thanks')?.checked ?? true;
    const thanksMessage = document.getElementById('rc-thanks-message')?.value || '';
    const showDate = document.getElementById('rc-show-date')?.checked ?? true;

    // Enable or disable input fields based on switch state
    if (document.getElementById('rc-company-name')) document.getElementById('rc-company-name').disabled = !showCompanyName;
    if (document.getElementById('rc-address')) document.getElementById('rc-address').disabled = !showAddress;
    if (document.getElementById('rc-piva')) document.getElementById('rc-piva').disabled = !showPiva;
    if (document.getElementById('rc-title')) document.getElementById('rc-title').disabled = !showTitle;
    if (document.getElementById('rc-event-name-prefix')) document.getElementById('rc-event-name-prefix').disabled = !showEventName;
    if (document.getElementById('rc-thanks-message')) document.getElementById('rc-thanks-message').disabled = !showThanks;

    currentReceiptConfig.header.showLogo = showLogo;
    currentReceiptConfig.header.showCompanyName = showCompanyName;
    currentReceiptConfig.header.companyName = companyName;
    currentReceiptConfig.header.showAddress = showAddress;
    currentReceiptConfig.header.address = address;
    currentReceiptConfig.header.showPiva = showPiva;
    currentReceiptConfig.header.piva = piva;
    currentReceiptConfig.header.showTitle = showTitle;
    currentReceiptConfig.header.title = title;
    currentReceiptConfig.header.showEventName = showEventName;
    currentReceiptConfig.header.eventNamePrefix = eventNamePrefix;
    currentReceiptConfig.body.dividerStyle = dividerStyle;
    currentReceiptConfig.footer.showThanks = showThanks;
    currentReceiptConfig.footer.thanksMessage = thanksMessage;
    currentReceiptConfig.footer.showDate = showDate;

    // Update section dividers in receipt preview
    const dividers = document.querySelectorAll('#receipt-customizer-modal .thermal-divider');
    dividers.forEach(div => {
        div.removeAttribute('style');
        div.innerText = '';
        if (dividerStyle === 'none') {
            div.style.display = 'none';
        } else if (dividerStyle === 'solid') {
            div.style.display = 'block';
            div.style.borderTop = '1.5px solid #000000';
            div.style.margin = '12px 0';
        } else if (dividerStyle === 'dotted') {
            div.style.display = 'block';
            div.style.borderTop = '1.5px dotted #000000';
            div.style.margin = '12px 0';
        } else if (dividerStyle === 'double') {
            div.style.display = 'block';
            div.style.borderTop = '3px double #000000';
            div.style.margin = '12px 0';
        } else if (dividerStyle === 'stars') {
            div.style.display = 'block';
            div.style.borderTop = 'none';
            div.style.textAlign = 'center';
            div.style.fontSize = '0.85rem';
            div.style.fontWeight = 'bold';
            div.style.letterSpacing = '3px';
            div.style.margin = '8px 0';
            div.innerText = '* * * * * * * * * * * * * * * * *';
        } else {
            div.style.display = 'block';
            div.style.borderTop = '1px dashed #000000';
            div.style.margin = '12px 0';
        }
    });

    const logoImg = document.querySelector('#receipt-customizer-modal .thermal-header-img-container');
    if (logoImg) logoImg.style.display = showLogo ? 'block' : 'none';

    const headerTextCenter = document.querySelector('#receipt-customizer-modal .thermal-text-center');
    if (headerTextCenter) {
        const companyEl = headerTextCenter.children[0];
        const addressEl = headerTextCenter.children[1];
        const pivaEl = headerTextCenter.children[2];
        const titleEl = headerTextCenter.children[3];
        const eventEl = headerTextCenter.children[4];

        if (companyEl) {
            companyEl.innerText = companyName;
            const isCompanyVisible = showCompanyName && (!showLogo || !logoImg);
            companyEl.style.display = (isCompanyVisible && companyName.trim()) ? 'block' : 'none';
        }
        if (addressEl) {
            addressEl.innerText = address;
            addressEl.style.display = (showAddress && address.trim()) ? 'block' : 'none';
        }
        if (pivaEl) {
            pivaEl.innerText = piva;
            pivaEl.style.display = (showPiva && piva.trim()) ? 'block' : 'none';
        }
        if (titleEl) {
            titleEl.innerText = title;
            titleEl.style.display = (showTitle && title.trim()) ? 'block' : 'none';
        }
        if (eventEl) {
            eventEl.innerText = showEventName ? `${eventNamePrefix}Sagra del Fungo 2026` : '';
            eventEl.style.display = showEventName ? 'block' : 'none';
        }
    }

    const footerTextCenter = document.querySelectorAll('#receipt-customizer-modal .thermal-text-center')[1];
    if (footerTextCenter) {
        const thanksEl = footerTextCenter.children[0];
        const dateEl = footerTextCenter.children[1];

        if (thanksEl) {
            thanksEl.innerText = thanksMessage;
            thanksEl.style.display = (showThanks && thanksMessage.trim()) ? 'block' : 'none';
        }
        if (dateEl) {
            dateEl.style.display = showDate ? 'block' : 'none';
        }
    }
}

async function openReceiptCustomizerModal() {
    await loadReceiptConfig();

    if (document.getElementById('rc-show-logo')) document.getElementById('rc-show-logo').checked = currentReceiptConfig.header.showLogo !== false;
    if (document.getElementById('rc-show-company-name')) document.getElementById('rc-show-company-name').checked = currentReceiptConfig.header.showCompanyName !== false;
    if (document.getElementById('rc-company-name')) document.getElementById('rc-company-name').value = currentReceiptConfig.header.companyName || '';
    if (document.getElementById('rc-show-address')) document.getElementById('rc-show-address').checked = currentReceiptConfig.header.showAddress !== false;
    if (document.getElementById('rc-address')) document.getElementById('rc-address').value = currentReceiptConfig.header.address || '';
    if (document.getElementById('rc-show-piva')) document.getElementById('rc-show-piva').checked = currentReceiptConfig.header.showPiva !== false;
    if (document.getElementById('rc-piva')) document.getElementById('rc-piva').value = currentReceiptConfig.header.piva || '';
    if (document.getElementById('rc-show-title')) document.getElementById('rc-show-title').checked = currentReceiptConfig.header.showTitle !== false;
    if (document.getElementById('rc-title')) document.getElementById('rc-title').value = currentReceiptConfig.header.title || '';
    if (document.getElementById('rc-show-event-name')) document.getElementById('rc-show-event-name').checked = currentReceiptConfig.header.showEventName !== false;
    if (document.getElementById('rc-event-name-prefix')) document.getElementById('rc-event-name-prefix').value = currentReceiptConfig.header.eventNamePrefix !== undefined ? currentReceiptConfig.header.eventNamePrefix : 'Evento: ';
    if (document.getElementById('rc-divider-style')) document.getElementById('rc-divider-style').value = currentReceiptConfig.body.dividerStyle || 'dashed';
    if (document.getElementById('rc-show-thanks')) document.getElementById('rc-show-thanks').checked = currentReceiptConfig.footer.showThanks !== false;
    if (document.getElementById('rc-thanks-message')) document.getElementById('rc-thanks-message').value = currentReceiptConfig.footer.thanksMessage || '';
    if (document.getElementById('rc-show-date')) document.getElementById('rc-show-date').checked = currentReceiptConfig.footer.showDate !== false;

    updateReceiptPreviewFromInputs();

    const modal = document.getElementById('receipt-customizer-modal');
    if (modal) {
        modal.classList.add('visible');
        modal.style.display = 'flex';
    }
}

function closeReceiptCustomizerModal() {
    const modal = document.getElementById('receipt-customizer-modal');
    if (modal) {
        modal.classList.remove('visible');
        modal.style.display = 'none';
    }
}

async function saveReceiptCustomization() {
    updateReceiptPreviewFromInputs();
    try {
        const res = await fetch('/api/receipt-config', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentReceiptConfig)
        });
        if (res.ok) {
            showToast("Personalizzazione scontrino salvata con successo!", "success");
            closeReceiptCustomizerModal();
        } else {
            showToast("Errore durante il salvataggio della personalizzazione", "error");
        }
    } catch (e) {
        showToast("Errore di connessione durante il salvataggio", "error");
    }
}

window.openReceiptCustomizerModal = openReceiptCustomizerModal;
window.closeReceiptCustomizerModal = closeReceiptCustomizerModal;
window.updateReceiptPreviewFromInputs = updateReceiptPreviewFromInputs;
window.saveReceiptCustomization = saveReceiptCustomization;

init();
