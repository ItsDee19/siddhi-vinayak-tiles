import test from 'node:test'
import assert from 'node:assert/strict'
import { createVisualizerSelectionBridge, isPreviewableTile } from './visualizerSelection.js'

const tile = (id, surface = 'Floor') => ({ id, surface, textureUrl: `/tiles/${id}.webp` })

test('only real tile faces for supported floor or wall surfaces have a preview', () => {
  for (const surface of ['Floor', 'Wall', 'Both', 'Wall & Floor', 'Floor & Wall']) {
    assert.equal(isPreviewableTile(tile(surface, surface), { desktop: '/processed.webp' }), true, surface)
  }
  assert.equal(isPreviewableTile(tile('counter', 'Countertop'), { desktop: '/processed.webp' }), false)
  assert.equal(isPreviewableTile(tile('rejected-crop'), null), false)
  assert.equal(isPreviewableTile({ surface: 'Floor' }, {}), false)
  assert.equal(isPreviewableTile(null, null), false)
})

test('a catalogue choice made before the lazy visualizer mounts is delivered exactly once', () => {
  const bridge = createVisualizerSelectionBridge(product => !!product?.textureUrl)
  const product = tile('marble')
  assert.equal(bridge.publish(product), true)
  const received = []
  const unsubscribe = bridge.subscribe(value => received.push(value))
  assert.deepEqual(received, [product])
  unsubscribe()
  bridge.subscribe(value => received.push(value))
  assert.deepEqual(received, [product], 'Strict Mode resubscription cannot replay a consumed choice')
})

test('the latest pending tile wins, while an invalid selection cannot replace it', () => {
  const bridge = createVisualizerSelectionBridge(product => !!product?.textureUrl)
  bridge.publish(tile('first'))
  const last = tile('last')
  bridge.publish(last)
  assert.equal(bridge.publish({ id: 'unsupported' }), false)
  const received = []
  bridge.subscribe(value => received.push(value))
  assert.deepEqual(received, [last])
})

test('mounted rooms receive a choice immediately, and remounts receive only later pending choices', () => {
  const bridge = createVisualizerSelectionBridge(product => !!product?.textureUrl)
  const received = []
  const unsubscribe = bridge.subscribe(value => received.push(value.id))
  bridge.publish(tile('live'))
  assert.deepEqual(received, ['live'])
  unsubscribe()
  bridge.publish(tile('while-unmounted'))
  assert.deepEqual(received, ['live'])
  bridge.subscribe(value => received.push(value.id))
  assert.deepEqual(received, ['live', 'while-unmounted'])
})
