# Difficoltà del computer

## Aggiornamento del 20 novembre: confronto versioni, copertura e rinforzi

Il riferimento precedente agli interventi è congelato in `scripts/ai-versions/before-tactical-20261120`: include ricerca, valutazione, generatore, tattica, budget e tipi. Il manifest conserva commit, SHA-256 delle sorgenti effettive e delle copie, e impronte delle regole condivise. Il confronto rifiuta snapshot alterati o regole diverse. La vecchia cartella `scripts/ai-baseline` rimane il riferimento storico del benchmark precedente.

Per congelare una futura versione: `npm run ai:freeze -- nome-versione`. I nomi esistenti non vengono sovrascritti. Per confrontare il riferimento appena congelato con il codice corrente: `npm run ai:compare`. Il confronto viene avviato esplicitamente, non da `npm test`; esegue una decisione alla volta, scambia i colori e mantiene separati i suggerimenti dei due giocatori. I risultati progressivi e le tracce complete sono in `output/ai-versions/<timestamp>/`.

Configurazione PowerShell di esempio (avvia partite complete):

```powershell
$env:SW_AI_A = 'before-tactical-20261120'
$env:SW_AI_B = 'current'
$env:SW_AI_LEVELS = 'normal,hard'
$env:SW_AI_SEEDS = '301,502'
$env:SW_AI_HP = '3,4,5'
$env:SW_AI_WALLS = 'standard,varied'
$env:SW_AI_REPEATS = '1'
npm run ai:compare
```

I valori predefiniti sono due semi, Normale e Difficile, 3 PV, muri standard, una coppia a colori invertiti per combinazione e limite 150 comandi. `SW_AI_MAX_COMMANDS` imposta il limite; i casi incompleti sono `unfinished`, mai vittorie o pareggi certificati. `current` indica i file correnti, le cui impronte vengono registrate: per un confronto futuro stabile conviene congelare anche il candidato. I tempi dipendono da dispositivo e carico, quindi eseguire campagne isolate e ripetere un sottoinsieme. Non sono ancora disponibili risultati di forza della nuova versione. Il candidato finale è congelato come `tactical-reinforcements-20261120`: impostare `SW_AI_B` a questo nome per confrontarlo in modo stabile anche dopo ulteriori modifiche. Su tre posizioni archiviate di Difficile il controllo locale conserva profondità 5 e confronta due risposte per abilità nemica, contro una del riferimento; tre posizioni di Normale completano più ricerca del riferimento. Sono osservazioni locali sullo stesso dispositivo, non una misura di vittorie né garanzie su ogni posizione.

Normale estende ora le risposte fino alla conclusione del turno avversario nelle posizioni di contatto o controllo, entro i limiti di tempo ed estensione. Difficile confronta inizialmente turni completi con due alternative per abilità avversaria e una continuazione propria; amplia poi anche le continuazioni proprie e le risposte nemiche. Il passo extra avversario mantiene un campione stretto. Le generazioni interne hanno finestre temporali più brevi per completare il confronto fra le mosse iniziali. La telemetria separa ampiezza avversaria (`completedBreadth`) e propria (`completedOwnBreadth`); non sono misure di copertura esaustiva. Le famiglie distinguono bersagli diversi, supporti e eliminazioni; la stessa diversità viene conservata nelle proposte da completare con movimento dopo l'abilità. La ricerca rimane selettiva: una famiglia conservata non garantisce che ogni sua mossa venga generata o approfondita.

La valutazione tattica di Normale e Difficile riconosce anche il recupero strategico di maghi lontani: distanza attorno ai muri rispetto alla portata del ruolo, con contributo limitato e progresso utile anche diversi turni prima del contatto. Non richiede un attacco possibile al prossimo turno e non aumenta in base al tempo di inattività. Vale anche nelle linee che preparano il passo extra, per evitare incoerenze tra piano ed esecuzione. Facile non usa questo termine; regole e budget temporali massimi restano invariati. Questo è un indicatore di accessibilità al combattimento, non una dimostrazione che una futura attivazione sarà vantaggiosa.

Le sezioni seguenti descrivono anche gli interventi storici; dove differiscono, valgono gli aggiornamenti di questo paragrafo.

L'iniziativa è leggermente favorita a tutti i livelli: avvicinarsi al nemico con i propri maghi pesa 0,8 punti per casella anziché 0,65, e togliere un PV nemico vale 13,5 punti contro i 12 di un PV proprio. Questo piccolo sbilanciamento rende più invitanti gli attacchi e gli scambi equilibrati. La gestione della sicurezza e dei superstiti ha priorità su questo piccolo incentivo offensivo; la difficoltà iniziale rimane Facile.

Il livello predefinito è **Facile** nelle nuove partite contro il computer, nei due lati di Computer vs Computer e nei salvataggi senza un livello esplicito. Le scelte esplicite, compreso Normale, si conservano nei backup e dopo la ricarica. La velocità di riproduzione è indipendente dalla difficoltà.

Facile conserva il precedente criterio di gioco, con alternative vicine alla mossa migliore. Normale e Difficile usano un pianificatore separato, senza cambiare le regole del motore.

| Livello | Tempo massimo previsto per decisione | Limite posizioni valutate | Ricerca |
| --- | --- | --- | --- |
| Normale | circa 750 ms | 24.000 | Fino a quattro attivazioni, con estensione limitata per vedere la prima risposta avversaria |
| Difficile | circa 3,2 s | 120.000 | Prima confronto stretto fino al termine della risposta avversaria, poi più alternative e maggiore profondità; estensioni sugli scambi con danni |

I tempi sono limiti cooperativi: una singola generazione/valutazione già iniziata può terminarvi poco oltre. La ricerca avviene nel worker esistente ed è annullabile. I limiti di tempo e posizioni possono impedire il completamento di un approfondimento; viene conservata l'ultima comparazione completata per tutte le mosse iniziali. Non è una ricerca esaustiva.

La generazione alterna sia i maghi sia le origini di lancio, evitando che le numerose varianti di teletrasporto o illusione consumino tutto il budget. Ogni elenco riserva spazio al movimento residuo dopo l'abilità. La selezione conserva famiglie diverse di maghi e poteri, comprese preparazioni senza danno immediato. Le posizioni duplicate vengono eliminate e le liste e le valutazioni minimax vengono riutilizzate durante la stessa decisione. Passare una fase viene considerato quando consentito dalle regole.

La valutazione tattica attribuisce maggiore peso agli attacchi raggiungibili dopo movimento e considera le distanze attorno ai muri. È una stima per ordinare le mosse: la simulazione e la legalità restano affidate al motore del gioco.

## Affidabilità fra livelli · 18 novembre 2026

La valutazione comune considera il margine rispetto alla sconfitta: perdere un mago pesa di più quando si passa da cinque a quattro superstiti. Per Normale e Difficile la valutazione tattica considera anche il danno potenziale combinato di due avversari e le croci di fuoco raggiungibili dopo movimento. Sono stime per ordinare la ricerca, non certificazioni di cattura: le azioni scelte passano sempre dal motore delle regole. La protezione dei maghi a rischio aumenta con quattro/cinque superstiti.

Difficile include fra le alternative anche la proposta di Facile. Le ricerche più ampie riservano spazio a famiglie di mosse diverse anche nei nodi interni, compresi i passi extra. Il primo confronto stretto resta limitato: non certifica la migliore risposta avversaria.

Normale e Difficile fanno una scansione mirata delle vittorie immediate prima della ricerca. Vengono eliminate le varianti di abilità che non possono eliminare abbastanza maghi; ciascun risultato viene convalidato da `activate`, compreso il caso di una scarica che eliminerebbe contemporaneamente le due gilde. Al passaggio del turno, un budget riservato controlla le sconfitte immediate causate dalle risposte nemiche e cerca una variante sicura fra le alternative. Una scansione interrotta restituisce “sconosciuto”, mai “sicuro”. Il controllo non prova l'assenza di combinazioni più lunghe né comprende ogni possibile turno futuro.

La continuazione prevista per il proprio turno viene trasferita fra i worker come suggerimento, non eseguita ciecamente. Il suggerimento entra nella ricerca successiva soltanto quando coincidono identità della partita, difficoltà e stato delle regole, e viene validato di nuovo. Non viene aggiunto ai backup e non modifica il formato dei salvataggi. Pausa, ricarica, annullamento o modifica delle impostazioni non obbligano a seguire un vecchio piano.

Le posizioni della partita `22c515dc` sono regressioni permanenti: passo extra che sottrae il Teletrasportatore alla combinazione fuoco/spada; protezione di almeno uno dei due maghi a 1 PV nel finale; vittoria immediata verificata dal motore. Sono controllati anche la scarica suicida e l'invalidazione dei suggerimenti per un'altra posizione o difficoltà. Una prova browser esegue il worker compilato sulla posizione del passo extra e verifica il backup risultante.

Per il confronto diretto fra livelli:

```sh
npx vitest run --config scripts/ai-league.config.ts --disableConsoleIntercept
```

Il campione comprende 12 partite Difficile–Facile, 4 Difficile–Normale e 4 Normale–Facile, a colori invertiti, con 3/4/5 PV e muri standard/variati. Il primo campo riproduce muri, PV e identificativo del salvataggio ricevuto. Il resoconto progressivo è in `output/ai-league/results.json`; i casi persi o incompleti conservano le posizioni per l'analisi. Il limite è 150 comandi: un caso incompleto non viene contato come vittoria. `SW_LEAGUE_SHARDS` e `SW_LEAGUE_SHARD` permettono di dividere i casi fra processi indipendenti; `SW_LEAGUE_RESUME=1` riprende i risultati già scritti. Tempi e mosse possono dipendere dal carico del dispositivo. Nessun risultato di questo campione garantisce zero sconfitte su tutte le posizioni possibili.

## Verifica

`npm test` comprende casi di vittoria immediata a tutti i livelli, protezione del quarto mago verificata contro tutti gli attacchi legali avversari e una vittoria preparata con teletrasporto di una Lamarcana immobilizzata. Le prove del browser controllano difficoltà iniziale, cambio di gilda, scelta esplicita Normale, livelli indipendenti, pausa, ripristino e una partita automatica completa.

Per ripetere il confronto con il motore precedente:

```sh
npx vitest run --config scripts/benchmark.config.ts --disableConsoleIntercept
```

La copia in `scripts/ai-baseline` proviene dal commit `d7022fa86cb5f2a88204534ade15721700b1f50d`; cambia soltanto la posizione degli import. Non viene inclusa nell'applicazione. Il confronto usa due campi generati con i semi 301 e 502, rispettivamente con 3 e 5 PV, e scambia i colori di vecchia e nuova versione per ogni livello. L'identificativo della partita è fisso per rendere riproducibili gli spareggi. Le decisioni dipendono anche dalla velocità del dispositivo e dal carico del sistema: un seme fisso non garantisce mosse identiche quando scade il budget di tempo.

Ogni partita si interrompe a 150 comandi se non si è ancora conclusa; il risultato viene registrato come `unfinished`, senza attribuire una vittoria. Il resoconto viene scritto progressivamente in `scripts/benchmark-results.json`. Si tratta di un controllo su un campione piccolo, utile per trovare regressioni; non misura un Elo o una percentuale generale di vittorie.

Il [confronto locale del 17 novembre 2026](ai-benchmark-2026-11-17.json) ha dato 3 vittorie su 4 alla nuova Normale e 4 su 4 alla nuova Difficile. Tutte le otto partite sono terminate entro il limite. I massimi osservati per decisione erano circa 0,76 s e 2,61 s; questi numeri descrivono il dispositivo e il carico di quella prova, senza garantire una percentuale generale di vittorie.

Il [confronto diretto del 18 novembre 2026](ai-league-2026-11-18.json) si è concluso con 12/12 vittorie di Difficile su Facile, 4/4 di Difficile su Normale e 4/4 di Normale su Facile. Tutte le partite sono terminate entro 150 comandi. Sono compresi entrambi i colori sul campo del salvataggio segnalato. È una verifica di regressione su venti casi, non una certificazione di imbattibilità.
