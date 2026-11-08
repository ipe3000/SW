# Grafica approvata: pedine e radura

Gli emblemi in `src/ui/MageEmblem.tsx` sono SVG nativi, condivisi fra campo, schieramento, scheda e animazioni. Le cornici indicano la gilda, il simbolo e il suo colore identificano il potere. I PV sono dinamici, in alto a destra; le copie hanno lo stesso occhio e la stessa cornice solida dell’Illusionista, con interno più chiaro e nessun PV. I nomi completi restano nei controlli e nelle descrizioni accessibili delle caselle.

Il componente `ChainedHeart` condivide esattamente lo stesso disegno fra Incantatore e stato di fascino effettivo. La semplice influenza mantiene il cuore non incatenato, perché non blocca necessariamente l’abilità. La barriera di energia usa ora `public/assets/force-wall.png`: la tessera raster originale della terza opzione dell’anteprima, scelta nuovamente dall’autore, estratta dalla tavola senza ridisegnarla. È un PNG quadrato da 153 px, con bordo e nastri viola intrecciati, applicato all’intera casella tramite immagine; il percorso rispetta `BASE_URL`.

La copia è distinguibile anche per il contrasto fra interno lavanda chiaro e occhio viola scuro. L’Illusionista originale conserva l’interno antracite. La cornice resta identica alla gilda del proprietario e il simbolo dell’occhio mantiene la stessa geometria. Le copie non hanno PV; il legame interrotto attenua soltanto il simbolo, senza scolorire la cornice.

La pagina principale usa `GameModes` per le quattro modalità, online compresa. `GameApp` gestisce il passaggio fra le configurazioni, l’indirizzo e il focus da tastiera; i link di invito esistenti continuano ad aprire il posto corretto.

| Mago | Emblema | Colore |
| --- | --- | --- |
| Piromante | Fiamma | Vermiglio |
| Geomante | Roccia spaccata | Ocra marrone |
| Elettromante | Fulmine | Giallo oro |
| Aeromante | Tre correnti con riccioli, dal riferimento dell'autore | Celeste chiaro |
| Incantatore | Cuore incatenato | Magenta |
| Illusionista | Un solo occhio | Viola |
| Lamarcana | Lama con runa | Argento |
| Teletrasportatore | Vortice a tre bracci | Verde smeraldo |

`public/assets/arcane-meadow.webp` è uno sfondo decorativo continuo, senza griglia o coordinate incorporate. La griglia interattiva 10×10, i riferimenti, i muri, gli aiuti e gli effetti rimangono elementi distinti. Il tema si trova in `src/ui/meadow-theme.css`, caricato dopo gli stili degli effetti. Il percorso dell'immagine rispetta `BASE_URL` anche nelle pubblicazioni in sottocartella.

Lo sfondo è stato derivato dall'anteprima della board approvata dall'autore usando il tool integrato **image_gen**, quindi convertito in WebP (qualità 86%, circa 167 KiB) senza cambiare il contenuto. Nessun servizio di generazione è necessario durante il gioco. L'immagine storica `wizard-roster.png` è conservata, ma non è più usata dalle pedine.

## Verifica

- Tessera originale e copie lavanda: build riuscita e dieci scenari di disposizione e movimento superati, con immagine caricata, casella interamente occupata dopo rotazione e su mobile, cornice identica all’originale e contrasto fra gli interni superiore a 5:1.
- Build TypeScript/Vite riuscita; 118 test del motore superati.
- Ultimo aggiornamento: superati 30 scenari locali su effetti, copie, modalità, avversario computer, disposizione e movimento, oltre ai quattro scenari online fra due browser: sincronizzazione, rientro, backup, schieramento e conclusione del duello.
- Controllo visivo desktop e mobile, senza scorrimento orizzontale a 390 px. Anteprime dell’ultimo aggiornamento in `output/modalita-online.png`, `output/barriera-energia.png` e `output/copie-e-fascino.png`.
- Le prove online sono state eseguite con server e browser nello stesso contesto di esecuzione, superando i timeout di connessione incontrati nella verifica precedente. Il protocollo di rete non è stato modificato.

## Prompt finale dello sfondo

> Prepare this approved meadow game-board artwork as a production BACKGROUND TEXTURE. Remove ALL grid lines, the rectangular field boundary, ALL coordinate letters and numbers, cleanly replacing them with matching continuous grass. Preserve the exact top-down continuous muted green meadow, fine quiet texture, sparse fantasy corner decorations: upper-left small mossy rune stone, upper-right tiny lavender crystals, bottom-left broken ritual stone arc, bottom-right fallen column and mushrooms. Keep every physical decoration entirely inside the outermost 5 percent edge/corners so the central 90 percent square is unobstructed grass. Preserve the three tiny very faint runic soil markings, low contrast. No new elements. Uniform soft daylight, low visual noise, no shadows over the central meadow. No text or grid of any kind anywhere. Perfectly square full-bleed image. This is a game production background; the precise interactive 10x10 grid and coordinates will be drawn separately in code.
