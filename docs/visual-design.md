# Grafica approvata: pedine e radura

Gli emblemi in `src/ui/MageEmblem.tsx` sono SVG nativi, condivisi fra campo, schieramento, scheda e animazioni. Le cornici indicano la gilda, il simbolo e il suo colore identificano il potere. I PV sono dinamici, in alto a destra; le copie hanno lo stesso occhio e la stessa cornice solida dell’Illusionista, con interno più chiaro e nessun PV. I nomi completi restano nei controlli e nelle descrizioni accessibili delle caselle.

Il componente `ChainedHeart` condivide esattamente lo stesso disegno fra Incantatore e stato di fascino effettivo. La semplice influenza mantiene il cuore non incatenato, perché non blocca necessariamente l’abilità. La barriera di energia usa `public/assets/force-wall-obsidian.png`: fondo nero/antracite, fasce di energia grigie, un sigillo centrale e due piccoli accenti runici. Il PNG quadrato da 256 px occupa tutta la casella; il percorso rispetta `BASE_URL`. Anche il colore di ripiego della casella è antracite.

La copia ha ora un interno rosso o blu molto chiaro e semitrasparente, secondo la gilda: la trasparenza riguarda soltanto il fondo e lascia intravedere il prato. Bordo e occhio restano nitidi. L’occhio è centrato orizzontalmente e verticalmente, senza riservare spazio per PV che la copia non possiede, anche su mobile e durante il movimento. L’Illusionista originale conserva l’interno antracite. La cornice resta identica alla gilda del proprietario e il simbolo dell’occhio mantiene la stessa geometria. Il legame interrotto attenua soltanto il simbolo, senza scolorire la cornice.

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

`public/assets/arcane-meadow-fantasy.webp` è uno sfondo decorativo continuo, senza griglia o coordinate incorporate. Piccoli frammenti runici, funghi, felci e cristalli sono distribuiti anche all’interno del campo, con colori attenuati. Il cerchio arcano in alto a destra è particolarmente tenue. Tutti questi elementi sono soltanto scenici e non indicano ostacoli. La griglia interattiva 10×10, i riferimenti, i muri, gli aiuti e gli effetti rimangono elementi distinti. Il tema si trova in `src/ui/meadow-theme.css`, caricato dopo gli stili degli effetti. Il percorso dell'immagine rispetta `BASE_URL` anche nelle pubblicazioni in sottocartella.

Le due immagini sono state preparate dall’anteprima approvata con il tool integrato **image_gen**, quindi ottimizzate tramite canvas senza modificare il disegno: sfondo WebP a qualità 86% (circa 103 KiB), muro PNG (circa 108 KiB). I nuovi nomi evitano il riutilizzo delle vecchie immagini in cache. Nessun servizio di generazione è necessario durante il gioco. Le immagini storiche sono conservate, ma non vengono caricate dalla board.

## Verifica

- Aggiornamento antracite/fantasy: build riuscita e tre scenari browser superati: fondo e copie, dimensioni/PV a quattro risoluzioni desktop, muri a piena casella anche dopo rotazione e su mobile. Controllate visivamente le immagini risultanti a 1366 px e 390 px.
- Tessera originale e copie lavanda: build riuscita e dieci scenari di disposizione e movimento superati, con immagine caricata, casella interamente occupata dopo rotazione e su mobile, cornice identica all’originale e contrasto fra gli interni superiore a 5:1.
- Build TypeScript/Vite riuscita; 118 test del motore superati.
- Ultimo aggiornamento: superati 30 scenari locali su effetti, copie, modalità, avversario computer, disposizione e movimento, oltre ai quattro scenari online fra due browser: sincronizzazione, rientro, backup, schieramento e conclusione del duello.
- Controllo visivo desktop e mobile, senza scorrimento orizzontale a 390 px. Anteprime dell’ultimo aggiornamento in `output/modalita-online.png`, `output/barriera-energia.png` e `output/copie-e-fascino.png`.
- Le prove online sono state eseguite con server e browser nello stesso contesto di esecuzione, superando i timeout di connessione incontrati nella verifica precedente. Il protocollo di rete non è stato modificato.

## Prompt delle immagini attuali

Tool: **image_gen integrato**, con l’anteprima approvata come riferimento; per il fondale anche la precedente radura.

Muro:

> Production game asset extraction from the approved concept sheet. Return ONLY the large square black/gray MURO DI FORZA tile on the right, filling the entire square output edge to edge. Faithfully preserve that exact approved tile design: charcoal square border, black smoky energy interior, broad faint crossing diagonal gray energy ribbons, delicate silver-gray central circle with a four-point curved diamond, two tiny rune accents above/below. No creative redesign. No surrounding presentation background, no margins, no drop shadow outside square, no label or typography, no board. Flat orthographic square image, clean readable at tiny 30px game-cell size, all neutral blacks/grays, no purple or colored glow. Full square tile reaches all four image boundaries.

Fondale:

> Produce ONLY the square meadow artwork, full bleed, perfectly top-down flat orthographic, matching the quiet olive grass and small fantasy scenic details of the approved concept's left board. Preserve corner decorations: upper-left small mossy rune stone, upper-right tiny crystal and fern, lower-left broken curved runic stone, lower-right fallen small column and mushrooms. Across the playable interior add approximately 12 tiny scattered subtle scenic accents: small mushroom clusters, partly buried flat runic stone fragments, tiny broken masonry chips, muted lavender crystal sprigs, fern/grass sprigs, one incomplete extremely faded old arcane circle near the upper-right. Desaturated, low contrast, small worn flat scenic accents, spread over all quadrants, not obstructive terrain. Vast majority of grass remains uncluttered and quiet. Fade the arcane circle more than concept. Do not include board grid lines, coordinate text, labels, numbers, field outlines, tokens, walls, interface, headings, frames or margins: they are rendered separately in code. No chess alternating squares. No perspective or raised objects casting long shadows, no tree or large rock or road or building. Even soft daylight. Gentle handpainted fantasy tabletop game art, restrained detail, subtle natural texture, tactical readability before scenic appeal. Square edge-to-edge background only.

## Prompt dello sfondo precedente (archivio)

> Prepare this approved meadow game-board artwork as a production BACKGROUND TEXTURE. Remove ALL grid lines, the rectangular field boundary, ALL coordinate letters and numbers, cleanly replacing them with matching continuous grass. Preserve the exact top-down continuous muted green meadow, fine quiet texture, sparse fantasy corner decorations: upper-left small mossy rune stone, upper-right tiny lavender crystals, bottom-left broken ritual stone arc, bottom-right fallen column and mushrooms. Keep every physical decoration entirely inside the outermost 5 percent edge/corners so the central 90 percent square is unobstructed grass. Preserve the three tiny very faint runic soil markings, low contrast. No new elements. Uniform soft daylight, low visual noise, no shadows over the central meadow. No text or grid of any kind anywhere. Perfectly square full-bleed image. This is a game production background; the precise interactive 10x10 grid and coordinates will be drawn separately in code.
