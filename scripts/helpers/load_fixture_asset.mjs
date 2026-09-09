import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { BufferAttribute, BufferGeometry } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const decoderUrl = new URL('../../public/draco/draco_wasm_wrapper.js', import.meta.url)
const wasmUrl = new URL('../../public/draco/draco_decoder.wasm', import.meta.url)

// The production decoder runs in a browser Worker. This adapter runs the same
// checked-in WASM in Node so tests inspect the shipped Draco geometry, rather
// than an uncompressed surrogate or only the export's JSON bounds.
async function createNodeDecoder() {
  const [wrapper, wasmBinary] = await Promise.all([readFile(decoderUrl, 'utf8'), readFile(wasmUrl)])
  const context = {
    module: { exports: {} }, exports: {},
    require: createRequire(import.meta.url), __dirname: dirname(fileURLToPath(decoderUrl)),
    process, Buffer, console, setTimeout, clearTimeout, WebAssembly,
  }
  vm.runInNewContext(wrapper, context, { filename: fileURLToPath(decoderUrl) })
  const draco = await context.module.exports({ wasmBinary })
  return {
    preload() {},
    decodeDracoFile(buffer, onLoad, attributeIDs, attributeTypes, _colorSpace, onError) {
      const decoder = new draco.Decoder()
      const mesh = new draco.Mesh()
      const geometry = new BufferGeometry()
      try {
        const encoded = new Int8Array(buffer)
        const status = decoder.DecodeArrayToMesh(encoded, encoded.byteLength, mesh)
        if (!status.ok() || mesh.ptr === 0) throw new Error(`Fixture Draco decode failed: ${status.error_msg()}`)
        for (const [name, id] of Object.entries(attributeIDs)) {
          const attribute = decoder.GetAttributeByUniqueId(mesh, id)
          const ArrayType = globalThis[attributeTypes[name]]
          const dataTypes = {
            Float32Array: draco.DT_FLOAT32, Int8Array: draco.DT_INT8,
            Int16Array: draco.DT_INT16, Int32Array: draco.DT_INT32,
            Uint8Array: draco.DT_UINT8, Uint16Array: draco.DT_UINT16, Uint32Array: draco.DT_UINT32,
          }
          const length = mesh.num_points() * attribute.num_components()
          const bytes = length * ArrayType.BYTES_PER_ELEMENT
          const pointer = draco._malloc(bytes)
          try {
            if (!decoder.GetAttributeDataArrayForAllPoints(mesh, attribute, dataTypes[attributeTypes[name]], bytes, pointer)) {
              throw new Error(`Cannot decode fixture attribute ${name}.`)
            }
            geometry.setAttribute(name, new BufferAttribute(new ArrayType(draco.HEAPF32.buffer, pointer, length).slice(), attribute.num_components()))
          } finally {
            draco._free(pointer)
          }
        }
        const length = mesh.num_faces() * 3
        const pointer = draco._malloc(length * 4)
        try {
          if (!decoder.GetTrianglesUInt32Array(mesh, length * 4, pointer)) throw new Error('Cannot decode fixture indices.')
          geometry.setIndex(new BufferAttribute(new Uint32Array(draco.HEAPF32.buffer, pointer, length).slice(), 1))
        } finally {
          draco._free(pointer)
        }
        onLoad(geometry)
      } catch (error) {
        geometry.dispose()
        onError(error)
      } finally {
        draco.destroy(mesh)
        draco.destroy(decoder)
      }
    },
  }
}

export async function loadFixtureAsset() {
  const bytes = await readFile(new URL('../../public/models/showroom-fixtures.glb', import.meta.url))
  const loader = new GLTFLoader().setDRACOLoader(await createNodeDecoder())
  const asset = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  return { ...asset, byteLength: bytes.byteLength }
}
