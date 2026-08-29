
# 📖 Manuale Utente Ufficiale — Cassa & Gestione Eventi ProLoco Lorenzago

  

Benvenuto nel **Manuale Operativo Ufficiale** dell'applicazione. Questa guida descrive passo-passo tutte le funzionalità del programma, partendo dalle operazioni fondamentali fino alla gestione avanzata degli eventi, dei menu, delle stampe e dei resoconti statistici.

---

## 📑 Indice dei Contenuti

1. [Informazioni Base](#1-informazioni-base)

2. [Schermata Iniziale & Gestione Eventi](#2-schermata-iniziale--gestione-eventi)

3. [Gestione Menu, Prezzi & Scorte Magazzino](#3-gestione-menu-prezzi--scorte-magazzino)

4. [Schermata Cassa & Vendita](#4-schermata-cassa--vendita)

5. [Guida alle Impostazioni](#5-guida-alle-impostazioni)

6. [Resoconti & Statistiche](#6-resoconti--statistiche)

7. [Azioni Rapide](#7-azioni-rapide)

---  

## 1. Informazioni Base

Per utilizzare l'applicazione è necessario un PC con Windows 10/11 e una stampante termica ad esso collegata.

L'applicazione non richiede una connessione ad internet.

---

## 2. Schermata Iniziale & Gestione Eventi  

Dopo aver effettuato l'accesso all'applicazione viene mostrata la **Schermata Iniziale** con la panoramica di tutti gli eventi registrati.

### Questa schermata contiene:

*  #### Al centro
    * Una barra di ricerca per filtrare la lista eventi
	* La lista eventi divisa tra eventi attivi ed eventi archiviati
	* Il tasto per la creazione di un nuovo evento

*  #### In alto a destra
	* Il tasto per visualizzare la schermata dei report/statistiche
	* Il tasto per accedere alle impostazioni
	* Il tasto per chiudere l'applicazione  

### 2.1 Creare un Nuovo Evento

1. Clicca sul pulsante **`+ Nuovo Evento`**
2. Inserisci il **Nome dell'Evento** (es. *"Festa della Piadina"*)
3. Clicca l'evento creato per accedere alla cassa  

### 2.2 Gestire gli Eventi Esistenti

Cliccando le impostazioni dell'evento o premendo il tasto destro del mouse si possono effettuare le seguenti operazioni:  

*  **`Modifica Nome`** Consente di rinominare l'evento.

*  **`Duplica Evento`** Crea una copia dell'evento e del suo menù. Utile per non partire da zero.

*  **`Archivia Evento`** Sposta l'evento nella sezione sottostante per indicare che è terminato.

*  **`Elimina Evento`** Rimuove definitivamente l'evento e i relativi ordini.

---

## 3. Gestione Menu, Prezzi & Scorte Magazzino

Una volta aperto un evento è possibile dalla barra superiore accedere alla schermata di **Gestione Menu** cliccando il tasto **`Modifica Menu`**.

### 3.1 Creazione e Modifica Categorie

Le categorie permettono di raggruppare i piatti e gestire la stampa di scontrini divisi.

Le categorie predefinite sono: "**Cibo**" e "**Bevande**", nel caso di utilizzo della stampa di due scontrini uno per il cibo uno per le bevande, è essenziale usare questa categoria "Bevande" in quanto la divisione si basa su di essa.

#### Per creare una nuova categoria:
 
1. Clicca su **`Aggiungi Categoria`**.
2. Inserisci il nome (es. *"Dolci"*).
 
### 3.2 Tipologie di Prodotti
Esistono quattro tipi diversi di prodotti:

* **Prodotti Semplici**:
	* Sono il tipo più semplice di prodotti e consistono in prodotti inscindibili le cui scorte dipendono unicamente da quel prodotto (*Es. Acqua, Salsicce, ..*)
	* Sono caratterizzati da **Nome**, **Prezzo**, **Scorte**.

* **Prodotti Base**:
	* Sono prodotti che compongono altri prodotti e non sono destinati alla vendita individuale. (*Es. Pane, Formaggio*)
	* Sono caratterizzati da **Nome**, **Scorte**.

* **Prodotti Composti**:
	* Sono prodotti composti da Prodotti Semplici e Prodotti Base, le cui scorte sono stabilite dai prodotti che lo compongono. (*Es. Panino con il formaggio: composto da Pane e Formaggio*)
	* Sono caratterizzati da **Nome**, **Prezzo**, **Prodotti Collegati**.

* **Prodotti con Selezione**:
	* Sono prodotti che permettono la selezione dei vari componenti prima di essere aggiunti al carrello. (*Es. Menu Completo. Le varie opzioni sono: due primi, tre secondi e quattro bibite. Selezionando questo prodotto verrà richiesto quale combinazione di scelte selezionare*)
	* Sono caratterizzati da **Nome**, **Prezzo**, **Prodotti Collegati**.

Per aggiungere un **Prodotto Base** bisogna aprire la finestra laterale cliccando il tasto **`Prodotti Base`** sul bordo sinistro della schermata.

Per aggiungere gli altri tipi di prodotto bisogna cliccare il tasto corrispondente in fondo alla categoria nel quale si desidera aggiungerli.
  
### 3.3 Funzionalità Utili del Menu
Una volta inseriti tutti i prodotti nel menu è possibile effettuare le seguenti operazioni:
* **Ordinamento Menu**: Nella barra superiore cliccando il tasto **`Ordina Menu`** si aprirà una schermata in cui è possibile trascinare i vari piatti per ordinarli nel modo più comodo.
* **Stampa Menu**: Nella barra superiore cliccando il tasto **`Stampa Menu`** è possibile esportare un file A4 contenente il Menu selezionando un **Modello di Stampa** e le varie voci che vi si vuole includere. 

---

## 4. Schermata Cassa & Vendita

La schermata si presenta nella parte sinistra con la lista dei prodotti in vendita e in quella destra con il resoconto dell'ordine attuale e le funzionalità di stampa.
  
### 4.1 Selezione Prodotti

*  **Aggiunta al Carrello**: Clicca su una card per aggiungere una porzione al carrello. Ogni click successivo incrementa la quantità. É possibile aggiungere una determinata quantità in una sola volta facendo click col tasto destro sulla card e inserendo la quantità desiderata nell'apposita schermata che si apre.

*  **Badge Disponibilità**: I prodotti per i quali sono gestite le scorte presentano un piccolo cerchio nell'angolo in alto a destra della card contenente la quantità rimanente. Non è possibile aggiungere il prodotto al carrello se le scorte sono terminate.

### 4.2 Gestione del Carrello
La sezione destra della schermata racchiude i comandi di stampa e l'ordine corrente. Da questa sezione è possibile:

* **Visualizzare il Carrello**

*  **Gestire le Quantità**: 
	* Usa il pulsante **`-`** all'inizio di ciascuna riga per diminuire la quantità;
	* Usa il pulsante **`x`** per rimuovere il prodotto dal carrello;
	* Fai click col tasto destro per impostare direttamente una determinata quantità.

*  **Svuotare Carrello**: Clicca sul pulsante **`Svuota`** in alto a destra per azzerare l'ordine in corso. Oppure premi il tasto **`ESC`** sulla tastiera.

* **Visualizzare il Totale Dovuto**

* **Visualizzare il Resto Dovuto**: Inserendo il contante ricevuto nello spazio apposito viene mostrato il resto dovuto, è inoltre possibile utilizzare i tasti predefiniti con i vari tagli delle banconote per velocizzare l'inserimento. 
*Questa sezione può variare in base alle impostazioni generali. Per capire come personalizzarla vedi la Guida alle Impostazioni.*

* **Stampare l'Ordine**: Premendo il tasto **`Stampa Ordine`** verrà stampato lo scontrino e l'ordine effettuato verrà salvato nello storico.
Per effettuare un ordine di prova/non tracciato e senza la diminuzione delle scorte è necessario cliccare con il tasto destro del mouse il pulsante **`Stampa Ordine`** e selezionare il tasto che comparirà con la scritta **`Stampa Senza Salvare`**

* **Visualizzare lo Storico**: Cliccando il tasto **`Storico`** si aprirà la lista di tutti gli ordini effettuati ordinati dal più recente, per ogni ordine è possibile ristampare lo scontrino premendo il tasto **`Ristampa`**, è inoltre possibile esportare l'intera lista degli ordini in formato csv premendo il tasto in alto a destra **`Esporta CSV`**.

### 4.3 Blocco Cassa

* Cliccando su **`Blocca Cassa`** in basso a sinistra, la cassa viene bloccata e viene richiesto il codice d'accesso, se presente, per sbloccarla. 

---

## 5. Guida alle Impostazioni

### 5.1 Impostazioni di Stampa

* #### Stampante Termica
	* Selezionare la stampante corretta dal menu a tendina che si apre cliccando il tasto **`Seleziona Stampante`**.
	* L'applicazione supporta le stampanti termiche per scontrini (ESC/POS standard da 80mm o 58mm), sia collegate tramite cavo USB, sia tramite rete Ethernet/Wi-Fi.
	* Utilizzando il tasto **`Test`** è possibile verificare che la stampante sia collegata correttamente e non presenti problemi.

* #### Modello Scontrino
	* **Modello Compatto**: unico scontrino per tutte le categorie;
	* **Modello Diviso**: stampa in uno scontrino diverso le bevande dalle altre categorie.

* #### Personalizzazione Layout
	* Permette di personalizzare a piacimento lo scontrino da stampare, cliccando sul tasto **`Personalizza Scontrino`** si aprirà una finestra dove è possibile personalizzare i seguenti campi: 
		* **Logo**: Indica se mostrare o meno il logo, nel caso non venisse mostrato al suo posto verrà scritto il *Nome Associazione*;
		* **Nome Associazione**: stampato se il logo è disattivato o ci sono errori nella sua stampa;
		* **Indirizzo**
		* **Testo Personalizzato nell'Intestazione**: Utile per scrivere ad esempio Scontrino Non Fiscale;
		* **Nome dell'Evento**: Permette di stampare o meno il Nome dell'Evento e la possibilità di aggiungere un prefisso personalizzato, se non lo si vuole basta lasciare vuoto il campo;
		* **Grafica dei Divisori**;
		* **Testo a Piè di Pagina**;
		* **Data e Ora**.

### 5.2 Impostazioni Aspetto

* #### Tema Interfaccia
	* Imposta i colori dell'interfaccia su **Chiari** o **Scuri** per non appesantire la vista con il buio.

* **Modalità Scura Programmata**
	* Consente di programmare il cambio automatico tra tema chiaro e tema scuro ad un determinato orario.

* **Calcolo del Resto** 
	* Permette di personalizzare la sezione del **Resto Dovuto** dentro la schermata della cassa in tre modalità:
		* **Nascondi**: il calcolo del resto viene nascosto;
		* **Compatto**: mostra solo resto dovuto e casella d'inserimento del contante ricevuto;
		* **Completa**: mostra resto dovuto, casella d'inserimento del contante ricevuto e tasti rapidi per i tagli di banconote (`5€`, `10€`, `20€` e `50€`).
		
		
### 5.3 Impostazioni Avanzate

* #### Password d'Accesso
	* Possibilità di richiedere una password per accedere all'app e per sbloccare la cassa se viene bloccata con l'apposito tasto.
	
* **Modalità Test**
	* Quando viene stampato un ordine, al posto che mandarlo in stampa sulla stampante, viene mostrata un'anteprima in app.

* **Importa/Esporta Eventi**
	* Possibilità di esportare o di importare Eventi completi di Menu e Storico.
	* Selezionando il tasto **`Esporta Eventi`** sarà necessario selezionare gli eventi che si desiderano esportare e verrà generato un file con estensione `.db` che potrà essere importato in un altro pc o tenuto come backup.
	* Selezionando il tasto **`Importa Eventi`** sarà necessario selezionare un file con estensione `.db` e se il file viene convalidato sarà possibile scegliere quali eventi contenuti nel file importare.
  
### 5.4 Aggiornamento Software

Questa sezione permette di verificare la versione del software attualmente in uso e di controllare la presenza di aggiornamenti.
*La presenza di aggiornamenti viene automaticamente verificata all'apertura dell'app se è presente una connessione Internet e viene mostrata una notifica in caso di aggiornamenti disponibili.*
  

## 6. Resoconti & Statistiche

Accessibile dalla **Schermata Principale** attraverso il tasto **`Resoconti`** in alto a destra, permette di visualizzare le statistiche e i dati di tutti gli eventi.

### 6.1 Filtro Periodo & Date

In alto a destra è presente il selettore del periodo di riferimento, è possibile selezionare un periodo suggerito (*Quest'anno, Anno Precedente, Mese Corrente, ...*) oppure indicare un periodo personalizzato tramite una **Data di Inizio** e una **Data di Fine**

Tutti i grafici e le tabelle della pagina si riferiscono unicamente all'intervallo di tempo selezionato.
*Se un evento ha una parte degli ordini fuori da questa linea temporale e una parte all'interno, vengono considerati a fine statistico solo gli ordini che rispettano il periodo di riferimento selezionato.*

### 6.2 Scheda Panoramica

Offre la visione d'insieme dell'attività:

*  **5 Indicatori KPI**: Incasso Totale, Scontrini Emessi, Scontrino Medio, Totale Eventi e Prodotto più Venduto.

*  **Grafico ad Onda Temporale**: Mostra l'andamento delle vendite raggruppato per Giorno, Settimana o Mese.

*  **Confronto Incassi per Evento**: Classifica degli eventi con maggiore incasso.

*  **Distribuzione Categorie**: Grafico a barre con la ripartizione del fatturato per categoria (Cibo, Bevande, ecc.).

### 6.3 Scheda Dettagli Eventi

*  **Tabella Comparativa**: Elenco di tutti gli eventi con incasso, numero ordini, scontrino medio e data. Cliccando sul nome di un evento è possibile visualizzare le sue statistiche.

*  **Confronto Duale**: Seleziona due eventi dai menu a tendina per confrontare le loro curve di vendita sovrapposte e analizzare quale edizione ha reso di più.

### 6.4 Scheda Dettagli Prodotti

* **Evento di Riferimento**: Seleziona l'evento di riferimento per le statistiche dei Prodotti. La selezione predefinita è su tutti gli eventi.

*  **Tabella Prodotti**: Mostra per ogni articolo le porzioni vendute, il fatturato generato, il prezzo medio e la quota percentuale sulle vendite totali.
*Cliccando sul nome del Prodotto è possibile vedere le sue statistiche con il grafico delle vendite orarie e la distribuzione tra i vari eventi.*

*  **Top 5 & Flop 5**: I 5 piatti più venduti e i 5 meno venduti dell'evento.

*  **Monitoraggio Scorte**
	* **Prodotti Esauriti**: Lista dei prodotti le cui scorte sono esaurite con indicazione dell'orario in cui sono terminate.
	* **Prodotti Con Alte Scorte Rimanenti**: Lista dei prodotti le cui scorte sono rimaste per lo più invendute.

### 6.5 Scheda Ispezione Evento

Permette di analizzare uno specifico evento nei minimi dettagli:

*  **Selettore Evento**: Seleziona l'evento per il quale si desidera visualizzare le statistiche.

*  **4 Indicatori KPI**: Incasso Totale, Scontrini Emessi, Scontrino Medio e Totale Prodotti Venduti.

*  **Curva Vendite Orarie**: Grafico delle vendite orarie che evidenzia i picchi di affluenza.

*  **Lista Vendite Prodotti**: Lista completa di tutti i prodotti venduti ordinati in modo decrescente in base alla quantità venduta.
*Cliccando sul nome del Prodotto è possibile vedere le sue statistiche con il grafico delle vendite orarie e la distribuzione tra i vari eventi.*

*  **Monitoraggio Scorte**: Lista dei prodotti con scorte esaurite e con scorte invendute elevate.

*  **Top 3 & Flop 3**: I 3 piatti più venduti e i 3 meno venduti dell'evento.

*  **Storico Ordini**: Tutti gli scontrini dell'evento visualizzati a schede. É possibile ordinarli in base a: *Più recenti*, *Meno recenti*, *Più costosi*, *Meno costosi*.

### 6.6 Esportazione Report

Cliccando sul pulsante **`Esporta Report`** nella barra superiore il programma genera uno **screenshot** della pagina o della scheda visualizzata.
  
---

## 7. Azioni Rapide

| Tasto          | Azione         | Dove |
|----------------|----------------|--------|
| `Esc`      | Svuota Carrello | Schermata Cassa|
| `Esc`      | Chiudi Pop-Up | Tutte le schermate|
| `F1`      | Apre lo Storico | Schermata Cassa|
| `F2`      | Apre le Statistiche Rapide | Schermata Cassa|
| `F3`      | Apre Schermata di Gestione Menu | Schermata Cassa|
| `Ctrl + Invio` | Inserisce un Nuovo Prodotto | Schermata Gestione Menu|
| `Ctrl + Invio` | Stampa Ordine | Schermata Cassa|

---

*Ultimo aggiornamento 29/08/2026 - Tommaso Tremonti*