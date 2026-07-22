/**
 * Prints common receipt footer on ESC/POS printer and cuts paper.
 * Returns footer metadata for receipt preview.
 * @param {Object} printer - ThermalPrinter instance.
 * @param {Object} [options] - Footer options.
 * @param {boolean} [options.includeThanks=true] - Whether to print "Grazie e arrivederci!".
 * @param {string} [options.dateStr] - Preformatted date string.
 * @returns {{footerLines: string[]}}
 */
function printReceiptFooter(printer, options = {}) {
    const includeThanks = options.includeThanks !== false;
    const dateStr = options.dateStr || new Date().toLocaleString('it-IT');

    printer.alignCenter();
    if (includeThanks) {
        printer.println("Grazie e arrivederci!");
    }
    printer.println(dateStr);

    printer.newLine();
    printer.newLine();
    printer.cut();

    const footerLines = [
        ...(includeThanks ? ["Grazie e arrivederci!"] : []),
        dateStr
    ];

    return {
        footerLines
    };
}

module.exports = { printReceiptFooter };
