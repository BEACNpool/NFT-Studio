// Original BEACN Labs synthesis. Call with a running, click-unlocked AudioContext.
// `when` is an absolute AudioContext time; the sound lasts 1.29 seconds.
function womp(c, when = c.currentTime) {
  when = Math.max(when, c.currentTime);
  for (const [offset, duration, pitch, fall] of [[0, .48, 196, .71], [.55, .74, 146.83, .5]]) {
    const t = when + offset, end = t + duration;
    const filter = c.createBiquadFilter(), envelope = c.createGain();
    filter.type = 'lowpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(750, t);
    filter.frequency.exponentialRampToValueAtTime(1800, t + .045);
    filter.frequency.exponentialRampToValueAtTime(340, end);
    envelope.gain.setValueAtTime(0, t);
    envelope.gain.linearRampToValueAtTime(.11, t + .016);
    envelope.gain.exponentialRampToValueAtTime(.075, t + .12);
    envelope.gain.exponentialRampToValueAtTime(.052, end - .10);
    envelope.gain.exponentialRampToValueAtTime(.001, end - .015);
    envelope.gain.linearRampToValueAtTime(0, end);
    filter.connect(envelope).connect(c.destination);
    let live = 2;
    for (const detune of [-6, 6]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = detune;
      o.frequency.setValueAtTime(pitch, t);
      o.frequency.exponentialRampToValueAtTime(pitch * fall, end);
      o.connect(filter);
      o.onended = () => { o.disconnect(); if (!--live) { filter.disconnect(); envelope.disconnect(); } };
      o.start(t);
      o.stop(end);
    }
  }
  return when + 1.29;
}
