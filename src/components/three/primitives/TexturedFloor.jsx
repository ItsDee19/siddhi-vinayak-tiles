import { useEffect, useState } from 'react'
import { loadZoneTexture, resolveZoneSource } from '../../../utils/threeTextures'

export default function TexturedFloor({
  size = [8, 5],
  position = [0, 0, 0],
  rotation = [-Math.PI / 2, 0, 0],
  source,            // swatch or { url } or catalogue product
  repeat = 4,
  onClick,
  isActive = false,
}) {
  const [tex, setTex] = useState(null)
  useEffect(() => {
    let cancelled = false
    if (source) {
      const src = resolveZoneSource(source)
      loadZoneTexture(src, repeat, 1024).then((t) => { if (!cancelled) setTex(t) })
    } else {
      setTex(null)
    }
    return () => { cancelled = true }
  }, [source, repeat])

  return (
    <mesh
      position={position}
      rotation={rotation}
      receiveShadow
      onClick={onClick}
    >
      <planeGeometry args={size} />
      <meshStandardMaterial
        map={tex || null}
        color={tex ? '#ffffff' : '#5C3A22'}
        roughness={0.55}
        metalness={0.05}
        emissive={isActive ? '#C49A3C' : '#000000'}
        emissiveIntensity={isActive ? 0.18 : 0}
      />
    </mesh>
  )
}
