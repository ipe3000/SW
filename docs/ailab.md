# ailab

Il gioco e le campagne di AI Lab usano G8-C3 a Difficile. Facile e Normale usano i pesi precedenti. Difficile ha un budget massimo di 3.200 ms per decisione, ridotto a 2.720 ms nelle aperture tranquille. Alla prima apertura della build con il ripristino di AI #2 le vecchie campagne salvate da AILab nel browser vengono eliminate.

La modalità **Solo stesso livello · iniziativa** gioca una partita per campo e livello. La modalità coppia scambia i colori quando le difficoltà sono diverse.

Il riepilogo dedicato nell'interfaccia e nel Markdown conta una partita una volta, mostrando vittorie del primo/rosso, del secondo/blu, inconcluse, campi distinti e percentuale del primo sui soli esiti decisivi. La statistica generale per difficoltà continua a contare entrambe le partecipazioni e quindi non misura l'iniziativa nei confronti uguali. Un campione piccolo non certifica il bilanciamento; primo giocatore e lato rosso restano associati, e le geometrie sono condivise fra i tre livelli.

Aprire direttamente `/ailab/` oppure `/ailab`. Se il server risponde con la home, l'app rinvia a `/ailab/index.html`. Non ci sono collegamenti dalla home. `ailab/index.html` contiene `noindex, nofollow, noarchive` già prima dell'esecuzione JavaScript. Questa esclusione non è un controllo di accesso: la pagina è pubblica per chi conosce l'URL. Non bloccare la scansione con robots.txt: il motore deve poter leggere noindex.

`npm run build` genera sia `dist/index.html` sia `dist/ailab/index.html`: pubblicare l'intera cartella dist mantenendone la struttura. L'hosting deve servire l'indice di directory per `/ailab/` anziché riscrivere questo percorso sulla home.

Il campionato confronta Difficile–Facile, Difficile–Normale e Normale–Facile. La modalità coppia permette anche confronti allo stesso livello. Per ogni coppia di difficoltà diverse, AILab gioca due partite per campo scambiando i colori. Il seme controlla la generazione del campo. I limiti temporali dell'AI rendono le scelte dipendenti anche dal dispositivo. Una sola partita è attiva alla volta, senza animazioni, con il motore condiviso e i piani di continuazione usati nel gioco.

Le nuove campagne usano `sampling: distinct-v2`: distribuiscono i semi con una funzione di mescolamento deterministica e deduplicano lo stato iniziale fisico, includendo PV e opzioni dei muri ma escludendo identità e dadi. Lo stesso elenco di campi è condiviso da tutti i confronti. Con PV fissi e muri standard sono disponibili al massimo 36 campi distinti: una richiesta superiore viene rifiutata esplicitamente. L'interfaccia e il Markdown mostrano il numero di posizioni distinte; il Markdown contiene catalogo e risultati per singolo campo.

Il pianificatore Normale/Difficile aggiunge diagnostica senza cambiare criteri di scelta o budget: origine della decisione, profondità e ampiezza dell'ultimo confronto completato, round completati/interrotti, risposte esplorate, cache, candidati e famiglie iniziali, budget di tempo/nodi esaurito. Il worker conserva separatamente il tempo dell'audit. L'interfaccia e il report aggregano per difficoltà/fase e confronto/PV/muri/colore. Dati assenti nelle vecchie campagne e nelle decisioni di Facile non vengono presentati come zero errori. Un confronto allo stesso livello conta due partecipazioni; le statistiche per colore contano invece una partita. La profondità riguarda una ricerca selettiva, non una certificazione di ottimalità.

L'impronta del motore deriva dai sorgenti TypeScript in src/ai e src/engine. Una campagna precedente può essere esportata, ma non proseguita con un'impronta diversa. Nuove campagne sostituiscono quella conservata nel browser. IndexedDB salva ogni partita completata. Pausa, ricarica o arresto scartano solo la partita in corso, che riparte dall'inizio alla ripresa. Un avviso segnala gli errori di salvataggio. Tenere aperta la pagina e il dispositivo attivo.

Il JSON contiene configurazione, motore, browser, campi, posizioni prima di ogni comando, comando, tempo di scelta, posizioni valutate, esito, stato finale e alternative vincenti verificate. Le scansioni tattiche hanno un budget separato di 80 ms e distinguono scansioni concluse e interrotte. Non coprono tutti gli errori strategici né tutte le possibili combinazioni future. Limite di comandi, terza ripetizione ed errori non assegnano una vittoria.

Verifica: `npm test` e, dopo `npm run build`, `npx playwright test --config scripts/ailab.e2e.config.ts`. È possibile impostare `SW_AILAB_URL` per usare un server già avviato invece del server gestito da Playwright.

## AutoTune

**Campo singolo** usa per impostazione iniziale F6–C5. Si possono scegliere altre colonne da C a H per i due muri standard. La modalità P3 esegue due partite a colori invertiti contro il riferimento selezionato con il profilo P3 della campagna del 21 novembre 2026. La modalità con quattro profili ne genera quattro e gioca otto partite sulla stessa disposizione. Questi confronti descrivono il campo scelto e non producono un profilo validato su più campi. Seleziona **Campi diversi** per la procedura di selezione e validazione descritta sotto.

Se un profilo chiude la ricerca su campo singolo con un saldo positivo, **Prepara verifica** riprende i suoi pesi esatti e la disposizione dei muri. **Avvia verifica** lancia una nuova coppia a colori invertiti. Il report della verifica conserva l’identificativo della ricerca di origine.

In AI Lab seleziona **AutoTune**, oppure apri `/ailab/?mode=autotune`. I confronti si giocano a Difficile con schieramento standard, 4 PV, due muri standard e un limite di 150 comandi. Candidato e riferimento hanno gli stessi budget di ricerca. Il seme riproduce profili e campi. Le scadenze dell’AI dipendono anche dal carico del dispositivo.

Il pannello permette di variare da 0 a 30% cinque pesi di valutazione intorno ai valori del riferimento. Il riferimento predefinito è G8-C3. P2 e AI #2 restano selezionabili come riferimenti storici. Selezionando AI #2 si riproduce la generazione storica dei profili. Con 0 il peso è fisso. Quattro profili iniziali vengono confrontati sugli stessi sei campi, a colori invertiti. I due migliori affrontano altri sei campi. Il profilo con il saldo migliore, se positivo, affronta una sola validazione su dodici campi riservati. I campi con muri equivalenti dopo una rotazione di 180° rimangono nella stessa fase. La ricerca richiede al massimo 96 partite.

Ogni coppia pesa nella selezione dopo che entrambe le partite sono registrate. Vittoria e sconfitta valgono +1 e −1. Limite e ripetizione valgono 0 e hanno conteggi separati. Dopo un errore si riprende dallo stesso incontro. La validazione richiede un saldo positivo anche assegnando tutte le inconcluse al riferimento e un test esatto unilaterale per campo con p ≤ 0,05. Con dodici campi la validazione può rimanere inconcludente anche con un vantaggio osservato. Un profilo validato è esportabile come JSON per una valutazione successiva.

Nel browser il salvataggio di AutoTune è separato dalle campagne ordinarie. Puoi mettere in pausa, ricaricare e riprendere dall’ultimo incontro registrato con la stessa build. Il report JSON contiene profili, campi, diagnostica per lato, singoli risultati, errori e la traccia dei comandi della prima coppia di validazione.

Per eseguire la stessa ricerca fuori dal browser:

```powershell
npm run ai:autotune -- --file output/autotune/prova.json --seed 301
npm run ai:autotune -- --file output/autotune/prova.json
```

Il secondo comando riprende lo stesso file. `--games 0` prepara solo il checkpoint. `--games N` limita le nuove partite della sessione. Per personalizzare gli intervalli al primo avvio, passa `--ranges` con un JSON contenente le chiavi `initiative`, `reinforcements`, `opening`, `danger` e `area` e le relative percentuali intere. Il batch registra il progresso dopo ogni partita e produce un file con suffisso `.profile.json` quando il candidato supera la validazione.

## Ricerca continua

Apri **AI Lab → Ricerca continua** oppure `/ailab/?mode=continuous`. Una nuova ricerca parte da G8-C3 a Difficile sul campo F6–C5, con schieramento standard, 4 PV e due muri standard. Puoi scegliere altre colonne per fissare una disposizione diversa. Ogni giro prova quattro varianti. Alcune cambiano un peso alla volta, altre ne cambiano più di uno. Dopo giri senza promozioni, l’ampiezza delle variazioni alterna passi più stretti e più ampi. I pesi restano fra 0,65 e 1,35 e il budget di ricerca vale allo stesso modo per entrambi i lati.

Ogni sfidante gioca una coppia a colori invertiti. Un 2–0 dà accesso a una nuova coppia, disputata con ordine dei colori opposto. Un secondo 2–0 è necessario per la promozione. Quando il riferimento è già diverso dal profilo iniziale della sessione, lo sfidante deve anche ottenere almeno 1–1 contro quel profilo, con entrambe le partite concluse. Limiti, ripetizioni ed errori non assegnano vittorie. Il nuovo riferimento viene usato dal giro successivo. Con questo protocollo si cerca un miglioramento per la disposizione scelta. La modalità AutoTune **Campi diversi** rimane disponibile per una validazione su altre geometrie.

Per impostazione iniziale la sessione si ferma a 3 giri, 120 minuti di simulazione o 3 giri consecutivi senza promozione. Il tempo viene controllato tra le partite e comprende le simulazioni che restituiscono un errore. I limiti possono essere rinnovati senza perdere il riferimento, i contatori o la partita in attesa. **Prosegui fino alla pausa manuale** disattiva le tre soglie. La pagina deve restare aperta e il dispositivo attivo. Il checkpoint salva ogni risultato e riparte dall’inizio di un incontro interrotto. Il report conserva gli ultimi 30 giri, i totali cumulativi e le prove della promozione del riferimento corrente. Il suo salvataggio è separato dalle altre campagne.

**Applica a Difficile** usa il riferimento promosso per i prossimi calcoli del computer in questo browser, con la stessa disposizione, PV e schieramento. **Ripristina G8-C3** rimuove l’applicazione locale. Il profilo può essere esportato con i risultati della conferma.

Per eseguire senza tenere aperto il browser:

```powershell
npm run ai:autotune -- --continuous --file output/autotune/continuous.json
npm run ai:autotune -- --continuous --file output/autotune/continuous.json --extend --rounds 3 --minutes 120
```

Lo stesso comando senza `--extend` riprende il budget salvato. Usa `--unlimited` per una sessione senza soglie, `--no-unlimited` per ripristinarle con `--extend`, o `--games 0` per preparare soltanto il checkpoint. Il primo avvio consente anche `--seed`, `--top`, `--bottom`, `--radius` e `--stagnant`. Il batch salva il profilo promosso in un file con suffisso `.profile.json`.

## Esperimento Elettromante

Scegli **Elettromante** in AI Lab o apri `/ailab/?mode=lightning`. Il tipo **Effetti della scarica lanciata** aggiunge una volta il bonus alla mossa corrente dopo aver simulato legalmente la scarica. Il valore è proporzionale ai PV persi e ai maghi eliminati: 12 punti per PV e 85 per eliminazione, sottraendo il danno sugli alleati. I punteggi di vittoria e sconfitta hanno priorità. Il tipo **Opportunità di scarica** usa il bonus del pilota precedente, che modifica il valore delle occasioni favorevoli sulla scacchiera. Il bonus iniziale è +30%. Lo 0% permette una prova di controllo. Ogni campo viene giocato due volte, una per colore, con schieramento standard, 4 PV e due muri standard.

La serie pilota inizia da F6–C5. La serie di riserva esclude tutte le otto geometrie del pilota, comprese le equivalenti per rotazione. Usa la riserva dopo aver scelto il bonus con cui proseguire. Il report separa esiti e attività dell’Elettromante. Registra attivazioni principali, semiattivazioni, scariche e i relativi danni ed eliminazioni per entrambi i lati. Il riepilogo usa solo coppie complete. Il salvataggio è separato dalle campagne AutoTune e dalla ricerca continua.
