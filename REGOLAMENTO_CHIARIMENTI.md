# Strategic Wizardry chiarimenti del regolamento

Chiarimenti forniti dall'autore nella conversazione del 6 novembre 2026.

Fonte di base: `C:/Users/Epi/Downloads/Strategic Wizardry.docx`, letta integralmente insieme ai sei diagrammi sostanziali. Questo documento integra il regolamento originale e non lo sostituisce.

## Immobilizzazione

L'effetto del Geomancer blocca soltanto il movimento proprio del mago. Aeromancer e Teleporter possono ancora spostare un mago immobilizzato. Lo spostamento non rimuove l'effetto, che conserva la scadenza indicata dal regolamento.

## Fireball

La linea di vista è richiesta verso la casella bersaglio. Non occorre verificare una linea di vista separata dal Pyromancer a ciascun nemico colpito nella croce dell'esplosione.

## Chain Lightning e sconfitta di entrambi

Se la medesima Chain Lightning riduce entrambi i giocatori a tre maghi o meno, perde il giocatore che ha lanciato la scarica.

## Comando della copia illusoria

Evocazione e comando fanno parte della medesima abilità dell'Illusionist. Se la copia è già presente, comandarla richiede comunque l'azione dell'Illusionist: movimento di 0–3 caselle seguito dall'eventuale danno a un nemico ortogonalmente adiacente.

Se l'Illusionist si allontana lasciando la copia a più di tre caselle, la copia resta sulla scacchiera e continua a occupare e bloccare normalmente la propria casella. Non può muoversi né infliggere danni finché l'Illusionist non torna entro distanza tre.

Durante il movimento della copia, il vincolo di distanza tre si applica a tutte le caselle del percorso, origine e destinazione comprese, come indicato nel regolamento.

## Obbligo di movimento o azione

Durante le attivazioni complete, almeno un mago deve fare almeno un passo oppure compiere un'azione. L'obbligo riguarda le attivazioni complete nel loro insieme, non ciascuna di esse separatamente.

La semiattivazione è sempre opzionale. Muovere soltanto durante la semiattivazione non soddisfa l'obbligo relativo alle attivazioni complete.

Se nessun mago selezionabile può rispettare un obbligo, si passa senza che questo comporti una sconfitta. La facoltatività della semiattivazione non dipende dall'impossibilità di muovere.

## Abilità senza effetti

Usare un'abilità senza produrre effetti non è consentito.

Esempi esplicitamente rifiutati dall'autore:

- Aeromancer su un alleato con spostamento di zero caselle.
- Comando di una copia già presente con movimento di zero caselle e nessun danno.

Conseguenze operative della stessa regola:

- Aeromancer su un nemico può spostarlo di zero caselle, poiché infligge danno.
- Una copia può restare ferma e infliggere danno.
- Evocare una nuova copia produce un effetto anche senza movimento o danno successivo.
- Fireball senza nemici nell'area e Chain Lightning senza altri maghi collegati non sono consentite.

L'autore ha confermato che anche lo spostamento di un alleato di una casella e ritorno alla posizione iniziale è vietato se non produce altri cambiamenti: conta l'effetto sulla situazione finale. Questo criterio si applica anche al comando di una copia già presente che ritorna all'origine senza infliggere danni. Un percorso proprio del mago resta movimento ai fini dell'obbligo del turno.

## Ripetizioni

Nel documento originale non è indicata una patta automatica per ripetizione o inattività. Nessuna regola di questo tipo è stata aggiunta dall'autore nella conversazione. L'obbligo di muovere o agire non garantisce da solo che una partita finisca.

## Interfaccia e annullamenti

L'autore ha scelto di consentire annullamenti liberi fino alla fine del proprio turno, anche dopo un'attivazione che porta un giocatore a tre maghi o meno. Il risultato viene rilevato come provvisorio e può essere annullato; diventa definitivo premendo «Termina turno».

Aggiornamento dell’autore: confermare la semiattivazione termina automaticamente il turno. Movimento, scadenza degli effetti e passaggio all’altra gilda sono un’unica conferma; da quel momento non si possono più annullare le attivazioni del turno concluso. La semiattivazione rimane opzionale. Un risultato provvisorio raggiunto durante le attivazioni complete continua a richiedere «Termina turno», perché impedisce ulteriori attivazioni.

Questa precisazione per la webapp prevale sulla formulazione originale della sconfitta immediata per quanto riguarda la conferma definitiva del risultato. Restano validi la soglia di tre maghi e il criterio di sconfitta del lanciatore nel caso della Chain Lightning che porta entrambi alla soglia.

Durante un risultato provvisorio sono consentiti soltanto «Annulla» e «Termina turno». Ulteriori mosse e attivazioni sono bloccate fino all'annullamento, che ripristina lo stato precedente, oppure alla conclusione, che rende definitivo il risultato.

La gestione tecnica delle disconnessioni, senza sconfitta automatica, è registrata in `PIANO_PROGETTO.md`. L'autore ha successivamente sostituito la stanza centrale conservata per 24 ore con salvataggi locali nei browser e backup esportabile, accettando i limiti di connessione dell'architettura WebRTC/PeerJS. Non è prevista una scadenza centralizzata della partita dopo 24 ore. Non sono previsti orologi nella prima versione.
