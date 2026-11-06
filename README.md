# Strategic Wizardry

Webapp in italiano per il duello tattico dell'autore. La schermata principale permette una partita completa fra due giocatori sullo stesso computer, con tutti gli otto tipi di maghi e i chiarimenti raccolti in `REGOLAMENTO_CHIARIMENTI.md`.

Il laboratorio online resta separato, al collegamento «Laboratorio online» o con `?lab=1`: usa ancora due pedine dimostrative per verificare inviti, connessione e recupero. L'integrazione del gioco completo online e l'avversario didattico sono i prossimi traguardi.

## Giocare in locale

1. Apri [il gioco](https://ipe3000.github.io/SW/) e scegli nomi, PV iniziali (3, 4 o 5), variante dei muri e schieramento standard o personalizzato.
2. Seleziona un mago della gilda attiva e clicca sulla destinazione. Il percorso viene mostrato prima della conferma; «Modifica percorso passo per passo» permette di scegliere ogni passo, anche attraversando alleati.
3. Premi «Usa abilità» per scegliere bersagli e, quando richiesto, spostamenti o destinazioni. Per Aeromante e Illusionista premi «Concludi abilità» quando hai finito di prepararla. Puoi ancora usare il movimento restante del mago.
4. «Conferma attivazione» applica e salva l'intera scelta. «Azzera preparazione» modifica solo la bozza, «Annulla attivazione» ripristina una conferma precedente del turno corrente.
5. Svolgi le altre fasi oppure termina il turno. Almeno una delle attivazioni complete deve muovere o agire, se possibile. Il Rosso nel primo turno ha una sola attivazione; poi sono disponibili due attivazioni e una semiattivazione di un terzo mago.
6. A tre maghi o meno l'esito resta provvisorio: puoi soltanto annullare o premere «Termina turno» per renderlo definitivo.

La scacchiera resta ferma al cambio di turno; «Ruota la scacchiera» cambia soltanto il punto di vista. Il numero sulla pedina è il PV attuale. Una catena indica l'immobilizzazione. Il pannello del mago descrive abilità e passive. Gli aiuti mostrano raggiungibilità, bersagli ed effetti delle scelte, senza consigli strategici.

Ogni conferma, annullamento e schieramento è salvato in IndexedDB prima di aggiornare la partita visibile. La ricarica riprende l'ultima conferma, inclusa la possibilità di annullare entro il turno. Le bozze non confermate non sono salvate. Non aprire la stessa partita per modificarla contemporaneamente in più finestre: un controllo di revisione impedisce di sovrascrivere modifiche più recenti.

«Le mie partite» conserva separatamente ogni duello; «Esporta partita» scarica un file JSON con stato e annullamenti disponibili. Dal menu puoi importarlo in un altro browser. Un file incompatibile o incoerente viene rifiutato; se la stessa partita è già presente con dati differenti, l'importazione conserva il salvataggio esistente. I backup del laboratorio online restano distinti.

Lo schieramento personalizzato segue Rosso 4 / Blu 6 / Rosso 2 / Blu 2 / Rosso 2 nelle otto caselle centrali della propria prima riga. Puoi annullare le collocazioni del gruppo corrente fino al completamento del gruppo.

## Avvio su Windows

Con Node.js 24 LTS installato, apri `AVVIA_PROTOTIPO.cmd`. Il programma installa le dipendenze se mancano e apre `http://127.0.0.1:5173` nel browser. Lascia aperta la finestra del programma; Ctrl+C interrompe il server.

In alternativa, dal terminale nella cartella del progetto:

```powershell
npm.cmd ci
npm.cmd run dev
```

Se il tuo ambiente utilizza certificati di sistema per accedere a npm, puoi impostare `$env:NODE_USE_SYSTEM_CA = '1'` prima di `npm.cmd ci`. La verifica TLS rimane attiva.

## Provare una sessione del laboratorio online

Apri prima «Laboratorio online» dal menu del gioco.

1. Inserisci il nome e scegli «Crea sessione» nel primo browser. Il creatore occupa il posto Rosso.
2. Attendi «Invito pronto», copia l'invito e aprilo in un altro profilo del browser o in una finestra privata. Inserisci il nome del giocatore Blu e scegli «Entra nella sessione».
3. Attendi «Sincronizzato» in entrambi i browser.
4. Il Rosso seleziona una casella raggiungibile. Questa anteprima è privata. «Conferma spostamento» sincronizza e salva la modifica.
5. Prova «Annulla», poi conferma uno spostamento e premi «Termina turno». Il Blu può ora spostare la propria pedina.
6. Prova «Interrompi per prova» e poi «Ricollega». Verifica anche la ricarica delle pagine.
7. Esporta un backup personale, chiudi il browser corrispondente e importalo in un altro browser per recuperare quel posto.

Due schede nello stesso browser possono condividere i salvataggi locali: per isolare i due giocatori usa due profili o contesti distinti. Lo stesso salvataggio personale identifica lo stesso posto. Un nuovo ospite non può sostituire il Blu già assegnato senza il suo salvataggio o backup.

Un'interruzione improvvisa può richiedere alcuni secondi per essere rilevata. Durante l'attesa le conferme sono sospese. La riconnessione confronta le cronologie confermate, recupera quella coerente più avanzata e scarta le preparazioni rimaste senza conferma. In caso di cronologie divergenti, la sessione si ferma e preserva i dati.

## Prova fra due reti differenti

Gli inviti che iniziano con `http://127.0.0.1` o `http://localhost` funzionano sul computer che esegue il server. Per una prova da due dispositivi su reti diverse, pubblica la build su GitHub Pages con HTTPS e crea l'invito da quell'indirizzo pubblico.

Il servizio pubblico PeerJS avvia il collegamento; le modifiche di gioco viaggiano tramite WebRTC. STUN aiuta a trovare un percorso fra i browser. Non è configurato un relay TURN: alcune reti possono impedire la connessione. L'applicazione lo segnala e non assegna sconfitte automatiche.

Il test con il servizio pubblico eseguito sullo stesso computer dimostra l'accessibilità del servizio e lo scambio fra quei browser, non il funzionamento su due reti differenti.

## Salvataggi e backup

Le sessioni sono salvate in IndexedDB, separatamente per partita e posto del giocatore. «Le mie sessioni» permette di riaprirle. Il browser può cancellare i propri dati; non esiste una stanza centrale conservata per 24 ore.

Il file JSON esportato contiene il tuo accesso personale e la cronologia. Conservalo per recuperare il tuo posto. Importazioni con versione, formato o cronologia non validi vengono rifiutate prima di scrivere. Un backup vecchio non sovrascrive una cronologia locale coerente più avanzata; due cronologie divergenti richiedono verifica.

Ogni conferma segue queste fasi: preparazione e salvataggio della proposta, riscontro dell'altro browser, registrazione della modifica confermata e riscontro finale. I comandi hanno identificativi univoci; la revisione avanza anche quando si annulla. Le impronte mostrate nei dettagli sono controlli di coerenza, non firme crittografiche.

## Verifiche automatiche

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
npm.cmd run test:public
```

- `test`: verifica il motore completo, le interazioni dei poteri, geometria e visuale, obblighi e fasi, annullamenti, esiti e backup; include inoltre modello e protocollo del laboratorio online, interruzioni, errori di scrittura e cronologie divergenti.
- `build`: controlla TypeScript e prepara `dist/`.
- `test:e2e`: usa Chrome per giocare, usare tutti gli otto poteri, schierare, verificare la griglia senza strisce, annullare, salvare e riprendere. Avvia anche un PeerServer locale per verificare il laboratorio con due browser. Il server locale è soltanto uno strumento di test.
- `test:public`: ripete le prove del gioco locale e prova il laboratorio con due browser sullo stesso computer usando il servizio pubblico PeerJS. Richiede accesso Internet e può fallire per indisponibilità del servizio o restrizioni di rete.

Per verificare il prototipo già pubblicato, senza avviare un server locale:

```powershell
$env:SW_BASE_URL = 'https://ipe3000.github.io/SW/'
npm.cmd run test:public
```

Questo controllo usa l'indirizzo pubblico e il percorso del repository, mantenendo i due browser sul computer che esegue il test.

Gli screenshot e le tracce sono conservati in `test-results/`, escluso dal repository. I server dei test vengono chiusi automaticamente al termine.

Le prove del laboratorio includono ingresso con invito, sincronizzazione, conferma e annullamento sulla versione pubblica. Due browser sullo stesso computer non dimostrano il funzionamento su due reti differenti.

Verifica della versione 0.2 del 6 novembre 2026: compilazione riuscita, 44 test unitari e di protocollo e 15 prove con Chrome superati. I controlli misurano anche l'altezza uniforme di tutte le righe e l'assenza di spazi tra righe, con i muri presenti.

## Pubblicazione su GitHub Pages

Repository: [ipe3000/SW](https://github.com/ipe3000/SW). Il prototipo è pubblicato su [GitHub Pages](https://ipe3000.github.io/SW/).

1. Carica il progetto in un repository pubblico GitHub, escludendo `node_modules/`, `dist/`, backup personali e `test-results/`.
2. In Settings → Pages scegli GitHub Actions come origine.
3. Nella scheda Actions avvia manualmente «Pubblica Strategic Wizardry su GitHub Pages».

Il workflow verifica i test unitari, compila e pubblica `dist/`. È predisposto per avvio manuale. La base relativa di Vite supporta anche un indirizzo `https://utente.github.io/nome-repository/`.

La prima pubblicazione è stata completata e verificata il 6 novembre 2026. Il [workflow iniziale](https://github.com/ipe3000/SW/actions/runs/42237250337) ha pubblicato il commit `ca2d7f6`. Gli aggiornamenti successivi si pubblicano avviando nuovamente il workflow manuale.

## Organizzazione del codice

| File | Responsabilità |
| --- | --- |
| `src/engine/game.ts` | Stato del gioco completo, movimento, turni, poteri, effetti, risultato e annullamenti |
| `src/engine/geometry.ts` | Distanze, percorsi e visuale geometrica |
| `src/engine/backup.ts` | Lettura e verifica dei salvataggi del gioco completo |
| `src/game-storage.ts` | Salvataggi locali del gioco completo e controllo di revisione |
| `src/ui/LocalGame.tsx` | Preparazione della partita, schieramento e composizione delle attivazioni |
| `src/ui/BoardGrid.tsx` | Griglia condivisa 10×10, percorsi e muri di forza |
| `src/model.ts` | Stato e comandi dimostrativi, cronologia, verifiche di backup e inviti |
| `src/online.ts` | PeerJS, ingresso e rientro, protocollo di conferma e sincronizzazione |
| `src/storage.ts` | Salvataggi IndexedDB |
| `src/ui/App.tsx` | Schermate e comandi del laboratorio |
| `src/ui/styles.css` | Presentazione fantasy sobria e disposizione adattabile |

Il motore completo è indipendente da React, IndexedDB e PeerJS: riceve stato e comandi e restituisce uno stato nuovo. Il modello dimostrativo resta confinato al laboratorio. I poteri condividono regole comuni di distanza, visuale, danno e movimento, senza un sistema di plugin per ciascun mago. Le scelte di progetto sono raccolte in `PIANO_PROGETTO.md`; i chiarimenti dell'autore in `REGOLAMENTO_CHIARIMENTI.md`.

I ritratti sono mostrati ritagliando via SVG l'immagine del diagramma fornito dall'autore in `Strategic Wizardry.docx`, conservata senza modifiche in `public/assets/wizard-roster.png`. Non sono nuove illustrazioni create per questa implementazione.
