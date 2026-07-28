import React, { useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'

// Calculates centroid positions for active model zones and renders floating 3D pins
export default function ZonePins({
  zones = [],
  activeZoneId,
  zoneTextures = {},
  onActivateZone,
}) {
  const { scene } = useThree()

  // Find 3D centroid positions for each zone by looking up meshes in the scene
  const pinPositions = useMemo(() => {
    const map = {}
    scene.traverse((obj) => {
      if (obj.type !== 'Mesh') return
      const name = obj.name || ''
      const match = name.match(/__([^_]+)$/)
      if (match) {
        const zoneId = match[1]
        if (!map[zoneId]) {
          obj.geometry.computeBoundingBox()
          const bbox = obj.geometry.boundingBox.clone()
          bbox.applyMatrix4(obj.matrixWorld)
          const center = new THREE.Vector3()
          bbox.getCenter(center)
          map[zoneId] = [center.x, center.y + 0.1, center.z + 0.1]
        }
      }
    })

    // Fallbacks if mesh naming isn't present (e.g. procedural fallbacks)
    zones.forEach((z) => {
      if (!map[z.id]) {
        if (z.id === 'lower' || z.id === 'lowerBand') map[z.id] = [0, 1.5, -2.4]
        else if (z.id === 'feature') map[z.id] = [0, 4.0, -2.4]
        else if (z.id === 'upper' || z.id === 'upperBand') map[z.id] = [0, 6.5, -2.4]
        else if (z.id === 'backWall') map[z.id] = [0, 3.5, -0.1]
        else if (z.id === 'counterTop') map[z.id] = [0, 0.1, 0.4]
        else if (z.id === 'frontPanel') map[z.id] = [0, -0.6, 0.7]
        else if (z.id === 'sideReturns') map[z.id] = [-1.4, 0.1, 0.4]
        else if (z.id === 'tread') map[z.id] = [1.2, 1.2, 1.2]
        else if (z.id === 'riser') map[z.id] = [1.2, 0.9, 1.4]
        else if (z.id === 'landing') map[z.id] = [2.6, 2.0, -1.2]
        else if (z.id === 'full') map[z.id] = [0, 5.0, 0]
      }
    })

    return map
  }, [scene, zones])

  return (
    <group>
      {zones.map((zone) => {
        const pos = pinPositions[zone.id]
        if (!pos) return null
        const isActive = activeZoneId === zone.id
        const product = zoneTextures[zone.id]
        const swatchUrl = product?.textureUrl || product?.imageUrl

        return (
          <Html key={zone.id} position={pos} center distanceFactor={15}>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onActivateZone?.(zone.id)
              }}
              className={`group relative flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium shadow-lg transition-all duration-200 ${
                isActive
                  ? 'bg-gold text-ink ring-2 ring-gold/50 scale-105 z-20'
                  : 'bg-charcoal/90 text-sand hover:bg-charcoal border border-white/10 hover:border-gold/50 z-10'
              }`}
            >
              {swatchUrl ? (
                <img
                  src={swatchUrl}
                  alt={zone.label}
                  className="h-4 w-4 rounded-full object-cover border border-white/20"
                />
              ) : (
                <span
                  className="h-3 w-3 rounded-full border border-white/30"
                  style={{ backgroundColor: product?.color || '#888' }}
                />
              )}
              <span className="whitespace-nowrap">{zone.label}</span>
              {isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-ink animate-ping" />
              )}
            </button>
          </Html>
        )
      })}
    </group>
  )
}
