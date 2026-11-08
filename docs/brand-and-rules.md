# Titolo, identità e regole complete

L’ingresso, locale e online, presenta «Battaglia tra gilde magiche.» e «8 MAGHI CONTRO 8 MAGHI». Anche il titolo della scheda del browser è aggiornato.

Il marchio usa **Cinzel Decorative Bold**, distribuito localmente in `public/fonts/CinzelDecorative-Bold.ttf`. La fonte è il [repository ufficiale Google Fonts](https://github.com/google/fonts/tree/main/ofl/cinzeldecorative); la licenza SIL Open Font License è inclusa in `public/fonts/OFL-CinzelDecorative.txt`. Il font viene precaricato dal sito e non richiede una richiesta a un servizio di font esterno. È usato solo per il marchio e il richiamo del titolo nel regolamento; comandi e testi lunghi conservano il carattere leggibile dell’interfaccia.

`GuildBrand` sostituisce il rombo con un SVG originale: una stella arcana a otto punte sopra un grimorio aperto. La stessa figura è usata nell’icona della scheda, `public/guild-sigil.svg`. Dimensioni e spaziature sono adattate a ingresso, barra laterale e telefono.

## Regolamento

«Regole complete» sostituisce «Regole rapide» nelle schermate principali e nelle partite locali/online. `RulesDialog` offre un documento navigabile con nove sezioni: obiettivo, preparazione e varianti, turno, movimento, gittata/visuale, gli otto maghi, effetti e copie, conferme/annullamenti e modalità/salvataggi/replay.

Il contenuto è stato confrontato con il regolamento originale dell’autore, `Strategic Wizardry.docx`, con `REGOLAMENTO_CHIARIMENTI.md` e con le regole e le conferme attuali della webapp. Le statistiche e le descrizioni base dei maghi sono condivise con `INFO`; i chiarimenti includono fascino all’inizio dell’attivazione, immobilizzazione e spostamenti forzati, copia oltre distanza tre, poteri senza effetti finali, danni simultanei e sconfitta del lanciatore se entrambe le gilde raggiungono la soglia. Tabelle testuali sostituiscono i diagrammi di schieramento e di posizione dei muri.

Il dialogo ha indice, intestazione e chiusura sempre raggiungibili, scorrimento interno, focus iniziale sul pulsante di chiusura, chiusura con Esc o sfondo e ripristino del focus. Non modifica partita, preparazione o salvataggi. L’indice usa pulsanti che scorrono all’interno del documento: non cambia l’hash dell’indirizzo, che online può contenere l’invito personale.

La board non cambia dimensioni e la pagina sottostante non scorre mentre si leggono le regole. Il vecchio riquadro sintetico `QuickRules` è sostituito dal documento completo.

## Verifica

Build TypeScript/Vite riuscita; superati 22 scenari distinti del browser, comprendenti ingresso, menu, fasi, replay, regole complete, schede dei maghi, copie, board e partita online. Verificati il caricamento effettivo del font locale, l’assenza di sovrapposizione tra marchio e pulsante su desktop/mobile, l’indice con nove sezioni e le otto schede dei poteri, chiusura con pulsante/Esc e ripristino del focus, preparazione e dimensioni della board conservate. Online, consultare e navigare le regole lascia invariati invito e fingerprint della partita. Controllati i percorsi relativi di font e icona nella build per GitHub Pages.
