const path = require("path");
const fs = require("fs");
const os = require("os");
const sharp = require("sharp");

/**
 * Prints common receipt header on ESC/POS printer.
 * Returns header metadata for receipt preview.
 * @param {Object} printer - ThermalPrinter instance.
 * @param {string} sagraName - Name of the event.
 * @returns {Promise<{hasHeaderImage: boolean, headerLines: string[]}>}
 */
async function printReceiptHeader(printer, sagraName) {
    const headerPath = path.join(__dirname, '..', 'public', 'images', 'receipt_header.png');
    let hasHeaderImage = false;

    if (fs.existsSync(headerPath)) {
        try {
            // Write resized image to OS temp directory (app.asar inside packaged exe is read-only)
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
    if (sagraName && sagraName.trim()) {
        printer.println(`Evento: ${sagraName.trim()}`);
    }
    printer.newLine();
    printer.drawLine();

    const headerLines = [
        ...(!hasHeaderImage ? ["PROLOCO LORENZAGO"] : []),
        "Via Faureana 117 - Lorenzago (BL)",
        "P.IVA 01089600256",
        "SCONTRINO NON FISCALE",
        ...(sagraName && sagraName.trim() ? [`Evento: ${sagraName.trim()}`] : [])
    ];

    return {
        hasHeaderImage,
        headerLines
    };
}

module.exports = { printReceiptHeader };
