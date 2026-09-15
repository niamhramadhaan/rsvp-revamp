import { createUISFX, type CueName } from 'uisfx'

let player: ReturnType<typeof createUISFX> | null = null

// Browsers block audio until a real user gesture — lazily creates the
// player on first use and unlocks it on the next pointerdown anywhere.
// 'zen' pack — pure tones and dry wood, kept quiet so it stays a calm
// background texture rather than a game-y feedback layer.
function getPlayer() {
  if (!player) {
    player = createUISFX({ pack: 'zen', volume: 0.28, cooldownMs: 60 })
    const unlock = () => {
      player?.unlock()
      window.removeEventListener('pointerdown', unlock)
    }
    window.addEventListener('pointerdown', unlock, { once: true })
  }
  return player
}

// Fire-and-forget UI sound cue — never throws, since audio is a nice-to-have
// polish layer, not something worth surfacing a failure for.
export function playSound(cue: CueName, volume?: number) {
  try {
    getPlayer().play(cue, volume !== undefined ? { volume } : undefined)
  } catch {
    // ignored
  }
}
