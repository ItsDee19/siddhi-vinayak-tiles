import { tileEntry } from '../data/visualizerTiles'
import { createVisualizerSelectionBridge, isPreviewableTile } from './visualizerSelection'
import { getBasinProduct } from '../data/basinCatalogue'

export const canPreviewProduct = (product) => !!getBasinProduct(product?.id) || isPreviewableTile(product, tileEntry(product))

const selection = createVisualizerSelectionBridge(canPreviewProduct)
export const publishVisualizerSelection = (product) => selection.publish(product)
export const subscribeVisualizerSelection = (listener) => selection.subscribe(listener)
