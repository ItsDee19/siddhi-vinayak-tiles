import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

// Environment reflections stay stable through glass and material changes.
// Contact shading and antialiasing clarify the geometry without temporal SSR.
export default function PostFX() {
  // EffectComposer already disables renderer tone mapping for its linear HDR
  // pass and restores it on unmount. A second owner here would restore the
  // wrong mode when switching quality. Apply the same Neutral operator used
  // by the direct mobile renderer exactly once, at the display boundary.
  return (
    <EffectComposer multisampling={4}>
      <N8AO aoRadius={0.16} distanceFalloff={1} intensity={0.8} quality="medium" halfRes />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  )
}
