const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Resolves a path that may be inside an asar archive to its unpacked equivalent.
 * When packaged with electron-builder and asarUnpack, files are extracted to app.asar.unpacked.
 */
function resolveUnpacked(filePath) {
    return filePath.replace('app.asar', 'app.asar.unpacked');
}

/**
 * Sends a raw buffer to a specific Windows printer using PowerShell.
 * @param {Buffer} buffer - The raw bytes to print.
 * @param {string} printerName - The name of the printer (system name).
 * @returns {Promise<void>}
 */
function printRawBuffer(buffer, printerName) {
    return new Promise((resolve, reject) => {
        // Use OS temp dir for temp files (asar is read-only)
        const tempFile = path.join(os.tmpdir(), 'sagra_print_job.bin');
        // Script may be inside asar.unpacked when packaged
        const scriptPath = resolveUnpacked(path.join(__dirname, 'print_raw.ps1'));

        // 1. Write buffer to temp file
        fs.writeFile(tempFile, buffer, (err) => {
            if (err) return reject(err);

            // 2. Execute PowerShell script
            // powershell -ExecutionPolicy Bypass -File "script.ps1" -PrinterName "Name" -FilePath "file.bin"
            const cmd = `powershell -ExecutionPolicy Bypass -File "${scriptPath}" -PrinterName "${printerName}" -FilePath "${tempFile}"`;

            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.error("Print Error:", stderr || error.message);
                    return reject(error);
                }
                console.log("Print Output:", stdout.trim());
                resolve();
            });
        });
    });
}

module.exports = { printRawBuffer };
