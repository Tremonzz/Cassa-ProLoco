const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;
const path = require("path");
const { printReceiptHeader, getReceiptConfig } = require("./receipt_header");
const { printReceiptFooter } = require("./receipt_footer");

/**
 * Generates an ESC/POS buffer and preview for a standard compact receipt.
 * @param {Object} data - The receipt data.
 * @param {string} data.sagraName - Name of the event.
 * @param {Array} data.items - Array of items {name, price, quantity}.
 * @param {number} data.total - Total amount.
 * @returns {Promise<{buffer: Buffer, preview: Object}>}
 */
async function generateReceiptBuffer(data) {
    const cfg = getReceiptConfig();
    const dividerStyle = cfg.body?.dividerStyle || 'dashed';

    let lineChar = "-";
    if (dividerStyle === 'solid') lineChar = "_";
    else if (dividerStyle === 'dotted') lineChar = ".";
    else if (dividerStyle === 'double') lineChar = "=";
    else if (dividerStyle === 'stars') lineChar = "*";

    const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: path.join(__dirname, '..', 'printer-output.bin'),
        width: 48,
        removeSpecialCharacters: false,
        lineCharacter: lineChar,
        options: { timeout: 5000 }
    });

    const printDivider = () => {
        if (dividerStyle === 'none') {
            printer.newLine();
        } else {
            printer.drawLine();
        }
    };

    const dateStr = new Date().toLocaleString('it-IT');

    // 1. HEADER (Shared module)
    const { hasHeaderImage, headerLines } = await printReceiptHeader(printer, data.sagraName, cfg);

    // 2. BODY (Items & Total)
    printer.raw(Buffer.from([0x1B, 0x33, 60]));

    const printRow = (left, right) => {
        const width = 48;
        let space = width - left.length - right.length;
        if (space < 1) space = 1;
        printer.println(left + " ".repeat(space) + right);
    };

    const itemsPreview = [];
    data.items.forEach(item => {
        const linePrice = (item.price * item.quantity).toFixed(2);
        const left = `${item.quantity}x ${item.name}`;
        printRow(left, linePrice);
        itemsPreview.push({ left: left, right: `€ ${linePrice}` });

        if (item.is_selection === 1 && Array.isArray(item.foodComponents) && item.foodComponents.length > 0) {
            item.foodComponents.forEach(compName => {
                const compLine = `    - ${compName}`;
                printer.println(compLine);
                itemsPreview.push({
                    left: compLine,
                    right: "",
                    isSubitem: true
                });
            });
        }
    });

    // Extract & aggregate menu drinks from composite items & selection items
    const menuDrinksMap = {};
    data.items.forEach(item => {
        if (Array.isArray(item.linkedDrinks) && item.linkedDrinks.length > 0) {
            const itemQty = item.quantity || 1;
            item.linkedDrinks.forEach(drinkName => {
                menuDrinksMap[drinkName] = (menuDrinksMap[drinkName] || 0) + itemQty;
            });
        }
    });

    // Print menu drinks with "MENU" label
    Object.entries(menuDrinksMap).forEach(([drinkName, totalQty]) => {
        const left = `${totalQty}x ${drinkName}`;
        printRow(left, "MENU");
        itemsPreview.push({
            left: left,
            right: "MENU"
        });
    });

    printer.raw(Buffer.from([0x1B, 0x32]));

    printDivider();
    printer.bold(true);
    printRow("TOTALE", `EUR ${data.total.toFixed(2)}`);
    printer.bold(false);
    printer.newLine();

    // 3. FOOTER (Shared module)
    const { footerLines } = printReceiptFooter(printer, { includeThanks: true, dateStr, customConfig: cfg });

    const preview = {
        receipts: [
            {
                hasHeaderImage,
                headerLines,
                items: itemsPreview,
                totalLabel: "TOTALE",
                totalValue: `EUR ${data.total.toFixed(2)}`,
                footerLines
            }
        ]
    };

    return {
        buffer: printer.getBuffer(),
        preview
    };
}

module.exports = { generateReceiptBuffer };
