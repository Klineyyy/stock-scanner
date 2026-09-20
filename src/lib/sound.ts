// A short beep and buzz when a scan lands, like a shop scanner. Browsers only allow audio after a
// tap, so unlockAudio() is wired to the first pointer event in main.tsx.

let ctx: AudioContext | null = null;

export function unlockAudio() {
  const Ctx =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  ctx ??= new Ctx();
  void ctx.resume();
}

export function beep(kind: "ok" | "miss") {
  // Chrome refuses to vibrate before the user has tapped the page, and logs an error when asked to.
  if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(kind === "ok" ? 60 : [80, 60, 80]);
  const audio = ctx;
  if (!audio || audio.state !== "running") return;

  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "square";
  osc.frequency.value = kind === "ok" ? 1400 : 300;
  const start = audio.currentTime;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.15, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + (kind === "ok" ? 0.12 : 0.3));
  osc.connect(gain).connect(audio.destination);
  osc.start(start);
  osc.stop(start + 0.35);
}
