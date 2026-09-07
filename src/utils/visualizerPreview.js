import { tileEntry } from '../data/visualizerTiles'
import { createVisualizerSelectionBridge, isPreviewableTile } from './visualizerSelection'

export const canPreviewProduct = (product) => isPreviewableTile(product, tileEntry(product))

const selection = createVisualizerSelectionBridge(canPreviewProduct)
export const publishVisualizerSelection = (product) => selection.publish(product)
export const subscribeVisualizerSelection = (listener) => selection.subscribe(listener)
