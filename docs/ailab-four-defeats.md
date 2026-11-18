# Analisi tattica delle quattro sconfitte di Difficile

**Aggiornamento:** il nuovo rilevatore descritto in `ai-two-activation.md` ha trovato combinazioni alternative anche dopo le difese che interrompevano la linea storica. Tutti e quattro i finali sono già persi entro due attivazioni al momento del passo extra. Le alternative della tabella sottostante conservano il significato originale: interrompono la risposta registrata, senza dimostrare salvezza generale.

Campagna `3b0b8fcc-b936-435a-bdfd-30c96c9cbd46`, motore originale `9aa39105fefc8c99`. Le mosse sono numerate da 1 come i riferimenti del report. Sono stati riprodotti i finali, enumerati tutti gli spostamenti legali della semiattivazione e il passaggio; poi sono state cercate alternative prima nel turno. Le alternative complete sono un campione limitato, non un'esplorazione esaustiva dell'albero.

## Risultati verificati

| Caso | Ultima mossa Difficile | Diagnosi verificata | Alternativa trovata |
|---|---:|---|---|
| hard-normal-0-0 | 85 | Tutte le 8 alternative del passo extra lasciano una vittoria immediata a Normale. | Alla mossa 83 il Piromante può invece spostarsi da (7,6) a (9,5) con tre passi, rinunciando al fuoco; mantenendo le due altre mosse registrate, il controllo non trova più una vittoria immediata e la risposta storica non è più legale. |
| hard-normal-0-1 | 94 | Tutte le 8 alternative del passo extra lasciano una vittoria immediata con la spada sul Piromante. | Nessuna alternativa valida trovata nel campione esaminato delle fasi precedenti. Il problema è già precedente al passo extra, ma non è dimostrato in quale decisione la sconfitta sia diventata inevitabile. |
| hard-normal-1-1 | 76 | Nessuna delle 10 alternative del passo extra permette una vittoria immediata, ma tutte lasciano vincere la sequenza storica fuoco + vento. | Dalla seconda attivazione, muovere la Lamarcana e usare il passo extra sull'Incantatore interrompe la sequenza storica. |
| hard-normal-2-1 | 82 | Nessuna vittoria immediata dopo il passo registrato, ma Normale vince con teletrasporto + tocco. Tre passi alternativi interrompono questa linea; un'altra alternativa permette invece una vittoria immediata. | Muovere il Piromante blu in (1,1), coordinate interne 0–9, invece dell'Aeromante. |

Le alternative non costituiscono una dimostrazione di salvezza o vittoria contro ogni risposta: interrompono la combinazione effettivamente registrata e, dove verificato, non lasciano una vittoria rilevata dallo scanner immediato. Normale potrebbe avere altre combinazioni più lunghe. In particolare, "scanner completo" si riferisce al suo ambito di vittorie immediate, non a tutti i turni possibili.

## Implicazioni per la ricerca

1. **Non basta perfezionare il passo extra.** Nei primi due casi la sua scelta non può più evitare la sconfitta in un comando. Bisogna valutare le conseguenze della prima e della seconda attivazione sull'intero turno.
2. **L'audit attuale non vede tutte le combinazioni.** Negli ultimi due casi passa da "nessuna vittoria immediata" a sconfitta entro due abilità. L'assenza di segnalazioni nel vecchio report non certificava quindi sicurezza.
3. **La profondità numerica non certifica la copertura.** Ricalcolando sul dispositivo locale le quattro posizioni finali, la ricerca spesso completa profondità 7; ciò non significa che abbia esplorato la linea avversaria decisiva. Le generazioni e le ampiezze sono selettive. I nuovi log conservano profondità, ampiezza, round completati e interrotti, risposte, cache e famiglie iniziali.
4. **I nuovi calcoli non ricostruiscono la telemetria storica.** Browser e dispositivo sono diversi; una rielaborazione locale non permette di dire quale profondità Firefox avesse completato nella campagna originale.

## Intervento raccomandato dopo questa fase

Valutare un controllo mirato delle combinazioni avversarie di due abilità e della protezione dei superstiti durante il proprio turno; confrontare la presenza delle alternative difensive fra le famiglie candidate. Il caso 0-0 suggerisce inoltre di verificare se un arretramento senza attacco venga escluso o sottovalutato. Non è ancora provato quale meccanismo della ricerca abbia causato ciascuna scelta.

In questa fase non sono stati modificati pesi, criteri di scelta o regole: sono stati aggiunti dati diagnostici e scenari riproducibili. `tests/ailab-forensics.test.ts` verifica i fatti tattici sopra descritti contro i quattro scenari conservati in `tests/fixtures/ailab-four-defeats.json`. Questi test proteggono la riproducibilità della diagnosi; non affermano che l'AI abbia già imparato a scegliere le alternative. Un successivo intervento sulla ricerca dovrà aggiungere controlli anche sulle scelte del computer.
