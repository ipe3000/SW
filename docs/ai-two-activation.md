# Difesa dalle combinazioni di due attivazioni

Normale e Difficile includono un controllo mirato delle vittorie avversarie entro due attivazioni complete. Il rilevatore restituisce una sequenza soltanto dopo averla riprodotta con `applyComputerCommand` e verificato il vincitore. Include danno seguito da danno, movimento preparatorio, vento e teletrasporto, con movimento prima e dopo il primo potere. Ogni mago può essere attivato una sola volta, secondo il motore. L'apertura a singola attivazione e le semiattivazioni sono rispettate.

Il risultato distingue una sequenza vincente, l'esaurimento della ricerca entro questo orizzonte e un controllo sconosciuto. Limite temporale o di lavoro interrompono il controllo senza certificare sicurezza. Anche una scansione conclusa senza vittorie riguarda soltanto due attivazioni, non tutti i futuri turni. Nei casi in cui nessun avversario può perdere abbastanza maghi in due attivazioni, un limite superiore conservativo sul danno evita la generazione superflua.

## Integrazione nella scelta

Nei finali con al massimo cinque maghi propri e almeno un mago a tre PV o meno, parte del budget esistente viene riservata al controllo. La ricerca ordinaria utilizza circa il 67% del tempo massimo, anziché l'84%; il residuo serve alla difesa. Restano invariati i massimi cooperativi di 750 ms per Normale e 3,2 s per Difficile. Una generazione già iniziata può superare lievemente il limite.

La selezione conserva anche spostamenti di fuga di maghi a uno/due PV. Il controllo completa legalmente il turno candidato, usando piani validi o un piccolo campione posizionale, e verifica la risposta avversaria. Se trova una sconfitta, confronta altre mosse e altre semiattivazioni. Una linea vincente avversaria già trovata viene riutilizzata solo se il motore la convalida nella nuova posizione. Una continuazione propria suggerita è sempre validata nuovamente dalle decisioni successive.

In assenza di una difesa con scansione conclusa, una continuazione non confutata può sostituire una sconfitta provata: resta classificata come sconosciuta. Non viene dimostrata l'inevitabilità della sconfitta se il campione di continuazioni proprie è esaurito. Il sistema non esplora esaustivamente l'intero proprio turno e non garantisce di trovare ogni difesa disponibile. Facile e le regole non sono stati modificati.

## Telemetria

Il JSON ailab conserva `threatChecks`, `threatsFound`, `threatUnknown`, `threatMilliseconds` e `safetyOverride`. Il report Markdown aggrega questi valori per livello e fase. Il tempo della guardia è incluso nel tempo della decisione, non va sommato una seconda volta. Minacce e scansioni contano posizioni controllate, non partite indipendenti.
