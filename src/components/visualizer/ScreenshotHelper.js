import { business } from '../../data/siteConfig'

// Capture the WebGL canvas, stamp the shop name + date, trigger a PNG download.
// Caller must pass the <canvas> element from the active 3D model.
// Requires `preserveDrawingBuffer: true` on the renderer (set in ModelShell).

export async function captureAndDownload(canvas) {
  if (!canvas) return
  const w = canvas.width
  const h = canvas.height
  const off = document.createElement('canvas')
  off.width = w
  off.height = h
  const ctx = off.getContext('2d')
  ctx.drawImage(canvas, 0, 0, w, h)

  // Watermark strip
  const stripH = 48
  ctx.fillStyle = 'rgba(26, 14, 5, 0.6)'
  ctx.fillRect(0, h - stripH, w, stripH)
  ctx.fillStyle = '#C49A3C'
  ctx.font = '600 18px Manrope, Inter, system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(business.name, 16, h - stripH / 2)
  ctx.fillStyle = 'rgba(245, 230, 200, 0.75)'
  ctx.font = '12px Manrope, Inter, system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(new Date().toLocaleDateString('en-IN'), w - 16, h - stripH / 2)

  const url = off.toDataURL('image/png')
  const a = document.createElement('a')
  a.href = url
  a.download = `svt-preview-${Date.now()}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
