# Strategic Wizardry piano del progetto

Aggiornato il 6 novembre 2026. Fase attuale: primo prototipo tecnico implementato su richiesta dell'autore. La realizzazione completa del gioco non è ancora iniziata.

Questo documento raccoglie le scelte confermate dall'autore e l'architettura di riferimento per la prima versione. Le scelte di prodotto sono stabilite; i dettagli tecnici e visivi saranno verificati durante lo sviluppo. Il regolamento originale e i chiarimenti dell'autore prevalgono sulle proposte di interfaccia e infrastruttura.

## Obiettivo e modalità confermate

La prima versione sarà una webapp pensata principalmente per computer e comprenderà:

- Due giocatori sullo stesso dispositivo.
- Due giocatori online tramite link d'invito.
- Un giocatore contro un avversario didattico controllato dal computer.

Le partite fra persone online saranno dal vivo, con riconnessione. Non sono richieste funzioni per partite asincrone su più giorni.

Non sono previsti orologi o limiti di tempo di riflessione nella prima versione.

La prima versione dell'interfaccia sarà soltanto in italiano. I nomi delle classi saranno italiani, con l'eccezione di «Spellsword», che resta invariato. I testi saranno organizzati per consentire traduzioni future senza riscrivere il motore.

Non sarà richiesta una registrazione nella prima versione. L'autore ha indicato GitHub come servizio già disponibile; repository, pubblicazione dell'interfaccia e servizio multiplayer sono ruoli da distinguere.

Il repository GitHub sarà pubblico. Il budget iniziale è zero: sono accettati i limiti dei piani gratuiti e non sono autorizzati servizi a pagamento.

L'autore non vuole creare account aggiuntivi oltre a GitHub. Ha confermato che sono accettabili servizi pubblici gratuiti utilizzabili senza nuove registrazioni. È stata adottata come architettura di riferimento GitHub Pages + WebRTC/PeerJS, con salvataggi locali ed esplicita accettazione dei possibili limiti di connessione per la prima versione fra amici.

## Disconnessioni confermate

Se un giocatore si disconnette, si attende il suo rientro senza sconfitta automatica. È possibile chiudere la partita senza assegnare un vincitore.

L'autore ha accettato di sostituire la precedente stanza centrale conservata per 24 ore con salvataggi nei browser di entrambi i giocatori e un file di backup esportabile.

La ripresa richiede di ritrovare i dati locali e ricollegare i giocatori. La cancellazione dei dati del browser o il passaggio a un altro dispositivo non garantiscono il recupero senza backup. La prima versione non prevede scadenza centralizzata né eliminazione della stanza su un server dopo 24 ore.

Scelta tecnica proposta: salvataggi automatici locali in IndexedDB, con esportazione e importazione di un file di partita versionato. Il browser può rimuovere i propri dati e l'utente può cancellarli; il file esportato è un mezzo distinto di recupero. La gestione dei salvataggi sarà esplicita nell'interfaccia.

## Interazione confermata

- Il giocatore prepara un'attivazione completa: movimento, eventuale abilità e movimento restante.
- Le scelte in preparazione sono modificabili prima della conferma dell'attivazione.
- Online, l'avversario vede le scelte confermate, non la preparazione.
- Il movimento si sceglie con clic o tocco sulla destinazione, con percorso proposto visibile e modificabile.
- Si seleziona il mago, si preme «Usa abilità» e si procede con la scelta guidata dei bersagli e degli eventuali spostamenti.
- Caselle raggiungibili, bersagli validi e anteprime di danni ed effetti saranno disponibili e disattivabili.
- Il giocatore può annullare liberamente le proprie attivazioni confermate finché non termina il proprio turno, senza chiedere il consenso dell'avversario.

Il pulsante «Termina turno» chiude la possibilità di annullamento. Gli annullamenti procedono a ritroso e sono comunicati all'altro giocatore.

L'autore ha scelto che anche il risultato di un'attivazione che porta un giocatore a tre maghi o meno resti provvisorio e annullabile fino a «Termina turno». La soglia viene rilevata subito; l'esito diventa definitivo alla chiusura del turno. Questa è una precisazione per la webapp rispetto alla formulazione della sconfitta immediata nel documento originale. La regola sulla Chain Lightning che porta entrambi alla soglia determina anche l'esito provvisorio.

Durante un risultato provvisorio le ulteriori mosse sono bloccate: sono disponibili soltanto «Annulla» e «Termina turno». Annullare rimuove il risultato provvisorio e ripristina lo stato precedente; concludere rende definitivo il risultato. In modalità online entrambe le operazioni sono validate e sincronizzate fra i browser.

## Presentazione confermata

- Stile fantasy sobrio, con ritratti e simboli riconoscibili delle classi.
- Leggibilità di caselle, punti vita, effetti e selezioni prioritaria rispetto agli ornamenti.
- Nella partita sullo stesso dispositivo, la scacchiera resta ferma al cambio di turno. Un pulsante consente di ruotarla manualmente.
- Per online e contro il computer, la proposta è mostrare inizialmente il proprio schieramento in basso.

Proposta di nomenclatura italiana, coerente con la scelta dell'autore:

| Nome nel regolamento e identificativo concettuale | Nome nell'interfaccia |
| --- | --- |
| Aeromancer | Aeromante |
| Electromancer | Elettromante |
| Enchanter | Incantatore |
| Geomancer | Geomante |
| Illusionist | Illusionista |
| Pyromancer | Piromante |
| Spellsword | Spellsword |
| Teleporter | Teletrasportatore |

Gli identificativi interni dei pezzi devono restare indipendenti da lingua, nome visualizzato e orientamento della scacchiera.

## Disposizione della schermata proposta

Per computer:

- Barra superiore con giocatori, colore attivo, fase e stato della connessione.
- Scacchiera ampia nella parte principale della schermata, con indicazione dei punti vita e degli stati sulle pedine.
- Pannello laterale con scheda del mago selezionato, velocità e movimento restante, abilità, eventuali limitazioni e anteprima degli effetti.
- Comandi «Usa abilità», «Conferma attivazione», «Annulla» e «Termina turno» raggruppati e abilitati in base allo stato corrente.
- Comandi secondari per aiuti visivi, regolamento e rotazione manuale.

L'interfaccia deve distinguere chiaramente preparazione locale, attivazione confermata e fine del turno. Se il risultato è provvisorio, il messaggio deve spiegare che «Termina turno» lo rende definitivo.

## Avversario automatico confermato

Il primo avversario deve essere didattico e adatto a imparare. L'architettura deve consentire di introdurre avversari più forti in seguito.

Proposta:

- Il modulo AI sceglie mosse; il motore delle regole ne verifica la legalità e ne applica gli effetti.
- Un'interfaccia comune riceve stato, configurazione e budget di calcolo e restituisce una decisione.
- L'interfaccia è asincrona, così il calcolo potrà essere locale o remoto senza cambiare le regole o i comandi del giocatore.
- La prima implementazione può eseguire il calcolo in un Web Worker del browser.
- La strategia può considerare combinazioni fra le attivazioni dello stesso turno.
- Eventuali spiegazioni devono riferirsi a effetti e valutazioni effettivamente calcolati.

Gli aiuti sulle regole restano disponibili come già confermato. Non sono previsti suggerimenti strategici né un pulsante «Suggerimento» nella prima versione, in nessuna modalità. L'AI è l'avversario; non consiglia le mosse al giocatore.

## Architettura di riferimento

| Modulo | Responsabilità |
| --- | --- |
| Motore TypeScript indipendente | Stato, legalità, movimento, visibilità, abilità, effetti, turni e risultato |
| Interfaccia React e TypeScript con Vite | Scacchiera, comandi, anteprime e animazioni |
| Gestione della partita | Collegare l'interfaccia alla modalità locale, AI o online |
| Strategie AI sostituibili | Scegliere mosse tramite il medesimo motore |
| Collegamento multiplayer WebRTC/PeerJS | Inviti, scambio dei comandi, sincronizzazione e riconnessione fra browser |
| Archiviazione locale | Stato corrente, configurazione, versione delle regole, cronologia e file di backup |

Il motore delle regole è condiviso dalle tre modalità. Nella partita online entrambi i browser verificano i comandi e sincronizzano le revisioni concordate. Il servizio pubblico PeerJS gestisce il collegamento iniziale; lo stato della partita rimane nei browser e non esiste un arbitro centrale del gioco.

L'autore ha ritirato la proposta di organizzare un file autonomo per ogni tipo di mago. Il motore sarà organizzato attorno alle regole comuni, alle fasi e alla risoluzione degli effetti; l'organizzazione interna delle abilità potrà essere definita durante l'implementazione. Restano confermate la separazione del motore dall'interfaccia e la modularità di AI, rete e salvataggi.

Ogni attivazione confermata deve essere applicata e salvata in modo atomico, rispettando l'ordine dei suoi effetti e le condizioni di fine partita. Identificativi dei comandi e revisioni dello stato devono impedire duplicazioni e applicazione di comandi obsoleti dopo una riconnessione.

Gli annullamenti online devono ripristinare coerentemente posizione, punti vita, effetti e avanzamento del turno. La cronologia deve poter rappresentare anche gli annullamenti. Il numero di revisione del protocollo continua ad avanzare anche quando una mossa viene annullata.

### Separazione dei moduli proposta

| Area del codice | Contenuto |
| --- | --- |
| `src/engine` | Stato e regole, indipendenti da interfaccia, rete e archiviazione |
| `src/game` | Preparazione delle attivazioni e gestione delle tre modalità |
| `src/ai` | Strategie sostituibili e adattatore per il Web Worker |
| `src/online` | Connessione PeerJS e protocollo dei comandi |
| `src/persistence` | Salvataggi locali e importazione/esportazione |
| `src/ui` | Schermate, scacchiera, comandi e testi italiani |

Queste sono le aree progettuali della futura applicazione completa. Il primo prototipo usa `src/model.ts` per il modello dimostrativo, `src/online.ts` per il collegamento, `src/storage.ts` per IndexedDB e `src/ui/` per l'interfaccia. L'adattatore di rete deve poter essere sostituito in futuro mantenendo il motore e i comandi di gioco.

### Stati e riconnessione proposti

- Preparazione dell'attivazione: anteprima privata, modificabile nel browser del giocatore attivo.
- Attivazione confermata: comando verificato, sincronizzato e salvato, ancora annullabile entro il turno.
- Risultato provvisorio: ulteriori mosse bloccate; sono possibili annullamento o conclusione.
- Fine turno: consolida le scelte e passa il controllo, oppure rende definitivo il risultato.
- Interruzione del collegamento: attesa del rientro senza sconfitta automatica; le nuove conferme online attendono la risincronizzazione.

I comandi avranno identificativi univoci e una revisione di partenza. Salvataggi e messaggi devono distinguere l'ultima revisione concordata da eventuali invii rimasti senza riscontro. Al rientro si confrontano partita, versione delle regole e revisioni; si recupera uno stato coerente prima di accettare nuove conferme. La selezione della revisione non deve basarsi soltanto sull'orologio dei dispositivi.

## Pubblicazione scelta

- Repository e interfaccia su GitHub e GitHub Pages.
- Motore, modalità locale e AI nel browser.
- Collegamento online dei browser con WebRTC tramite PeerJS.
- Servizio pubblico PeerServer Cloud per lo scambio iniziale dei dati di connessione, utilizzabile senza creare un account aggiuntivo.
- STUN per facilitare la connessione fra reti; alcune combinazioni di reti richiedono un relay TURN. Non è stato individuato e approvato un relay che garantisca il funzionamento su quelle reti restando nei vincoli scelti.
- Stato e cronologia nei browser dei partecipanti, con backup esportabile; recupero basato sui dati locali e sulla riconnessione dei due browser.

L'autore ha accettato sia il recupero tramite dati locali sia i possibili limiti di connessione per una prima versione di partite fra amici. L'interfaccia deve segnalare chiaramente l'impossibilità di collegarsi e le interruzioni, senza assegnare sconfitte automatiche.

Il servizio pubblico PeerJS non include più TURN gratuito, secondo l'annuncio dei manutentori. PeerServer Cloud e un relay TURN hanno responsabilità distinte; non va promessa una copertura di rete universale usando soltanto il servizio di signaling.

Il prototipo è stato verificato con due browser sullo stesso computer, sia tramite un PeerServer locale di test sia tramite il servizio pubblico PeerJS. Sono stati verificati rientro dopo interruzione, recupero dell'ultima revisione coerente e importazione del backup in un altro browser. Resta da eseguire la prova fra due dispositivi effettivamente su reti differenti.

Il collegamento iniziale richiede che il creatore abbia la partita aperta. La procedura di ripresa e l'eventuale generazione di un nuovo invito devono essere verificate durante lo sviluppo. L'indisponibilità di un servizio pubblico deve produrre un messaggio comprensibile, senza passaggi automatici a servizi a pagamento.

Riferimenti consultati:

- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Limiti GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
- [PeerJS FAQ](https://peerjs.com/client/faq)
- [PeerServer Cloud](https://peerjs.com/server/cloud)
- [Annuncio dei manutentori sulla cessazione del TURN gratuito](https://github.com/orgs/peers/discussions/1172)
- [WebRTC e protocolli di connessione](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols)

## Accesso senza account proposto

- Nome visualizzato scelto dal giocatore.
- Credenziale riservata che identifica il posto del giocatore nella partita.
- Link d'invito distinto dall'accesso personale del creatore.
- Credenziale conservata nel browser per la riconnessione.
- Ripresa tramite il salvataggio dello stesso browser o importazione del backup, seguita dal ricollegamento dei partecipanti. Un solo link personale non sostituisce i dati di partita mancanti.

Il nome e il semplice identificativo della stanza non devono essere sufficienti a prendere il posto di un giocatore.

## Verifiche previste nello sviluppo

Le scelte necessarie per impostare il progetto sono state raccolte. Le seguenti verifiche appartengono allo sviluppo futuro:

- Collegamento con due browser su reti differenti e comportamento sulle reti che impediscono il collegamento diretto.
- Disconnessione durante l'invio di un comando, riconnessione e prevenzione di duplicazioni.
- Ripresa dai salvataggi e dal file esportato, controllando anche versioni incompatibili.
- Annullamento delle attivazioni, delle eliminazioni, degli effetti e di un risultato provvisorio.
- Coerenza delle regole nelle tre modalità e legalità delle mosse dell'AI.
- Leggibilità e praticità delle schermate su computer.

Il caso di spostamento forzato di andata e ritorno senza cambiamento finale, segnalato in `REGOLAMENTO_CHIARIMENTI.md`, resta da precisare se necessario prima di implementare il divieto di abilità senza effetti.

## Percorso di sviluppo proposto

Il primo prototipo tecnico del collegamento online è implementato. Consente di creare un invito, entrare da un secondo browser, scambiare e annullare modifiche a un piccolo stato dimostrativo, salvarlo ed esportarlo. Mostra lo stato della connessione e recupera una revisione coerente dopo un'interruzione. La prova fra reti differenti richiede due partecipanti o dispositivi effettivamente su reti diverse; due schede dello stesso browser non bastano a validare quel caso.

Verifiche completate: build TypeScript/Vite; 18 test automatici su modello, backup e protocollo; 5 test con Chrome e PeerServer locale; 1 test con due browser e PeerServer Cloud pubblico. Le prove sul protocollo interrompono ciascuna fase della conferma e includono errori di scrittura e cronologie divergenti. I test locali non dimostrano la compatibilità con due reti differenti.

Avvio e istruzioni sono in `README.md` e `AVVIA_PROTOTIPO.cmd`. L'autore ha indicato `https://github.com/ipe3000/SW` come repository pubblico di destinazione. Il repository è stato verificato come vuoto; la pubblicazione GitHub Pages è predisposta con un workflow manuale ed è da completare.

1. Verificare con un piccolo prototipo il collegamento PeerJS fra reti diverse e il recupero dopo un'interruzione.
2. Formalizzare stato e comandi del motore e verificare le interazioni significative del regolamento.
3. Realizzare una partita locale completa con preparazione e conferma delle attivazioni, annullamenti e salvataggi.
4. Introdurre l'avversario didattico tramite l'interfaccia AI comune.
5. Integrare inviti online, protocollo dei comandi, backup e riconnessione.
6. Verificare le tre modalità e pubblicare secondo le istruzioni che l'autore darà per l'implementazione.

Sono traguardi di sviluppo; la prima versione destinata ai giocatori deve comprendere tutte e tre le modalità richieste.
