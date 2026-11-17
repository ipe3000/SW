# Difficoltà del computer

L'iniziativa è leggermente favorita a tutti i livelli: avvicinarsi al nemico con i propri maghi pesa 0,8 punti per casella anziché 0,65, e togliere un PV nemico vale 13,5 punti contro i 12 di un PV proprio. Questo piccolo sbilanciamento rende più invitanti gli attacchi e gli scambi equilibrati. Restano intere le penalità per pericolo letale, perdita dei maghi e sconfitta; non sono cambiati profondità, tempi di ricerca o difficoltà iniziale.

Il livello predefinito è **Facile** nelle nuove partite contro il computer, nei due lati di Computer vs Computer e nei salvataggi senza un livello esplicito. Le scelte esplicite, compreso Normale, si conservano nei backup e dopo la ricarica. La velocità di riproduzione è indipendente dalla difficoltà.

Facile conserva il precedente criterio di gioco, con alternative vicine alla mossa migliore. Normale e Difficile usano un pianificatore separato, senza cambiare le regole del motore.

| Livello | Tempo massimo previsto per decisione | Limite posizioni valutate | Ricerca |
| --- | --- | --- | --- |
| Normale | circa 750 ms | 24.000 | Fino a quattro attivazioni, con estensione limitata per vedere la prima risposta avversaria |
| Difficile | circa 2,6 s | 95.000 | Prima confronto stretto fino al termine della risposta avversaria, poi più alternative e maggiore profondità; estensioni sugli scambi con danni |

I tempi sono limiti cooperativi: una singola generazione/valutazione già iniziata può terminarvi poco oltre. La ricerca avviene nel worker esistente ed è annullabile. I limiti di tempo e posizioni possono impedire il completamento di un approfondimento; viene conservata l'ultima comparazione completata per tutte le mosse iniziali. Non è una ricerca esaustiva.

La generazione alterna sia i maghi sia le origini di lancio, evitando che le numerose varianti di teletrasporto o illusione consumino tutto il budget. Ogni elenco riserva spazio al movimento residuo dopo l'abilità. La selezione conserva famiglie diverse di maghi e poteri, comprese preparazioni senza danno immediato. Le posizioni duplicate vengono eliminate e le liste e le valutazioni minimax vengono riutilizzate durante la stessa decisione. Passare una fase viene considerato quando consentito dalle regole.

La valutazione tattica attribuisce maggiore peso agli attacchi raggiungibili dopo movimento e considera le distanze attorno ai muri. È una stima per ordinare le mosse: la simulazione e la legalità restano affidate al motore del gioco.

## Verifica

`npm test` comprende casi di vittoria immediata a tutti i livelli, protezione del quarto mago verificata contro tutti gli attacchi legali avversari e una vittoria preparata con teletrasporto di una Lamarcana immobilizzata. Le prove del browser controllano difficoltà iniziale, cambio di gilda, scelta esplicita Normale, livelli indipendenti, pausa, ripristino e una partita automatica completa.

Per ripetere il confronto con il motore precedente:

```sh
npx vitest run --config scripts/benchmark.config.ts --disableConsoleIntercept
```

La copia in `scripts/ai-baseline` proviene dal commit `d7022fa86cb5f2a88204534ade15721700b1f50d`; cambia soltanto la posizione degli import. Non viene inclusa nell'applicazione. Il confronto usa due campi generati con i semi 301 e 502, rispettivamente con 3 e 5 PV, e scambia i colori di vecchia e nuova versione per ogni livello. L'identificativo della partita è fisso per rendere riproducibili gli spareggi. Le decisioni dipendono anche dalla velocità del dispositivo e dal carico del sistema: un seme fisso non garantisce mosse identiche quando scade il budget di tempo.

Ogni partita si interrompe a 150 comandi se non si è ancora conclusa; il risultato viene registrato come `unfinished`, senza attribuire una vittoria. Il resoconto viene scritto progressivamente in `scripts/benchmark-results.json`. Si tratta di un controllo su un campione piccolo, utile per trovare regressioni; non misura un Elo o una percentuale generale di vittorie.

Il [confronto locale del 17 novembre 2026](ai-benchmark-2026-11-17.json) ha dato 3 vittorie su 4 alla nuova Normale e 4 su 4 alla nuova Difficile. Tutte le otto partite sono terminate entro il limite. I massimi osservati per decisione erano circa 0,76 s e 2,61 s; questi numeri descrivono il dispositivo e il carico di quella prova, senza garantire una percentuale generale di vittorie.
