import Icon from '../Icons'
import { useState } from 'react'
import { business } from '../../data/siteConfig'

// Reset Camera / Save Preview (screenshot PNG) / Ask on WhatsApp.
// Also renders camera-preset buttons when `cameraPresets` has more than the default.

export default function ControlBar({
  onReset,
  onScreenshot,
  zoneTextures,
  modelName,
  cameraPresets,
  activePreset,
  onPresetChange,
}) {
  const [busy, setBusy] = useState(false)
  const onShot = async () => {
    setBusy(true)
    try { await onScreenshot() } finally { setBusy(false) }
  }
  const summary = Object.entries(zoneTextures)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v.name}`)
    .join(' · ')
  const waHref = `${business.whatsapp}?text=${encodeURIComponent(
    `Hi! I tried a ${modelName} preview in your Visualizer. ${summary}. Can we discuss these in-store?`,
  )}`

  const presetEntries = cameraPresets ? Object.entries(cameraPresets) : []
  const hasMultiplePresets = presetEntries.length > 1

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasMultiplePresets && (
        <div className="flex flex-wrap gap-1">
          {presetEntries.map(([name, _]) => (
            <button
              key={name}
              onClick={() => onPresetChange?.(name)}
              className={`rounded-btn px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                activePreset === name
                  ? 'bg-gold/20 text-gold'
                  : 'bg-white/5 text-sand/70 hover:bg-white/10'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <button onClick={onReset} className="btn-outline px-4 py-2 text-xs">
        <Icon name="compass" className="h-4 w-4" /> Reset
      </button>
      <button onClick={onShot} disabled={busy} className="btn-outline px-4 py-2 text-xs">
        <Icon name="search" className="h-4 w-4" /> {busy ? 'Saving…' : 'Save Preview'}
      </button>
      <a href={waHref} target="_blank" rel="noreferrer" className="btn-gold px-4 py-2 text-xs">
        <Icon name="whatsapp" className="h-4 w-4" filled /> Ask on WhatsApp
      </a>
    </div>
  )
}
