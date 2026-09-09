import assert from 'node:assert/strict'
import test from 'node:test'
import { getFinish } from './finishMaterial.js'

test('smooth printed finishes never turn photograph colours into raised geometry', () => {
  for (const finish of ['Polished', 'Glossy', 'Satin', 'matt', 'Matte', 'Matt / Glossy']) {
    const response = getFinish(finish)
    assert.equal(response.normalScale, 0, `${finish}: printed veins must stay flat`)
    assert.equal(response.metalness, 0, `${finish}: tile colour must not tint metallic reflections`)
  }
  assert.ok(getFinish('Rough').roughness > getFinish('Glossy').roughness)
})
