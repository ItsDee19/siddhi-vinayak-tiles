import { createBathroom } from './bathroom.js'
import { createFeatureWall } from './featureWall.js'
import { createVanity } from './vanity.js'
import { createStairHall } from './stairs.js'

export const roomFactories = {
  'bathroom-s': () => createBathroom({ widthFeet: 8, depthFeet: 5, bandsFeet: [3, 2, 3] }),
  'bathroom-l': () => createBathroom({ widthFeet: 10, depthFeet: 10, bandsFeet: [2, 4, 2] }),
  stairs: createStairHall,
  'feature-wall': createFeatureWall,
  vanity: createVanity,
}
