import fs from 'node:fs'
import path from 'node:path'

// Retired visualizer assets and extraction inputs. The catalogue reader's
// /catalogues/ originals and three image resolutions are deliberately excluded.
// Source files remain in public/ so the offline import tools still work.
export const LEGACY_PUBLIC_ROOTS = ['2d-rooms', 'textures', 'assets/catalogue']

export function assertChildPath(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target))
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Refusing to modify a path outside the build output: ${target}`)
  }
  return target
}

function filesWithin(root, directory) {
  if (!fs.existsSync(directory)) return []
  assertChildPath(root, directory)
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error(`Refusing to traverse a linked build path: ${directory}`)
  const found = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = assertChildPath(root, path.join(directory, entry.name))
    if (entry.isSymbolicLink()) throw new Error(`Refusing to traverse a linked build path: ${target}`)
    if (entry.isDirectory()) found.push(...filesWithin(root, target))
    else if (entry.isFile()) found.push(target)
  }
  return found
}

export function referencedLegacyUrls(sources) {
  const references = new Set()
  // Inspect emitted, tree-shaken JS, CSS and HTML. A remaining dynamic URL
  // prefix protects its entire subtree, rather than guessing its filenames.
  const text = sources.join('\n').replaceAll('\\/', '/')
  for (const root of LEGACY_PUBLIC_ROOTS) {
    const expression = new RegExp(`/${root}/[^\\s"'\x60<>\\\\)\\]}]*`, 'g')
    for (const match of text.matchAll(expression)) {
      let url = match[0].split('${')[0].split(/[?#]/)[0]
      try { url = decodeURIComponent(url) } catch { /* Keep literal invalid escapes. */ }
      references.add(url)
    }
  }
  return [...references]
}

export function pruneLegacyPublicFiles({ outDir, projectRoot, publicDir, sources }) {
  const output = path.resolve(outDir)
  for (const protectedRoot of [projectRoot, publicDir].filter(Boolean)) {
    const protectedPath = path.resolve(protectedRoot)
    const insidePublic = protectedRoot === publicDir && output.startsWith(`${protectedPath}${path.sep}`)
    if (insidePublic || output === protectedPath || protectedPath.startsWith(`${output}${path.sep}`)) {
      throw new Error(`Refusing to prune source files through build.outDir: ${output}`)
    }
  }
  if (!fs.existsSync(output)) return { removedFiles: 0, removedBytes: 0, retainedFiles: 0 }
  if (fs.lstatSync(output).isSymbolicLink()) throw new Error('Build output must not be a symbolic link')
  const actualOutput = fs.realpathSync(output)
  const references = referencedLegacyUrls(sources)
  // Collect and validate everything before deleting any file.
  const files = LEGACY_PUBLIC_ROOTS.flatMap(relative => filesWithin(output, path.join(output, relative)))
  for (const file of files) assertChildPath(actualOutput, fs.realpathSync(file))
  const report = { removedFiles: 0, removedBytes: 0, retainedFiles: 0 }
  for (const file of files) {
    const url = `/${path.relative(output, file).split(path.sep).join('/')}`
    const retained = references.some(reference => {
      const completeFile = /\.(?:avif|webp|png|jpe?g|gif|svg|ico|glb|gltf|bin|ktx2?|hdr|exr|json|pdf|woff2?|ttf|mp4|webm|ogg|mp3)$/i.test(reference)
      return url === reference || (!completeFile && url.startsWith(reference))
    })
    if (retained) { report.retainedFiles++; continue }
    report.removedBytes += fs.statSync(file).size
    fs.unlinkSync(file)
    report.removedFiles++
  }
  return report
}

export function pruneLegacyPublicAssets() {
  let resolved
  let sources = []
  return {
    name: 'prune-unused-legacy-public-assets',
    apply: 'build',
    configResolved(config) { resolved = config },
    generateBundle(_options, bundle) {
      sources = Object.values(bundle).flatMap(item => {
        if (item.type === 'chunk') return [item.code]
        if (/\.(?:html|css|js|svg)$/.test(item.fileName)) return [String(item.source)]
        return []
      })
    },
    closeBundle() {
      if (!resolved || resolved.build.ssr || !sources.length) return
      const report = pruneLegacyPublicFiles({
        outDir: path.resolve(resolved.root, resolved.build.outDir),
        projectRoot: resolved.root,
        publicDir: resolved.publicDir,
        sources,
      })
      resolved.logger.info(`[assets] Omitted ${report.removedFiles} unused legacy files (${(report.removedBytes / 1048576).toFixed(1)} MiB); preserved ${report.retainedFiles} referenced legacy assets and every original catalogue.`)
    },
  }
}
