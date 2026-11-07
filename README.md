# Strategic Wizardry

Webapp in italiano per il duello tattico dell'autore. La schermata principale permette una partita completa fra due giocatori sullo stesso computer, contro un avversario didattico oppure online con invito, con tutti gli otto tipi di maghi e i chiarimenti raccolti in `REGOLAMENTO_CHIARIMENTI.md`.

«Gioca online» nella navigazione e «Gioca online con un amico» nella schermata iniziale aprono il duello completo. Il vecchio laboratorio a due pedine resta disponibile soltanto con `?lab=1`, separato dalle partite complete e dai loro backup.

## Eventi, stati e suoni del duello · versione 0.13

Le sequenze usano ora simboli e piccoli effetti SVG nello stile dell’interfaccia: cuore spezzato e danno −1/−2 sopra il ferito, teschio sul mago eliminato e frammenti luminosi per una copia svanita. Le ultime sagome restano attenuate durante la rimozione; la dissoluzione della copia indica il legame con il proprietario ferito. I danni simultanei mantengono una sola fase comune. Volto, PV e casella restano leggibili.

Il cuore incatenato identifica un mago la cui abilità è bloccata dal fascino per l’attivazione corrente, anche dopo essersi allontanato: dipende dalla posizione iniziale, non da quella intermedia. Si spegne alla conclusione. Ispezionare un Incantatore mostra l’influenza sulle quattro caselle adiacenti, se gli aiuti sono attivi. Radici e un piede bloccato dal terreno identificano l’immobilizzazione del Geomante, anche durante uno spostamento forzato; la fine dell’effetto mostra il rilascio del movimento. Una copia oltre tre caselle ha luce attenuata e legame interrotto; torna operativa quando il proprietario rientra in distanza. Le copie non ricevono indicatori di vita.

I poteri hanno segni distinti: scie del vento durante i passi forzati, fulmini sulle adiacenze realmente collegate, fiammata a croce, fendente della Lamarcana, sigillo psichico, terra, portali abbinati di partenza e arrivo, evocazione e comando della copia. Il teletrasporto non percorre caselle intermedie. Annullare mostra un orologio di ritorno sulle posizioni ripristinate, senza simulare guarigioni o resurrezioni.

La scheda **Effetti del duello** offre **Attiva suoni**, volume, **Effetti e movimenti ridotti** e una legenda. L’audio è inizialmente spento; i suoni brevi dei poteri e degli impatti sono sintetizzati nel browser. Preferenze e volume, compreso zero, sono conservati localmente. La riduzione del movimento del dispositivo viene rispettata; la riduzione manuale elimina anche lo scorrimento delle pedine mantenendo tutti i passi e i simboli. La pausa ferma movimenti ed effetti. Una scheda nascosta non riproduce i suoni persi al rientro.

Le nuove informazioni visive derivano dal motore e non entrano nei salvataggi né nei messaggi di gioco: online entrambi ricostruiscono gli stessi eventi confermati, mentre volume e preferenze restano personali. I formati e le regole non cambiano. Tutti i nuovi simboli e suoni sono originali, senza immagini o file audio esterni.

La [pubblicazione della versione 0.13](https://github.com/ipe3000/SW/actions/runs/42388186429) è riuscita sul commit `df1aa67`, con compilazione e 117 test superati. Sono stati verificati 29 casi del browser su effetti, stati, movimenti, audio, preferenze, stabilità e online. Tutte le 13 prove dedicate agli effetti e al duello completo online sono passate anche sul sito pubblico, inclusa la visione di danno ed eliminazione da parte dell’avversario. La partita automatica completa mantiene fermi campo e pannelli. Firefox 157 conferma sul sito pubblico cuore spezzato e −2, teschio distinto dalla copia svanita, annullamento, assenza di PV sulle copie e modalità di movimento ridotto.

## Turno automatico, esito del duello e barriere magiche · versione 0.12

**Conferma semiattivazione** esegue l’ultimo movimento e passa automaticamente il turno, facendo scadere gli effetti dovuti e chiudendo gli annullamenti. Il pulsante avverte della conclusione del turno. Anche il computer usa questa operazione atomica; online viene salvata come un solo comando, recuperabile senza ripetere il cambio turno. I vecchi archivi online mantengono la loro interpretazione originale; per collegarsi serve aggiornare la pagina di entrambi i giocatori.

Quando l’esito diventa definitivo appare una finestra con vincitore, motivo della sconfitta e maghi rimasti nelle due gilde. Attende la fine delle animazioni e distingue vittoria e sconfitta del giocatore nelle modalità online e contro il computer. **Osserva il campo** oppure Esc chiudono la finestra; **Le mie partite** torna all’elenco. Un risultato ancora provvisorio non apre la finestra finale.

I muri sono ora veli di energia viola e azzurra con bordi luminosi, reticolo arcano, rune e particelle, su una base ben distinta dal campo. La lieve variazione luminosa si disattiva con la preferenza di sistema per il movimento ridotto. Il disegno SVG è originale, ispirato alle barriere energetiche fantasy come quelle mostrate nella [pagina ufficiale di MythForce su Nintendo](https://www.nintendo.com/us/store/products/mythforce-switch/); nessuna immagine di altri giochi è incorporata nell’app.

La [pubblicazione della versione 0.12](https://github.com/ipe3000/SW/actions/runs/42385461892) è riuscita sul commit `482f992`, con compilazione e 111 test superati. Sono state verificate le 36 prove del browser interessate dalle modifiche, aggiornando due controlli per la nuova chiusura atomica del turno e per la finestra modale. Le quattro prove del gioco completo online sono passate anche sul sito pubblico, compresi semiattivazione con cambio turno, ricaricamento e finestra finale nei due browser. Firefox 157 conferma il nuovo disegno dei muri, la preferenza di movimento ridotto, la finestra su desktop e schermo stretto, il focus, Esc e la riapertura dopo ricaricamento.

## Duello completo online e recupero · versione 0.11

Apri **Gioca online**, scrivi il tuo nome, scegli PV, muri e schieramento e premi **Crea duello e invito**. Il creatore riceve la gilda Rossa, l’amico che apre il link riceve la Blu. I dadi vengono lanciati una sola volta: entrambi ricevono lo stesso campo, compreso lo schieramento personalizzato. Non occorrono account aggiuntivi.

La preparazione rimane privata. Confermare invia l’intera attivazione, con percorsi, bersagli e scelte dell’abilità. I due browser la validano con lo stesso motore e mostrano la stessa sequenza: movimenti casella per casella, copie, danni, eliminazioni ed effetti. La prossima operazione attende che entrambi abbiano finito la sequenza; ciascuno può scegliere riproduzione automatica, passo per passo o immediata e usare **Mostra esito**. Il replay resta locale.

Anche schieramenti, passaggi di fase, annullamenti e **Termina turno** sono comandi sincronizzati. L’esito rimane provvisorio fino alla conclusione del turno; nel frattempo sono consentiti solo annullamento e conclusione, dopo la presentazione. La riconnessione conserva questo stato e gli annullamenti ancora disponibili.

Ogni richiesta viene salvata prima dell’invio con un identificativo stabile. Preparazione, conferma e riscontro vengono registrati nei browser; al rientro si ricostruisce la cronologia compatibile più avanzata, comprese le preparazioni già salvate. Una richiesta rimasta in sospeso viene ritentata con lo stesso identificativo e una già applicata viene riconosciuta. I messaggi grandi vengono frammentati dal trasporto binario PeerJS. Una cronologia divergente o una scrittura locale non riuscita blocca la sessione conservando i dati.

Per riprendere, riapri il tuo posto nell’elenco delle partite online dello stesso browser. Sono disponibili **Ricollega**, **Sospendi collegamento** ed **Esporta backup personale**. Importando il backup in un nuovo browser recuperi il tuo accesso e puoi ricevere dall’amico le conferme successive al backup. Un’importazione non sovrascrive una cronologia locale più avanzata e conserva le preparazioni ancora da recuperare. Il posto Blu resta riservato al primo invitato. Le scritture verificano la versione locale per impedire a una scheda superata di sovrascrivere l’altra.

Il backup personale contiene le credenziali del posto: non va condiviso come invito. I backup online, locali e del laboratorio sono formati distinti. Senza i dati del browser o un backup non è garantito il recupero del proprio accesso. Non esistono archivio centrale, scadenza di 24 ore, orologi o sconfitte automatiche per disconnessione. Resta il limite concordato delle connessioni dirette senza TURN: alcune reti non permettono il collegamento; due browser sullo stesso computer non verificano due reti differenti.

La [pubblicazione della versione 0.11](https://github.com/ipe3000/SW/actions/runs/42380187881) è riuscita sul commit `31b9912`, con compilazione e 106 test superati. Sono passate tutte le 49 prove locali nel browser, comprese quattro dedicate al gioco completo online. Le stesse quattro prove sono passate sulla versione effettivamente servita da GitHub Pages usando il servizio pubblico PeerJS: ingresso dalla schermata iniziale, campo condiviso, percorso animato remoto, annullamento, recupero e backup vecchio, schieramento personalizzato, posto Blu riservato, abilità letale ed esito provvisorio recuperato e concluso. Due verifiche aggiuntive sulla versione pubblica collegano Firefox 157 e Chrome alternando il ruolo di creatore: conferma, ricaricamento dei due browser e annullamento restano sincronizzati.

## Campo quasi a tutta altezza e muri distinti · versione 0.10

Su desktop intestazioni, gilde, fase e comandi sono raccolti nella colonna laterale. Il campo sfrutta quasi tutta l’altezza visibile, con dimensioni limitate anche dalla larghezza realmente disponibile: resta quadrato e non viene tagliato. Le regole rapide si aprono sopra la colonna laterale senza spingere la scacchiera. Il campo resta stabile durante le sequenze e la pagina può essere scorsa manualmente per consultare la cronaca.

I muri di forza sono barriere lilla e viola con bordi marcati, pilastri e un simbolo energetico chiaro. Il contrasto del riempimento rispetto alle caselle libere supera 3:1; forma e colore li distinguono dalla griglia verde e dalle pedine delle gilde. Le regole dei muri restano invariate.

La [pubblicazione del campo a tutta altezza](https://github.com/ipe3000/SW/actions/runs/42366519870) è riuscita sul commit `0885b52`, con compilazione e 79 test automatici superati. Sono passate tutte le 41 prove sul sito pubblico in Chrome, compresa una partita automatica completa con verifica della stabilità. Firefox 157 conferma campo interamente visibile e caselle da circa 66 a 102 pixel sulle quattro risoluzioni desktop già usate; la sequenza automatica osservata non modifica scroll o geometria del campo. Sono verificati anche il contrasto dei muri e l’apertura delle regole rapide senza spostamenti della scacchiera.

## Campo più leggibile a zoom 100% · versione 0.9

Durante la partita l’intestazione è compatta e il campo usa gran parte dell’altezza disponibile. Scacchiera, pedine, sigle e comandi sono più grandi senza richiedere lo zoom del browser. Su desktop le due gilde e il numero di maghi rimasti sono raccolti in una sola riga, lasciando più spazio alle caselle. Il layout mantiene aree stabili e scorrimento interno dei pannelli.

Ogni pedina ha un ritratto libero e una fascia separata sotto il volto, con sigla e punti vita. Anche l’indicatore di immobilizzazione resta nella fascia. Le copie mostrano soltanto il ritratto, la dicitura «COPIA» e i colori della gilda: nessun numero di vita e nessuna iniziale «R/B», anche durante il movimento.

Le misure a zoom 100% sono verificate in Chrome e Firefox 157 su finestre 1280×720, 1366×768, 1440×900 e 1920×1080: scacchiera interamente visibile e caselle da circa 50 a 85 pixel, con PV sempre sotto il ritratto. È verificata anche l’assenza di scorrimento orizzontale su schermo stretto.

La [pubblicazione della vista ingrandita](https://github.com/ipe3000/SW/actions/runs/42364564173) è riuscita sul commit `887eb8b`, con compilazione e 79 test automatici superati. Sono passate tutte le 40 prove online in Chrome. La verifica aggiuntiva su Firefox 157 sul sito pubblico conferma tutte le dimensioni, l’assenza di indicatori sulle copie e nessuna variazione della posizione o dimensione del campo durante la sequenza automatica osservata.

## Schermata stabile e gilde riconoscibili · versione 0.8

In Computer vs Computer il campo, il riepilogo e l’area dei comandi mantengono dimensioni stabili durante gli eventi. I testi lunghi e le schede scorrono nei rispettivi pannelli: cambi di fase, selezioni automatiche ed eliminazioni non devono trascinare la pagina. Anche la cronaca occupa uno spazio stabile e resta consultabile con il proprio scorrimento. Lo scorrimento manuale della pagina resta libero.

Le copie illusorie mantengono i colori della propria gilda, sia da ferme sia durante il movimento: bordo e barra rossi o blu. Il bordo tratteggiato e la dicitura «COPIA» le distinguono dai maghi. I distintivi «R/B» introdotti nella 0.8 sono rimossi nella 0.9 su richiesta dell’autore. Spellsword è rinominato «Lamarcana», con sigla «LAM», anche nelle cronache mostrate da salvataggi precedenti; gli identificativi dei backup restano compatibili.

La [pubblicazione delle correzioni visive](https://github.com/ipe3000/SW/actions/runs/42361911340) è riuscita sul commit `747a359`, con compilazione e 79 test automatici superati. Sono passate tutte le 39 prove sul sito pubblico, incluse le due nuove verifiche di stabilità, colori e rinomina. La partita automatica completa misura continuamente scroll, posizione e dimensioni del campo fino alla vittoria: le variazioni devono restare inferiori a 1,5 pixel. Il test riproduceva salti fino a 81 pixel prima della correzione.

## Movimenti leggibili · versione 0.7

Maghi e copie scorrono visibilmente da una casella alla successiva, seguendo ogni svolta del percorso confermato. Una pedina evidenziata si muove sopra il campo; gli alleati attraversati rimangono visibili sotto di essa. Anche gli spostamenti causati dal vento vengono mostrati passo per passo. Il teletrasporto conserva origine e destinazione senza percorrere le caselle intermedie.

Il percorso completo resta tracciato e numerato: 0 indica la partenza, i numeri successivi indicano i passi. Oro per il mago, azzurro per la copia. Il percorso del mago include sia il movimento prima dell’abilità sia quello successivo; una casella visitata più volte mostra tutti i numeri corrispondenti. La traccia rimane dopo la sequenza e sparisce iniziando una nuova preparazione o annullando.

«Pausa sequenza» ferma anche la pedina a metà passo; ruotare la scacchiera mantiene il punto raggiunto. «Prossimo evento» attende l’arrivo nella casella corrente, mentre «Mostra esito» salta direttamente al risultato salvato. Il computer attende il completamento delle animazioni. Il cambio di velocità modifica il movimento in corso senza ricominciare il passo. Chi usa l’impostazione di sistema per ridurre il movimento vede comunque tutte le caselle della sequenza, senza scorrimento continuo. «Riproduzione Immediata» continua a saltare le sequenze.

La [pubblicazione del movimento animato](https://github.com/ipe3000/SW/actions/runs/42360344347) è riuscita sul commit `8b09c73`, con compilazione e 79 test automatici superati. Sono passate tutte le 37 prove sul sito pubblico: incluse cinque nuove prove che verificano lo scorrimento effettivo fra le caselle, svolte e alleati attraversati, copia, vento, teletrasporto, pausa, rotazione e cambio di velocità senza perdere il punto raggiunto. È stata completata anche una partita Computer vs Computer con tutte le sequenze attive.

## Seguire quello che succede · versione 0.6

Ogni attivazione confermata viene presentata in ordine: mago attivo, passi del percorso, abilità con bersagli o area, danni, eliminazioni, effetti e movimento restante. I danni di un’unica scarica o palla di fuoco compaiono insieme. Un mago eliminato mostra prima zero PV e l’etichetta di eliminazione, poi viene rimosso. La scomparsa della copia è spiegata come conseguenza dei danni al suo Illusionista. Vento e teletrasporto hanno presentazioni distinte; quest’ultimo mostra origine e destinazione senza tracciare passi intermedi.

Il pannello accanto alla scacchiera conserva il riepilogo dell’ultima attivazione. «Riproduzione» offre Automatica, Passo per passo e Immediata; la preferenza resta in questo browser. Puoi fermare la sequenza, usare «Prossimo evento» oppure «Mostra esito». L’opzione Immediata applica la vista finale conservando il riepilogo. Le comunicazioni degli eventi restano visibili anche con gli aiuti di preparazione disattivati.

«Rivedi ultima attivazione» riproduce l’ultima attivazione osservata nella sessione corrente e sospende le mosse automatiche. Non cambia PV, turno, revisione, annullamenti o salvataggi. È disabilitato mentre una bozza ha modifiche, durante il salvataggio o dopo un annullamento. La cronaca completa, conservata nei backup, si può espandere sotto il campo. Le sequenze visive non sono salvate: riaprire la pagina mostra lo stato finale già confermato e la cronaca, senza ripetere mosse o riproduzioni interrotte.

Durante una sequenza puoi ispezionare e ruotare il campo, ma i comandi di gioco e la successiva fase del computer attendono che termini. Il salvataggio dell’intera attivazione precede la presentazione: zero PV e transiti su alleati sono fotogrammi visivi, mai stati intermedi da salvare. Un errore di scrittura non avvia la sequenza. «Annulla attivazione» ripristina lo stato precedente e lo comunica esplicitamente; un risultato provvisorio resta annullabile come prima.

In Computer vs Computer il livello di velocità regola anche la durata dei singoli eventi automatici. L’attesa minima prima della fase si aggiunge alla presentazione. La pausa del computer ferma le prossime scelte; «Pausa sequenza» ferma la presentazione in corso. Il cambio di velocità resta disponibile durante la sequenza e non la riavvia. La scheda di un mago immobilizzato indica anche la durata dell’effetto, e il cambio turno comunica la sua scadenza.

Verifica locale 0.6 del 7 novembre 2026: compilazione, 79 test automatici e 31 prove nel browser superati. Le sette nuove prove coprono eliminazioni, copie, danni simultanei, immobilizzazione, riproduzione e replay, annullamento, cambio velocità, ricarica e scrittura fallita, percorso prima e dopo l’abilità e una partita Computer vs Computer intera con le sequenze automatiche attive.

La [pubblicazione delle sequenze visive](https://github.com/ipe3000/SW/actions/runs/42358991822) è riuscita sul commit `03b5c35`. Tutte le 32 prove sul sito pubblico sono passate, incluse le sette nuove verifiche della presentazione e una partita automatica intera con le sequenze attive.

## Computer vs Computer

Scegli «Computer vs Computer» nel menu e premi «Avvia Computer vs Computer». Le due gilde didattiche svolgono automaticamente schieramento, attivazioni e conclusione dei turni fino alla vittoria. Restano disponibili tutte le varianti di PV, muri e schieramento.

Puoi osservare il campo, leggere le schede dei maghi, ruotare la scacchiera, mettere in pausa e riprendere con gli stessi pulsanti della modalità contro il computer. I comandi di gioco manuali sono disabilitati per entrambe le gilde. Ogni fase è salvata; riaprendo la partita o importandone il backup, l'automatismo riprende dalla fase salvata. La pausa è temporanea e non viene mantenuta alla riapertura.

«Velocità dei computer» è disponibile prima dell'avvio e nel pannello Computer vs Computer durante la partita, anche quando è in pausa. I livelli sono Molto lenta (5 s), Lenta (2 s), Normale (0,65 s), Veloce (0,2 s) e Massima (senza attesa aggiunta). Il tempo è l'attesa minima prima di ogni fase, comprese le collocazioni dello schieramento. A velocità Massima la fase è pronta appena il computer ha terminato la scelta; se la riproduzione è attiva, la fase successiva attende il termine degli eventi. Scegli Riproduzione Immediata per saltare le sequenze.

Il cambio di velocità è salvato automaticamente e incluso nei backup. Le partite già salvate senza questa impostazione usano Normale. Modificare il ritmo interrompe il calcolo ancora in preparazione e lo riavvia dalla fase salvata; una fase già in salvataggio viene completata prima di registrare la nuova velocità. La partita mantiene stato e cronologia di annullamento.

Verifica 0.5 del 6 novembre 2026: compilazione, 72 test automatici e 14 prove delle modalità del computer nel browser superati. Sono inclusi cambio di velocità durante il calcolo, durante una scrittura rallentata, nello schieramento e in pausa, conservazione dopo ricarica ed errore di scrittura senza perdita dello stato precedente.

La [pubblicazione della velocità regolabile](https://github.com/ipe3000/SW/actions/runs/42295686652) è riuscita sul commit `cbb3089`. Tutte le 25 prove sulla versione pubblica sono passate, comprese le quattro dedicate ai controlli di velocità e alla conservazione dei dati.

Nei salvataggi la modalità è identificata da `computer.side: "both"`, distinta dalle partite con un solo computer. Il profilo delle due gilde è quello didattico; `computer.speed` conserva il livello di velocità ed è facoltativo per i salvataggi precedenti.

Verifica 0.4 del 6 novembre 2026: compilazione e 68 test automatici superati. Sono passate quattro prove mirate nel browser: una partita Computer vs Computer completa con pausa, ripresa e ricarica, lo schieramento personalizzato automatico e le due modalità esistenti contro il computer.

La [pubblicazione di Computer vs Computer](https://github.com/ipe3000/SW/actions/runs/42293078910) è riuscita sul commit `d3b1ed6`. Sono passate tutte le 21 prove sul sito pubblico, inclusa una partita completa tra i due computer e le verifiche delle modalità precedenti.

## Giocare contro il computer

1. Nel menu scegli «Contro il computer» e la tua gilda. Il Rosso comincia sempre: se scegli il Blu, il computer svolge automaticamente il primo turno con una sola attivazione.
2. Scegli nome, PV, muri e schieramento, poi premi «Gioca contro il computer». La tua prima riga appare in basso; puoi ruotare manualmente il campo.
3. Prepara e conferma le tue attivazioni come nella partita fra persone. Puoi annullarle finché non premi «Termina turno». Durante il turno del computer puoi osservare il campo e leggere i poteri dei maghi.
4. Il computer conferma e salva una fase alla volta. Nel pannello e nella cronaca puoi seguire il suo turno. Nello schieramento personalizzato colloca autonomamente i propri gruppi rispettando l'alternanza.
5. «Metti in pausa il computer» sospende il calcolo o la fase successiva; «Riprendi computer» lo riavvia. La pausa è temporanea: ricaricando o riaprendo la partita, il computer riprende dalla fase salvata.

Il computer cerca attacchi utili, eliminazioni e posizioni meno pericolose per i maghi feriti. Considera anche movimento prima e dopo l'abilità, spostamenti di alleati e nemici, copie, immobilizzazione e incantamento. È un avversario introduttivo, con una valutazione semplice e senza ricerca approfondita dei turni futuri; può commettere errori strategici. Non fornisce suggerimenti al giocatore e non modifica le regole.

Il calcolo avviene in un Web Worker del browser, senza account, chiamate a modelli esterni o servizi aggiuntivi. Ogni comando viene controllato dal motore comune prima del salvataggio. Tornare al menu o mettere in pausa interrompe il lavoro ancora in preparazione; un risultato di calcolo superato non viene applicato.

Se il calcolo o il salvataggio fallisce, il computer si ferma, mostra un messaggio e permette di riprovare. L'ultima fase salvata rimane disponibile. Chiudere e riaprire la partita riprende anche un turno del computer interrotto, senza ripetere le fasi già confermate. Una vittoria del computer diventa definitiva quando conclude il proprio turno; una tua vittoria resta annullabile fino al tuo «Termina turno».

Modalità, profilo dell'avversario e gilda del computer sono inclusi nei salvataggi e nei file esportati. Le nuove partite usano il formato di salvataggio 2; i salvataggi locali precedenti in formato 1 continuano a essere letti e conservati. La versione delle regole resta invariata.

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

Apri il sito con `?lab=1` per il laboratorio dimostrativo. Per giocare una partita completa usa invece «Gioca online».

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

- `test`: verifica il motore completo, le interazioni dei poteri, geometria e visuale, obblighi e fasi, annullamenti, esiti e backup. Verifica inoltre le scelte dell'AI e sette partite simulate fino alla conclusione, oltre al protocollo del laboratorio online, interruzioni, errori di scrittura e cronologie divergenti.
- `build`: controlla TypeScript e prepara `dist/`.
- `test:e2e`: usa Chrome per giocare nelle due modalità, usare tutti gli otto poteri, schierare, verificare la griglia, annullare, salvare e riprendere. Controlla entrambe le gilde contro il computer, pausa, interruzioni del calcolo, errori di salvataggio e conclusione della partita. Avvia anche un PeerServer locale per verificare il laboratorio con due browser. Il server locale è soltanto uno strumento di test.
- `test:public`: ripete le prove del duello fra persone e contro il computer, e prova il laboratorio con due browser sullo stesso computer usando il servizio pubblico PeerJS. Richiede accesso Internet e può fallire per indisponibilità del servizio o restrizioni di rete.

Per verificare il prototipo già pubblicato, senza avviare un server locale:

```powershell
$env:SW_BASE_URL = 'https://ipe3000.github.io/SW/'
npm.cmd run test:public
```

Questo controllo usa l'indirizzo pubblico e il percorso del repository, mantenendo i due browser sul computer che esegue il test.

Gli screenshot e le tracce sono conservati in `test-results/`, escluso dal repository. I server dei test vengono chiusi automaticamente al termine.

Le prove del laboratorio includono ingresso con invito, sincronizzazione, conferma e annullamento sulla versione pubblica. Due browser sullo stesso computer non dimostrano il funzionamento su due reti differenti.

Verifica della versione 0.2 del 6 novembre 2026: compilazione riuscita, 44 test unitari e di protocollo e 15 prove con Chrome superati. I controlli misurano anche l'altezza uniforme di tutte le righe e l'assenza di spazi tra righe, con i muri presenti.

Verifica della versione 0.3 del 6 novembre 2026: compilazione riuscita, 67 test automatici (incluse sette partite simulate complete) e 23 prove con Chrome superati. Le simulazioni coprono 3, 4 e 5 PV e le due varianti dei muri; ogni comando è applicato dal motore comune e ogni stato viene controllato dal lettore dei salvataggi.

La [pubblicazione della versione con il computer](https://github.com/ipe3000/SW/actions/runs/42291808091) è riuscita sul commit `2327192`. Sono passate tutte le 19 prove sulla versione effettivamente servita da GitHub Pages: otto per il computer, dieci per il duello locale e una per il laboratorio con il servizio pubblico PeerJS. Le prove del computer usano il worker compilato distribuito insieme alla webapp.

Dopo la [pubblicazione del duello locale](https://github.com/ipe3000/SW/actions/runs/42254887518), sono passate tutte le 11 prove sulla versione servita da `https://ipe3000.github.io/SW/`: dieci sul gioco locale e una sul laboratorio con PeerServer Cloud. Il rilascio precedente aveva superato test e compilazione, ma era stato annullato dal limite di dieci minuti della distribuzione; il nuovo tentativo è riuscito con l'attesa massima estesa.

## Pubblicazione su GitHub Pages

Repository: [ipe3000/SW](https://github.com/ipe3000/SW). Il prototipo è pubblicato su [GitHub Pages](https://ipe3000.github.io/SW/).

1. Carica il progetto in un repository pubblico GitHub, escludendo `node_modules/`, `dist/`, backup personali e `test-results/`.
2. In Settings → Pages scegli GitHub Actions come origine.
3. Nella scheda Actions avvia manualmente «Pubblica Strategic Wizardry su GitHub Pages».

Il workflow verifica i test unitari, compila e pubblica `dist/`. È predisposto per avvio manuale. La base relativa di Vite supporta anche un indirizzo `https://utente.github.io/nome-repository/`.

La distribuzione Pages può richiedere diversi minuti anche dopo la riuscita della compilazione. Il workflow concede fino a 20 minuti alla fase di pubblicazione prima di segnalarla come non riuscita; finché non termina, il sito può mostrare la versione precedente.

La prima pubblicazione è stata completata e verificata il 6 novembre 2026. Il [workflow iniziale](https://github.com/ipe3000/SW/actions/runs/42237250337) ha pubblicato il commit `ca2d7f6`. Gli aggiornamenti successivi si pubblicano avviando nuovamente il workflow manuale.

## Organizzazione del codice

| File | Responsabilità |
| --- | --- |
| `src/ai/types.ts` | Contratto dei giocatori automatici, comandi e applicazione attraverso il motore comune |
| `src/ai/candidates.ts` | Percorsi e proposte di attivazioni con tutti gli otto poteri |
| `src/ai/didactic.ts` | Profilo introduttivo: scelta delle mosse, valutazione e movimento successivo all'abilità |
| `src/ai/worker.ts`, `src/ai/client.ts` | Calcolo nel browser, interruzione e gestione degli errori |
| `src/ui/useComputer.ts` | Turni automatici, pausa, scarto dei risultati superati e salvataggio per fase |
| `src/engine/game.ts` | Stato del gioco completo, movimento, turni, poteri, effetti, risultato e annullamenti |
| `src/engine/geometry.ts` | Distanze, percorsi e visuale geometrica |
| `src/engine/backup.ts` | Lettura e verifica dei salvataggi del gioco completo |
| `src/engine/commands.ts` | Comandi comuni alle interfacce locale e online |
| `src/network/model.ts` | Campo iniziale, cronologia completa, deduplicazione e backup personali |
| `src/network/session.ts` | PeerJS binario, conferme persistenti, riconnessione e attesa delle animazioni |
| `src/network/storage.ts` | Salvataggi online con controllo della versione locale e importazione conservativa |
| `src/ui/OnlineGame.tsx` | Inviti, accessi alle gilde, recupero e interfaccia del duello online |
| `src/game-storage.ts` | Salvataggi locali del gioco completo e controllo di revisione |
| `src/ui/LocalGame.tsx` | Preparazione della partita, schieramento e composizione delle attivazioni |
| `src/ui/BoardGrid.tsx` | Griglia condivisa 10×10, percorsi e muri di forza |
| `src/model.ts` | Stato e comandi dimostrativi, cronologia, verifiche di backup e inviti |
| `src/online.ts` | PeerJS, ingresso e rientro, protocollo di conferma e sincronizzazione |
| `src/storage.ts` | Salvataggi IndexedDB |
| `src/ui/App.tsx` | Schermate e comandi del laboratorio |
| `src/ui/styles.css` | Presentazione fantasy sobria e disposizione adattabile |

Il motore completo è indipendente da React, IndexedDB e PeerJS: riceve stato e comandi e restituisce uno stato nuovo. Il modello dimostrativo resta confinato al laboratorio. I poteri condividono regole comuni di distanza, visuale, danno e movimento, senza un sistema di plugin per ciascun mago. Le scelte di progetto sono raccolte in `PIANO_PROGETTO.md`; i chiarimenti dell'autore in `REGOLAMENTO_CHIARIMENTI.md`.

Per aggiungere un avversario più forte si implementa il contratto `ComputerPlayer`, registrando un nuovo profilo nel worker e nel lettore dei salvataggi. Generazione dei candidati, motore, interfaccia e protocollo dei comandi possono essere riutilizzati. Il profilo didattico considera gli effetti immediati di tutte le proposte legali e approfondisce il movimento residuo per una rosa limitata di candidati per mago; non è un giocatore competitivo né una ricerca esaustiva di più turni.

I ritratti sono mostrati ritagliando via SVG l'immagine del diagramma fornito dall'autore in `Strategic Wizardry.docx`, conservata senza modifiche in `public/assets/wizard-roster.png`. Non sono nuove illustrazioni create per questa implementazione.
