import Icon from '../Icons'
import { useState } from 'react'
import { business } from '../../data/siteConfig'

// Reset Camera / Save Preview (screenshot PNG) / Ask on WhatsApp.
// Also renders camera-preset buttons when ≥2 presets exist.
// Also renders model-specific controls (PRD §4.5 / §4.6) when `modelControls` is set:
//   - 'layout'      : Full / Bands / Grid radio
//   - 'repeatScale' : 0.5x–2x slider (simulates tile size)
//   - 'groutColor'  : 4 preset grout colors
//   - 'basinStyle'  : round / rect / vessel
//   - 'showFaucet'  : checkbox
//   - 'showVanityLight' : checkbox
//   - 'showNosing'  : checkbox (Model C)

const GROUT_PRESETS = [
  { name: 'None',      value: 'none' },
  { name: 'White',     value: '#ffffff' },
  { name: 'Off-white', value: '#e8e2d5' },
  { name: 'Light grey', value: '#9a9488' },
  { name: 'Dark grey', value: '#3a3633' },
]

export default function ControlBar({
  onReset,
  onScreenshot,
  zoneTextures,
  modelName,
  cameraPresets,
  activePreset,
  onPresetChange,
  modelControls,
  modelExtras,
  onModelExtrasChange,
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
  const controls = modelControls || []

  const setExtra = (k, v) => onModelExtrasChange?.({ ...modelExtras, [k]: v })

  return (
    <div className="space-y-3">
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

      {/* Model-specific controls */}
      {controls.includes('layout') && (
        <div>
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-sand/60">
            Layout
          </span>
          <div className="flex gap-1">
            {['full', 'bands', 'grid'].map((l) => (
              <button
                key={l}
                onClick={() => setExtra('layout', l)}
                className={`flex-1 rounded-btn px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  (modelExtras?.layout || 'full') === l
                    ? 'bg-gold/20 text-gold'
                    : 'bg-white/5 text-sand/70 hover:bg-white/10'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      {controls.includes('repeatScale') && (
        <div>
          <label className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-sand/60">
            <span>Tile size</span>
            <span className="text-gold">
              {Math.round((modelExtras?.repeatScale ?? 1) * 600)}mm
            </span>
          </label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={modelExtras?.repeatScale ?? 1}
            onChange={(e) => setExtra('repeatScale', parseFloat(e.target.value))}
            className="w-full accent-[#C49A3C]"
          />
          <div className="mt-1 flex justify-between text-[9px] text-sand/50">
            <span>1200mm</span><span>600mm</span><span>300mm</span>
          </div>
        </div>
      )}

      {controls.includes('groutColor') && (
        <div>
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-sand/60">
            Grout
          </span>
          <div className="flex gap-1.5">
            {GROUT_PRESETS.map((g) => {
              const active = (modelExtras?.groutColor || '#cfc6b4') === g.value
              const isNone = g.value === 'none'
              return (
                <button
                  key={g.value}
                  onClick={() => setExtra('groutColor', g.value)}
                  title={g.name}
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[9px] font-semibold uppercase transition-all ${
                    active
                      ? 'border-gold scale-110 text-gold'
                      : 'border-white/15 text-sand/60 hover:border-sand/50'
                  } ${isNone ? 'bg-transparent' : ''}`}
                  style={isNone ? undefined : { background: g.value }}
                >
                  {isNone ? '∅' : ''}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {controls.includes('basinStyle') && (
        <div>
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-sand/60">
            Basin style
          </span>
          <div className="flex gap-1">
            {['round', 'rect', 'vessel'].map((s) => (
              <button
                key={s}
                onClick={() => setExtra('basinStyle', s)}
                className={`flex-1 rounded-btn px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all ${
                  (modelExtras?.basinStyle || 'rect') === s
                    ? 'bg-gold/20 text-gold'
                    : 'bg-white/5 text-sand/70 hover:bg-white/10'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {controls.includes('showFaucet') && (
        <CheckRow
          label="Faucet"
          checked={modelExtras?.showFaucet ?? true}
          onChange={(v) => setExtra('showFaucet', v)}
        />
      )}

      {controls.includes('showVanityLight') && (
        <CheckRow
          label="Vanity light"
          checked={modelExtras?.showVanityLight ?? true}
          onChange={(v) => setExtra('showVanityLight', v)}
        />
      )}

      {controls.includes('showNosing') && (
        <CheckRow
          label="Nosing edge"
          checked={modelExtras?.showNosing ?? true}
          onChange={(v) => setExtra('showNosing', v)}
        />
      )}

      {controls.includes('showShower') && (
        <CheckRow
          label="Shower fixture"
          checked={modelExtras?.showShower ?? true}
          onChange={(v) => setExtra('showShower', v)}
        />
      )}

      {controls.includes('showWC') && (
        <CheckRow
          label="WC fixture"
          checked={modelExtras?.showWC ?? true}
          onChange={(v) => setExtra('showWC', v)}
        />
      )}

      {/* Standard controls */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
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
    </div>
  )
}

function CheckRow({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-btn bg-white/[0.03] px-3 py-2">
      <span className="text-xs text-sand/80">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[#C49A3C]"
      />
    </label>
  )
}
