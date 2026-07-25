"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";

interface Item {
  id: number;
  sku: string;
  name: string;
  item_type: string;
}

interface Job {
  id: number;
  order_number: string;
  finished_item_sku: string;
  finished_item_name: string;
  target_quantity: number;
  actual_yield: number;
  scrap_quantity: number;
  status: string;
  created_by_name: string;
  created_at: string;
}

export default function JobsPage() {
  const { apiFetch, user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [fgItems, setFgItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState<Job | null>(null);

  // Create Job Form State
  const [orderNumber, setOrderNumber] = useState("");
  const [finishedItemId, setFinishedItemId] = useState("");
  const [targetQty, setTargetQty] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Complete Job Form State
  const [actualYield, setActualYield] = useState("");
  const [scrapQty, setScrapQty] = useState("0");
  const [fgLocation, setFgLocation] = useState("Finished Goods Warehouse");
  const [isCompleting, setIsCompleting] = useState(false);

  // Role permissions check
  const isSupervisorOrAdmin = user?.role === "ADMIN" || user?.role === "PRODUCTION_SUPERVISOR";

  useEffect(() => {
    loadJobsData();
  }, []);

  const loadJobsData = async () => {
    try {
      setLoading(true);
      const [jobsData, itemsData] = await Promise.all([
        apiFetch("/production/jobs"),
        apiFetch("/inventory/items"),
      ]);
      setJobs(jobsData);
      
      const finishedGoods = itemsData.filter((i: Item) => i.item_type === "FINISHED_GOOD");
      setFgItems(finishedGoods);
    } catch (err: any) {
      setError(err.message || "Failed to load production jobs");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);
    try {
      await apiFetch("/production/jobs", {
        method: "POST",
        body: JSON.stringify({
          order_number: orderNumber.trim().toUpperCase(),
          finished_item_id: parseInt(finishedItemId),
          target_quantity: parseFloat(targetQty),
        }),
      });

      setSuccess(`Job Order ${orderNumber.toUpperCase()} created successfully as DRAFT.`);
      setOrderNumber("");
      setFinishedItemId("");
      setTargetQty("");
      setShowCreateModal(false);
      loadJobsData();
    } catch (err: any) {
      setError(err.message || "Failed to create Job Order");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartJob = async (jobId: number) => {
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/production/jobs/${jobId}/start`, {
        method: "PUT",
      });
      setSuccess("Job Order transitioned to IN PROGRESS.");
      loadJobsData();
    } catch (err: any) {
      setError(err.message || "Failed to start Job Order");
    }
  };

  const handleCancelJob = async (jobId: number) => {
    if (!confirm("Are you sure you want to cancel this Job Order? All issued raw materials will be automatically returned to inventory.")) {
      return;
    }
    setError("");
    setSuccess("");
    try {
      await apiFetch(`/production/jobs/${jobId}/cancel`, {
        method: "PUT",
      });
      setSuccess("Job Order CANCELLED. Materials returned to stock.");
      loadJobsData();
    } catch (err: any) {
      setError(err.message || "Failed to cancel Job Order");
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCompleteModal) return;
    setError("");
    setSuccess("");
    setIsCompleting(true);
    try {
      await apiFetch(`/production/jobs/${showCompleteModal.id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          actual_yield: parseFloat(actualYield),
          scrap_quantity: parseFloat(scrapQty),
          finished_goods_location: fgLocation,
        }),
      });

      setSuccess(`Job Order ${showCompleteModal.order_number} completed. Finished Goods stocked.`);
      setActualYield("");
      setScrapQty("0");
      setShowCompleteModal(null);
      loadJobsData();
    } catch (err: any) {
      setError(err.message || "Failed to complete Job Order");
    } finally {
      setIsCompleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
      case "IN_PROGRESS":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "COMPLETED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "CANCELLED":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-zinc-500 border-zinc-500/20";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Work-In-Progress (WIP) Job Orders</h1>
            <p className="text-zinc-400 mt-1">Open batches, allocate materials, and track production yields.</p>
          </div>
          {isSupervisorOrAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all flex items-center gap-2 text-sm self-start md:self-auto"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Open Job Order
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

        {/* Jobs List */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-12 bg-zinc-900 rounded-lg"></div>
            <div className="h-12 bg-zinc-900 rounded-lg"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
            No production job orders found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-zinc-900 border border-zinc-850 rounded-xl p-6 space-y-4 flex flex-col justify-between hover:border-zinc-850 transition-all relative"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <Link href={`/jobs/${job.id}`} className="text-xl font-bold text-white hover:text-emerald-400 transition-colors flex items-center gap-2">
                        {job.order_number}
                        <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </Link>
                      <div className="text-xs text-zinc-500">
                        Opened on {new Date(job.created_at).toLocaleDateString()} by {job.created_by_name}
                      </div>
                    </div>
                    <span className={`border rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${getStatusBadge(job.status)}`}>
                      {job.status}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 border-t border-zinc-850 pt-4 text-sm text-zinc-400">
                    <div>
                      <div className="text-xs text-zinc-500 uppercase font-semibold">Target SKU</div>
                      <div className="text-white font-medium truncate mt-0.5" title={job.finished_item_name}>
                        {job.finished_item_sku} - {job.finished_item_name}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500 uppercase font-semibold">Target Output</div>
                      <div className="text-white font-medium mt-0.5">{job.target_quantity} units</div>
                    </div>
                  </div>

                  {job.status === "COMPLETED" && (
                    <div className="grid grid-cols-2 gap-4 mt-4 bg-zinc-950/40 p-3 rounded-lg border border-emerald-950/20 text-sm">
                      <div>
                        <div className="text-xs text-zinc-500">Actual Yield</div>
                        <div className="text-emerald-400 font-bold text-base mt-0.5">{job.actual_yield} units</div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">Defect/Scrap</div>
                        <div className="text-rose-400 font-semibold text-base mt-0.5">{job.scrap_quantity} units</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {isSupervisorOrAdmin && (job.status === "DRAFT" || job.status === "IN_PROGRESS") && (
                  <div className="flex gap-2 pt-2 border-t border-zinc-850">
                    {job.status === "DRAFT" && (
                      <button
                        onClick={() => handleStartJob(job.id)}
                        className="flex-1 py-2 text-xs font-bold uppercase bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
                      >
                        Start Production
                      </button>
                    )}
                    {job.status === "IN_PROGRESS" && (
                      <button
                        onClick={() => setShowCompleteModal(job)}
                        className="flex-1 py-2 text-xs font-bold uppercase bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
                      >
                        Record Yield / Complete
                      </button>
                    )}
                    <button
                      onClick={() => handleCancelJob(job.id)}
                      className="py-2 px-3 text-xs font-bold uppercase border border-zinc-800 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-zinc-400 rounded-lg transition-colors"
                    >
                      Cancel Job
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Create Job Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl relative">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h2 className="text-xl font-bold text-white mb-6">Open WIP Job Order</h2>

              <form onSubmit={handleCreateJob} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Job Order Number (Batch Ref)
                  </label>
                  <input
                    type="text"
                    required
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g., JOB-BATCH-2026-A"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Select Target Finished Good SKU
                  </label>
                  <select
                    required
                    value={finishedItemId}
                    onChange={(e) => setFinishedItemId(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">-- Choose SKU --</option>
                    {fgItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.sku} - {i.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Target Yield Quantity (Units)
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={targetQty}
                    onChange={(e) => setTargetQty(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="0"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-zinc-850 hover:bg-zinc-850 text-zinc-400 font-semibold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors flex items-center justify-center"
                  >
                    {isSaving ? (
                      <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                    ) : (
                      "Save Job"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Complete Job Modal */}
        {showCompleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl relative animate-scaleUp">
              <button
                onClick={() => setShowCompleteModal(null)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h2 className="text-xl font-bold text-white mb-2">Record Production Yield</h2>
              <p className="text-xs text-zinc-400 mb-6">
                Completing job order <span className="font-semibold text-amber-400">{showCompleteModal.order_number}</span>.
              </p>

              <form onSubmit={handleCompleteSubmit} className="space-y-4">
                <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-lg text-sm text-zinc-400 space-y-1">
                  <div>Target finished SKU: <span className="text-white font-medium">{showCompleteModal.finished_item_sku}</span></div>
                  <div>Target yield size: <span className="text-white font-medium">{showCompleteModal.target_quantity} units</span></div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Actual Yield Output
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={actualYield}
                      onChange={(e) => setActualYield(e.target.value)}
                      className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Scrap / Defect Yield
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={scrapQty}
                      onChange={(e) => setScrapQty(e.target.value)}
                      className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Store Destination Location
                  </label>
                  <input
                    type="text"
                    required
                    value={fgLocation}
                    onChange={(e) => setFgLocation(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    The warehouse shelf location where completed items will be stored.
                  </p>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCompleteModal(null)}
                    className="flex-1 px-4 py-2 rounded-lg border border-zinc-850 hover:bg-zinc-850 text-zinc-400 font-semibold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCompleting}
                    className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors flex items-center justify-center"
                  >
                    {isCompleting ? (
                      <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                    ) : (
                      "Finalize & Stock"
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
