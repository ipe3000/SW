# Sviluppo nelle aperture senza contatto

La variante selezionata riguarda soltanto Difficile. Il pianificatore richiede un piccolo termine di sviluppo quando la ricerca parte da una `quietOpening`: sedici maghi ai PV iniziali, nessuna immobilizzazione, nessun risultato e tutte le coppie nemiche a distanza Manhattan maggiore di quattro. Normale, Facile e le ricerche avviate da posizioni tattiche conservano la valutazione precedente.

Il termine considera i tre maghi offensivi più sviluppati della gilda valutata, escludendo il Teletrasportatore. Per ogni mago usa la distanza dal nemico più vicino lungo il terreno con muri, senza presumere che quel percorso sia libero dagli altri pezzi. Ogni casella di avvicinamento fra distanza nove e quattro vale 0,45 punti; il massimo complessivo è 6,75 punti, contro 13,5 per un PV nemico. Le copie non producono questo bonus: restano valutate dai criteri esistenti. Un trasporto di un attaccante può invece migliorare lo sviluppo.

Non è un obbligo di avanzare o attaccare entro un round. I pesi di danni, perdite, esposizione e controllo e le guardie tattiche non vengono ridotti. La preferenza può comunque cambiare gli scambi selezionati: va valutata su partite complete, non soltanto sulla prima ferita.

La classificazione viene fissata alla radice della singola ricerca. Il termine resta continuo nelle linee esplorate che raggiungono il contatto: azzerarlo improvvisamente in quelle foglie potrebbe incentivare l'AI a rimanere lontana. Una nuova decisione reale da una posizione non più tranquilla usa invece la valutazione precedente. Il punteggio terminale resta prioritario.

## Regressioni

I test specifici verificano sviluppo di attaccanti sui due lati, mancato bonus per sole copie/supporto, continuità al contatto, limite del bonus e assenza della preferenza nelle ricerche già tattiche. Restano attive le regressioni sulla protezione dei superstiti e sulle combinazioni di due attivazioni.
