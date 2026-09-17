import { useId, useRef, useState } from 'react'
import { estimateTiles } from '../../utils/tileEstimate'

const FIELDS = [
  { name: 'lengthFt', label: 'Room length (ft)', example: '12' },
  { name: 'widthFt', label: 'Room width (ft)', example: '10' },
  { name: 'tileWidthMm', label: 'Tile width (mm)', example: '600' },
  { name: 'tileHeightMm', label: 'Tile height (mm)', example: '600' },
  { name: 'wastePct', label: 'Extra for cuts & waste (%)', example: '10' },
]

export default function SizeCalculator() {
  const formId = useId()
  const formRef = useRef(null)
  const [values, setValues] = useState({ lengthFt: '', widthFt: '', tileWidthMm: '', tileHeightMm: '', wastePct: '10' })
  const [errors, setErrors] = useState({})
  const [result, setResult] = useState(null)

  function update(name, value) {
    setValues((previous) => ({ ...previous, [name]: value }))
    setResult(null)
    setErrors((previous) => ({ ...previous, [name]: undefined }))
  }

  function calculate(event) {
    event.preventDefault()
    const calculation = estimateTiles(values)
    setErrors(calculation.errors)
    setResult(calculation.result)
    const firstError = Object.keys(calculation.errors)[0]
    if (firstError) formRef.current?.elements.namedItem(firstError)?.focus()
  }

  return (
    <div className="grid gap-6 pt-6 lg:grid-cols-[1.5fr_1fr]">
      <form ref={formRef} onSubmit={calculate} noValidate aria-label="Tile quantity estimate">
        <p className="mb-5 text-sm leading-relaxed text-sand-light">Enter your room measurements and the tile size printed in the catalogue.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(({ name, label, example }) => {
            const inputId = `${formId}-${name}`
            const errorId = `${inputId}-error`
            return (
              <div key={name}>
                <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-cream">{label}</label>
                <input
                  id={inputId}
                  name={name}
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={name === 'wastePct' ? '0' : '0.001'}
                  max={name === 'wastePct' ? '100' : undefined}
                  value={values[name]}
                  placeholder={example}
                  onChange={(event) => update(name, event.target.value)}
                  aria-invalid={Boolean(errors[name])}
                  aria-describedby={errors[name] ? errorId : undefined}
                  className="min-h-11 w-full rounded-btn border border-sand/40 bg-charcoal px-3 py-2.5 text-base text-cream placeholder:text-sand/70 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
                {errors[name] && <p id={errorId} className="mt-2 text-sm text-cream">{errors[name]}</p>}
              </div>
            )
          })}
          <div className="flex items-end">
            <button type="submit" className="btn-gold min-h-11 w-full cursor-pointer">Calculate estimate</button>
          </div>
        </div>
      </form>

      <div className="rounded-card border border-sand/25 bg-charcoal p-5 sm:p-6">
        <h3 className="font-display text-xl text-cream">Your estimate</h3>
        <div aria-live="polite" aria-atomic="true" className="mt-4 min-h-28">
          {result ? (
            <>
              <p className="font-display text-4xl text-cream">{result.tilesNeeded.toLocaleString('en-IN')} <span className="text-xl">tiles</span></p>
              <p className="mt-2 text-sm leading-relaxed text-sand-light">For {result.areaSqFt.toLocaleString('en-IN', { maximumFractionDigits: 2 })} sq ft, including {result.wastePct}% extra.</p>
              <p className="mt-1 text-sm text-sand-light">Tile size: {result.tileWidthMm} × {result.tileHeightMm} mm.</p>
            </>
          ) : (
            <p className="text-sm leading-relaxed text-sand-light">{Object.values(errors).some(Boolean) ? 'Check the highlighted measurements to calculate your estimate.' : 'Fill in the measurements and select Calculate estimate.'}</p>
          )}
        </div>
        <p className="mt-5 border-t border-sand/20 pt-4 text-sm leading-relaxed text-sand-light">An area estimate, rounded up to whole tiles. Layout, cuts, grout and site conditions affect the final quantity. Confirm quantities and box packing with the showroom before ordering.</p>
      </div>
    </div>
  )
}
