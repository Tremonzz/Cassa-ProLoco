const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;
const path = require("path");
const fs = require("fs");
const sharp = require('sharp');

/**
 * Generates a SPLIT receipt buffer (Food + Drinks).
 * Receipt 1: Food Items (Detailed) + Drinks (Aggregated 1 Line) + Total
 * Receipt 2: Drinks Items (Detailed) + Total Drinks
 */
async function generateSplitReceipt(data) {
    const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: path.join(__dirname, '..', 'printer-output.bin'),
        width: 48,
        removeSpecialCharacters: false,
        lineCharacter: "=",
        options: { timeout: 5000 }
    });

    console.log("Splitting order items...", data.items);

    // Filter Items
    const drinks = data.items.filter(i => (i.category && i.category.toLowerCase() === 'bevande'));
    const food = data.items.filter(i => !(i.category && i.category.toLowerCase() === 'bevande'));

    // Calculate Totals
    const totalDrinks = drinks.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    // const totalFood = food.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    // --- RECEIPT 1: FOOD + AGGREGATED DRINKS ---
    // Print if there is food OR if there are drinks (to show the payment total)
    if (food.length > 0 || drinks.length > 0) {
        await printHeader(printer);

        printer.alignCenter();
        printer.println(`Evento: ${data.sagraName || 'Sagra'}`);
        printer.newLine();
        printer.drawLine();

        // 1. Print Food Items (Detailed)
        if (food.length > 0) {
            printItems(printer, food);
        }

        // 2. Print Drinks (Aggregated)
        if (totalDrinks > 0) {
            // Add a small separator or valid spacing if needed, but simple row is fine
            if (food.length > 0) printer.newLine();
            printer.bold(true);
            printRow(printer, "BEVANDE (Totale)", "EUR " + totalDrinks.toFixed(2));
            printer.bold(false);
        }

        printer.drawLine();
        printer.bold(true);
        // GRAND TOTAL
        printRow(printer, "TOTALE", "EUR " + Number(data.total).toFixed(2));
        printer.bold(false);
        printer.newLine();

        // Footer 1
        printer.alignCenter();
        printer.println("Grazie e arrivederci!");
        printer.println(new Date().toLocaleString('it-IT'));
        printer.newLine();
        printer.newLine();
        printer.cut();
    }

    // --- RECEIPT 2: DRINKS (Detailed) ---
    if (drinks.length > 0) {
        // No graphical header
        printer.alignCenter();
        printer.bold(true);
        printer.setTextSize(1, 1);
        printer.println("BEVANDE");
        printer.setTextSize(0, 0);
        printer.bold(false);
        printer.newLine();

        printer.alignCenter();
        // printer.println(`Ordine N. ${data.orderId || '---'}`); // Removed per user request
        printer.newLine();

        // Print Drinks Detailed
        printItems(printer, drinks);

        printer.drawLine();
        printer.bold(true);
        printRow(printer, "TOTALE BEVANDE", "EUR " + totalDrinks.toFixed(2));
        printer.bold(false);

        printer.newLine();
        printer.alignCenter();
        printer.println(new Date().toLocaleString('it-IT'));
        printer.newLine();
        printer.newLine();
        printer.cut();
    }

    return printer.getBuffer();
}

// --- HELPERS ---

async function printHeader(printer) {
    const headerPath = path.join(__dirname, '..', 'public', 'receipt_header.png');
    if (fs.existsSync(headerPath)) {
        try {
            const resizedHeaderPath = path.join(__dirname, '..', 'public', 'receipt_header_resized.png');
            // Check if resize needed (simplified, just do it)
            if (!fs.existsSync(resizedHeaderPath)) {
                await sharp(headerPath).resize({ width: 380 }).toFile(resizedHeaderPath);
            }
            printer.alignCenter();
            await printer.printImage(resizedHeaderPath);
            printer.newLine();
        } catch (e) {
            printer.alignCenter();
            printer.bold(true);
            printer.println("PROLOCO LORENZAGO");
        }
    } else {
        printer.alignCenter();
        printer.bold(true);
        printer.println("PROLOCO LORENZAGO");
    }

    printer.alignCenter();
    printer.setTextSize(0, 0);
    printer.println("Via Faureana 117 - Lorenzago (BL)");
    printer.println("P.IVA 01089600256");
    printer.newLine();
    printer.bold(true);
    printer.println("SCONTRINO NON FISCALE");
    printer.bold(false);
}

function printItems(printer, items) {
    printer.raw(Buffer.from([0x1B, 0x33, 60])); // Spacing

    items.forEach(item => {
        const linePrice = (item.price * item.quantity).toFixed(2);
        const left = `${item.quantity}x ${item.name}`;
        // Print price for everything in the split receipt for clarity
        printRow(printer, left, `EUR ${linePrice}`);
    });

    printer.raw(Buffer.from([0x1B, 0x32])); // Reset Spacing
}

function printRow(printer, left, right) {
    const width = 48;
    let space = width - left.length - right.length;
    if (space < 1) space = 1;
    printer.println(left + " ".repeat(space) + right);
}

module.exports = { generateSplitReceipt };
