# Strategic Wizardry laboratorio online

Primo prototipo tecnico della futura webapp. Verifica inviti, collegamento fra due browser, conferma degli spostamenti, annullamento, salvataggio e recupero.

Il campo usa due pedine dimostrative: fino a tre passi ortogonali per spostamento e due spostamenti per turno. Non è ancora un'implementazione delle regole di Strategic Wizardry.

## Avvio su Windows

Con Node.js 24 LTS installato, apri `AVVIA_PROTOTIPO.cmd`. Il programma installa le dipendenze se mancano e apre `http://127.0.0.1:5173` nel browser. Lascia aperta la finestra del programma; Ctrl+C interrompe il server.

In alternativa, dal terminale nella cartella del progetto:

```powershell
npm.cmd ci
npm.cmd run dev
```

Se il tuo ambiente utilizza certificati di sistema per accedere a npm, puoi impostare `$env:NODE_USE_SYSTEM_CA = '1'` prima di `npm.cmd ci`. La verifica TLS rimane attiva.

## Provare una sessione

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

- `test`: verifica regole dimostrative, versioni e backup, recupero delle cronologie e interruzioni durante ogni fase della conferma. Include un errore di scrittura locale e salvataggi divergenti.
- `build`: controlla TypeScript e prepara `dist/`.
- `test:e2e`: avvia un PeerServer locale e Vite in modalità test. Usa Chrome installato per collegare due browser e verificare invito, anteprima, sincronizzazione, annullamento, riconnessione, backup e assegnazione dei posti. Il server locale resta uno strumento di test; non fa parte dell'hosting del gioco.
- `test:public`: prova due browser sullo stesso computer usando il servizio pubblico PeerJS. Richiede accesso Internet e può fallire per indisponibilità del servizio o restrizioni di rete.

Per verificare il prototipo già pubblicato, senza avviare un server locale:

```powershell
$env:SW_BASE_URL = 'https://ipe3000.github.io/SW/'
npm.cmd run test:public
```

Questo controllo usa l'indirizzo pubblico e il percorso del repository, mantenendo i due browser sul computer che esegue il test.

Gli screenshot e le tracce sono conservati in `test-results/`, escluso dal repository. I server dei test vengono chiusi automaticamente al termine.

Verifica del 6 novembre 2026: build riuscita, 18 test unitari e di protocollo superati, 5 prove con due browser e server locale superate, 1 prova con il servizio pubblico PeerJS superata. Dopo la pubblicazione è passato anche il controllo con due browser sulla versione effettivamente servita da GitHub Pages: ingresso con invito, sincronizzazione, conferma e annullamento. La prova tra due reti differenti resta da eseguire.

## Pubblicazione su GitHub Pages

Repository: [ipe3000/SW](https://github.com/ipe3000/SW). Il prototipo è pubblicato su [GitHub Pages](https://ipe3000.github.io/SW/).

1. Carica il progetto in un repository pubblico GitHub, escludendo `node_modules/`, `dist/`, backup personali e `test-results/`.
2. In Settings → Pages scegli GitHub Actions come origine.
3. Nella scheda Actions avvia manualmente «Pubblica il laboratorio su GitHub Pages».

Il workflow verifica i test unitari, compila e pubblica `dist/`. È predisposto per avvio manuale. La base relativa di Vite supporta anche un indirizzo `https://utente.github.io/nome-repository/`.

La prima pubblicazione è stata completata e verificata il 6 novembre 2026. Il [workflow iniziale](https://github.com/ipe3000/SW/actions/runs/42237250337) ha pubblicato il commit `ca2d7f6`. Gli aggiornamenti successivi si pubblicano avviando nuovamente il workflow manuale.

## Organizzazione del codice

| File | Responsabilità |
| --- | --- |
| `src/model.ts` | Stato e comandi dimostrativi, cronologia, verifiche di backup e inviti |
| `src/online.ts` | PeerJS, ingresso e rientro, protocollo di conferma e sincronizzazione |
| `src/storage.ts` | Salvataggi IndexedDB |
| `src/ui/App.tsx` | Schermate e comandi del laboratorio |
| `src/ui/styles.css` | Presentazione fantasy sobria e disposizione adattabile |

Il modello dimostrativo verrà sostituito dal futuro motore completo. Non sono ancora implementati i poteri dei maghi o l'avversario automatico. Le scelte di progetto sono raccolte in `PIANO_PROGETTO.md`; i chiarimenti dell'autore in `REGOLAMENTO_CHIARIMENTI.md`.
