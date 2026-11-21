# Ritmo delle aperture di Difficile

La ricerca di Difficile usa un budget temporale ridotto del 15% quando la posizione è ancora un'apertura intatta e le gilde sono distanti. Il massimo configurato passa da 3.200 a 2.720 ms; la ricerca ordinaria continua a riservare una frazione del budget per i controlli finali. Il limite resta cooperativo: una generazione già iniziata può terminare poco oltre la scadenza.

La riduzione richiede contemporaneamente: fase di gioco attiva senza risultato pendente, tutti i sedici maghi presenti (otto per lato), tutti ai PV iniziali, nessuna immobilizzazione e distanza Manhattan strettamente maggiore di quattro fra ogni coppia di maghi nemici. La classificazione non dipende dalla cronaca, dalla velocità delle animazioni o da un contatore di turni presunto. Il raggio quattro comprende la portata del danno a lanciatore fermo, inclusa una copia di illusione controllata; le mosse con avvicinamento possono comunque creare attacchi e continuano a essere considerate dalla ricerca. I muri sono ignorati nella soglia di distanza, così una posizione vicina ma separata da un muro conserva prudentemente il budget pieno.

In presenza di danni, perdite, schieramento personalizzato non concluso, controllo o contatto ravvicinato resta il budget normale. Nei finali fragili rimangono invariati sia i tempi sia la guardia contro le combinazioni letali di due attivazioni. Normale, Facile, regole e pesi della valutazione tattica non cambiano.

L'obiettivo di questa prima modifica è ridurre i secondi fra inizio e primo danno, mantenendo la qualità delle preparazioni. Non viene imposto un attacco né modificato il numero di round del regolamento. Un budget più breve può comunque cambiare le scelte di una ricerca selettiva a tempo: i risultati sui pochi casi di prova non certificano una percentuale generale di vittorie invariata.

## Diagnostica e verifica

Il JSON ailab conserva `openingTimeScale` (0,85 oppure 1) e `budgetMilliseconds` per ogni decisione del pianificatore. Il Markdown riepiloga il numero di decisioni con budget ridotto per livello e fase; le campagne precedenti senza questi campi non consentono di ricostruire tale metrica.

I test verificano la riduzione esclusiva di Difficile, il ripristino dei tempi in presenza di pressione, danni e controllo, l'assenza di mutazioni della partita e una decisione legale con diagnostica. Restano in esecuzione i test tattici, di protezione dei superstiti e delle combinazioni di due attivazioni.

La suite di regressione viene eseguita con un solo worker e senza file paralleli: i test delle AI hanno budget reali e, in parallelo, si sottraevano tempo a vicenda cambiando le linee esplorate. Una regressione di un finale a budget pieno ha fallito sotto carico concorrente ed è passata isolata; il test resta invariato. Questa modifica rende più controllata la verifica, non cambia il parallelismo dell'applicazione né garantisce determinismo assoluto su dispositivi diversi.
