import { useEffect, useState } from 'react'
import { loadZoneTexture, resolveZoneSource } from '../../../utils/threeTextures'

// Generic textured plane — used for feature walls, side returns, vanity back wall, etc.
export default function TexturedPlane({
  size = [10, 10],
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  source,
  repeat = 4,
  isActive = false,
  onClick,
}) {
  const [tex, setTex] = useState(null)
  useEffect(() => {
    let cancelled = false
    if (source) {
      const src = resolveZoneSource(source)
      loadZoneTexture(src, repeat, 512).then((t) => { if (!cancelled) setTex(t) })
    } else {
      setTex(null)
    }
    return () => { cancelled = true }
  }, [source, repeat])

  return (
    <mesh position={position} rotation={rotation} receiveShadow onClick={onClick} castShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial
        map={tex || null}
        color={tex ? '#ffffff' : '#5C3A22'}
        roughness={0.85}
        metalness={0.05}
        emissive={isActive ? '#C49A3C' : '#000000'}
        emissiveIntensity={isActive ? 0.18 : 0}
      />
    </mesh>
  )
}
