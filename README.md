# Gestione Ordini - Proloco Lorenzago

Applicazione desktop per la gestione della cassa, degli ordini e della stampa degli scontrini per sagre ed eventi.

---

## Caratteristiche Principali

- **Interfaccia POS Cassa**: Inserimento rapido degli ordini organizzato per categorie, calcolatrice dinamica del resto e gestione carrello.
- **Stampa Termica (ESC/POS)**:
  - **Template Compatto**: Scontrino unico con riepilogo dell'ordine.
  - **Template Diviso**: Separa automaticamente gli articoli per la zona Cibo e la zona Bar/Bevande (con riepilogo aggregato). Se l'ordine contiene solo una categoria, viene stampato automaticamente un singolo scontrino compatto per evitare sprechi di carta.
- **Modalità Test (Anteprima)**: Attivabile dalle impostazioni per verificare a schermo l'aspetto grafico esatto dello scontrino senza inviare la stampa fisica.
- **Gestione Eventi & Menu**: Creazione di eventi dedicati, personalizzazione del listino prezzi e gestione delle scorte/inventario (illimitato o a quantitativo limitato).
- **Storico e Reportistica**: Consultazione degli ordini recenti, statistiche sui prodotti più venduti, fatturato totale ed esportazione dati in formato CSV.
- **Backup e Ripristino**: Esportazione ed importazione completa del database SQLite per la salvaguardia dei dati.

---

## Requisiti di Sistema

- **Sistema Operativo**: Windows 10 / Windows 11 (64-bit)
- **Node.js**: Versione 16 o superiore (per lo sviluppo)
- **Stampante Termica**: Qualsiasi stampante termica compatibile Windows (58mm o 80mm) collegata tramite USB o rete.

---

## Struttura del Progetto

```text
metallic-kepler/
├── main.js                 # Punto d'ingresso Electron (gestione finestra a schermo intero)
├── server.js               # Server Express e gestione Database SQLite3
├── print_service.js        # Integrazione PowerShell per invio buffer ESC/POS grezzo
├── print_raw.ps1           # Script PowerShell per chiamata API Win32 (winspool.drv)
├── templates/              # Generazione scontrini termici
│   ├── receipt_header.js   # Modulo condiviso intestazione (logo e dati)
│   ├── receipt_footer.js   # Modulo condiviso piè di pagina
│   ├── receipt_compact.js  # Template scontrino compatto
│   └── receipt_split.js    # Template scontrino diviso
├── public/                 # Interfaccia Web Frontend
│   ├── index.html          # Struttura della cassa e delle schermate
│   ├── css/
│   │   └── style.css       # Stili dell'interfaccia e anteprima termica
│   ├── js/
│   │   └── app.js          # Logica frontend, calcoli e chiamate API
│   └── images/             # Loghi e icone
└── dev_tools/              # Script di utilità e test in fase di sviluppo
```

---

## Guida allo Sviluppo

### 1. Installazione Dipendenze
Aprire il terminale nella cartella del progetto ed eseguire:
```bash
npm install
```

### 2. Esecuzione in Ambiente di Sviluppo
È possibile avviare l'applicazione in due modalità:

- **Tramite script batch (Server Web locale)**:
  Eseguire il file `start_app.bat` oppure lanciare:
  ```bash
  npm start
  ```
  L'interfaccia sarà raggiungibile via browser all'indirizzo `http://localhost:3000`.

- **Tramite Electron (Applicazione Desktop)**:
  ```bash
  npm run start-electron
  ```

---

## Creazione dell'Eseguibile (.exe)

Per generare l'installatore Windows distribuibile (`.exe`):

1. Assicurarsi che le dipendenze siano aggiornate:
   ```bash
   npm install
   ```
2. Avviare la procedura di packaging con `electron-builder`:
   ```bash
   npm run dist
   ```
3. Il file di installazione verrà generato nella cartella `dist/` (es. `Gestione Ordini Setup 1.3.2.exe`).

---

## Configurazione Stampante

1. Aprire l'applicazione ed accedere al pannello **Impostazioni** (icona ingranaggio in alto a destra).
2. Selezionare la stampante termica installata sul sistema dal menu a tendina.
3. Scegliere il layout desiderato (*Compatto* o *Diviso*).
4. *(Opzionale)* Attivare la **Modalità Test** per verificare il layout dello scontrino prima dell'evento.

---

## Licenza e Proprietà

Sviluppato per **Comune di Lorenzago / Proloco Lorenzago**.
