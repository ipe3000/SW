# ailab

Aprire direttamente `/ailab/` oppure `/ailab`. Se il server risponde con la home, l'app rinvia a `/ailab/index.html`. Non ci sono collegamenti dalla home. `ailab/index.html` contiene `noindex, nofollow, noarchive` già prima dell'esecuzione JavaScript. Questa esclusione non è un controllo di accesso: la pagina è pubblica per chi conosce l'URL. Non bloccare la scansione con robots.txt: il motore deve poter leggere noindex.

`npm run build` genera sia `dist/index.html` sia `dist/ailab/index.html`: pubblicare l'intera cartella dist mantenendone la struttura. L'hosting deve servire l'indice di directory per `/ailab/` anziché riscrivere questo percorso sulla home.

Il campionato confronta Difficile–Facile, Difficile–Normale e Normale–Facile. La modalità coppia permette anche confronti allo stesso livello. Ogni campo viene ripetuto con le difficoltà a colori invertiti. Il seme controlla la generazione del campo; i limiti temporali dell'AI rendono le scelte dipendenti anche dal dispositivo. Una sola partita è attiva alla volta, senza animazioni, con il motore condiviso e i piani di continuazione della normale AI.

L'impronta del motore deriva dai sorgenti TypeScript in src/ai e src/engine. Una campagna precedente può essere esportata, ma non proseguita con un'impronta diversa. Nuove campagne sostituiscono quella conservata nel browser. IndexedDB salva ogni partita completata. Pausa, ricarica o arresto scartano solo la partita in corso, che riparte dall'inizio alla ripresa. Un avviso segnala gli errori di salvataggio. Tenere aperta la pagina e il dispositivo attivo.

Il JSON contiene configurazione, motore, browser, campi, posizioni prima di ogni comando, comando, tempo di scelta, posizioni valutate, esito, stato finale e alternative vincenti verificate. Le scansioni tattiche hanno un budget separato di 80 ms e distinguono scansioni concluse e interrotte. Non coprono tutti gli errori strategici né tutte le possibili combinazioni future. Limite di comandi, terza ripetizione ed errori non assegnano una vittoria.

Il Markdown riepiloga la campagna e contiene indicazioni per l'analisi con Codex; allegare anche il JSON. Per confrontare due versioni avviare campagne con gli stessi parametri e conservare entrambi gli archivi. Non è incluso un selettore per eseguire vecchi motori nella pagina.

Verifica: `npm test` e, dopo `npm run build`, `npx playwright test --config scripts/ailab.e2e.config.ts`. È possibile impostare `SW_AILAB_URL` per usare un server già avviato invece del server gestito da Playwright.
