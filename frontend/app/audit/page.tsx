"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";

interface Transaction {
  id: number;
  item_id: number;
  item_sku: string;
  item_name: string;
  item_type: string;
  job_order_id?: number;
  job_order_number?: string;
  quantity_change: number;
  transaction_type: string;
  performed_by_name: string;
  timestamp: string;
  batch_number?: string;
  unit_cost?: number;
  reference_number?: string;
  notes?: string;
}

interface Item {
  id: number;
  sku: string;
  name: string;
  item_type: string;
  unit_of_measure: string;
}

export default function AuditPage() {
  const { apiFetch, user } = useAuth();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Filters
  const [typeFilter, setTypeFilter] = useState("");
  const [itemIdFilter, setItemIdFilter] = useState("");

  // Adjustment Modal State
  const [showAdjModal, setShowAdjModal] = useState(false);
  const [adjItemId, setAdjItemId] = useState("");
  const [adjQty, setAdjQty] = useState("");
  const [adjBatch, setAdjBatch] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjLocation, setAdjLocation] = useState("Main Warehouse");
  const [isAdjSaving, setIsAdjSaving] = useState(false);

  const canAdjust = user?.role === "ADMIN" || user?.role === "STORE_KEEPER";

  useEffect(() => {
    loadTransactions();
  }, [typeFilter, itemIdFilter]);

  useEffect(() => {
    // Load catalog for adjustment SKU selection
    apiFetch("/inventory/items").then((data) => setItems(data)).catch(() => {});
  }, []);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      let queryPath = "/audit/transactions";
      const params = new URLSearchParams();
      if (typeFilter) params.append("transaction_type", typeFilter);
      if (itemIdFilter) params.append("item_id", itemIdFilter);
      
      const queryString = params.toString();
      if (queryString) queryPath += `?${queryString}`;

      const data = await apiFetch(queryPath);
      setTxns(data);
    } catch (err: any) {
      setError(err.message || "Failed to load audit transactions log");
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsAdjSaving(true);
    try {
      const result = await apiFetch("/audit/adjustments", {
        method: "POST",
        body: JSON.stringify({
          item_id: parseInt(adjItemId),
          quantity_change: parseFloat(adjQty),
          batch_number: adjBatch.trim() || null,
          reason: adjReason.trim(),
          location: adjLocation,
        }),
      });

      setSuccess(`Stock adjustment completed. ${result.message}`);
      setAdjItemId("");
      setAdjQty("");
      setAdjBatch("");
      setAdjReason("");
      setShowAdjModal(false);
      loadTransactions();
    } catch (err: any) {
      setError(err.message || "Failed to submit manual stock adjustment");
    } finally {
      setIsAdjSaving(false);
    }
  };

  const getTxnTypeBadge = (type: string) => {
    switch (type) {
      case "STOCK_IN":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "ISSUE_TO_WIP":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "FG_PRODUCED":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "DISPATCH":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "ADJUSTMENT":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">System Transactions Audit Logs</h1>
            <p className="text-zinc-400 mt-1">Immutable trace log of all company stock adjustments and material flow.</p>
          </div>
          {canAdjust && (
            <button
              onClick={() => setShowAdjModal(true)}
              className="px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-all flex items-center gap-2 text-sm self-start md:self-auto"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Manual Adjustment / Scrap Log
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

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 bg-zinc-900 border border-zinc-850 p-4 rounded-xl">
          <div className="flex-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Filter by Item SKU</label>
            <select
              value={itemIdFilter}
              onChange={(e) => setItemIdFilter(e.target.value)}
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All Catalog SKUs</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sku} - {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-64">
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Filter by Transaction Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All Transaction Types</option>
              <option value="STOCK_IN">STOCK IN (Receiving)</option>
              <option value="ISSUE_TO_WIP">ISSUE TO WIP (Allocations)</option>
              <option value="FG_PRODUCED">FG PRODUCED (Yields)</option>
              <option value="DISPATCH">DISPATCH (Outbound)</option>
              <option value="ADJUSTMENT">ADJUSTMENT (Corrections / Damage)</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-12 bg-zinc-900 rounded-lg"></div>
            <div className="h-12 bg-zinc-900 rounded-lg"></div>
          </div>
        ) : txns.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
            No transactions found matching the selected filters.
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-850 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-semibold">
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">SKU / Code</th>
                    <th className="p-4">Transaction Type</th>
                    <th className="p-4 text-right">Delta Quantity</th>
                    <th className="p-4 text-right">Unit cost</th>
                    <th className="p-4">Batch Ref</th>
                    <th className="p-4">Reference/Job</th>
                    <th className="p-4">Performed By</th>
                    <th className="p-4">Obligatory Note / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 text-zinc-350">
                  {txns.map((t) => (
                    <tr key={t.id} className="hover:bg-zinc-850/20 transition-colors">
                      <td className="p-4 text-zinc-500">
                        {new Date(t.timestamp).toLocaleDateString()}{" "}
                        {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4 font-bold text-white">{t.item_sku}</td>
                      <td className="p-4">
                        <span className={`inline-block border rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase ${getTxnTypeBadge(t.transaction_type)}`}>
                          {t.transaction_type.replace("_", " ")}
                        </span>
                      </td>
                      <td className={`p-4 text-right font-bold text-sm ${
                        t.quantity_change > 0 ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {t.quantity_change > 0 ? "+" : ""}
                        {t.quantity_change}
                      </td>
                      <td className="p-4 text-right">
                        {t.unit_cost ? `$${t.unit_cost.toFixed(2)}` : "$0.00"}
                      </td>
                      <td className="p-4 font-mono text-zinc-400">{t.batch_number || "N/A"}</td>
                      <td className="p-4 font-semibold text-zinc-300">
                        {t.reference_number || t.job_order_number || "N/A"}
                      </td>
                      <td className="p-4">{t.performed_by_name}</td>
                      <td className="p-4 text-zinc-400 max-w-[200px] truncate" title={t.notes}>
                        {t.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Manual Adjustment Modal */}
        {showAdjModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl relative">
              <button
                onClick={() => setShowAdjModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h2 className="text-xl font-bold text-white mb-2">Record Stock Adjustment</h2>
              <p className="text-xs text-rose-400 mb-6">
                WARNING: Adjustments modify live inventory. Changes are audit logged and immutable.
              </p>

              <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Select Catalog SKU
                  </label>
                  <select
                    required
                    value={adjItemId}
                    onChange={(e) => setAdjItemId(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Choose Item --</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.sku} - {i.name} ({i.item_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Delta Change (+ / -)
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={adjQty}
                      onChange={(e) => setAdjQty(e.target.value)}
                      className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                      placeholder="e.g. -5 for damage, +2 for recount"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Batch Ref (Optional)
                    </label>
                    <input
                      type="text"
                      value={adjBatch}
                      onChange={(e) => setAdjBatch(e.target.value)}
                      className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                      placeholder="e.g. LOT-2026-A"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    required
                    value={adjLocation}
                    onChange={(e) => setAdjLocation(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Obligatory Reason Code / Notes
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={adjReason}
                    onChange={(e) => setAdjReason(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="Describe why stock correction is required (e.g., 'Recount mismatch on annual inventory audits', 'Damaged in transit')."
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAdjModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-zinc-850 hover:bg-zinc-850 text-zinc-400 font-semibold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isAdjSaving || !adjItemId || parseFloat(adjQty) === 0}
                    className="flex-1 px-4 py-2 rounded-lg bg-rose-650 hover:bg-rose-550 text-white font-semibold text-sm transition-colors flex items-center justify-center disabled:opacity-50"
                  >
                    {isAdjSaving ? (
                      <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                    ) : (
                      "Apply Correction"
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
