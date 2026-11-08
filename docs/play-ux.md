# Schermata di gioco e replay del turno avversario

La board conserva le dimensioni precedenti. Su desktop la colonna di destra separa intestazione, informazioni consultabili e comandi: il dock inferiore rimane fermo quando si seleziona un mago, si prepara un movimento o si aprono le impostazioni. Su mobile il dock è fissato al fondo dello schermo, con spazio riservato nella pagina e intestazione ridotta.

## Gerarchia dei controlli

- In alto: gilda attiva, turno, conteggi e avanzamento Prima / Seconda / Passo extra.
- Nella zona centrale scorrevole: riepilogo compatto del mago consultato (simbolo, nome, gilda, PV e stati), pulsante Dettagli e anteprima dell’attivazione preparata. Nessun grande riquadro vuoto prima della selezione.
- Ultima azione compatta e un solo pulsante «Rivedi ultimo turno avversario».
- Cronaca, impostazioni e menu partita espandibili. Audio, volume, aiuti, percorso manuale, animazioni delle nuove azioni e velocità del computer sono nelle impostazioni. Invito, collegamento ed esportazione sono nel menu partita, che si apre quando occorre completare il collegamento.
- Nel dock: abilità, conferma, annullamento del passo, azzeramento della preparazione, annullamento dell’attivazione e rinuncia alla fase. Ispezionare un nemico non sostituisce il mago in preparazione.
- Contro il computer o in osservazione c’è un solo comando Pausa/Riprendi duello; ferma sia l’avanzamento automatico sia l’animazione corrente.

## Scheda dei maghi e scorciatoia

Dettagli apre un dialogo nativo con nome, gilda, PV, movimento, gittata, stati e loro conseguenze, sintesi dell’abilità e regole complete richiudibili. Il selettore interno permette di consultare entrambe le gilde senza selezionare un bersaglio né cambiare il mago in preparazione. La scheda fotografa la posizione consultata: non applica comandi, non salva e non interrompe il turno online. Su mobile sale dal fondo, sopra i comandi; su desktop è compatta e centrata. Chiusura tramite pulsante, Esc o sfondo, con focus restituito al pulsante Dettagli e scorrimento della pagina ripristinato.

Il doppio clic del mouse su un proprio mago disponibile prepara la sua abilità come il pulsante Usa abilità, senza confermarla. Conserva un eventuale percorso già preparato dello stesso mago. La scorciatoia è disponibile soltanto se il primo clic è avvenuto in modalità movimento: durante scelta di bersagli, destinazioni, movimento del vento o della copia non avvia nuove abilità. I clic successivi al primo nello stesso doppio clic non vengono applicati come altre scelte. Le restrizioni del pulsante (turno, fascino, fasi, attivazioni già spese e bersagli disponibili) restano valide. Sul touch il percorso principale è selezione più Usa abilità; il doppio tocco non attiva la scorciatoia.

## Confine del turno

«Termina turno» non è più un pulsante permanente. La conferma è «Conferma attivazione» nelle fasi intermedie, «Conferma e passa turno» al primo turno, al passo extra o quando non rimangono passi extra legali, e «Conferma e concludi partita» quando l’anteprima raggiunge la soglia di sconfitta.

Prima della conferma si può correggere la preparazione. Le attivazioni intermedie restano annullabili fino al passaggio della mano. La conferma finale applica azione, scadenza degli effetti e cambio di gilda in un solo comando e cancella la cronologia di annullamento del turno. Saltare l’ultima fase ha lo stesso confine. Restano applicati gli obblighi di attività del regolamento.

I salvataggi vecchi aperti nella fase finale esplicita mostrano un comando contestuale «Passa la mano» o «Conferma vittoria». I comandi storici `end-turn` e `completeTurn` mantengono il loro comportamento; il nuovo flag `finishTurn` permette la conclusione atomica solo ai confini consentiti.

## Replay minimale

Il pulsante riproduce in ordine tutte le azioni dell’ultimo turno completo della gilda avversaria, incluso il passo extra. Durante la riproduzione resta un solo comando: «Torna alla partita». Non ci sono velocità, selettori o avanzamento manuale del replay. La riproduzione è automatica anche se le animazioni delle nuove azioni sono impostate su Immediata o Passo per passo.

La cronologia informativa `Match.replays` conserva l’ultimo turno per ciascuna gilda e la registrazione del turno corrente: al massimo tre attivazioni per registrazione. I dati derivano dai comandi realmente applicati dal motore, includono stato iniziale/finale e rimuovono le azioni annullate. Le copie dei campi non contengono l’intera cronaca crescente. Il lettore dei backup verifica anche che gli effetti registrati corrispondano alle attivazioni.

Il replay non applica comandi, non scrive il salvataggio e non cambia revisioni o fingerprint online. Al termine o all’interruzione torna alla posizione attuale, comprese eventuali attivazioni già confermate nel proprio turno. I dati persistono nei salvataggi locali e sono ricostruiti dal journal online dopo il rientro.

Un vecchio salvataggio locale privo di questa cronologia non può ricostruire un turno passato dal solo testo: il pulsante si abilita dal prossimo turno avversario completo registrato. I vecchi backup restano leggibili.

## Verifica

Test del motore per primo turno atomico, passo extra, rinuncia, annullamenti, replay dopo ripristino, vittoria, validazione dei dati e compatibilità dei comandi storici. Test del browser per dimensioni della board, posizione ferma della conferma, ispezione senza perdita del piano, menu, mobile senza sovrapposizione, replay completo automatico e salvataggio identico prima/dopo. Le prove online verificano anche il fingerprint invariato durante il replay e il risultato definitivo dopo il rientro.

Aggiornamento schede e doppio clic: build riuscita, 125 test del motore e 41 scenari browser superati, comprese quattro partite online. Le nuove prove verificano scheda desktop/mobile, consultazione di entrambe le gilde, ritorno del focus, percorso e dimensioni conservati; doppio clic con conferma obbligatoria, bersaglio trattato una sola volta, nessuna scrittura prima della conferma, percorso preservato e scorciatoia bloccata su avversari, maghi incantati/già attivati e passo extra.
