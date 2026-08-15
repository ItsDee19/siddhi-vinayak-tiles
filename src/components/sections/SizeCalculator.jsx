import { useMemo, useState } from 'react'
import SectionHeading from '../ui/SectionHeading'
import Reveal from '../ui/Reveal'
import Icon from '../Icons'
import {
  calculateTiles,
  collections,
  sizeCalculatorProducts,
  sizeOptions,
} from '../../data/sizeCalculatorCatalog'

const WASTE_PRESETS = [5, 10, 15]

export default function SizeCalculator() {
  const [mode, setMode] = useState('size') // size | product
  const [collection, setCollection] = useState('all')
  const [sizeMm, setSizeMm] = useState(sizeOptions[0]?.sizeMm || '600×1200mm')
  const [productId, setProductId] = useState('')
  const [lengthFt, setLengthFt] = useState('12')
  const [widthFt, setWidthFt] = useState('10')
  const [wastePct, setWastePct] = useState(10)
  const [surface, setSurface] = useState('Floor') // Floor | Wall labels only

  const filteredProducts = useMemo(() => {
    return sizeCalculatorProducts.filter((p) => {
      if (collection !== 'all' && p.collection !== collection) return false
      if (p.confidence === 'placeholder' && mode === 'product') {
        // still allow size-based; for product mode prefer named
        if (/^(Global Floor Tile|Global Wall Tile|Sky 12x18 Concept)/i.test(p.name)) {
          return false
        }
      }
      return true
    })
  }, [collection, mode])

  const productsForSize = useMemo(() => {
    return filteredProducts.filter((p) => p.sizeMm === sizeMm).slice(0, 80)
  }, [filteredProducts, sizeMm])

  const selectedProduct = useMemo(
    () => filteredProducts.find((p) => p.id === productId) || null,
    [filteredProducts, productId],
  )

  const activeSize = mode === 'product' && selectedProduct ? selectedProduct.sizeMm : sizeMm
  const pcsPerBox = selectedProduct?.pcsPerBox ?? null
  const coverageSqFt = selectedProduct?.coverageSqFt ?? null

  const result = useMemo(() => {
    const L = Number(lengthFt)
    const W = Number(widthFt)
    if (!Number.isFinite(L) || !Number.isFinite(W)) return null
    return calculateTiles({
      lengthFt: L,
      widthFt: W,
      sizeMm: activeSize,
      wastePct,
      pcsPerBox,
      coverageSqFt,
    })
  }, [lengthFt, widthFt, activeSize, wastePct, pcsPerBox, coverageSqFt])

  const dimLabel = surface === 'Wall' ? 'Wall length (ft)' : 'Room length (ft)'
  const dimLabel2 = surface === 'Wall' ? 'Wall height (ft)' : 'Room width (ft)'

  return (
    <section id="size-calculator" className="section-pad relative bg-charcoal-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(201,162,79,0.08),_transparent_55%)]" />
      <div className="container-px relative">
        <SectionHeading
          eyebrow="Tile Planner"
          title="Size Calculator"
          subtitle="Estimate how many tiles (and boxes) you need for a room or wall — using sizes from our Global, Sunflora, Sky and Skype catalogues."
        />

        <div className="mt-12 grid gap-8 lg:grid-cols-5">
          {/* Controls */}
          <Reveal className="lg:col-span-3">
            <div className="rounded-3xl border border-white/5 bg-charcoal-800/80 p-6 sm:p-8">
              {/* Surface + mode */}
              <div className="flex flex-wrap gap-3">
                {['Floor', 'Wall'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSurface(s)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      surface === s
                        ? 'bg-gold text-charcoal'
                        : 'bg-white/5 text-sand hover:bg-white/10'
                    }`}
                  >
                    {s}
                  </button>
                ))}
                <span className="mx-1 hidden h-8 w-px bg-white/10 sm:inline-block" />
                {[
                  { id: 'size', label: 'By size' },
                  { id: 'product', label: 'By product' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      mode === m.id
                        ? 'ring-1 ring-gold/50 bg-gold/15 text-gold-light'
                        : 'bg-white/5 text-sand hover:bg-white/10'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs uppercase tracking-wider text-sand/60">
                    Collection
                  </span>
                  <select
                    value={collection}
                    onChange={(e) => {
                      setCollection(e.target.value)
                      setProductId('')
                    }}
                    className="w-full rounded-xl border border-white/10 bg-charcoal-900 px-3 py-2.5 text-sm text-cream outline-none focus:border-gold/40"
                  >
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs uppercase tracking-wider text-sand/60">
                    Tile size
                  </span>
                  <select
                    value={activeSize}
                    onChange={(e) => {
                      setSizeMm(e.target.value)
                      setProductId('')
                      setMode('size')
                    }}
                    className="w-full rounded-xl border border-white/10 bg-charcoal-900 px-3 py-2.5 text-sm text-cream outline-none focus:border-gold/40"
                  >
                    {sizeOptions.map((s) => (
                      <option key={s.sizeMm} value={s.sizeMm}>
                        {s.sizeMm} ({s.count} designs)
                      </option>
                    ))}
                  </select>
                </label>

                {mode === 'product' && (
                  <label className="block sm:col-span-2">
                    <span className="mb-1.5 block text-xs uppercase tracking-wider text-sand/60">
                      Product ({productsForSize.length} in this size)
                    </span>
                    <select
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-charcoal-900 px-3 py-2.5 text-sm text-cream outline-none focus:border-gold/40"
                    >
                      <option value="">— Select a design —</option>
                      {productsForSize.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.collection}
                          {p.finish ? ` · ${p.finish}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-xs uppercase tracking-wider text-sand/60">
                    {dimLabel}
                  </span>
                  <input
                    type="number"
                    min="0.5"
                    step="0.1"
                    value={lengthFt}
                    onChange={(e) => setLengthFt(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-charcoal-900 px-3 py-2.5 text-sm text-cream outline-none focus:border-gold/40"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs uppercase tracking-wider text-sand/60">
                    {dimLabel2}
                  </span>
                  <input
                    type="number"
                    min="0.5"
                    step="0.1"
                    value={widthFt}
                    onChange={(e) => setWidthFt(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-charcoal-900 px-3 py-2.5 text-sm text-cream outline-none focus:border-gold/40"
                  />
                </label>
              </div>

              <div className="mt-6">
                <span className="mb-2 block text-xs uppercase tracking-wider text-sand/60">
                  Wastage allowance
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {WASTE_PRESETS.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setWastePct(w)}
                      className={`rounded-full px-3 py-1.5 text-sm ${
                        wastePct === w
                          ? 'bg-gold text-charcoal'
                          : 'bg-white/5 text-sand hover:bg-white/10'
                      }`}
                    >
                      {w}%
                    </button>
                  ))}
                  <input
                    type="number"
                    min="0"
                    max="40"
                    value={wastePct}
                    onChange={(e) => setWastePct(Number(e.target.value) || 0)}
                    className="w-20 rounded-xl border border-white/10 bg-charcoal-900 px-2 py-1.5 text-sm text-cream outline-none focus:border-gold/40"
                  />
                </div>
                <p className="mt-2 text-xs text-sand/50">
                  10% is typical for straight lays; use 15% for diagonals or busy cuts.
                </p>
              </div>
            </div>
          </Reveal>

          {/* Results */}
          <Reveal delay={0.08} className="lg:col-span-2">
            <div className="flex h-full flex-col rounded-3xl border border-gold/20 bg-gradient-to-b from-charcoal-800 to-charcoal-900 p-6 sm:p-8">
              <div className="mb-4 flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gold/15 ring-1 ring-gold/30">
                  <Icon name="tag" className="h-5 w-5 text-gold-light" />
                </div>
                <div>
                  <h3 className="font-display text-xl text-cream">Estimate</h3>
                  <p className="text-xs text-sand/60">{activeSize || '—'}</p>
                </div>
              </div>

              {!result ? (
                <p className="text-sm text-sand/70">Enter room dimensions to see tile counts.</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Stat
                      label="Area"
                      value={`${result.areaSqFt} sq.ft`}
                    />
                    <Stat
                      label="Tile size"
                      value={result.sizeMm}
                    />
                    <Stat
                      label="Tiles (raw)"
                      value={String(result.rawTiles)}
                    />
                    <Stat
                      label={`Tiles + ${result.wastePct}%`}
                      value={String(result.tilesNeeded)}
                      highlight
                    />
                  </div>

                  {result.boxes != null ? (
                    <div className="rounded-2xl border border-gold/25 bg-gold/10 px-4 py-4">
                      <p className="text-xs uppercase tracking-wider text-gold-light/80">
                        Boxes to order
                      </p>
                      <p className="mt-1 font-display text-3xl text-gold-light">
                        {result.boxes}
                        <span className="ml-2 text-base text-sand/70">
                          {result.pcsPerBox
                            ? `@ ${result.pcsPerBox} pcs/box`
                            : 'est. from coverage'}
                        </span>
                      </p>
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-sand/75">
                      Box packing not listed for this size — use tile count above, or ask the
                      showroom for pcs/box.
                    </p>
                  )}

                  {selectedProduct && (
                    <div className="border-t border-white/5 pt-4 text-sm text-sand/80">
                      <p className="font-medium text-cream">{selectedProduct.name}</p>
                      <p className="mt-1 text-xs text-sand/55">
                        {selectedProduct.collection}
                        {selectedProduct.finish ? ` · ${selectedProduct.finish}` : ''}
                        {selectedProduct.confidence === 'placeholder' ? ' · name TBD' : ''}
                      </p>
                    </div>
                  )}

                  <p className="text-[11px] leading-relaxed text-sand/45">
                    Estimate only. Actual quantity depends on layout, cuts, and site conditions.
                    Confirm with Sidhhi Binayak Tiles before ordering.
                  </p>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value, highlight = false }) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 ${
        highlight
          ? 'border-gold/30 bg-gold/10'
          : 'border-white/5 bg-white/[0.03]'
      }`}
    >
      <p className="text-[10px] uppercase tracking-wider text-sand/55">{label}</p>
      <p className={`mt-1 font-display text-lg ${highlight ? 'text-gold-light' : 'text-cream'}`}>
        {value}
      </p>
    </div>
  )
}
