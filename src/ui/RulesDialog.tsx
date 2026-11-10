import { useEffect, useRef } from 'react';
import { INFO, KINDS, type Kind } from '../engine/game';
import { EffectLegend } from './BattlePreferences';
import { MageEmblem } from './MageEmblem';

const chapters = [
  ['objective', 'Obiettivo e componenti'], ['setup', 'Preparazione e varianti'], ['turn', 'Il turno'],
  ['movement', 'Movimento'], ['sight', 'Gittata e linea di vista'], ['mages', 'Gli otto maghi'],
  ['effects', 'Danni, copie e stati'], ['confirm', 'Conferme e annullamenti'], ['play', 'Modalità, salvataggi e replay'],
  ['symbols', 'Legenda dei simboli'],
] as const;
const blueOrder: Kind[] = ['spellsword', 'enchanter', 'illusionist', 'aeromancer', 'teleporter', 'pyromancer', 'geomancer', 'electromancer'];
const clarifications: Record<Kind, string> = {
  aeromancer: 'Ogni passo forzato deve arrivare su una casella vuota: non puoi attraversare altri pezzi o muri. Puoi scegliere la direzione a ogni passo. Un nemico eliminato dal danno non viene spostato. Su un nemico lo spostamento può essere zero; su un alleato occorre cambiare la situazione finale.',
  electromancer: 'La propagazione segue tutte le adiacenze ortogonali collegate, anche passando attraverso alleati e proseguendo oltre la prima fila di bersagli. Ogni mago coinvolto subisce il danno una sola volta, simultaneamente. Le copie non sono maghi e non conducono né subiscono la scarica. Se entrambe le gilde scendono a tre maghi o meno, perde chi ha lanciato la scarica.',
  enchanter: 'Il fascino si controlla all’inizio dell’attivazione nemica: se il mago parte adiacente, non può usare il proprio potere per tutta l’attivazione, anche se si allontana. Può comunque muovere. Entrare nella zona durante un’attivazione iniziata fuori non lo incanta. Il blocco riguarda il potere attivo, non cancella le passive. Alleati, diagonali e copie non sono incantati.',
  geomancer: 'La morsa blocca soltanto il movimento proprio del bersaglio: il mago può usare il potere ed essere spostato da vento o teletrasporto. Gli spostamenti forzati non rimuovono la morsa e non ne cambiano la scadenza. Se il bersaglio è eliminato, non resta alcuno stato da applicare.',
  illusionist: 'Ogni Illusionista può avere una sola copia. Evocazione, movimento della copia ed eventuale colpo fanno parte della stessa abilità. Se la copia esiste già, comandarla richiede comunque l’abilità dell’Illusionista. Il movimento della copia è distinto da quello del mago e segue i normali blocchi al passaggio. Non serve linea di vista per comandarla: origine, ogni passo e destinazione devono restare entro distanza tre dall’Illusionista. Dopo il percorso può infliggere 1 danno a un solo mago nemico adiacente, anche restando ferma.',
  pyromancer: 'È sufficiente vedere la casella centrale: non serve una linea di vista separata verso ciascun nemico nell’esplosione. Puoi scegliere anche la tua casella come centro, ma non una casella con un muro. La croce comprende il centro e le quattro caselle ortogonalmente adiacenti; le diagonali sono escluse. Gli alleati, compreso il Piromante, sono immuni.',
  spellsword: 'Il bersaglio deve essere un mago nemico ortogonalmente adiacente. La lama infligge 2 danni con un solo uso del potere; non colpisce in diagonale e non può bersagliare una copia.',
  teleporter: 'Puoi spostare un alleato o un nemico, ma non te stesso. Bersaglio e destinazione devono essere entrambi visibili ed entro due caselle dal Teletrasportatore. La destinazione deve essere vuota. Non si attraversano le caselle intermedie: il teletrasporto può superare ostacoli senza un percorso di movimento, purché le due verifiche di visuale siano soddisfatte.',
};

/** Full, navigable rules. Opening the document never changes the game or an online invite URL. */
export function RulesDialog({ onClose, returnToMenu = false }: { onClose: () => void; returnToMenu?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null), outside = useRef(false);
  useEffect(() => {
    const dialog = ref.current!, previous = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previous; };
  }, []);
  const beyond = (x: number, y: number) => { const r = ref.current!.getBoundingClientRect(); return x < r.left || x > r.right || y < r.top || y > r.bottom; };
  function goTo(id: string) {
    const chapter = ref.current?.querySelector<HTMLElement>(`#rules-${id}`);
    chapter?.scrollIntoView({ block: 'start' }); chapter?.focus({ preventScroll: true });
  }
  return <dialog ref={ref} className="rules-dialog" aria-labelledby="rules-title" onClose={onClose}
    onPointerDown={e => { outside.current = e.target === e.currentTarget && beyond(e.clientX, e.clientY); }}
    onClick={e => { if (outside.current && e.target === e.currentTarget && beyond(e.clientX, e.clientY)) ref.current?.close(); outside.current = false; }}>
    <header className="rules-heading"><div><p>Strategic Wizardry</p><h2 id="rules-title">Regole del gioco</h2></div><button autoFocus className="button secondary" onClick={() => ref.current?.close()} aria-label={returnToMenu ? "Torna al menù" : "Chiudi regole"}>{returnToMenu ? "Torna al menù" : "Chiudi"} <span aria-hidden="true">×</span></button></header>
    <div className="rules-body">
      <p className="rules-intro">Battaglia tra gilde magiche. Un gioco tattico per due giocatori, a informazione completa: otto maghi diversi per gilda su una scacchiera 10 × 10.</p>
      <nav className="rules-index" aria-label="Indice del regolamento">{chapters.map(([id, title], i) => <button key={id} type="button" onClick={() => goTo(id)}>{i + 1}. {title}</button>)}</nav>

      <section id="rules-objective" tabIndex={-1}><h3>1. Obiettivo e componenti</h3>
        <p>Vinci quando la gilda avversaria rimane con <strong>tre maghi o meno</strong>. Le copie illusorie non contano come maghi. Se una Scarica a catena porta entrambe le gilde a questa soglia, perde chi l’ha lanciata.</p>
        <p>Ogni gilda, Rossa o Blu, comprende un Aeromante, un Elettromante, un Incantatore, un Geomante, un Illusionista, un Piromante, una Lamarcana e un Teletrasportatore. Ogni mago inizia normalmente con <strong>4 punti vita</strong>; a zero viene eliminato. Sono disponibili una copia per Illusionista e gli indicatori degli effetti temporanei.</p>
        <p>I muri di forza sono indistruttibili e immobili. Occupano l’intera casella, bloccando movimento e linea di vista. Erba, cristalli e rovine del fondale sono decorazioni: non aggiungono ostacoli o effetti.</p>
      </section>

      <section id="rules-setup" tabIndex={-1}><h3>2. Preparazione e varianti</h3>
        <p>Si preparano prima i muri, poi i maghi. Il Rosso comincia. I dadi determinano soltanto i muri iniziali; non si lanciano dadi per muovere o attaccare. La webapp prepara il campo automaticamente secondo le opzioni scelte.</p>
        <h4>Muri standard</h4><p>Si lanciano due dadi a sei facce: il primo sceglie una casella della riga 6, il secondo della riga 5. Su entrambe le righe i risultati da 1 a 6 corrispondono alle colonne C, D, E, F, G, H. Si ottengono sempre due muri.</p>
        <h4>Schieramento standard</h4>
        <div className="rules-table-scroll"><table><caption>Gli angoli A e J restano liberi. La riga Blu è la 10, la riga Rossa è la 1.</caption><thead><tr><th scope="col">Colonna</th><th scope="col">Blu · riga 10</th><th scope="col">Rosso · riga 1</th></tr></thead><tbody>{blueOrder.map((kind, i) => <tr key={kind}><th scope="row">{String.fromCharCode(66 + i)}</th><td>{INFO[kind].name}</td><td>{INFO[blueOrder[7 - i]].name}</td></tr>)}</tbody></table></div>
        <h4>Schieramento personalizzato</h4><p>Dopo i muri, il Rosso colloca 4 maghi e il Blu 6; poi Rosso 2, Blu 2 e Rosso 2. Ogni giocatore sceglie l’ordine e la posizione dei propri maghi, soltanto nelle otto caselle centrali della sua prima riga, escludendo gli angoli.</p>
        <h4>Punti vita alternativi</h4><p>Per una partita più rapida si può iniziare con 3 PV per mago; per una più resistente con 5 PV. La soglia di sconfitta rimane sempre tre maghi o meno, indipendentemente dai PV iniziali.</p>
        <h4>Muri alternativi</h4><p>Si lancia un dado per ciascuno dei quattro settori. Con 5 o 6 non compare un muro in quel settore: il campo può quindi avere da zero a quattro muri. Con 1–4 si usa la casella indicata:</p>
        <div className="rules-table-scroll"><table><caption>Posizioni dei muri nella variante a quattro settori</caption><thead><tr><th scope="col">Settore</th>{[1, 2, 3, 4].map(n => <th key={n} scope="col">Dado {n}</th>)}</tr></thead><tbody>{[['B6', 'C6', 'B5', 'C5'], ['D6', 'E6', 'D5', 'E5'], ['F6', 'G6', 'F5', 'G5'], ['H6', 'I6', 'H5', 'I5']].map((cells, i) => <tr key={i}><th scope="row">{i + 1}</th>{cells.map(cell => <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>
      </section>

      <section id="rules-turn" tabIndex={-1}><h3>3. Il turno</h3>
        <p>Le gilde giocano a turni alterni. Un turno ordinario comprende:</p>
        <ol><li><strong>1° Attivazione:</strong> scegli un mago, muovilo fino alla sua velocità e usa eventualmente una volta il suo potere.</li><li><strong>2° Attivazione:</strong> scegli un altro mago e svolgi una seconda attivazione completa.</li><li><strong>Passo extra:</strong> puoi scegliere un terzo mago, non ancora attivato, e muoverlo di una sola casella. Non può usare poteri. Questa fase è sempre facoltativa.</li></ol>
        <p><strong>Eccezione iniziale:</strong> nel suo primo turno il Rosso svolge soltanto la 1° Attivazione, poi passa la mano al Blu.</p>
        <p>Durante un’attivazione completa puoi muovere prima del potere, dopo, oppure dividere il movimento in due parti; la somma dei passi non supera la velocità del mago. Puoi usare il potere restando fermo o muovere senza usarlo.</p>
        <p><strong>Obbligo di attività:</strong> durante l’insieme delle attivazioni complete, almeno un mago deve fare almeno un passo oppure usare un’abilità, se è possibile. Non occorre che lo facciano entrambi. Il solo Passo extra non soddisfa questo obbligo. Se nessun mago selezionabile può muovere o agire, si può passare senza perdere.</p>
        <p>Le fasi possono essere saltate rispettando l’obbligo di attività. Non è consentito usare un’abilità senza effetti sulla situazione finale: per esempio vento su un alleato lasciato fermo, oppure una copia già presente che non si sposta e non colpisce. Anche spostare un alleato o una copia e riportarlo all’origine senza altri effetti è vietato. Evocare una nuova copia è invece già un effetto. Il percorso proprio di un mago conta come movimento anche se torna all’origine.</p>
        <p>Non sono previsti orologi, sconfitte per immobilità o patte automatiche per ripetizione o inattività.</p>
      </section>

      <section id="rules-movement" tabIndex={-1}><h3>4. Movimento</h3>
        <p>Si procede di una casella per passo, soltanto in orizzontale o verticale. Non si muove in diagonale e non si esce dalla board. La velocità indica il massimo dei passi dell’intera attivazione, non una distanza da percorrere obbligatoriamente.</p>
        <ul><li>Muri, maghi nemici e copie nemiche bloccano il passaggio.</li><li>Puoi attraversare maghi e copie alleati, ma devi terminare su una casella libera.</li><li>Non puoi usare un’abilità mentre attraversi una casella occupata da un altro pezzo.</li><li>Il vento sposta il bersaglio soltanto attraverso caselle vuote. Il teletrasporto non percorre le caselle intermedie.</li></ul>
      </section>

      <section id="rules-sight" tabIndex={-1}><h3>5. Gittata, bersagli e linea di vista</h3>
        <p>La gittata si misura contando la distanza ortogonale: due colonne e una riga di differenza valgono tre caselle. La distanza non è il percorso necessario per aggirare gli ostacoli.</p>
        <p>Per la linea di vista traccia una retta dal centro della casella del mago al centro della casella bersaglio. Questa retta può andare in qualsiasi direzione, anche diagonale. I due controlli, gittata e visuale, sono distinti.</p>
        <ul><li>I muri, tutti i maghi, anche alleati, e le copie nemiche bloccano la linea di vista. Le copie alleate sono trasparenti.</li><li>La casella di partenza e quella bersaglio non bloccano la propria retta.</li><li>Se la retta sfiora soltanto un angolo di un ostacolo, la visuale passa. Se quell’angolo è condiviso da due caselle bloccanti, la visuale è interrotta.</li></ul>
        <p>Un’abilità che indica un «mago» può bersagliare un alleato o un nemico; se indica un «nemico», soltanto un avversario. Non puoi bersagliare te stesso, salvo la Palla di fuoco, che può scegliere come centro anche la casella del Piromante. Le copie non sono bersagli validi dei poteri rivolti ai maghi.</p>
      </section>

      <section id="rules-mages" tabIndex={-1}><h3>6. Gli otto maghi</h3><p>Le due gilde hanno gli stessi otto tipi di maghi e gli stessi poteri. Velocità e gittata sono espresse in caselle.</p>
        <div className="rules-mages">{KINDS.map(kind => <article className="rules-mage" key={kind}><h4><MageEmblem kind={kind}/>{INFO[kind].name}</h4><p className="rules-mage-stats">Movimento {INFO[kind].speed} · Gittata {INFO[kind].range}{kind === 'electromancer' ? ' (catena di adiacenze)' : kind === 'illusionist' ? ' (evocazione)' : ''}</p><h5>{INFO[kind].ability}</h5><p>{INFO[kind].description}</p><p>{clarifications[kind]}</p></article>)}</div>
      </section>

      <section id="rules-effects" tabIndex={-1}><h3>7. Danni, copie e stati</h3>
        <p>I danni riducono i PV. A zero il mago viene rimosso; i danni di una singola Scarica a catena sono simultanei. Il cuore spezzato indica un danno e il teschio un’eliminazione.</p>
        <h4>Copia illusoria</h4><p>Non è un mago: non ha PV, non può essere bersagliata, non è incantabile e non viene distrutta direttamente. Svanisce non appena il suo Illusionista subisce danni, anche da un alleato. Se l’Illusionista è incantato, non può evocarla o comandarla durante quell’attivazione.</p>
        <p>Se l’Illusionista si allontana oltre tre caselle, la copia rimane sul campo e continua a occupare la propria casella e a bloccare normalmente. Non può muoversi né colpire finché il proprietario non torna entro distanza tre. Il simbolo del legame interrotto indica questa condizione.</p>
        <h4>Incantato</h4><p>Il cuore incatenato compare soltanto quando il potere è effettivamente bloccato per l’attivazione corrente. La sola vicinanza o l’ingresso successivo nella zona non mostrano falsi stati di fascino. Lo stato termina con l’attivazione e rimane attivo anche dopo che il mago si è allontanato.</p>
        <h4>Immobilizzato</h4><p>La morsa di terra impedisce di camminare fino alla fine del prossimo turno della gilda del bersaglio. Non impedisce l’uso di abilità o gli spostamenti forzati. La scadenza è conservata anche dopo vento e teletrasporto.</p>
      </section>

      <section id="rules-confirm" tabIndex={-1}><h3>8. Conferme e annullamenti nella webapp</h3>
        <p>I clic sulla board preparano l’azione: prima della conferma puoi modificarla, annullare l’ultimo passo o azzerare tutta la preparazione. Il doppio clic su un tuo mago utilizzabile prepara il suo potere, ma non lo esegue senza conferma. Sul telefono puoi selezionare il mago e premere Usa abilità.</p>
        <p>«Conferma attivazione» applica una fase intermedia. Puoi annullare le attivazioni già confermate soltanto finché il turno rimane tuo. «Conferma e passa turno» applica l’ultima fase e passa direttamente la mano; da quel momento non puoi annullare il turno concluso. Anche saltare il Passo extra conclude il turno. Se non esiste un Passo extra legale, la seconda conferma passa direttamente la mano.</p>
        <p>Se la preparazione porta una gilda a tre maghi o meno, il risultato resta provvisorio finché non confermi: puoi ancora correggere o azzerare la preparazione. «Conferma e concludi partita» rende l’esito definitivo. Un vecchio salvataggio con un risultato ancora da confermare offre soltanto annullamento o conferma della vittoria.</p>
        <p>Dettagli permette di consultare qualsiasi mago di entrambe le gilde senza cambiare l’attivazione preparata. Ruota la scacchiera cambia soltanto la visualizzazione. Dal Menu puoi regolare aiuti, effetti e animazioni, esportare e tornare alle partite. Gli aiuti visivi non modificano le regole.</p>
      </section>

      <section id="rules-play" tabIndex={-1}><h3>9. Modalità, salvataggi e replay</h3>
        <p>Due giocatori sullo stesso dispositivo, Contro il computer, Computer vs Computer e Online con un amico usano le stesse regole. In osservazione puoi mettere in pausa il duello e cambiare la velocità; le preferenze degli effetti sono personali.</p>
        <p>Le azioni confermate vengono salvate nel browser; la preparazione non confermata non viene salvata. Puoi esportare una partita e importarla in seguito. Cancellare i dati del browser può eliminare i salvataggi: un file esportato permette di conservarli.</p>
        <p>«Rivedi ultimo turno avversario» riproduce l’intero ultimo turno nemico completato, Passo extra compreso. Non cambia la partita né applica nuove mosse; «Torna alla partita» interrompe il replay e ripristina la visualizzazione attuale.</p>
        <p>Online il creatore occupa il posto Rosso e l’invitato quello Blu. Condividi il link d’invito, non il backup personale: quest’ultimo contiene l’accesso al tuo posto. Per riprendere usa lo stesso browser o importa il tuo backup e ricollega la partita. Una disconnessione non assegna una sconfitta automatica e non c’è una scadenza centrale dopo 24 ore. Alcune reti possono impedire il collegamento diretto: entrambi i giocatori devono risultare collegati per proseguire.</p>
      </section>
      <section id="rules-symbols" tabIndex={-1}><h3>10. Legenda dei simboli</h3><EffectLegend/></section>
    </div>
  </dialog>;
}
