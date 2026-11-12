import { mageGlossary } from '../i18n/glossary';
import { useLanguage } from '../i18n/language';
import { useEffect, useRef, useState } from 'react';
import { wizard, type Activation, type Effect, type Game } from '../engine/game';
import { distance, square } from '../engine/geometry';
import { comboCenter, lessons, type Lesson } from './tutorial-lessons';

export type TutorialControls = {
  lesson: Lesson;
  retry: () => void;
  next: () => void;
  play?: () => Promise<void>;
  exit: () => void;
  error: string;
};

type GuideProps = TutorialControls & {
  game: Game;
  draft: Activation | null;
  mode: string;
  instruction: string;
  abilityAllowed: boolean;
  practicedUndo: boolean;
  effects: Effect[];
  playback: boolean;
  complete: boolean;
  busy: boolean;
};

function guidance({ lesson, game, draft, mode, instruction, abilityAllowed, practicedUndo }: GuideProps, english: boolean): string {
  if (lesson === 0) {
    if (!practicedUndo) {
      if (draft?.before.length) return english ? 'Now choose “Undo last step” under Planned action to take back the last square of your move.' : 'Ora premi «Annulla ultimo passo» sotto «Preparazione» per tornare indietro di una casella.';
      if (draft?.wizardId === 'red:spellsword') return english ? 'Choose D4 to prepare a one-square move. You’ll undo it in the next step.' : 'Scegli D4 per preparare un movimento di una casella. Subito dopo lo annullerai.';
      return english ? 'Select the Red Spellsword on D3 to practice moving and undoing a step.' : 'Seleziona la Lamarcana rossa in D3 per provare a muoverla e annullare un passo.';
    }
    if (draft?.spell) return english ? 'Read the damage preview, then confirm the activation to pass the turn.' : 'Leggi l’anteprima dei danni, poi conferma l’attivazione per passare la mano.';
    if (mode === 'target') return (english ? "Select the Blue Geomancer. Arcane Blade strikes only orthogonally." : 'Seleziona il Geomante blu. Lama arcana colpisce solo sopra, sotto o di lato.');
    if (draft?.wizardId !== 'red:spellsword') return (english ? "Select the Red Spellsword on D3." : 'Seleziona la Lamarcana rossa in D3.');
    if (!abilityAllowed) return english ? 'Step undone. Move next to the Blue Geomancer. Aim for D5.' : 'Passo annullato. Avvicinati al Geomante blu puntando a D5.';
    return english ? 'Choose “Use ability” to add Arcane Blade to this activation.' : 'Premi «Usa abilità» per aggiungere Lama arcana alla stessa attivazione.';
  }
  if (lesson === 1) {
    if (game.phase === 1 && !practicedUndo) {
      if (draft && (draft.before.length || draft.after.length || draft.spell)) return english ? 'Clear your plan to show “Undo activation”.' : 'Azzera la preparazione per ritrovare «Annulla attivazione».';
      return english ? 'First move confirmed. Choose “Undo activation” to bring the mage back.' : 'Prima mossa confermata. Premi «Annulla attivazione» per riportare il mago al suo posto.';
    }
    if (game.phase === 2) {
      if (draft?.before.length) return english ? 'Choose “Confirm and end turn” to apply the extra step and pass the turn.' : 'Premi «Conferma e passa turno» per eseguire il Passo extra e passare la mano.';
      return english ? 'The extra step is optional. Choose “Skip extra step” to end the turn now, or move a third mage one square.' : 'Il Passo extra è facoltativo. Premi «Salta passo extra» per passare subito la mano, oppure muovi un terzo mago di una casella.';
    }
    if (draft?.before.length) return english ? 'Your move is ready. Choose “Confirm activation”.' : 'Il movimento è pronto. Premi «Conferma attivazione».';
    if (draft) return english ? 'Choose a highlighted square to prepare the move.' : 'Scegli una casella evidenziata per preparare il movimento.';
    if (game.phase === 1) return game.activated.includes('red:geomancer')
      ? (english ? 'Select a different Red mage, for example the Spellsword on D3.' : 'Seleziona un altro mago rosso, per esempio la Lamarcana in D3.')
      : (english ? 'Select a different Red mage, for example the Geomancer on B2.' : 'Seleziona un altro mago rosso, per esempio il Geomante in B2.');
    return practicedUndo
      ? (english ? 'Move undone. Select the Spellsword on D3 again, then choose D4 to repeat the move.' : 'Mossa annullata. Seleziona di nuovo la Lamarcana in D3, poi scegli D4 per ripetere il movimento.')
      : (english ? 'Select the Spellsword on D3, then choose D4 to prepare its move.' : 'Seleziona la Lamarcana in D3, poi scegli D4 per preparare il movimento.');
  }
  if (lesson === 2) {
    if (game.phase === 2) return (english ? "The extra step is optional. Move a third mage one square without using an ability, or choose Skip extra step." : 'Il Passo extra è facoltativo. Muovi un terzo mago di una casella, senza usare poteri, oppure premi «Salta passo extra».');
    if (game.phase === 0) {
      if (mode === 'wind') return (english ? "Move the target up to two steps toward the other Blue mage. Try E5, then finish the ability." : 'Sposta il bersaglio fino a due passi per avvicinarlo all’altro mago blu. Prova E5, poi premi «Concludi abilità».');
      if (mode === 'target') return (english ? "Choose a highlighted Blue mage. For the guided route, choose the Geomancer on D5." : 'Scegli un mago blu evidenziato. Per il percorso guidato, scegli il Geomante in D5.');
      if (draft?.spell) return (english ? "When both targets are close together, choose Confirm activation." : 'Quando i due bersagli sono vicini, premi «Conferma attivazione».');
      return (english ? "Select the Red Aeromancer on D3 and choose Use ability." : 'Seleziona l’Aeromante rosso in D3 e premi «Usa abilità».');
    }
    if (mode === 'target') return (english ? "Choose the center. Fireball hits there and on the four adjacent squares. The preview should show two Blue mages taking damage." : 'Scegli il centro: il fuoco colpisce lì e nelle quattro caselle ai lati. L’anteprima deve mostrare due maghi blu feriti.');
    if (draft?.spell?.kind === 'fireball') {
      const center = draft.spell.center;
      const hits = game.wizards.filter(mage => mage.side === 'blue' && mage.pos && distance(center, mage.pos) <= 1).length;
      return hits >= 2
        ? (english ? 'Both Blue mages are in the blast. Confirm the activation.' : 'Entrambi i maghi blu sono nella croce di fuoco. Conferma l’attivazione.')
        : (english ? `Blue mages in the blast: ${hits} of 2. Clear your plan and try a different center.` : `Maghi blu nella croce di fuoco: ${hits} su 2. Azzera la preparazione e prova un altro centro.`);
    }
    return (english ? "Choose the Pyromancer for the second activation and prepare Fireball. The center must be visible and within two squares." : 'Scegli il Piromante per la seconda attivazione e prepara Palla di fuoco. Il centro deve essere visibile ed entro due caselle.');
  }
  return draft ? instruction : (english ? "Look for a Blue mage with low health. Open mage details to inspect them." : 'Cerca un mago blu con pochi punti vita. Puoi consultare i maghi con «Dettagli».');
}

function hint({ lesson, game, mode, draft, practicedUndo }: GuideProps, english: boolean) {
  if (lesson === 0) {
    if (!practicedUndo) return english ? 'Move from D3 to D4, then choose “Undo last step”. The Spellsword will return to D3.' : 'Vai da D3 a D4, poi premi «Annulla ultimo passo». La Lamarcana tornerà in D3.';
    if (mode === 'target') return (english ? "Tap the Blue Geomancer on D6." : 'Tocca il Geomante blu in D6.');
    if (draft?.spell) return (english ? "Choose Confirm and end turn." : 'Premi «Conferma e passa turno».');
    return (english ? "With the Spellsword selected, choose D5, one square below the Geomancer. Then prepare Arcane Blade." : 'Con la Lamarcana selezionata, scegli D5, una casella sotto il Geomante. Poi prepara Lama arcana.');
  }
  if (lesson === 1) {
    if (game.phase === 0) return english ? 'For example, move the Spellsword from D3 to D4.' : 'Per esempio, muovi la Lamarcana da D3 a D4.';
    if (game.phase === 1) return practicedUndo
      ? (game.activated.includes('red:geomancer')
        ? (english ? 'Try moving the Spellsword from D3 to D4.' : 'Prova a muovere la Lamarcana da D3 a D4.')
        : (english ? 'Try moving the Geomancer from B2 to B3.' : 'Prova a muovere il Geomante da B2 a B3.'))
      : (english ? 'Look for “Undo activation” under Confirmed actions.' : 'Cerca «Annulla attivazione» sotto «Azioni confermate».');
    return english ? 'For example, move the Teleporter from I2 to I3 if it is still available.' : 'Per esempio, muovi il Teletrasportatore da I2 a I3 se è ancora disponibile.';
  }
  if (lesson === 2) {
    if (game.phase === 0) return (english ? "Start with the Aeromancer on D3. Moving the Blue Geomancer from D5 to E5 is enough." : 'Parti dall’Aeromante in D3. Spostare il Geomante blu da D5 a E5 è sufficiente.');
    if (game.phase === 1) {
      const center = comboCenter(game);
      return center ? (english ? "From the Pyromancer’s starting square, aim at " : 'Dalla posizione iniziale del Piromante, mira a ') + square(center) + (english ? " to hit both targets." : ' per colpire entrambi i bersagli.') : (english ? "Look for a visible square where the Fireball cross reaches both targets." : 'Cerca una casella visibile dalla quale la croce di fuoco raggiunge entrambi i bersagli.');
    }
    return (english ? "You can skip this phase and complete the exercise." : 'Puoi saltare questa fase e completare la prova.');
  }
  if (!game.activated.includes('red:pyromancer')) return english ? 'The Geomancer on F5 has 1 HP. From F3, the Pyromancer can center Fireball on F5.' : 'Il Geomante in F5 ha 1 PV. Da F3, il Piromante può centrare la Palla di fuoco su F5.';
  if (!game.activated.includes('red:spellsword')) return english ? 'Move the Spellsword to F4, then strike the Geomancer on F5 with Arcane Blade.' : 'Porta la Lamarcana in F4, poi colpisci il Geomante in F5 con Lama arcana.';
  return english ? 'Undo the last confirmed activation or restart the exercise.' : 'Puoi annullare l’ultima attivazione confermata o riprovare dalla posizione iniziale.';
}

export function TutorialGuide(props: GuideProps) {
  const { language } = useLanguage();
  const english = language === 'en';
  const { lesson, game, complete, playback, busy, retry, next, play, exit, error } = props;
  const continueButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (complete && !playback) continueButton.current?.focus(); }, [complete, playback]);
  const [showHint, setShowHint] = useState(false);
  const [phase, setPhase] = useState(game.phase);
  if (phase !== game.phase) { setPhase(game.phase); setShowHint(false); }

  const damage = props.effects.filter(effect => effect.kind === 'damage');
  return <section className="tutorial-guide" aria-label={english ? 'Tutorial guide' : 'Guida del tutorial'}>
    <div aria-live="polite" aria-atomic="true">
      {playback ? <p>{(english ? "Watch the result on the board." : "Osserva l’esito sulla scacchiera.")}</p> : complete
        ? <p><strong>{lesson === 3 ? (english ? "Tutorial complete." : "Tutorial completato.") : (english ? "Exercise complete." : "Prova riuscita.")}</strong> {lesson === 0
          ? (english ? "Red opens with one activation. On normal turns you can activate two different mages." : "Il Rosso apre con una sola attivazione. Nei turni ordinari puoi attivare due maghi diversi.")
          : lesson === 1 ? (english ? 'Passing the turn locks in the confirmed moves.' : 'Quando passi la mano, le mosse confermate diventano definitive.')
          : lesson === 2 ? (english ? "Gale brought the targets together and Fireball hit both." : "Il vento ha raggruppato i bersagli e la Palla di fuoco li ha colpiti insieme.")
          : (english ? "Blue has three mages left. You now know the basics of the duel." : "Hai lasciato il Blu con tre maghi. Ora conosci le basi del duello.")}</p>
        : <><p><strong>{lessons[lesson][language].goal}</strong></p><p>{guidance(props, english)}</p>{damage.length > 0 && <p className="tutorial-preview">{english ? 'Preview' : 'Anteprima'} · {damage.map(effect => {
          const mage = effect.wizardId ? wizard(game, effect.wizardId) : undefined;
          if (!english || !mage || effect.amount === undefined || effect.fromHp === undefined) return effect.text;
          const side = mage.side === 'red' ? 'Red' : 'Blue';
          return `${side} ${mageGlossary.en[mage.kind].name}: −${effect.amount} HP (${effect.fromHp} → ${Math.max(0, effect.fromHp - effect.amount)}).`;
        }).join(' ')}</p>}</>}
    </div>
    {!playback && <>
      <div className="tutorial-guide-actions">
        {complete && (lesson === 3
          ? <button ref={continueButton} className="button primary" disabled={busy} onClick={play ? () => void play() : exit}>{play ? (english ? "Play against the computer" : "Gioca contro il computer") : (english ? "Return to match" : "Torna alla partita")}</button>
          : <button ref={continueButton} className="button primary" onClick={next}>{(english ? "Next exercise" : "Prossima prova")}</button>)}
        {!complete && <button className="button secondary" aria-expanded={showHint} onClick={() => setShowHint(!showHint)}>{showHint ? (english ? "Hide hint" : "Nascondi indizio") : (english ? "Show hint" : "Mostra indizio")}</button>}
        <button className="button secondary" disabled={busy} onClick={retry}>{(english ? "Retry" : "Riprova")}</button>
      </div>
      {!complete && showHint && <p className="tutorial-hint" role="status">{hint(props, english)}</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
    </>}
  </section>;
}
