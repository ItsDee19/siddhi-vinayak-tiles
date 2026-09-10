import React from 'react'
import { renderToPipeableStream } from 'react-dom/server'
import { Writable } from 'node:stream'
import App from './App.jsx'

// Wait for ordinary React.lazy sections before writing the static document.
// No browser is launched and no crawler-specific version of the site is served.
export function render() {
  return new Promise((resolve, reject) => {
    const chunks = []
    let renderError
    const destination = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk))
        callback()
      },
    })
    const timeout = setTimeout(() => {
      stream.abort()
      reject(new Error('Homepage prerender exceeded 30 seconds'))
    }, 30000)
    destination.on('finish', () => {
      clearTimeout(timeout)
      if (renderError) reject(renderError)
      else resolve(Buffer.concat(chunks).toString('utf8'))
    })
    destination.on('error', error => {
      clearTimeout(timeout)
      reject(error)
    })
    const stream = renderToPipeableStream(<React.StrictMode><App /></React.StrictMode>, {
      onAllReady() { stream.pipe(destination) },
      onError(error) { renderError ||= error },
      onShellError(error) {
        clearTimeout(timeout)
        reject(error)
      },
    })
  })
}
