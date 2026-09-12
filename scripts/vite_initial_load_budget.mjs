import { gzipSync } from 'node:zlib'

// Check the emitted module graph, not chunk names: manual splitting can hide
// Three.js inside a seemingly innocuous shared chunk. Dynamic imports remain
// deliberately outside this budget; the room renderer loads near its section.
export function initialLoadBudget() {
  return {
    name: 'initial-load-budget',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const entries = Object.values(bundle).filter(file => file.type === 'chunk' && file.isEntry)
        const initial = new Map()
        const visit = file => {
          if (!file || file.type !== 'chunk' || initial.has(file.fileName)) return
          initial.set(file.fileName, file)
          for (const dependency of file.imports) visit(bundle[dependency])
        }
        entries.forEach(visit)

        const engineModules = [...initial.values()].flatMap(file => Object.keys(file.modules))
          .filter(id => /\/node_modules\/(?:three|@react-three|three-stdlib)\//.test(id.replaceAll('\\', '/')))
        if (engineModules.length) {
          this.error(`The initial page imports the 3D engine before the room preview is needed: ${engineModules[0]}`)
        }

        const bytes = [...initial.values()].reduce((sum, file) => sum + Buffer.byteLength(file.code), 0)
        const gzipBytes = [...initial.values()].reduce((sum, file) => sum + gzipSync(file.code).length, 0)
        // Leaves room for accessibility and consent controls while preventing a
        // regression to the former 1.26 MB / 363 KB gzip initial JavaScript.
        if (gzipBytes > 150 * 1024) {
          this.error(`Initial JavaScript exceeds the 150 KiB gzip budget (${gzipBytes} bytes).`)
        }
        this.info(`Initial JavaScript: ${bytes} bytes / ${gzipBytes} gzip bytes; no 3D engine in the initial import graph.`)
      },
    },
  }
}
