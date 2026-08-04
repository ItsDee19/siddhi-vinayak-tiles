// ---------------------------------------------------------------------------
// Guard rails for the "upload your own tile photo" flow in the Visualizer.
//
// The picked file is turned into a blob: URL and pushed straight through
// THREE.TextureLoader, so the browser will happily try to decode whatever it is
// handed. The `accept` attribute on <input type="file"> is only a hint — the OS
// picker can be told to show all files and a drag/drop or scripted change event
// bypasses it entirely. So re-check the type here, and cap the size before we
// hand a multi-hundred-megabyte file to the GPU.
// ---------------------------------------------------------------------------

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8 MB

/**
 * @param {File} file
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateImageFile(file) {
  if (!file) return { ok: false, error: 'No file selected.' }
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, error: 'Please choose a JPG, PNG or WebP image.' }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'That image is over 8 MB — please pick a smaller one.' }
  }
  return { ok: true }
}
