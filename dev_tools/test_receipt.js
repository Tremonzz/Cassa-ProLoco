const ThermalPrinter = require("node-thermal-printer").printer;
const PrinterTypes = require("node-thermal-printer").types;
const electron = require("electron");
const { PosPrinter } = require("electron-pos-printer");
const path = require("path");
const fs = require("fs");

// Function to generate receipt data
async function generateReceipt() {
    // Config without 'interface' to avoid requiring native printer drivers
    // We only want the buffer.
    let printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: path.join(__dirname, '..', 'printer-output.bin'), // Use file interface to avoid TCP errors
        width: 48,
        removeSpecialCharacters: false,
        lineCharacter: "=",
        options: {
            timeout: 5000
        }
    });

    // --- 1. HEADER: Static Image (Logo + Title) ---
    // User must save the image as 'public/receipt_header.png'
    const headerPath = path.join(__dirname, '..', 'public', 'receipt_header.png');

    if (fs.existsSync(headerPath)) {
        try {
            // Resize to 380px width (max for 58mm/80mm safe area) if needed, 
            // but assuming user provides correct size or we resize for safety.
            const sharp = require('sharp');
            const resizedHeaderPath = path.join(__dirname, '..', 'public', 'receipt_header_resized.png');

            await sharp(headerPath)
                .resize({ width: 380 }) // Ensure it fits
                .toFile(resizedHeaderPath);

            printer.alignCenter();
            await printer.printImage(resizedHeaderPath);
            printer.newLine();
        } catch (e) {
            console.error("Errore stampa header:", e);
            printer.println("PROLOCO LORENZAGO");
        }
    } else {
        console.log("⚠️ File 'public/receipt_header.png' non trovato. Stampa testo di default.");
        printer.alignCenter();
        printer.bold(true);
        printer.println("PROLOCO LORENZAGO");
    }

    // Address info moved BELOW the image
    printer.alignCenter();
    printer.setTextSize(0, 0);
    printer.println("Via Roma, 1 - Lorenzago (BL)");
    printer.println("P.IVA 12345678901");
    printer.newLine();

    printer.bold(true);
    printer.println("SCONTRINO NON FISCALE");
    printer.bold(false);
    printer.println("Evento: Festa 2025");
    printer.newLine();
    printer.drawLine();

    // --- 2. ITEMS: Manual Formatting ---
    // Increase line spacing for items (ESC 3 n) - n is dots. Default is usually ~30. Let's try 60.
    printer.raw(Buffer.from([0x1B, 0x33, 60]));

    // Helper to pad text
    const printRow = (left, right) => {
        const width = 48; // Max chars per line (approx for 80mm font A)
        const space = width - left.length - right.length;
        if (space > 0) {
            printer.println(left + " ".repeat(space) + right);
        } else {
            printer.println(left + " " + right); // Overflow handling basic
        }
    };

    printRow("2x Panino Salsiccia", "10.00");
    printRow("1x Birra Media", "5.00");
    printRow("1x Patatine", "3.50");

    // Reset to default line spacing (ESC 2)
    printer.raw(Buffer.from([0x1B, 0x32]));

    printer.drawLine();
    printer.bold(true);
    printRow("TOTALE", "EUR 18.50");
    printer.bold(false);
    printer.newLine();

    printer.alignCenter();
    printer.println("Grazie e arrivederci!");
    printer.println(new Date().toLocaleString());
    printer.cut();

    return printer.getBuffer();
}

// Since node-thermal-printer is just a buffer generator in some modes, 
// and we are in a pure Node environment for this test, we might need a 
// specific way to send bytes to the windows printer.
// A robust way in Node without Electron running is using 'bady-os-printer' or similar,
// but let's try a simple approach: saving to file and sending to printer via RAW.

const { exec } = require('child_process');
const readline = require('readline');

async function run() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log("=== TEST SCONTRINO COMPLETO ===");

    // Generate the buffer
    try {
        const buffer = await generateReceipt();
        const tempFile = path.join(__dirname, '..', 'temp_receipt.bin');
        fs.writeFileSync(tempFile, buffer);
        console.log("Scontrino generato in memoria.");

        // Automatically use POS-80 since user confirmed it 
        // (Or allow override but default to it)
        rl.question('Inserisci stampante (Invio per "POS-80"): ', (answer) => {
            const printerName = answer.trim() || "POS-80";

            console.log(`Eseguo script di stampa per "${printerName}"...`);

            // Defines a PowerShell command to send RAW BYTES to the printer
            // This bypasses the text driver and sends ESC/POS commands directly
            // Use the Robust PowerShell Script
            const psScript = path.join(__dirname, '..', 'print_raw.ps1');
            const cmd = `powershell -ExecutionPolicy Bypass -File "${psScript}" -PrinterName "${printerName}" -FilePath "${tempFile}"`;

            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Errore esecuzione: ${error.message}`);
                }
                console.log(`Output: ${stdout}`);
                if (stderr) console.error(`Stderr: ${stderr}`);
                rl.close();
            });
        });

    } catch (e) {
        console.error(e);
        rl.close();
    }
}

run();
