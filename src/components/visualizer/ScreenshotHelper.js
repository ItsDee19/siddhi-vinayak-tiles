import { business } from '../../data/siteConfig'

// Capture the WebGL canvas, stamp the shop name + date, trigger a PNG download.
// Caller must pass the <canvas> element from the active 3D model.
// Requires `preserveDrawingBuffer: true` on the renderer (set in ModelShell).

export async function captureAndDownload(canvas, { roomName, selections = [] } = {}) {
  if (!canvas) return
  const w = canvas.width
  const h = canvas.height
  const off = document.createElement('canvas')
  off.width = w
  const footerHeight = selections.length ? 52 + selections.length * 22 : 48
  off.height = h + footerHeight
  const ctx = off.getContext('2d')
  ctx.drawImage(canvas, 0, 0, w, h)

  // Watermark strip
  ctx.fillStyle = '#211a15'
  ctx.fillRect(0, h, w, footerHeight)
  ctx.fillStyle = '#C49A3C'
  ctx.font = '600 18px Manrope, Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${business.name}${roomName ? ' · ' + roomName : ''}`, 16, h + 26, w - 120)
  ctx.fillStyle = 'rgba(245, 230, 200, 0.75)'
  ctx.font = '12px Manrope, Inter, system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(new Date().toLocaleDateString('en-IN'), w - 16, h + 26)
  ctx.textAlign = 'left'
  selections.forEach((selection, index) => ctx.fillText(selection, 16, h + 52 + index * 22, w - 32))

  const blob = await new Promise((resolve, reject) => off.toBlob(
    value => value ? resolve(value) : reject(new Error('The room image could not be saved. Please try again.')),
    'image/png',
  ))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `svt-preview-${Date.now()}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Let the browser consume the download before releasing the exported image.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
