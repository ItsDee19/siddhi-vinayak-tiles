import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import SectionHeading from '../ui/SectionHeading'
import CanvasFallback from '../ui/CanvasFallback'
import { useWebGL } from '../../hooks/useWebGL'
import { useInView } from '../../hooks/useInView'
import { products } from '../../data/catalogue'
import { models } from '../three/models'
import ModelTabs from '../visualizer/ModelTabs'
import ZonePicker from '../visualizer/ZonePicker'
import ControlBar from '../visualizer/ControlBar'
import MobileDrawer from '../visualizer/MobileDrawer'
import Icon from '../Icons'
import { captureAndDownload } from '../visualizer/ScreenshotHelper'

// Lazy model components keyed by id
const modelCache = {}
function getModel(id) {
  if (!modelCache[id]) {
    const m = models.find((x) => x.id === id)
    if (m) modelCache[id] = lazy(m.load)
  }
  return modelCache[id]
}

// Pick a starter product per zone's surface (Floor / Wall / Countertop / Both).
const defaultZoneTextures = (zones) => {
  const out = {}
  zones.forEach((z) => {
    const candidate = products.find(
      (p) => p.surface === z.surface || p.surface === 'Both',
    )
    if (candidate) out[z.id] = candidate
  })
  return out
}

const firstPresetName = (m) =>
  m?.presets ? Object.keys(m.presets)[0] : 'default'

// Default values for model-specific extras (layout / repeatScale / groutColor / etc.)
const defaultModelExtras = (m) => ({
  layout: 'full',
  repeatScale: 1,
  groutColor: '#cfc6b4',
  basinStyle: 'rect',
  showFaucet: true,
  showVanityLight: true,
  showNosing: true,
  showShower: m?.fixtures?.shower !== false,
  showWC: m?.fixtures?.wc !== false,
})

export default function Visualizer() {
  const webgl = useWebGL()
  const [stageRef, stageEntered, stageVisible] = useInView({ rootMargin: '300px' })
  const [activeModelId, setActiveModelId] = useState(models[0].id)
  const [activeZoneId, setActiveZoneId] = useState(models[0].zones[0].id)
  const [presetName, setPresetName] = useState(firstPresetName(models[0]))
  const [resetKey, setResetKey] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [modelExtras, setModelExtras] = useState(() => defaultModelExtras(models[0]))
  const canvasWrapRef = useRef(null)

  const activeModel = useMemo(
    () => models.find((m) => m.id === activeModelId),
    [activeModelId],
  )
  const ModelComp = getModel(activeModelId)

  // Initialize / reset zone textures and preset when the model changes
  const [zoneTextures, setZoneTextures] = useState(() =>
    defaultZoneTextures(models[0].zones),
  )
  useEffect(() => {
    setZoneTextures(defaultZoneTextures(activeModel.zones))
    setActiveZoneId(activeModel.zones[0].id)
    setPresetName(firstPresetName(activeModel))
    setModelExtras(defaultModelExtras(activeModel))
  }, [activeModelId]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSwatchPick = (zoneId, swatch) => {
    setZoneTextures((z) => ({ ...z, [zoneId]: swatch }))
  }
  const onCustomUpload = (zoneId, file) => {
    const url = URL.createObjectURL(file)
    onSwatchPick(zoneId, {
      id: 'custom-' + Date.now(),
      name: file.name,
      url,
      isCustom: true,
    })
  }
  const onReset = () => {
    setZoneTextures(defaultZoneTextures(activeModel.zones))
    setActiveZoneId(activeModel.zones[0].id)
    setPresetName(firstPresetName(activeModel))
    setModelExtras(defaultModelExtras(activeModel))
    setResetKey((k) => k + 1)
  }
  const onScreenshot = async () => {
    const canvas = canvasWrapRef.current?.querySelector('canvas')
    if (canvas) await captureAndDownload(canvas)
  }

  // Listen for "view-in-3d" events from the Catalogue
  useEffect(() => {
    const handler = (e) => {
      const product = e.detail
      if (!product) return
      setActiveModelId(models[0].id)
      setZoneTextures((z) => ({ ...z, [models[0].zones[0].id]: product }))
    }
    window.addEventListener('view-in-3d', handler)
    return () => window.removeEventListener('view-in-3d', handler)
  }, [])

  return (
    <section id="visualizer" className="section-pad relative bg-charcoal">
      <div className="container-px">
        <SectionHeading
          eyebrow="See It Before You Buy"
          title="Interactive Tile Visualizer"
          subtitle="Pick a model, then assign tiles to each surface zone. Drag to orbit, scroll to zoom — preview the look before you visit."
        />

        <div className="mt-10 lg:hidden">
          <ModelTabs active={activeModelId} onChange={setActiveModelId} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* 3D stage */}
          <div
            ref={stageRef}
            className="relative aspect-[4/3] overflow-hidden rounded-card border border-white/5 bg-charcoal-800 shadow-card lg:aspect-auto lg:min-h-[540px]"
          >
            {webgl ? (
              stageEntered ? (
                <Suspense
                  fallback={
                    <div className="flex h-full w-full items-center justify-center text-sand/60">
                      <span className="animate-pulse">Loading 3D scene…</span>
                    </div>
                  }
                >
                  <div
                    ref={canvasWrapRef}
                    key={`${activeModelId}-${resetKey}`}
                    className="h-full w-full"
                  >
                    <ModelComp
                      zoneTextures={zoneTextures}
                      activeZone={activeZoneId}
                      onZoneClick={setActiveZoneId}
                      frameloop={stageVisible ? 'always' : 'never'}
                      presetName={presetName}
                      cameraPresets={activeModel.presets}
                      interactiveAutoRotate={activeModel.interactiveAutoRotate}
                      showShower={activeModel.fixtures?.shower !== false}
                      showWC={activeModel.fixtures?.wc !== false}
                      showNosing={modelExtras.showNosing}
                      layout={modelExtras.layout}
                      repeatScale={modelExtras.repeatScale}
                      groutColor={modelExtras.groutColor}
                      basinStyle={modelExtras.basinStyle}
                      showFaucet={modelExtras.showFaucet}
                      showVanityLight={modelExtras.showVanityLight}
                    />
                  </div>
                </Suspense>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sand/50">
                  <span className="animate-pulse">Preparing 3D…</span>
                </div>
              )
            ) : (
              <div className="relative h-full w-full p-4">
                <CanvasFallback
                  swatchList={Object.values(zoneTextures).filter(Boolean).slice(0, 6)}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal to-transparent p-4 text-center text-xs text-sand/70">
                  3D preview unavailable on this device — showing material samples
                </div>
              </div>
            )}

            {/* controls hint */}
            {webgl && (
              <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-full bg-charcoal/70 px-3 py-1.5 text-[11px] text-sand backdrop-blur">
                <Icon name="compass" className="h-3.5 w-3.5 text-gold" />
                Drag to orbit · Scroll to zoom
              </div>
            )}

            {/* Mobile: open drawer button */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-btn bg-gold px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-ink shadow-glow lg:hidden"
            >
              <Icon name="grid" className="h-4 w-4" /> Customize
            </button>
          </div>

          {/* Desktop: side panel */}
          <div className="hidden flex-col gap-4 lg:flex">
            <ModelTabs active={activeModelId} onChange={setActiveModelId} />
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {activeModel.zones.map((z) => (
                <ZonePicker
                  key={z.id}
                  zone={z}
                  activeZoneId={activeZoneId}
                  zoneTextures={zoneTextures}
                  onSwatchPick={onSwatchPick}
                  onActivateZone={setActiveZoneId}
                  onCustomUpload={onCustomUpload}
                />
              ))}
            </div>
            <ControlBar
              onReset={onReset}
              onScreenshot={onScreenshot}
              zoneTextures={zoneTextures}
              modelName={activeModel.name}
              cameraPresets={activeModel.presets}
              activePreset={presetName}
              onPresetChange={setPresetName}
              modelControls={activeModel.controls}
              modelExtras={modelExtras}
              onModelExtrasChange={setModelExtras}
            />
          </div>
        </div>
      </div>

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        models={models}
        activeModelId={activeModelId}
        onModelChange={setActiveModelId}
        activeZoneId={activeZoneId}
        onActivateZone={setActiveZoneId}
        zoneTextures={zoneTextures}
        onSwatchPick={onSwatchPick}
        onCustomUpload={onCustomUpload}
        onReset={onReset}
        onScreenshot={onScreenshot}
        modelName={activeModel.name}
        cameraPresets={activeModel.presets}
        activePreset={presetName}
        onPresetChange={setPresetName}
        modelControls={activeModel.controls}
        modelExtras={modelExtras}
        onModelExtrasChange={setModelExtras}
      />
    </section>
  )
}
