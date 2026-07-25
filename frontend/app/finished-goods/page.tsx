"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";

interface BatchInfo {
  batch_number: string;
  remaining_quantity: number;
  unit_cost: number;
}

interface FinishedGood {
  item_id: number;
  sku: string;
  name: string;
  quantity_on_hand: number;
  unit_of_measure: string;
  reorder_level: number;
  batches: BatchInfo[];
}

export default function FinishedGoodsPage() {
  const { apiFetch, user } = useAuth();
  const [fgStocks, setFgStocks] = useState<FinishedGood[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Dispatch Form State
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchItemId, setDispatchItemId] = useState("");
  const [dispatchBatch, setDispatchBatch] = useState("");
  const [dispatchQty, setDispatchQty] = useState("");
  const [dispatchCustomerRef, setDispatchCustomerRef] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canOperate = user?.role === "ADMIN" || user?.role === "STORE_KEEPER";

  useEffect(() => {
    loadFinishedGoods();
  }, []);

  const loadFinishedGoods = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/finished-goods");
      setFgStocks(data);
    } catch (err: any) {
      setError(err.message || "Failed to load Finished Goods stock");
    } finally {
      setLoading(false);
    }
  };

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);
    try {
      const result = await apiFetch("/finished-goods/dispatch", {
        method: "POST",
        body: JSON.stringify({
          item_id: parseInt(dispatchItemId),
          quantity: parseFloat(dispatchQty),
          customer_reference: dispatchCustomerRef.trim(),
          batch_number: dispatchBatch,
        }),
      });

      setSuccess(`Outbound dispatch recorded. Dispatched unit cost valuation: $${result.unit_cost.toFixed(2)}/unit`);
      setDispatchItemId("");
      setDispatchBatch("");
      setDispatchQty("");
      setDispatchCustomerRef("");
      setShowDispatchModal(false);
      loadFinishedGoods();
    } catch (err: any) {
      setError(err.message || "Failed to dispatch Finished Goods");
    } finally {
      setIsSaving(false);
    }
  };

  const getAvailableBatches = () => {
    const selected = fgStocks.find((item) => item.item_id === parseInt(dispatchItemId));
    return selected ? selected.batches : [];
  };

  const getSelectedBatchQty = () => {
    const selected = getAvailableBatches().find((b) => b.batch_number === dispatchBatch);
    return selected ? selected.remaining_quantity : 0;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Finished Goods Stock & Dispatches</h1>
            <p className="text-zinc-400 mt-1">Track finished items, production costs, and customer dispatch operations.</p>
          </div>
          {canOperate && (
            <button
              onClick={() => {
                const hasFgWithStock = fgStocks.some((item) => item.quantity_on_hand > 0);
                if (!hasFgWithStock) {
                  setError("No Finished Goods stock available to dispatch.");
                  return;
                }
                setShowDispatchModal(true);
              }}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all flex items-center gap-2 text-sm self-start md:self-auto"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Record Sales Dispatch
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-400">
            {success}
          </div>
        )}

        {/* Finished Goods Inventory Table */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-12 bg-zinc-900 rounded-lg"></div>
            <div className="h-12 bg-zinc-900 rounded-lg"></div>
          </div>
        ) : fgStocks.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
            No Finished Goods configured in the catalog.
          </div>
        ) : (
          <div className="space-y-6 animate-fadeIn">
            {fgStocks.map((item) => (
              <div key={item.item_id} className="bg-zinc-900 border border-zinc-850 rounded-xl p-6 space-y-4">
                {/* Item Details Header */}
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <span className="text-emerald-400">{item.sku}</span> - {item.name}
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">UOM: {item.unit_of_measure}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-zinc-500">Total Physical Available</div>
                    <div className="text-2xl font-bold text-white">{item.quantity_on_hand} units</div>
                  </div>
                </div>

                {/* Batches Sub-table */}
                <div className="border-t border-zinc-800 pt-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Available Batches</h3>
                  {item.batches.length === 0 ? (
                    <div className="text-xs text-zinc-500 italic py-2">
                      No stock on hand. Open and complete a Job Order batch run.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-zinc-800 text-zinc-500 font-semibold">
                            <th className="pb-2">Batch/Lot (Job Order Number)</th>
                            <th className="pb-2 text-right">Batch Unit Cost</th>
                            <th className="pb-2 text-right">Remaining Stock</th>
                            <th className="pb-2 text-right">Asset Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-850 text-zinc-400">
                          {item.batches.map((b) => (
                            <tr key={b.batch_number} className="hover:bg-zinc-850/10">
                              <td className="py-2 font-mono text-zinc-300">{b.batch_number}</td>
                              <td className="py-2 text-right">${b.unit_cost.toFixed(2)}</td>
                              <td className="py-2 text-right font-semibold text-white">
                                {b.remaining_quantity} {item.unit_of_measure}
                              </td>
                              <td className="py-2 text-right text-emerald-400 font-semibold">
                                ${(b.remaining_quantity * b.unit_cost).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dispatch Modal Dialog */}
        {showDispatchModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl relative animate-scaleUp">
              <button
                onClick={() => setShowDispatchModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h2 className="text-xl font-bold text-white mb-6">Record Outbound Sales Dispatch</h2>

              <form onSubmit={handleDispatchSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Select Finished Product SKU
                  </label>
                  <select
                    required
                    value={dispatchItemId}
                    onChange={(e) => {
                      setDispatchItemId(e.target.value);
                      setDispatchBatch("");
                    }}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Choose Item --</option>
                    {fgStocks
                      .filter((i) => i.quantity_on_hand > 0)
                      .map((i) => (
                        <option key={i.item_id} value={i.item_id}>
                          {i.sku} - {i.name} ({i.quantity_on_hand} available)
                        </option>
                      ))}
                  </select>
                </div>

                {dispatchItemId && getAvailableBatches().length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                          Select Production Batch
                        </label>
                        <select
                          required
                          value={dispatchBatch}
                          onChange={(e) => setDispatchBatch(e.target.value)}
                          className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="">-- Choose Batch --</option>
                          {getAvailableBatches().map((b) => (
                            <option key={b.batch_number} value={b.batch_number}>
                              {b.batch_number} (Available: {b.remaining_quantity})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                          Batch Available Stock
                        </label>
                        <div className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-zinc-400 text-sm font-semibold">
                          {getSelectedBatchQty()}{" "}
                          {fgStocks.find((item) => item.item_id === parseInt(dispatchItemId))?.unit_of_measure}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                        Customer Dispatch Reference
                      </label>
                      <input
                        type="text"
                        required
                        value={dispatchCustomerRef}
                        onChange={(e) => setDispatchCustomerRef(e.target.value)}
                        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                        placeholder="e.g., Walmart Order #10029"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                        Quantity to Dispatch
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={dispatchQty}
                        onChange={(e) => setDispatchQty(e.target.value)}
                        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                        placeholder="0"
                        max={getSelectedBatchQty()}
                      />
                    </div>
                  </>
                ) : dispatchItemId ? (
                  <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
                    No active production batches found for this item.
                  </div>
                ) : null}

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDispatchModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-zinc-850 hover:bg-zinc-850 text-zinc-400 font-semibold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !dispatchBatch || parseFloat(dispatchQty) > getSelectedBatchQty() || parseFloat(dispatchQty) <= 0}
                    className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors flex items-center justify-center disabled:opacity-50"
                  >
                    {isSaving ? (
                      <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                    ) : (
                      "Record Dispatch"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
