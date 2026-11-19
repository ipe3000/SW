# Sviluppo nelle aperture senza contatto

La variante selezionata riguarda soltanto Difficile. Il pianificatore richiede un piccolo termine di sviluppo quando la ricerca parte da una `quietOpening`: sedici maghi ai PV iniziali, nessuna immobilizzazione, nessun risultato e tutte le coppie nemiche a distanza Manhattan maggiore di quattro. Normale, Facile e le ricerche avviate da posizioni tattiche conservano la valutazione precedente.

Il termine considera i tre maghi offensivi più sviluppati della gilda valutata, escludendo il Teletrasportatore. Per ogni mago usa la distanza dal nemico più vicino lungo il terreno con muri, senza presumere che quel percorso sia libero dagli altri pezzi. Ogni casella di avvicinamento fra distanza nove e quattro vale 0,45 punti; il massimo complessivo è 6,75 punti, contro 13,5 per un PV nemico. Le copie non producono questo bonus: restano valutate dai criteri esistenti. Un trasporto di un attaccante può invece migliorare lo sviluppo.

Non è un obbligo di avanzare o attaccare entro un round. I pesi di danni, perdite, esposizione e controllo e le guardie tattiche non vengono ridotti. La preferenza può comunque cambiare gli scambi selezionati: va valutata su partite complete, non soltanto sulla prima ferita.

La classificazione viene fissata alla radice della singola ricerca. Il termine resta continuo nelle linee esplorate che raggiungono il contatto: azzerarlo improvvisamente in quelle foglie potrebbe incentivare l'AI a rimanere lontana. Una nuova decisione reale da una posizione non più tranquilla usa invece la valutazione precedente. Il punteggio terminale resta prioritario.

## Procedura di confronto

La baseline è una copia dei sorgenti prima della modifica in `output/opening-development/baseline/src`. Le impronte dei file sono in `method.json`. Le posizioni iniziali e le identità provengono dalla campagna `f982db2b-8a19-455c-b465-5a60b4b445a1`: otto campi standard, 3 PV, Difficile–Facile a colori invertiti. Ogni versione rigioca realmente ogni partita con i budget di produzione, i piani di continuazione, il limite di 150 comandi, il controllo delle ripetizioni e l'audit delle vittorie immediate.

Le versioni vengono eseguite una alla volta e l'ordine si alterna fra gli abbinamenti nel primo confronto. Non si eseguono suite o altre simulazioni concorrenti. Il caso lento, seme 777060680, viene provato per primo; gli altri campi servono a verificare che il risultato non sia limitato a quella geometria.

La taratura selezionata anticipa il danno medio da 4,375 a 3,5 round, mantenendo 15 vittorie su 16, ma aumenta le perdite di Difficile da 41 a 47. Il calcolo fino al primo danno passa da 25,12 a 19,37 secondi medi; il massimo scende dal round 8 al 5 e i casi oltre il quinto round da quattro a zero. La mediana resta quattro: il beneficio riguarda soprattutto la coda. Sul campo lento 777060680, i round passano da 8/6 a 4/5. Il margine di vittoria non è certificato invariato: questa variante perde più maghi.

È stata provata anche una taratura attiva solo dal terzo round, rieseguendo gli stessi sedici abbinamenti contro la baseline già registrata. Ottiene 4,3125 round medi al primo danno, 15 vittorie e 45 maghi persi: il piccolo beneficio sul ritmo non compensa il mantenimento di perdite superiori alla baseline. Non è stata selezionata. In totale la procedura comprende 48 partite, di cui 32 nel confronto selezionato; i confronti condividono la baseline e non sono repliche indipendenti. Le tracce e i sorgenti della taratura scartata sono in `output/opening-development/late-variant`.

Il report completo è `output/opening-development/confronto.md`. Tutte le transizioni sono state riprodotte, con verifica del bilancio PV: 3.073 comandi unici nelle 48 partite. La scelta è stata fatta su questi otto campi, quindi una successiva campagna dovrebbe usare campi non impiegati per la taratura. La prima taratura è quella selezionata per il rilascio.

Script: `output/opening-development/compare.test.ts`, configurazione `compare.config.ts`, tracce complete `results.json`, estrazione `summarize.py`. Il riepilogo confronta primo danno, coda oltre il quinto round, durata completa, vittorie, danni e maghi persi. Le perdite iniziali sono misurate fino al round del primo danno più due, incluso; questa finestra si sposta con il contatto e non equivale a confrontare lo stesso numero di round dall'inizio.

Il confronto è locale in Node, non una nuova campagna nella pagina pubblica. I vecchi risultati Chrome restano un riferimento descrittivo: non vengono riciclati come baseline del confronto. Una sola replica per abbinamento non elimina la variabilità del pianificatore a tempo e non certifica una percentuale generale di vittorie invariata.

## Regressioni

I test specifici verificano sviluppo di attaccanti sui due lati, mancato bonus per sole copie/supporto, continuità al contatto, limite del bonus e assenza della preferenza nelle ricerche già tattiche. Restano attive le regressioni sulla protezione dei superstiti e sulle combinazioni di due attivazioni.
