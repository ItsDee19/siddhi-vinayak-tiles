import React, { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import SectionHeading from '../ui/SectionHeading'
import CanvasFallback from '../ui/CanvasFallback'
import ErrorBoundary from '../ui/ErrorBoundary'
import { useWebGL } from '../../hooks/useWebGL'
import { useInView } from '../../hooks/useInView'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { visualizerProducts as products } from '../../data/visualizerCatalogue'
import { models } from '../three/models'
import ModelShell from '../three/primitives/ModelShell'
import GLBModel from '../three/GLBModel'
import ModelTabs from '../visualizer/ModelTabs'
import ZonePicker from '../visualizer/ZonePicker'
import ControlBar from '../visualizer/ControlBar'
import MobileDrawer from '../visualizer/MobileDrawer'
import Icon from '../Icons'
import { captureAndDownload } from '../visualizer/ScreenshotHelper'
import { validateImageFile } from '../../utils/imageUpload'

// Internal ErrorBoundary inside Three.js Canvas to catch GLB loading or decoder errors
class GLBErrorBoundary extends Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(err) {
    console.warn('[GLBErrorBoundary] GLB load failed, rendering procedural model fallback:', err)
  }
  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

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
  basinStyle: 'vessel',
  showFaucet: true,
  showVanityLight: true,
  showNosing: true,
  showShower: m?.fixtures?.shower !== false,
  showWC: m?.fixtures?.wc !== false,
})

export default function Visualizer() {
  const webgl = useWebGL()
  const quality = useDeviceTier()
  const [stageRef, stageEntered, stageVisible] = useInView({ rootMargin: '300px' })
  const [activeModelId, setActiveModelId] = useState(models[0].id)
  const [activeZoneId, setActiveZoneId] = useState(models[0].zones[0].id)
  const [presetName, setPresetName] = useState(firstPresetName(models[0]))
  const [resetKey, setResetKey] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [cinematicMode, setCinematicMode] = useState(false)
  const [modelExtras, setModelExtras] = useState(() => defaultModelExtras(models[0]))
  const canvasWrapRef = useRef(null)

  // Preload GLB models only once we know the device can actually render them
  // (and only once this component itself has been lazy-loaded near-viewport —
  // see VisualizerLazy). Only the active model is preloaded eagerly; the
  // rest are prefetched at browser idle time so a phone doesn't fetch all
  // 5 GLBs (1.57 MB) just to show one 657 KB model.
  useEffect(() => {
    if (!webgl) return
    const active = models.find((m) => m.id === activeModelId)
    if (active?.glbUrl) useGLTF.preload(active.glbUrl)

    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300))
    const cancelIdle = window.cancelIdleCallback || clearTimeout
    const handle = idle(() => {
      models.forEach((m) => { if (m.glbUrl) useGLTF.preload(m.glbUrl) })
    })
    return () => cancelIdle(handle)
  }, [webgl, activeModelId])

  const activeModel = useMemo(
    () => models.find((m) => m.id === activeModelId),
    [activeModelId],
  )
  const ModelComp = useMemo(() => getModel(activeModelId), [activeModelId])

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

  // Every blob: URL we mint for a custom upload, so none of them outlive the
  // swatch that referenced it (an un-revoked object URL pins the whole file in
  // memory for the life of the document).
  const objectUrlsRef = useRef(new Set())

  const onCustomUpload = (zoneId, file) => {
    // ZonePicker already validated and reported the error to the user; this is
    // the layer that actually mints the URL, so re-check before doing so.
    if (!validateImageFile(file).ok) return
    const url = URL.createObjectURL(file)
    objectUrlsRef.current.add(url)
    onSwatchPick(zoneId, {
      id: 'custom-' + Date.now(),
      name: file.name,
      url,
      isCustom: true,
    })
  }

  // Release object URLs once no zone points at them any more (swatch replaced,
  // model switched, reset pressed) and on unmount.
  useEffect(() => {
    const inUse = new Set(
      Object.values(zoneTextures)
        .map((t) => t?.url)
        .filter(Boolean),
    )
    objectUrlsRef.current.forEach((url) => {
      if (!inUse.has(url)) {
        URL.revokeObjectURL(url)
        objectUrlsRef.current.delete(url)
      }
    })
  }, [zoneTextures])

  useEffect(() => {
    const urls = objectUrlsRef.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

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

  // Listen for "view-in-3d" events from the Catalogue — route the product to
  // the best model + zone for its surface type (e.g. Countertop → Vanity).
  useEffect(() => {
    const handler = (e) => {
      const product = e.detail
      if (!product) return

      const surface = product.surface
      let bestModel = models[0]
      let bestZone = bestModel.zones[0]

      // Countertop products → Vanity Counter model
      if (surface === 'Countertop') {
        const vanity = models.find((m) => m.id === 'vanity')
        if (vanity) {
          const cz = vanity.zones.find((z) => z.surface === 'Countertop')
          if (cz) { bestModel = vanity; bestZone = cz }
        }
      } else {
        // Find the first model with a zone matching the product's surface
        for (const model of models) {
          const match = model.zones.find(
            (z) => z.surface === surface || z.surface === 'Both' || surface === 'Both',
          )
          if (match) { bestModel = model; bestZone = match; break }
        }
      }

      setActiveModelId(bestModel.id)
      setActiveZoneId(bestZone.id)
      setZoneTextures((z) => ({ ...z, [bestZone.id]: product }))
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
          {/* 3D stage — wrapped in ErrorBoundary so a runtime error
              here doesn't take down the whole app. */}
          <ErrorBoundary>
              <div
                ref={stageRef}
                className="relative aspect-[4/3] min-w-0 overflow-hidden rounded-card border border-white/5 bg-charcoal-800 shadow-card lg:aspect-auto lg:min-h-[540px]"
              >
              {webgl ? (
                stageEntered ? (
                  <div
                      ref={canvasWrapRef}
                      className="h-full w-full"
                    >
                      <ModelShell
                        cameraPresets={activeModel.presets}
                        presetName={presetName}
                        frameloop={stageVisible ? 'always' : 'never'}
                        interactiveAutoRotate={!!activeModel.interactiveAutoRotate}
                        cinematicMode={cinematicMode}
                        quality={quality}
                      >
                        <Suspense key={`${activeModelId}-${resetKey}`} fallback={null}>
                          {activeModel.glbUrl ? (
                            <GLBErrorBoundary
                              fallback={
                                <ModelComp
                                  zoneTextures={zoneTextures}
                                  activeZone={activeZoneId}
                                  onZoneClick={setActiveZoneId}
                                  showShower={modelExtras.showShower}
                                  showWC={modelExtras.showWC}
                                  showNosing={modelExtras.showNosing}
                                  layout={modelExtras.layout}
                                  repeatScale={modelExtras.repeatScale}
                                  groutColor={modelExtras.groutColor}
                                  basinStyle={modelExtras.basinStyle}
                                  showFaucet={modelExtras.showFaucet}
                                  showVanityLight={modelExtras.showVanityLight}
                                />
                              }
                            >
                              <GLBModel
                                glbUrl={activeModel.glbUrl}
                                zones={activeModel.zones}
                                zoneTextures={zoneTextures}
                                activeZone={activeZoneId}
                                onZoneClick={setActiveZoneId}
                                layout={modelExtras.layout}
                                groutEnabled={!!(activeModel.controls || []).includes('groutColor')}
                                modelExtras={modelExtras}
                                tier={quality}
                              />
                            </GLBErrorBoundary>
                          ) : (
                            <ModelComp
                              zoneTextures={zoneTextures}
                              activeZone={activeZoneId}
                              onZoneClick={setActiveZoneId}
                              showShower={modelExtras.showShower}
                              showWC={modelExtras.showWC}
                              showNosing={modelExtras.showNosing}
                              layout={modelExtras.layout}
                              repeatScale={modelExtras.repeatScale}
                              groutColor={modelExtras.groutColor}
                              basinStyle={modelExtras.basinStyle}
                              showFaucet={modelExtras.showFaucet}
                              showVanityLight={modelExtras.showVanityLight}
                            />
                          )}
                        </Suspense>
                      </ModelShell>
                    </div>
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

              {/* controls hint & cinematic tour toggle */}
              {webgl && (
                <div className="absolute left-4 top-4 flex items-center gap-2">
                  <div className="pointer-events-none flex items-center gap-2 rounded-full bg-charcoal/70 px-3 py-1.5 text-[11px] text-sand backdrop-blur">
                    <Icon name="compass" className="h-3.5 w-3.5 text-gold" />
                    Drag to orbit · Scroll to zoom
                  </div>
                  <button
                    onClick={() => setCinematicMode((v) => !v)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider backdrop-blur transition-all ${
                      cinematicMode
                        ? 'bg-gold text-ink ring-2 ring-gold/50 shadow-glow'
                        : 'bg-charcoal/70 text-sand hover:bg-charcoal hover:text-gold'
                    }`}
                  >
                    🎬 {cinematicMode ? 'Orbiting 360°' : 'Cinematic Tour'}
                  </button>
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
          </ErrorBoundary>

          {/* Desktop: side panel — also wrapped to be safe. */}
          <ErrorBoundary>
            <div className="hidden min-w-0 flex-col gap-4 lg:flex">
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
          </ErrorBoundary>
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
