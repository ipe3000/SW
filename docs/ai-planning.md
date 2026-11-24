# Difficoltà del computer

Il gioco e AI Lab condividono il motore. Difficile usa G8-C3. Durante la ricerca continua ha battuto G7-C1 4–0 e P2 2–0 su F6–C5, a colori invertiti. I risultati misurano quella disposizione e il profilo è predefinito anche sugli altri campi. Facile e Normale mantengono i pesi di AI #2.

Normale e Difficile controllano le scariche preparate con il Teletrasportatore prima di cedere il turno, quando i due maghi avversari possono cooperare. La ricerca verifica risposte legali e valuta il danno netto e le eliminazioni. Difficile controlla più preparazioni e Normale conserva un tetto più stretto. Il controllo usa il budget esistente e può cambiare l’ultima mossa se riduce la minaccia osservata. Le verifiche di vittoria immediata e le difese dei finali fragili hanno precedenza. Una scansione troncata lascia incerte le risposte non esplorate.

Normale estende ora le risposte fino alla conclusione del turno avversario nelle posizioni di contatto o controllo, entro i limiti di tempo ed estensione. Difficile confronta inizialmente turni completi con due alternative per abilità avversaria e una continuazione propria; amplia poi anche le continuazioni proprie e le risposte nemiche. Il passo extra avversario mantiene un campione stretto. Le generazioni interne hanno finestre temporali più brevi per completare il confronto fra le mosse iniziali. La telemetria separa ampiezza avversaria (`completedBreadth`) e propria (`completedOwnBreadth`); non sono misure di copertura esaustiva. Le famiglie distinguono bersagli diversi, supporti e eliminazioni; la stessa diversità viene conservata nelle proposte da completare con movimento dopo l'abilità. La ricerca rimane selettiva: una famiglia conservata non garantisce che ogni sua mossa venga generata o approfondita.

La valutazione tattica di Normale e Difficile riconosce anche il recupero strategico di maghi lontani: distanza attorno ai muri rispetto alla portata del ruolo, con contributo limitato e progresso utile anche diversi turni prima del contatto. Non richiede un attacco possibile al prossimo turno e non aumenta in base al tempo di inattività. Vale anche nelle linee che preparano il passo extra, per evitare incoerenze tra piano ed esecuzione. Facile non usa questo termine; regole e budget temporali massimi restano invariati. Questo è un indicatore di accessibilità al combattimento, non una dimostrazione che una futura attivazione sarà vantaggiosa.

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

Per misurare le prestazioni dei tre livelli, usa una nuova campagna in AILab.
