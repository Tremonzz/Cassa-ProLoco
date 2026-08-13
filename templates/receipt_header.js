const path = require("path");
const fs = require("fs");
const os = require("os");
const sharp = require("sharp");

function getReceiptConfig() {
    const configPath = path.join(__dirname, 'receipt_config.json');
    const defaults = {
        header: {
            showLogo: true,
            showCompanyName: true,
            companyName: "PROLOCO LORENZAGO",
            showAddress: true,
            address: "Via Faureana 117 - Lorenzago (BL)",
            showPiva: true,
            piva: "P.IVA 01089600256",
            showTitle: true,
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
    if (fs.existsSync(configPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return {
                header: { ...defaults.header, ...(data.header || {}) },
                body: { ...defaults.body, ...(data.body || {}) },
                footer: { ...defaults.footer, ...(data.footer || {}) }
            };
        } catch (e) {}
    }
    return defaults;
}

/**
 * Prints common receipt header on ESC/POS printer.
 * Returns header metadata for receipt preview.
 * @param {Object} printer - ThermalPrinter instance.
 * @param {string} sagraName - Name of the event.
 * @param {Object} [customConfig] - Optional custom configuration.
 * @returns {Promise<{hasHeaderImage: boolean, headerLines: string[]}>}
 */
async function printReceiptHeader(printer, sagraName, customConfig = null) {
    const cfg = customConfig || getReceiptConfig();
    const h = cfg.header || {};

    const headerPath = path.join(__dirname, '..', 'public', 'images', 'receipt_header.png');
    let hasHeaderImage = false;

    if (h.showLogo !== false && fs.existsSync(headerPath)) {
        try {
            const resizedHeaderPath = path.join(os.tmpdir(), 'receipt_header_resized.png');
            await sharp(headerPath)
                .resize({ width: 380 })
                .toFile(resizedHeaderPath);

            printer.alignCenter();
            await printer.printImage(resizedHeaderPath);
            printer.newLine();
            hasHeaderImage = true;
        } catch (e) {
            console.error("Error printing logo:", e);
        }
    }

    const showCompanyText = (h.showCompanyName !== false) && (!hasHeaderImage || h.showLogo === false);
    if (showCompanyText && h.companyName) {
        printer.alignCenter();
        printer.bold(true);
        printer.println(h.companyName);
    }

    printer.alignCenter();
    printer.setTextSize(0, 0);
    if (h.showAddress !== false && h.address) printer.println(h.address);
    if (h.showPiva !== false && h.piva) printer.println(h.piva);
    printer.newLine();

    if (h.showTitle !== false && h.title) {
        printer.bold(true);
        printer.println(h.title);
        printer.bold(false);
    }

    const eventPrefix = h.eventNamePrefix !== undefined ? h.eventNamePrefix : "Evento: ";
    if (h.showEventName !== false && sagraName && sagraName.trim()) {
        printer.println(`${eventPrefix}${sagraName.trim()}`);
    }

    printer.newLine();
    printer.drawLine();

    const headerLines = [
        ...(showCompanyText && h.companyName ? [h.companyName] : []),
        ...(h.showAddress !== false && h.address ? [h.address] : []),
        ...(h.showPiva !== false && h.piva ? [h.piva] : []),
        ...(h.showTitle !== false && h.title ? [h.title] : []),
        ...(h.showEventName !== false && sagraName && sagraName.trim() ? [`${eventPrefix}${sagraName.trim()}`] : [])
    ];

    return {
        hasHeaderImage,
        headerLines
    };
}

module.exports = { printReceiptHeader, getReceiptConfig };
