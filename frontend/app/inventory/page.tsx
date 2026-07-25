"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";

interface Item {
  id: number;
  sku: string;
  name: string;
  item_type: string;
  unit_of_measure: string;
  reorder_level: number;
  quantity_on_hand: number;
}

interface Job {
  id: number;
  order_number: string;
  status: string;
  finished_item_name: string;
}

interface Batch {
  batch_number: string;
  remaining_quantity: number;
  unit_cost: number;
}

export default function InventoryPage() {
  const { apiFetch, user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal Control
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);

  // Stock In Form State
  const [stockInItemId, setStockInItemId] = useState("");
  const [stockInQty, setStockInQty] = useState("");
  const [stockInCost, setStockInCost] = useState("");
  const [stockInLocation, setStockInLocation] = useState("Warehouse Shelf A");
  const [stockInBatch, setStockInBatch] = useState("");
  const [stockInRef, setStockInRef] = useState("");
  const [isStockInSaving, setIsStockInSaving] = useState(false);

  // Issue to WIP Form State
  const [issueJobId, setIssueJobId] = useState("");
  const [issueItemId, setIssueItemId] = useState("");
  const [issueBatchNumber, setIssueBatchNumber] = useState("");
  const [issueQty, setIssueQty] = useState("");
  const [availableBatches, setAvailableBatches] = useState<Batch[]>([]);
  const [isIssueSaving, setIsIssueSaving] = useState(false);

  const canOperate = user?.role === "ADMIN" || user?.role === "STORE_KEEPER";

  useEffect(() => {
    loadInventoryData();
  }, []);

  const loadInventoryData = async () => {
    try {
      setLoading(true);
      const [itemsData, jobsData] = await Promise.all([
        apiFetch("/inventory/items"),
        apiFetch("/production/jobs"),
      ]);

      // Only display raw materials and supplies on this page
      const rawAndSupplies = itemsData.filter(
        (i: Item) => i.item_type === "RAW_MATERIAL" || i.item_type === "SUPPLY"
      );
      setItems(rawAndSupplies);

      // Only display active jobs (DRAFT or IN_PROGRESS) for material allocations
      const openJobs = jobsData.filter(
        (j: Job) => j.status === "DRAFT" || j.status === "IN_PROGRESS"
      );
      setActiveJobs(openJobs);
    } catch (err: any) {
      setError(err.message || "Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  };

  // Fetch batches when issue item changes
  useEffect(() => {
    if (issueItemId) {
      fetchItemBatches(parseInt(issueItemId));
    } else {
      setAvailableBatches([]);
      setIssueBatchNumber("");
    }
  }, [issueItemId]);

  const fetchItemBatches = async (itemId: number) => {
    try {
      const data = await apiFetch(`/inventory/batches/${itemId}`);
      setAvailableBatches(data);
      if (data.length > 0) {
        setIssueBatchNumber(data[0].batch_number);
      } else {
        setIssueBatchNumber("");
      }
    } catch (err: any) {
      setError("Failed to fetch available batches for selected item.");
    }
  };

  const handleStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsStockInSaving(true);
    try {
      await apiFetch("/inventory/stock-in", {
        method: "POST",
        body: JSON.stringify({
          item_id: parseInt(stockInItemId),
          quantity: parseFloat(stockInQty),
          unit_cost: parseFloat(stockInCost),
          batch_number: stockInBatch.trim(),
          location: stockInLocation.trim(),
          reference_number: stockInRef.trim() || null,
        }),
      });

      setSuccess("Incoming shipment recorded successfully.");
      setStockInItemId("");
      setStockInQty("");
      setStockInCost("");
      setStockInBatch("");
      setStockInRef("");
      setShowStockInModal(false);
      loadInventoryData();
    } catch (err: any) {
      setError(err.message || "Failed to stock in material");
    } finally {
      setIsStockInSaving(false);
    }
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsIssueSaving(true);
    try {
      const result = await apiFetch("/inventory/issue-to-wip", {
        method: "POST",
        body: JSON.stringify({
          job_order_id: parseInt(issueJobId),
          item_id: parseInt(issueItemId),
          quantity: parseFloat(issueQty),
          batch_number: issueBatchNumber,
        }),
      });

      setSuccess(`Materials issued successfully. Job status updated to: ${result.job_status}`);
      setIssueJobId("");
      setIssueItemId("");
      setIssueQty("");
      setIssueBatchNumber("");
      setShowIssueModal(false);
      loadInventoryData();
    } catch (err: any) {
      setError(err.message || "Failed to allocate materials to job");
    } finally {
      setIsIssueSaving(false);
    }
  };

  const getSelectedBatchQty = () => {
    const selected = availableBatches.find((b) => b.batch_number === issueBatchNumber);
    return selected ? selected.remaining_quantity : 0;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Company Inventory (Raw & Supplies)</h1>
            <p className="text-zinc-400 mt-1">Manage warehouse stock-in shipments and issue inputs to active jobs.</p>
          </div>
          {canOperate && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowStockInModal(true)}
                className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all flex items-center gap-2 text-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Stock In Shipment
              </button>
              <button
                onClick={() => {
                  if (activeJobs.length === 0) {
                    setError("No active WIP Job Orders available to receive materials.");
                    return;
                  }
                  setShowIssueModal(true);
                }}
                className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-all flex items-center gap-2 text-sm"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Issue to WIP
              </button>
            </div>
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

        {/* Live inventory levels */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-12 bg-zinc-900 rounded-lg"></div>
            <div className="h-12 bg-zinc-900 rounded-lg"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
            No raw materials or supply stock items configured in the catalog.
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-850 rounded-xl overflow-hidden animate-fadeIn">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-semibold">
                    <th className="p-4">SKU</th>
                    <th className="p-4">Material Name</th>
                    <th className="p-4">UOM</th>
                    <th className="p-4">Type</th>
                    <th className="p-4 text-right">Min Level</th>
                    <th className="p-4 text-right">Qty On Hand</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {items.map((item) => {
                    const isLow = item.quantity_on_hand <= item.reorder_level;
                    return (
                      <tr key={item.id} className="hover:bg-zinc-850/30 text-zinc-350 transition-colors">
                        <td className="p-4 font-bold text-zinc-200">{item.sku}</td>
                        <td className="p-4 text-white font-medium">{item.name}</td>
                        <td className="p-4">{item.unit_of_measure}</td>
                        <td className="p-4 text-xs font-semibold uppercase">{item.item_type.replace("_", " ")}</td>
                        <td className="p-4 text-right text-zinc-500">{item.reorder_level}</td>
                        <td className={`p-4 text-right font-bold text-lg ${isLow ? "text-amber-500" : "text-emerald-400"}`}>
                          {item.quantity_on_hand} {item.unit_of_measure}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stock In Shipment Modal */}
        {showStockInModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl relative">
              <button
                onClick={() => setShowStockInModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h2 className="text-xl font-bold text-white mb-6">Record incoming raw shipment</h2>

              <form onSubmit={handleStockInSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Select Material / Supply SKU
                  </label>
                  <select
                    required
                    value={stockInItemId}
                    onChange={(e) => setStockInItemId(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Choose Material --</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.sku} - {i.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Received Qty
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={stockInQty}
                      onChange={(e) => setStockInQty(e.target.value)}
                      className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Unit Cost ($)
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={stockInCost}
                      onChange={(e) => setStockInCost(e.target.value)}
                      className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Batch / Lot Number (Supplier)
                  </label>
                  <input
                    type="text"
                    required
                    value={stockInBatch}
                    onChange={(e) => setStockInBatch(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g., LOT-2026-001"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Supplier Reference / Invoice #
                  </label>
                  <input
                    type="text"
                    value={stockInRef}
                    onChange={(e) => setStockInRef(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g., INV-99818"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Storage location
                  </label>
                  <input
                    type="text"
                    value={stockInLocation}
                    onChange={(e) => setStockInLocation(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowStockInModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-zinc-850 hover:bg-zinc-850 text-zinc-400 font-semibold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isStockInSaving}
                    className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors flex items-center justify-center"
                  >
                    {isStockInSaving ? (
                      <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                    ) : (
                      "Receive Stock"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Issue to WIP Modal */}
        {showIssueModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl relative">
              <button
                onClick={() => setShowIssueModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h2 className="text-xl font-bold text-white mb-6">Issue Materials to WIP Job</h2>

              <form onSubmit={handleIssueSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Select Target Job Order
                  </label>
                  <select
                    required
                    value={issueJobId}
                    onChange={(e) => setIssueJobId(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Choose WIP Job --</option>
                    {activeJobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.order_number} (Produce: {j.finished_item_name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Select Material SKU
                  </label>
                  <select
                    required
                    value={issueItemId}
                    onChange={(e) => setIssueItemId(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Choose SKU --</option>
                    {items.map((i) => (
                      <option key={i.id} value={i.id} disabled={i.quantity_on_hand <= 0}>
                        {i.sku} - {i.name} (Stock: {i.quantity_on_hand} {i.unit_of_measure})
                      </option>
                    ))}
                  </select>
                </div>

                {issueItemId && availableBatches.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                          Select Batch to Issue
                        </label>
                        <select
                          required
                          value={issueBatchNumber}
                          onChange={(e) => setIssueBatchNumber(e.target.value)}
                          className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                        >
                          {availableBatches.map((b) => (
                            <option key={b.batch_number} value={b.batch_number}>
                              {b.batch_number} (${b.unit_cost}/unit)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                          Available in Batch
                        </label>
                        <div className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-zinc-400 text-sm font-semibold">
                          {getSelectedBatchQty()}{" "}
                          {items.find((i) => i.id === parseInt(issueItemId))?.unit_of_measure}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                        Quantity to Issue
                      </label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={issueQty}
                        onChange={(e) => setIssueQty(e.target.value)}
                        className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                        placeholder="0"
                        max={getSelectedBatchQty()}
                      />
                    </div>
                  </>
                ) : issueItemId ? (
                  <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
                    No active supplier batches found for this item in stock. Run a manual adjustment or Stock In first.
                  </div>
                ) : null}

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowIssueModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-zinc-850 hover:bg-zinc-850 text-zinc-400 font-semibold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isIssueSaving || !issueBatchNumber || parseFloat(issueQty) > getSelectedBatchQty()}
                    className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors flex items-center justify-center disabled:opacity-50 disabled:hover:bg-emerald-650"
                  >
                    {isIssueSaving ? (
                      <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                    ) : (
                      "Issue Materials"
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
