const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;
const path = require("path");
const { generateReceiptBuffer } = require("./receipt_compact");
const { printReceiptHeader } = require("./receipt_header");
const { printReceiptFooter } = require("./receipt_footer");

/**
 * Generates a SPLIT receipt buffer (Food + Drinks).
 * If order has only Food or only Drinks, delegates to single COMPACT receipt.
 * Otherwise generates 2 receipts:
 * Receipt 1: Food Items (Detailed) + Drinks (Aggregated 1 Line) + Total
 * Receipt 2: Drinks Items (Detailed) + Total Drinks
 * @param {Object} data - Order data.
 * @returns {Promise<{buffer: Buffer, preview: Object}>}
 */
async function generateSplitReceipt(data) {
    console.log("Splitting order items...", data.items);

    const drinks = data.items.filter(i => (i.category && i.category.toLowerCase() === 'bevande'));
    const food = data.items.filter(i => !(i.category && i.category.toLowerCase() === 'bevande'));

    // Single category fallback: print single compact receipt
    if (food.length === 0 || drinks.length === 0) {
        console.log("Order contains single category. Printing single compact receipt.");
        return await generateReceiptBuffer(data);
    }

    const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: path.join(__dirname, '..', 'printer-output.bin'),
        width: 48,
        removeSpecialCharacters: false,
        lineCharacter: "=",
        options: { timeout: 5000 }
    });

    const dateStr = new Date().toLocaleString('it-IT');
    const totalDrinks = drinks.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    const printRow = (left, right) => {
        const width = 48;
        let space = width - left.length - right.length;
        if (space < 1) space = 1;
        printer.println(left + " ".repeat(space) + right);
    };

    const printItems = (itemsList) => {
        printer.raw(Buffer.from([0x1B, 0x33, 60]));
        itemsList.forEach(item => {
            const linePrice = (item.price * item.quantity).toFixed(2);
            const left = `${item.quantity}x ${item.name}`;
            printRow(left, `EUR ${linePrice}`);
        });
        printer.raw(Buffer.from([0x1B, 0x32]));
    };

    // --- RECEIPT 1: FOOD + AGGREGATED DRINKS ---
    let receipt1HeaderInfo = { hasHeaderImage: false, headerLines: [] };
    let receipt1FooterInfo = { footerLines: [] };

    if (food.length > 0 || drinks.length > 0) {
        receipt1HeaderInfo = await printReceiptHeader(printer, data.sagraName);

        if (food.length > 0) {
            printItems(food);
        }

        if (totalDrinks > 0) {
            if (food.length > 0) printer.newLine();
            printer.bold(true);
            printRow("BEVANDE (Totale)", "EUR " + totalDrinks.toFixed(2));
            printer.bold(false);
        }

        printer.drawLine();
        printer.bold(true);
        printRow("TOTALE", "EUR " + Number(data.total).toFixed(2));
        printer.bold(false);
        printer.newLine();

        receipt1FooterInfo = printReceiptFooter(printer, { includeThanks: true, dateStr });
    }

    // --- RECEIPT 2: DRINKS (Detailed for Bar) ---
    let receipt2FooterInfo = { footerLines: [] };

    if (drinks.length > 0) {
        printer.alignCenter();
        printer.bold(true);
        printer.setTextSize(1, 1);
        printer.println("BEVANDE");
        printer.setTextSize(0, 0);
        printer.bold(false);
        printer.newLine();

        printer.alignCenter();
        printer.newLine();

        printItems(drinks);

        printer.drawLine();
        printer.bold(true);
        printRow("TOTALE BEVANDE", "EUR " + totalDrinks.toFixed(2));
        printer.bold(false);
        printer.newLine();

        receipt2FooterInfo = printReceiptFooter(printer, { includeThanks: false, dateStr });
    }

    // Build Preview Object
    const foodItemsPreview = food.map(item => ({
        left: `${item.quantity}x ${item.name}`,
        right: `€ ${(item.price * item.quantity).toFixed(2)}`
    }));

    if (totalDrinks > 0) {
        foodItemsPreview.push({
            left: "BEVANDE (Totale)",
            right: `EUR ${totalDrinks.toFixed(2)}`,
            isBold: true
        });
    }

    const receipt1Preview = {
        hasHeaderImage: receipt1HeaderInfo.hasHeaderImage,
        headerLines: receipt1HeaderInfo.headerLines,
        items: foodItemsPreview,
        totalLabel: "TOTALE",
        totalValue: `EUR ${Number(data.total).toFixed(2)}`,
        footerLines: receipt1FooterInfo.footerLines
    };

    const drinksItemsPreview = drinks.map(item => ({
        left: `${item.quantity}x ${item.name}`,
        right: `€ ${(item.price * item.quantity).toFixed(2)}`
    }));

    const receipt2Preview = {
        hasHeaderImage: false,
        title: "BEVANDE",
        headerLines: [],
        items: drinksItemsPreview,
        totalLabel: "TOTALE BEVANDE",
        totalValue: `EUR ${totalDrinks.toFixed(2)}`,
        footerLines: receipt2FooterInfo.footerLines
    };

    return {
        buffer: printer.getBuffer(),
        preview: {
            receipts: [receipt1Preview, receipt2Preview]
        }
    };
}

module.exports = { generateSplitReceipt };
