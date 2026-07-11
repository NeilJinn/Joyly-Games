export function shouldRenderScoreBurstOverlay(phase: string): boolean {
  return phase === "reveal" || phase === "scoring";
}
