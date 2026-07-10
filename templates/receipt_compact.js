const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;
const path = require("path");
const fs = require("fs");
const sharp = require('sharp');

/**
 * Generates an ESC/POS buffer for a standard receipt.
 * @param {Object} data - The receipt data.
 * @param {string} data.sagraName - Name of the event.
 * @param {Array} data.items - Array of items {name, price, quantity}.
 * @param {number} data.total - Total amount.
 * @param {number|string} data.orderId - Order sequence number.
 * @returns {Promise<Buffer>}
 */
async function generateReceiptBuffer(data) {
    const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: path.join(__dirname, '..', 'printer-output.bin'), // Dummy file interface
        width: 48,
        removeSpecialCharacters: false,
        lineCharacter: "=",
        options: { timeout: 5000 }
    });

    // --- 1. HEADER ---
    // Try to print the resized image if available, else text
    const headerPath = path.join(__dirname, '..', 'public', 'receipt_header.png');

    if (fs.existsSync(headerPath)) {
        try {
            // Resize strictly to 380px to be safe for all 58/80mm printers
            const resizedHeaderPath = path.join(__dirname, '..', 'public', 'receipt_header_resized.png');

            // We resize every time or check if exists? 
            // For safety/updates, let's resize if source is newer or just always (it's fast).
            await sharp(headerPath)
                .resize({ width: 380 })
                .toFile(resizedHeaderPath);

            printer.alignCenter();
            await printer.printImage(resizedHeaderPath);
            printer.newLine();
        } catch (e) {
            console.error("Error printing logo:", e);
            printer.alignCenter();
            printer.bold(true);
            printer.println("PROLOCO LORENZAGO");
        }
    } else {
        printer.alignCenter();
        printer.bold(true);
        printer.println("PROLOCO LORENZAGO");
    }

    // Address & Metadata
    printer.alignCenter();
    printer.setTextSize(0, 0);
    printer.println("Via Faureana 117 - Lorenzago (BL)");
    printer.println("P.IVA 01089600256");
    printer.newLine();

    printer.bold(true);
    printer.println("SCONTRINO NON FISCALE");
    printer.bold(false);
    printer.println(`Evento: ${data.sagraName || 'Sagra'}`);
    // printer.println(`Ordine N. ${data.orderId || '---'}`); // Removed per user request
    printer.newLine();
    printer.drawLine();

    // --- 2. ITEMS ---
    // Increase line spacing for items (ESC 3 60)
    printer.raw(Buffer.from([0x1B, 0x33, 60]));

    // Helper for rows
    const printRow = (left, right) => {
        const width = 48; // Standard POS-80 width approx
        let space = width - left.length - right.length;
        if (space < 1) space = 1; // ensure at least one space

        // Simple truncation/overflow handling could be added here if needed
        printer.println(left + " ".repeat(space) + right);
    };

    data.items.forEach(item => {
        const linePrice = (item.price * item.quantity).toFixed(2);
        // Format: "2x Panino Salsiccia"
        const left = `${item.quantity}x ${item.name}`;
        printRow(left, linePrice);
    });

    // Reset line spacing (ESC 2)
    printer.raw(Buffer.from([0x1B, 0x32]));

    printer.drawLine();
    printer.bold(true);
    printRow("TOTALE", `EUR ${data.total.toFixed(2)}`);
    printer.bold(false);
    printer.newLine();

    // --- 3. FOOTER ---
    printer.alignCenter();
    printer.println("Grazie e arrivederci!");
    printer.println(new Date().toLocaleString('it-IT'));

    // Add extra newlines for cut clearance
    printer.newLine();
    printer.newLine();
    printer.cut();

    return printer.getBuffer();
}

module.exports = { generateReceiptBuffer };
