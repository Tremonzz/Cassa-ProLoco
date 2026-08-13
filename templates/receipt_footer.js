const { getReceiptConfig } = require('./receipt_header');

/**
 * Prints common receipt footer on ESC/POS printer and cuts paper.
 * Returns footer metadata for receipt preview.
 * @param {Object} printer - ThermalPrinter instance.
 * @param {Object} [options] - Footer options.
 * @param {boolean} [options.includeThanks] - Override include thanks option.
 * @param {string} [options.dateStr] - Preformatted date string.
 * @param {Object} [options.customConfig] - Optional custom configuration.
 * @returns {{footerLines: string[]}}
 */
function printReceiptFooter(printer, options = {}) {
    const cfg = options.customConfig || getReceiptConfig();
    const f = cfg.footer || {};

    const includeThanks = options.includeThanks !== undefined ? options.includeThanks : (f.showThanks !== false);
    const thanksMessage = f.thanksMessage || "Grazie e arrivederci!";
    const showDate = f.showDate !== false;
    const dateStr = options.dateStr || new Date().toLocaleString('it-IT');

    printer.alignCenter();
    if (includeThanks && thanksMessage) {
        printer.println(thanksMessage);
    }
    if (showDate) {
        printer.println(dateStr);
    }

    printer.newLine();
    printer.newLine();
    printer.cut();

    const footerLines = [
        ...(includeThanks && thanksMessage ? [thanksMessage] : []),
        ...(showDate ? [dateStr] : [])
    ];

    return {
        footerLines
    };
}

module.exports = { printReceiptFooter };
