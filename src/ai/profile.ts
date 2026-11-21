export const ai2HardProfile = Object.freeze({ initiative: 1, reinforcements: 1, opening: 1, danger: 1, area: 1 });
export type HardProfile = Readonly<Record<keyof typeof ai2HardProfile, number>>;

// P2 from the single-field AutoTune run with seed 502.
export const p2HardProfile: HardProfile = Object.freeze({
  initiative: .9981, reinforcements: .9474, opening: 1.0133, danger: .9241, area: .9612,
});

// G8-C3 won the promotion and the P2 check on F6–C5.
export const defaultHardProfileId = 'g8-c3';
export const defaultHardProfileName = 'G8-C3';
export const defaultHardProfile: HardProfile = Object.freeze({
  initiative: 1.1147, reinforcements: 1.0893, opening: .9216, danger: .9444, area: 1.1619,
});
