const { exec } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("=== TEST STAMPANTE TERMICA ===");
console.log("Sto cercando le stampanti installate...");

// 1. List Printers via PowerShell
exec('powershell "Get-Printer | Select-Object Name | Format-Table -HideTableHeaders"', (err, stdout, stderr) => {
    if (err) {
        console.error("Errore nel recupero stampanti:", err);
        return;
    }

    const printers = stdout.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

    console.log("\nStampanti trovate:");
    printers.forEach((p, index) => console.log(`${index + 1}. ${p}`));
    console.log("---------------------------");

    rl.question('\nInserisci il NOME esatto della stampante (o il numero): ', (answer) => {
        let printerName = answer.trim();

        // Handle numeric selection
        const idx = parseInt(printerName) - 1;
        if (!isNaN(idx) && printers[idx]) {
            printerName = printers[idx];
        }

        if (!printerName) {
            console.log("Nessuna stampante selezionata.");
            rl.close();
            return;
        }

        console.log(`\nStampo "Ciao Mary" su: "${printerName}"...`);

        // 2. Print "Ciao Mary" via PowerShell
        const printCommand = `powershell "$printer = Get-WmiObject -Class Win32_Printer -Filter \\"Name='${printerName}'\\"; $printer.PrintJobDataType='TEXT'; 'Ciao Mary' | Out-Printer -Name '${printerName}'"`;

        // Alternative simple command:
        // const simpleCommand = `powershell "'Ciao Mary' | Out-Printer -Name '${printerName}'"`;

        exec(printCommand, (err, stdout, stderr) => {
            if (err) {
                console.error("ERRORE DI STAMPA:", stderr || err.message);
                console.log("Probabilmente il nome stampante è errato o non raggiungibile.");
            } else {
                console.log("✅ Comando inviato con successo!");
                console.log("Controlla se la stampante ha stampato.");
            }
            rl.close();
        });
    });
});
