import React, { useEffect, useMemo, useState } from 'react';
import { InvoiceItem, Product, TaxMode } from '../../lib/types';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatCurrency, roundMoney } from '../../lib/utils';

interface Props {
  item: InvoiceItem;
  productMatches: (query: string) => Product[];
  activeMatches: Product[];
  isActive: boolean;
  gstMode: TaxMode;
  isEstimate?: boolean;
  onFocus: () => void;
  onChange: (patch: Partial<InvoiceItem>) => void;
  onSelectProduct: (product: Product) => void;
  onRemove: () => void;
}

const ItemRow = React.memo(function ItemRow({ item, productMatches, activeMatches, isActive, gstMode, isEstimate = false, onFocus, onChange, onSelectProduct, onRemove }: Props) {
  const [query, setQuery] = useState(item.name || '');
  const [expanded, setExpanded] = useState(false);
  const matches = isActive ? (query ? productMatches(query) : activeMatches) : [];

  useEffect(() => {
    setQuery(item.name || '');
  }, [item.name]);

  const lineTotal = useMemo(() => {
    const price = Number(item.price) || 0;
    const qty = Number(item.quantity) || 0;
    const discount = Number(item.discount) || 0;
    const taxRate = Number(item.taxRate) || 0;
    const subtotal = price * qty;
    const afterDiscount = subtotal * (1 - discount / 100);
    if (gstMode === 'inclusive') {
      return roundMoney(afterDiscount);
    }
    const withTax = afterDiscount * (1 + taxRate / 100);
    return roundMoney(withTax);
  }, [item.price, item.quantity, item.discount, item.taxRate, gstMode]);

  function handleQty(delta: number) {
    const next = Math.max(0, (Number(item.quantity) || 0) + delta);
    onChange({ quantity: next });
  }

  function handlePriceChange(raw: string) {
    const numeric = Number(raw.replace(/[^0-9.]/g, '')) || 0;
    onChange({ price: numeric });
  }

  if (isEstimate) {
    return (
      <div className="group relative w-full overflow-hidden rounded-2xl border border-stone-200 bg-white p-3 shadow-sm transition-all duration-200 hover:border-emerald-200 hover:shadow-md md:p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 min-[1180px]:grid-cols-12 min-[1180px]:gap-2">
          <div className="relative min-w-0 md:col-span-2 min-[1180px]:col-span-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Description</div>
            <div className="relative">
              <input
                value={query}
                onFocus={() => { onFocus(); }}
                onChange={(e) => { setQuery(e.target.value); onChange({ name: e.target.value, description: e.target.value }); }}
                placeholder="Enter description"
                className="min-h-12 w-full min-w-0 rounded-xl border-0 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-800 outline-none ring-1 ring-transparent placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            {isActive && matches.length > 0 && (
              <div className="absolute z-20 mt-2 max-h-56 w-[min(100%,32rem)] overflow-auto rounded-xl border border-stone-200 bg-white text-sm shadow-xl">
                {matches.map((p) => (
                  <button key={p.id} type="button" onClick={() => { onSelectProduct(p); setQuery(p.name); }} className="block w-full px-3 py-2 text-left transition-colors hover:bg-emerald-50">
                    <div className="font-medium text-stone-800">{p.name}</div>
                    <div className="text-xs text-stone-500">{formatCurrency(p.price)}{p.hsnSac ? ` • ${p.hsnSac}` : ''}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0 min-[1180px]:col-span-2">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">HSN/SAC</div>
            <input
              value={item.hsnSac || ''}
              onChange={(e) => onChange({ hsnSac: e.target.value })}
              placeholder="HSN/SAC"
              className="min-h-12 w-full rounded-xl border-0 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none ring-1 ring-transparent placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div className="min-w-0 min-[1180px]:col-span-1">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Unit</div>
            <input
              value={item.unit || 'Nos'}
              onChange={(e) => onChange({ unit: e.target.value })}
              placeholder="Nos"
              className="min-h-12 w-full rounded-xl border-0 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none ring-1 ring-transparent placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div className="min-w-0 min-[1180px]:col-span-2">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Quantity</div>
            <div className="flex min-h-12 items-center rounded-xl bg-stone-50">
              <button type="button" onClick={() => handleQty(-1)} aria-label="Decrease quantity" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-stone-600 hover:bg-white"><Minus size={17} /></button>
              <input
                value={String(item.quantity)}
                onChange={(e) => onChange({ quantity: Math.max(0, Number(e.target.value) || 0) })}
                className="h-12 w-full min-w-0 border-0 bg-transparent text-center text-sm font-semibold text-stone-800 outline-none"
                inputMode="numeric"
              />
              <button type="button" onClick={() => handleQty(1)} aria-label="Increase quantity" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-stone-600 hover:bg-white"><Plus size={17} /></button>
            </div>
          </div>

          <div className="min-w-0 min-[1180px]:col-span-2">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Price</div>
            <div className="flex min-h-12 items-center rounded-xl bg-stone-50 px-3">
              <span className="mr-2 shrink-0 text-sm text-stone-400">₹</span>
              <input
                value={Number(item.price) ? String(item.price) : ''}
                onChange={(e) => handlePriceChange(e.target.value)}
                placeholder="0.00"
                className="h-8 w-full min-w-0 border-0 bg-transparent text-sm font-medium text-stone-800 outline-none placeholder:text-stone-400"
                inputMode="decimal"
              />
            </div>
          </div>

          <div className="min-w-0 min-[1180px]:col-span-1">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">GST %</div>
            <div className="flex min-h-12 items-center rounded-xl bg-stone-50 px-3">
              <input
                value={String(item.taxRate || 0)}
                onChange={(e) => onChange({ taxRate: Number(e.target.value) || 0 })}
                placeholder="0"
                className="h-8 w-full min-w-0 border-0 bg-transparent text-sm font-medium text-stone-800 outline-none placeholder:text-stone-400"
                inputMode="decimal"
              />
            </div>
          </div>

          <div className="min-w-0 min-[1180px]:col-span-1">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Amount</div>
            <div className="flex min-h-12 items-center justify-between rounded-xl bg-stone-50 px-3 py-2">
              <div className="text-sm font-bold text-stone-900">{formatCurrency(lineTotal)}</div>
              <button type="button" onClick={onRemove} aria-label="Delete item" className="opacity-70 transition-all duration-200 hover:text-rose-600 md:opacity-100 p-2 -mr-2 text-stone-500 hover:bg-stone-100 rounded-lg flex items-center justify-center">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative w-full overflow-hidden rounded-2xl border border-stone-200 bg-white p-3 shadow-sm transition-all duration-200 hover:border-emerald-200 hover:shadow-md md:p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 min-[1180px]:grid-cols-12 min-[1180px]:gap-3">
        <div className="relative min-w-0 md:col-span-2 min-[1180px]:col-span-4">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Product</div>
          <div className="relative">
            <input
              value={query}
              onFocus={() => { onFocus(); }}
              onChange={(e) => { setQuery(e.target.value); onChange({ name: e.target.value }); }}
              placeholder="Search product or enter name"
              className="min-h-12 w-full min-w-0 rounded-xl border-0 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-800 outline-none ring-1 ring-transparent placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          {isActive && matches.length > 0 && (
            <div className="absolute z-20 mt-2 max-h-56 w-[min(100%,32rem)] overflow-auto rounded-xl border border-stone-200 bg-white text-sm shadow-xl md:w-[min(100%,36rem)]">
              {matches.map((p) => (
                <button key={p.id} type="button" onClick={() => { onSelectProduct(p); setQuery(p.name); }} className="block w-full px-3 py-2 text-left transition-colors hover:bg-emerald-50">
                  <div className="font-medium text-stone-800">{p.name}</div>
                  <div className="text-xs text-stone-500">{formatCurrency(p.price)}{p.hsnSac ? ` • ${p.hsnSac}` : ''}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 min-[1180px]:col-span-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Qty</div>
          <div className="flex min-h-12 items-center rounded-xl bg-stone-50">
            <button type="button" onClick={() => handleQty(-1)} aria-label="Decrease quantity" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-stone-600 hover:bg-white"><Minus size={17} /></button>
            <input
              value={String(item.quantity)}
              onChange={(e) => onChange({ quantity: Math.max(0, Number(e.target.value) || 0) })}
              className="h-12 w-full min-w-0 border-0 bg-transparent text-center text-sm font-semibold text-stone-800 outline-none"
              inputMode="numeric"
            />
            <button type="button" onClick={() => handleQty(1)} aria-label="Increase quantity" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-stone-600 hover:bg-white"><Plus size={17} /></button>
          </div>
        </div>

        <div className="min-w-0 min-[1180px]:col-span-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Unit Price</div>
          <div className="flex min-h-12 items-center rounded-xl bg-stone-50 px-3">
            <span className="mr-2 shrink-0 text-sm text-stone-400">₹</span>
            <input
              value={Number(item.price) ? String(item.price) : ''}
              onChange={(e) => handlePriceChange(e.target.value)}
              placeholder="0.00"
              className="h-8 w-full min-w-0 border-0 bg-transparent text-sm font-medium text-stone-800 outline-none placeholder:text-stone-400"
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="min-w-0 min-[1180px]:col-span-1">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">GST</div>
          <div className="flex min-h-12 items-center rounded-xl bg-stone-50 px-3">
            <input
              value={String(item.taxRate || 0)}
              onChange={(e) => onChange({ taxRate: Number(e.target.value) || 0 })}
              placeholder="0"
              className="h-8 w-full min-w-0 border-0 bg-transparent text-sm font-medium text-stone-800 outline-none placeholder:text-stone-400"
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="min-w-0 min-[1180px]:col-span-1">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Disc</div>
          <div className="flex min-h-12 items-center rounded-xl bg-stone-50 px-3">
            <input
              value={String(item.discount || 0)}
              onChange={(e) => onChange({ discount: Number(e.target.value) || 0 })}
              placeholder="0"
              className="h-8 w-full min-w-0 border-0 bg-transparent text-sm font-medium text-stone-800 outline-none placeholder:text-stone-400"
              inputMode="decimal"
            />
          </div>
        </div>

        <div className="min-w-0 min-[1180px]:col-span-2">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Total</div>
          <div className="flex min-h-12 items-center justify-between rounded-xl bg-stone-50 px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-bold text-stone-900">{formatCurrency(lineTotal)}</div>
            </div>
            <button type="button" onClick={onRemove} aria-label="Delete item" className="opacity-100 md:opacity-0 transition-all duration-200 md:group-hover:opacity-100 hover:translate-x-0.5 hover:text-rose-600 md:opacity-70 p-2 -mr-2 text-stone-500 hover:bg-stone-100 rounded-lg shrink-0 flex items-center justify-center">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="md:col-span-2 min-[1180px]:col-span-12">
          <button type="button" onClick={() => setExpanded((value) => !value)} className="text-xs font-medium text-stone-500 hover:text-stone-700">
            {expanded ? 'Hide details' : 'Details'}
          </button>
          <div className={`mt-2 space-y-3 ${expanded ? 'block' : 'hidden'}`}>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">HSN / SAC Code</div>
              <input
                value={item.hsnSac || ''}
                onChange={(e) => onChange({ hsnSac: e.target.value })}
                placeholder="Enter HSN or SAC code"
                className="mt-1 min-h-12 w-full rounded-xl border-0 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none ring-1 ring-transparent placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Description</div>
              <input
                value={item.description || ''}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder="Optional description"
                className="mt-1 min-h-12 w-full rounded-xl border-0 bg-stone-50 px-3 py-2 text-sm text-stone-700 outline-none ring-1 ring-transparent placeholder:text-stone-400 focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ItemRow.displayName = 'ItemRow';

export default ItemRow;
