import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import SectionHeading from '../ui/SectionHeading'
import CanvasFallback from '../ui/CanvasFallback'
import ErrorBoundary from '../ui/ErrorBoundary'
import { useWebGL } from '../../hooks/useWebGL'
import { useInView } from '../../hooks/useInView'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { visualizerProducts as products } from '../../data/visualizerCatalogue'
import { models } from '../three/models'
import ModelShell from '../three/primitives/ModelShell'
import RoomModel from '../three/RoomModel'
import ModelTabs from '../visualizer/ModelTabs'
import SurfaceLibrary from '../visualizer/SurfaceLibrary'
import Icon from '../Icons'
import { captureAndDownload } from '../visualizer/ScreenshotHelper'
import { validateImageFile } from '../../utils/imageUpload'
import { surfaceMatches } from '../../utils/surfaces'
import { business } from '../../data/siteConfig'
import { publishVisualizerSelection, subscribeVisualizerSelection } from '../../utils/visualizerPreview'
import { releaseCustomTexture } from '../../utils/threeTextures'
import { usePageVisible } from '../../hooks/usePageVisible'

const starters = { wall: 'sky12x18-c019', feature: 'sky12x18-p019-t3', floor: 'gt-floor-c011' }
function defaultTiles(model) {
  return Object.fromEntries(model.zones.map(zone => {
    const role = zone.defaultTileRole || (zone.surface === 'Floor' ? 'floor' : zone.id === 'feature' ? 'feature' : 'wall')
    const matching = products.filter(product => product.textureUrl && surfaceMatches(product.surface, zone.surface))
    return [zone.id, matching.find(product => product.id === starters[role]) || matching[0]]
  }))
}
const grouts = [
  { name: 'Warm white', color: '#e8e2d5' },
  { name: 'Light grey', color: '#b5b1aa' },
  { name: 'Graphite', color: '#595753' },
]

export default function Visualizer() {
  const pageVisible = usePageVisible()
  const webgl = useWebGL()
  const quality = useDeviceTier()
  const [stageRef, stageEntered, stageVisible] = useInView({ rootMargin: '300px' })
  const [activeModelId, setActiveModelId] = useState(models[0].id)
  const [activeZoneId, setActiveZoneId] = useState(models[0].zones[0].id)
  const [presetName, setPresetName] = useState('default')
  const [cameraResetKey, setCameraResetKey] = useState(0)
  const [designs, setDesigns] = useState(() => Object.fromEntries(models.map(model => [model.id, defaultTiles(model)])))
  const [roomGrouts, setRoomGrouts] = useState({})
  const groutColor = roomGrouts[activeModelId] || grouts[0].color
  const setGroutColor = color => setRoomGrouts(current => ({ ...current, [activeModelId]: color }))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [materialStatus, setMaterialStatus] = useState({ key: null, phase: 'loading', error: '' })
  const objectUrls = useRef(new Set())
  const canvasWrapRef = useRef(null)
  const activeModel = models.find(model => model.id === activeModelId)
  const zoneTextures = designs[activeModelId]
  const activeZone = activeModel.zones.find(zone => zone.id === activeZoneId) || activeModel.zones[0]
  const materialKey = JSON.stringify([activeModelId, quality, groutColor, ...activeModel.zones.map(zone => [zone.id, zoneTextures[zone.id]?.id, zoneTextures[zone.id]?.url])])
  const materialsReady = materialStatus.key === materialKey && materialStatus.phase === 'ready'
  const materialError = materialStatus.key === materialKey ? materialStatus.error : ''

  const onModelChange = useCallback((id, selection) => {
    const model = models.find(item => item.id === id)
    if (!model) return
    setActiveModelId(id)
    setActiveZoneId(selection?.zoneId || model.zones[0].id)
    setPresetName('default')
    setCameraResetKey(key => key + 1)
    if (selection) setDesigns(current => ({ ...current, [id]: { ...current[id], [selection.zoneId]: selection.product } }))
  }, [])
  const onSwatchPick = (zoneId, product) => {
    setMaterialStatus({ key: null, phase: 'loading', error: '' })
    setDesigns(current => ({ ...current, [activeModelId]: { ...current[activeModelId], [zoneId]: product } }))
  }
  const onCustomUpload = (zoneId, file) => {
    if (!validateImageFile(file).ok) return
    const url = URL.createObjectURL(file)
    objectUrls.current.add(url)
    onSwatchPick(zoneId, { id: 'custom-' + Date.now(), name: file.name, url, isCustom: true })
  }
  useEffect(() => {
    const inUse = new Set(Object.values(designs).flatMap(zones => Object.values(zones).map(tile => tile?.url)))
    objectUrls.current.forEach(url => {
      if (!inUse.has(url)) { releaseCustomTexture(url); URL.revokeObjectURL(url); objectUrls.current.delete(url) }
    })
  }, [designs])
  useEffect(() => {
    const urls = objectUrls.current
    return () => { urls.forEach(url => { releaseCustomTexture(url); URL.revokeObjectURL(url) }); urls.clear() }
  }, [])
  useEffect(() => {
    const handler = product => {
      // Prefer the current room when it already has a compatible surface.
      const ordered = [activeModel, ...models.filter(model => model !== activeModel)]
      const model = ordered.find(item => item.zones.some(zone => surfaceMatches(product.surface, zone.surface)))
      const zone = model?.zones.find(item => surfaceMatches(product.surface, item.surface))
      if (zone) onModelChange(model.id, { zoneId: zone.id, product })
    }
    const unsubscribe = subscribeVisualizerSelection(handler)
    // Keep the existing DOM event usable by integrations after mount; it
    // passes through exactly the same eligibility gate as the catalogue.
    const legacyHandler = event => publishVisualizerSelection(event.detail)
    window.addEventListener('view-in-3d', legacyHandler)
    return () => {
      unsubscribe()
      window.removeEventListener('view-in-3d', legacyHandler)
    }
  }, [activeModel, onModelChange])

  const onPresetChange = name => { setPresetName(name); setCameraResetKey(key => key + 1) }
  const onReset = () => {
    setMaterialStatus({ key: null, phase: 'loading', error: '' })
    setDesigns(current => ({ ...current, [activeModelId]: defaultTiles(activeModel) }))
    setGroutColor(grouts[0].color)
    onPresetChange('default')
  }
  const onScreenshot = async () => {
    if (!materialsReady) { setSaveError('Wait for your selected tiles to finish loading before saving.'); return }
    setSaving(true); setSaveError('')
    try {
      const canvas = canvasWrapRef.current?.querySelector('canvas')
      if (!canvas) throw new Error('Preview is still preparing. Please try again.')
      await captureAndDownload(canvas, { roomName: activeModel.name, selections: activeModel.zones.map(zone => `${zone.label}: ${zoneTextures[zone.id]?.name || 'Custom tile'}`) })
    } catch (error) { setSaveError(error.message || 'Could not save this preview. Please try again.') }
    finally { setSaving(false) }
  }
  const summary = activeModel.zones.map(zone => `${zone.label}: ${zoneTextures[zone.id]?.name || 'Unselected'}`).join('; ')
  const waHref = `${business.whatsapp}?text=${encodeURIComponent(`Hi! I designed a ${activeModel.name} in your tile visualizer. ${summary}. Can we discuss these in-store?`)}`

  return (
    <section id="visualizer" className="section-pad relative bg-charcoal">
      <div className="container-px">
        <SectionHeading eyebrow="See It Before You Buy" title="Your tiles. A real sense of home."
          subtitle="Explore five spaces, choose a surface, and see how your favourite tiles work at room scale." />
        <div className="mt-8"><ModelTabs active={activeModelId} onChange={onModelChange} /></div>
        <div className="mt-4 flex items-center justify-between gap-4 text-xs text-sand/70">
          <p>{activeModel.blurb}</p><span className="shrink-0 tabular-nums">{activeModel.dimensions}</span>
        </div>
        <div className="mt-4 flex flex-col items-start gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_310px] xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="sticky top-20 z-10 w-full overflow-hidden rounded-card border border-white/10 bg-charcoal-800 shadow-card lg:static">
            <ErrorBoundary>
              <div ref={stageRef} className="relative h-[min(310px,34svh)] min-h-[210px] sm:h-[440px] lg:h-[536px]">
                {webgl && stageEntered ? (
                  <div ref={canvasWrapRef} className="h-full w-full">
                    <ModelShell roomId={activeModelId} cameraPresets={activeModel.presets} presetName={presetName} cameraResetKey={cameraResetKey}
                      frameloop={stageVisible && pageVisible ? 'always' : 'never'} quality={quality}>
                      <Suspense fallback={null}>
                        <RoomModel roomId={activeModelId} zones={activeModel.zones} zoneTextures={zoneTextures}
                          onZoneClick={setActiveZoneId} modelExtras={{ groutColor }} tier={quality}
                          materialKey={materialKey} onMaterialStatus={setMaterialStatus} />
                      </Suspense>
                    </ModelShell>
                  </div>
                ) : webgl ? (
                  <div className="flex h-full items-center justify-center text-sm text-sand/70">Preparing your room…</div>
                ) : (
                  <div className="h-full p-4"><CanvasFallback swatchList={Object.values(zoneTextures).filter(Boolean)} />
                    <p className="absolute inset-x-4 bottom-4 text-center text-xs text-sand">3D is unavailable on this device. You can still browse tile samples.</p>
                  </div>
                )}
                <div className="pointer-events-none absolute left-3 top-3 rounded-btn bg-cream/95 px-3 py-2 text-[11px] font-medium text-ink shadow-sm">
                  {activeModel.name} <span className="mx-1 text-ink/40">/</span> {activeZone.label}
                </div>
                <button type="button" onClick={() => onPresetChange('default')} aria-label="Reset room view"
                  className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-btn bg-cream/95 text-ink shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">
                  <Icon name="compass" className="h-4 w-4" />
                </button>
              </div>
            </ErrorBoundary>
            <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 px-3 py-2.5">
              <div role="group" aria-label="Camera views" className="flex gap-1">
                {Object.entries(activeModel.presets).map(([name, preset]) => (
                  <button key={name} type="button" aria-pressed={presetName === name} onClick={() => onPresetChange(name)}
                    className={`min-h-10 rounded-btn px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${presetName === name ? 'bg-gold/20 text-gold' : 'text-sand/80 hover:bg-white/10'}`}>
                    {preset.label}
                  </button>
                ))}
              </div>
              <span className="hidden text-[10px] text-sand/65 sm:block">Drag to look · 150° · Pinch or scroll to zoom</span>
            </div>
          </div>
          <aside aria-label="Choose room tiles" className="flex h-[530px] min-h-0 w-full flex-col rounded-card border border-white/10 bg-charcoal-800 lg:h-[600px]">
            <SurfaceLibrary key={`${activeModelId}-${activeZoneId}`} zones={activeModel.zones} activeZoneId={activeZoneId}
              surfaceNote={activeModel.surfaceNote}
              zoneTextures={zoneTextures} onActivateZone={setActiveZoneId} onSwatchPick={onSwatchPick} onCustomUpload={onCustomUpload} />
          </aside>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-card border border-white/5 px-4 py-3">
          <div className="flex items-center gap-3" role="group" aria-label="Grout colour">
            <span className="text-xs text-sand/75">Grout</span>
            {grouts.map(grout => <button key={grout.color} type="button" onClick={() => setGroutColor(grout.color)}
              aria-label={`${grout.name} grout`} aria-pressed={groutColor === grout.color} title={grout.name}
              className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${groutColor === grout.color ? 'border-gold' : 'border-transparent hover:border-white/30'}`}>
              <span className="h-6 w-6 rounded-full border border-white/20" style={{ backgroundColor: grout.color }} />
            </button>)}
            <span className="text-[10px] text-sand/60">2 mm joints</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onReset} className="btn-outline min-h-11 px-3 py-2 text-xs">Reset tiles</button>
            <button onClick={onScreenshot} disabled={saving || !webgl || !materialsReady} className="btn-outline min-h-11 px-4 py-2 text-xs">{saving ? 'Saving…' : !materialsReady && webgl && !materialError ? 'Loading tiles…' : 'Save room'}</button>
            <a href={waHref} target="_blank" rel="noreferrer" className="btn-gold min-h-11 px-4 py-2 text-xs"><Icon name="whatsapp" className="h-4 w-4" filled /> Ask about these tiles</a>
          </div>
        </div>
        {saveError && <p role="alert" className="mt-2 text-sm text-terracotta">{saveError}</p>}
        {materialError && <p role="alert" className="mt-2 text-sm text-[#ffc2a8]">{materialError}</p>}
        <p className="mt-3 text-xs leading-relaxed text-sand/80">{activeModel.selectionHint}</p>
        <p className="mt-1 text-xs leading-relaxed text-sand/60">Drag to look around within 150°. Room dimensions and tile spacing help you judge the pattern; colour and sheen can vary with your screen and lighting.</p>
      </div>
    </section>
  )
}
