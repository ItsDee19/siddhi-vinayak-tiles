import { AnimatePresence, motion } from 'framer-motion'
import Icon from '../Icons'
import ModelTabs from './ModelTabs'
import ZonePicker from './ZonePicker'
import ControlBar from './ControlBar'

// Mobile bottom-sheet drawer — replaces the desktop side panel on small screens.
// Slides up from the bottom with a drag handle. Backdrop click closes.

export default function MobileDrawer({
  open,
  onClose,
  models,
  activeModelId,
  onModelChange,
  activeZoneId,
  onActivateZone,
  zoneTextures,
  onSwatchPick,
  onCustomUpload,
  onReset,
  onScreenshot,
  modelName,
  cameraPresets,
  activePreset,
  onPresetChange,
  modelControls,
  modelExtras,
  onModelExtrasChange,
}) {
  const activeModel = models.find((m) => m.id === activeModelId)
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-charcoal/60 backdrop-blur-sm lg:hidden"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-card border-t border-gold/30 bg-charcoal-800 p-5 shadow-card lg:hidden"
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-gold/40" />
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-cream">Customize</h3>
              <button
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-cream"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4">
              <ModelTabs active={activeModelId} onChange={onModelChange} />
            </div>
            <div className="mt-4 space-y-3">
              {activeModel?.zones.map((z) => (
                <ZonePicker
                  key={z.id}
                  zone={z}
                  activeZoneId={activeZoneId}
                  zoneTextures={zoneTextures}
                  onSwatchPick={onSwatchPick}
                  onActivateZone={onActivateZone}
                  onCustomUpload={onCustomUpload}
                />
              ))}
            </div>
            <div className="mt-5 border-t border-white/5 pt-4">
              <ControlBar
                onReset={onReset}
                onScreenshot={onScreenshot}
                zoneTextures={zoneTextures}
                modelName={modelName}
                cameraPresets={cameraPresets}
                activePreset={activePreset}
                onPresetChange={onPresetChange}
                modelControls={modelControls}
                modelExtras={modelExtras}
                onModelExtrasChange={onModelExtrasChange}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
