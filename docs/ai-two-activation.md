# Difesa dalle combinazioni di due attivazioni

Normale e Difficile includono un controllo mirato delle vittorie avversarie entro due attivazioni complete. Il rilevatore restituisce una sequenza soltanto dopo averla riprodotta con `applyComputerCommand` e verificato il vincitore. Include danno seguito da danno, movimento preparatorio, vento e teletrasporto, con movimento prima e dopo il primo potere. Ogni mago può essere attivato una sola volta, secondo il motore. L'apertura a singola attivazione e le semiattivazioni sono rispettate.

Il risultato distingue una sequenza vincente, l'esaurimento della ricerca entro questo orizzonte e un controllo sconosciuto. Limite temporale o di lavoro interrompono il controllo senza certificare sicurezza. Anche una scansione conclusa senza vittorie riguarda soltanto due attivazioni, non tutti i futuri turni. Nei casi in cui nessun avversario può perdere abbastanza maghi in due attivazioni, un limite superiore conservativo sul danno evita la generazione superflua.

## Integrazione nella scelta

Nei finali con al massimo cinque maghi propri e almeno un mago a tre PV o meno, parte del budget esistente viene riservata al controllo. La ricerca ordinaria utilizza circa il 67% del tempo massimo, anziché l'84%; il residuo serve alla difesa. Restano invariati i massimi cooperativi di 750 ms per Normale e 3,2 s per Difficile. Una generazione già iniziata può superare lievemente il limite.

La selezione conserva anche spostamenti di fuga di maghi a uno/due PV. Il controllo completa legalmente il turno candidato, usando piani validi o un piccolo campione posizionale, e verifica la risposta avversaria. Se trova una sconfitta, confronta altre mosse e altre semiattivazioni. Una linea vincente avversaria già trovata viene riutilizzata solo se il motore la convalida nella nuova posizione. Una continuazione propria suggerita è sempre validata nuovamente dalle decisioni successive.

In assenza di una difesa con scansione conclusa, una continuazione non confutata può sostituire una sconfitta provata: resta classificata come sconosciuta. Non viene dimostrata l'inevitabilità della sconfitta se il campione di continuazioni proprie è esaurito. Il sistema non esplora esaustivamente l'intero proprio turno e non garantisce di trovare ogni difesa disponibile. Facile e le regole non sono stati modificati.

## Nuova evidenza sui quattro finali

Il rilevatore trova risposte vincenti in tutti i quattro scenari della campagna `3b0b8fcc-b936-435a-bdfd-30c96c9cbd46`. Sono state controllate anche tutte le alternative legalmente distinte del passo extra, incluso passare: **in tutti e quattro i casi resta una vittoria entro due attivazioni**. Questo amplia la precedente diagnosi, che dimostrava l'inevitabilità in una sola abilità soltanto nei primi due casi.

Le alternative precedentemente trovate nei casi 1-1 e 2-1 interrompevano la sequenza registrata, ma lasciavano altre combinazioni vincenti. Per esempio, spostare il Piromante nel caso 2-1 lascia possibile teletrasportare l'Incantatore per eliminare invece l'Aeromante. Salvare un singolo bersaglio non protegge necessariamente la soglia dei superstiti.

I test permanenti riproducono tutte le sequenze trovate e verificano le alternative del passo extra. Due controlli aggiuntivi fanno scegliere effettivamente Difficile dall'inizio del turno, invece di eseguire ciecamente una difesa preparata nel test.

## Confronto preliminare locale con la versione precedente

Stessi quattro stati all'inizio del turno finale, livelli Normale e Difficile, fino a tre decisioni reali per turno, ripassando alla ricerca soltanto suggerimenti validi. Il confronto è stato raccolto durante l'implementazione, prima dell'ultimo ordinamento che anticipa le fughe dei maghi feriti nella guardia: è una misura preliminare, non una certificazione del rilascio finale. Si verifica se la risposta storica resta vincente; questo **non è un campionato di partite complete**, né una verifica contro ogni risposta alternativa.

| Livello | Turni che interrompono la sconfitta registrata, prima | Dopo | Tempo medio turno prima | Dopo |
|---|---:|---:|---:|---:|
| Normale | 3/4 | 3/4 | circa 1,40 s | circa 1,79 s |
| Difficile | 0/4 | 2/4 | circa 5,61 s | circa 6,67 s |

Difficile evita le risposte registrate nei casi 0-0 e 2-1; non risolve ancora 0-1 e 1-1. La nuova protezione costa tempo reale anche se non aumenta il budget massimo: può usare una riserva prima inutilizzata. Nel confronto il massimo osservato per singola decisione nuova è circa 753 ms per Normale e 3.134 ms per Difficile. Alcune misure iniziali sono state raccolte mentre giravano altri test: il confronto è diagnostico e dipende dal carico, non una misura stabile delle prestazioni. Non prova una maggiore percentuale generale di vittorie; occorre una successiva campagna completa a colori invertiti su campi distinti.

## Telemetria

Il JSON ailab conserva `threatChecks`, `threatsFound`, `threatUnknown`, `threatMilliseconds` e `safetyOverride`. Il report Markdown aggrega questi valori per livello e fase. Il tempo della guardia è incluso nel tempo della decisione, non va sommato una seconda volta. Minacce e scansioni contano posizioni controllate, non partite indipendenti.

Procedura locale e risultati dettagliati: `output/ailab-analysis/compare-guard.test.ts`, `guard-comparison.json` e `two-activation-audit.json`. La baseline locale del confronto è il rilascio precedente `c6b4713`.
