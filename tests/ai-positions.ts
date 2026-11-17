import { defaultOptions, newMatch, type Kind, type Side } from '../src/engine/game';

/** Independently constructed test board. Contains no imported match data or private identifiers. */
export function syntheticSafetyPosition() {
  const game=newMatch({...defaultOptions,hp:3,walls:'varied'},()=>.8).game;
  const pieces: [Side,Kind,number,number][]=[
    ['red','pyromancer',4,5],['red','teleporter',5,5],['red','aeromancer',6,5],
    ['red','enchanter',9,9],['red','geomancer',0,9],['red','spellsword',8,8],
    ['blue','pyromancer',5,1],['blue','spellsword',5,0],['blue','teleporter',9,0],
    ['blue','geomancer',0,0],['blue','enchanter',8,0],['blue','aeromancer',1,0]
  ];
  game.wizards=pieces.map(([side,kind,x,y])=>({...game.wizards.find(w=>w.side===side&&w.kind===kind)!,pos:{x,y}}));
  game.turn=2;game.phase=2;game.activity=true;game.activated=['red:pyromancer','red:aeromancer'];
  return game;
}
