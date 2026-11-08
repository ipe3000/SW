# Fantasy Realism: ingresso, comandi e campo

L’aggiornamento applica la direzione grafica approvata e la semplificazione della schermata di ingresso e del pannello di gioco. Il motore, il protocollo online e i salvataggi non cambiano.

## Immagini definitive

- `public/assets/fantasy-realism-entry.webp`: illustrazione dipinta realistica del mago e della valle, 1086 × 1448 px, circa 328 KiB. Compare soltanto nell’ingresso, con dimensioni riservate per evitare salti di impaginazione.
- `public/assets/meadow-realism.webp`: prato continuo meno giallo, frammenti runici e decorazioni minute, 1254 × 1254 px, circa 155 KiB. Non contiene griglia, coordinate, pedine o muri.
- `public/assets/force-wall-obsidian.png`: resta la barriera antracite approvata.

Le due nuove immagini sono state preparate dalle anteprime approvate con **image_gen integrato**, poi convertite in WebP qualità 86% tramite canvas, senza ridisegnare il contenuto. I nomi nuovi evitano il riuso delle versioni precedenti in cache. Nessuna generazione o richiesta a servizi di immagini avviene durante il gioco.

La cornice della board, la sottile rifinitura in bronzo e le superfici chiare dei pannelli sono CSS. La texture non viene applicata ai testi. I colori rosso/blu continuano a indicare le gilde; il bronzo identifica i comandi principali. Coordinate discrete, griglia continua, PV e simboli dei maghi rimangono elementi interattivi distinti e leggibili.

## Ingresso

`EntryScene` e `SavedGames` condividono la presentazione tra modalità locali e online. Quattro modalità visibili; solo i campi pertinenti; `MatchOptions` riunisce PV, muri e schieramento in un solo pannello richiudibile, con riepilogo aggiornato. Le opzioni standard permettono di iniziare direttamente. Il collegamento ricevuto apre la sezione di ingresso nel duello online.

La sezione dei salvataggi mostra l’ultima partita, eventuali altre partite in un elenco richiudibile e l’importazione. Senza salvataggi non compare un grande riquadro vuoto. Le informazioni sul backup personale online restano disponibili su richiesta. Il footer resta nell’ingresso e non nella partita.

## Partita

Il pulsante Menu apre un solo pannello con impostazioni, esportazione e ritorno alle partite. Si può chiudere con Chiudi menu o Esc, con ritorno del focus al pulsante. Le regole rapide restano direttamente accessibili anche online. Lo stato del computer e la pausa sono accorpati all’intestazione del turno.

La fase corrente è indicata una sola volta per esteso e la progressione usa piccoli punti etichettati per le tecnologie assistive. Il riepilogo del mago integra PV e budget dell’attivazione, senza ripetere visivamente il nome. Se si consulta un avversario il budget del proprio mago rimane esplicito e distinto.

L’area Ultima azione è visibile durante le sequenze; a riposo resta soltanto il pulsante di replay del turno nemico. La cronaca conserva i risultati. Le anteprime di effetti e i controlli per rimuovere un potere preparato restano disponibili; il semplice movimento non produce un altro riquadro ripetitivo. Conferma, annullamento del passo, azzeramento, annullamento dell’attivazione e salto della fase mantengono comportamenti distinti.

Restano validi il cuore incatenato soltanto durante il fascino effettivo, il doppio clic per preparare l’abilità, la scheda dei maghi su richiesta e il contenimento della schermata desktop. Su mobile lo spazio finale continua a essere misurato sull’altezza reale del dock.

## Verifica

Build TypeScript/Vite riuscita. Superati 70 scenari del browser su ingresso e quattro modalità, opzioni e salvataggi, board, menu unico, tastiera e focus, desktop/mobile e finestre basse, copie e fascino, tutte le abilità, replay e animazioni, velocità/pausa/ripresa del computer e quattro flussi online fra due browser. Le aspettative dei test sono state aggiornate ai controlli ora consultabili su richiesta; il motore e il formato dei salvataggi non sono stati modificati.

Anteprime locali dell’interfaccia: `output/realism-entry-desktop.png`, `output/realism-entry-mobile.png`, `output/realism-game-desktop.png`, `output/realism-game-mobile.png` (artefatti di verifica, esclusi dal rilascio).

## Prompt finali delle immagini

Illustrazione:

> Use case: precise-object-edit. Production illustration extraction from approved Fantasy Realism UI concept. Produce ONLY the LEFT entrance illustration of the robed elderly wizard seen three-quarter from behind on a mossy rocky overlook with realistic deep red-brown embroidered cloak, holding a small subtly glowing orb, looking over a green mountain valley toward distant stone castle ruins. Match the approved realistic hand-painted fantasy aesthetic, soft late afternoon natural light, subtle mist in distant hills, credible rock, vegetation, fabric. Expand into a complete PORTRAIT 3:4 artwork suitable for a website left hero panel with object-fit cover. Mage in lower left/middle, distant ruin in upper right, calm sky upper 20 percent can host live HTML title. No UI, no text, no logo, no lettering, no frame, no parchment or buttons or board. Image edge-to-edge, no margin. No excessive magical glow, no other characters or brand marks. Preserve the scene and art direction faithfully, preview approved and now production asset.

Fondale:

> Use case: precise-object-edit. Prepare the APPROVED Fantasy Realism grass board as a production BACKGROUND ONLY texture. Faithfully preserve the continuous muted moss/fern green natural meadow, less yellow than original game, fine quiet realistic grass texture and tiny scenic details in approved preview. Remove ALL pieces, HP badges, power symbols, walls, move dots, paths, selection highlights, grid lines, coordinates, stone/bronze frame and all surrounding margins, replacing their sites with matching uninterrupted grass. Output a perfectly square edge-to-edge meadow with NO frame or text; grid and coordinate bands are drawn separately by game code. Preserve approximately twelve tiny low contrast partly buried flat runic fragments, faint grass/earth variations, tiny lavender-gray crystal sprigs, mushrooms and fern sprigs dispersed across all quadrants, especially at edges of imaginary cells; tiny rune stone upper left, tiny crystals upper right, broken flat runic stone lower left and tiny fallen column/mushrooms bottom right. Extremely faded incomplete arcane soil circle upper-right. Decorations must remain much smaller than one tenth image width, not obstacles. No large rocks/trees/roads or dramatic shadows or obvious dirt paths. Overall soft uniform diffused lighting, no vignetting, no dark regions. Match middle green brightness in approved preview so UI overlays stay legible, not dark forest floor. Do not paint checkerboard squares; continuous grass throughout. High quality realistic material, but restrained low visual noise for tactical readability.
