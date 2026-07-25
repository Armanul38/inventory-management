"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../components/DashboardLayout";

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

interface AllocatedMaterial {
  item_id: number;
  sku: string;
  name: string;
  quantity_allocated: number;
  unit_cost: number;
  total_cost: number;
  batch_number: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function JobDetailPage({ params }: PageProps) {
  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const jobId = resolvedParams.id;

  const { apiFetch } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [allocations, setAllocations] = useState<AllocatedMaterial[]>([]);
  const [totalMaterialsCost, setTotalMaterialsCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadJobDetails() {
      try {
        setLoading(true);
        const data = await apiFetch(`/production/jobs/${jobId}`);
        setJob(data.job);
        setAllocations(data.allocated_materials);
        setTotalMaterialsCost(data.total_materials_cost);
      } catch (err: any) {
        setError(err.message || "Failed to load Job details");
      } finally {
        setLoading(false);
      }
    }
    if (jobId) {
      loadJobDetails();
    }
  }, [jobId]);

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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center py-20">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-emerald-500"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !job) {
    return (
      <DashboardLayout>
        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-xl text-center">
          <h2 className="text-lg font-bold text-red-400">Error</h2>
          <p className="text-zinc-400 mt-2">{error || "Job Order details could not be found."}</p>
          <Link href="/jobs" className="mt-4 inline-block text-sm text-emerald-400 hover:text-emerald-350 underline">
            Back to Job Orders
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fadeIn">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Link href="/jobs" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1.5 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              WIP Jobs
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Job Order Details: {job.order_number}
            </h1>
          </div>
          <span className={`border rounded-full px-3 py-1 text-sm font-bold uppercase tracking-wider self-start sm:self-auto ${getStatusBadge(job.status)}`}>
            {job.status}
          </span>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-zinc-900 border border-zinc-850 rounded-xl space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Target SKU Specification</div>
            <div className="text-lg font-bold text-white truncate">{job.finished_item_sku}</div>
            <div className="text-sm text-zinc-400 truncate">{job.finished_item_name}</div>
          </div>
          <div className="p-6 bg-zinc-900 border border-zinc-850 rounded-xl space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Target Yield vs Output</div>
            <div className="text-lg font-bold text-white">{job.target_quantity} target units</div>
            <div className="text-sm text-zinc-400">
              {job.status === "COMPLETED" 
                ? `Actual Yield: ${job.actual_yield} units` 
                : "Awaiting final batch run"}
            </div>
          </div>
          <div className="p-6 bg-zinc-900 border border-zinc-850 rounded-xl space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Calculated Cost Per Unit</div>
            <div className="text-lg font-bold text-emerald-400">
              {job.status === "COMPLETED" && job.actual_yield > 0
                ? `$${(totalMaterialsCost / job.actual_yield).toFixed(2)}`
                : "$0.00"}
            </div>
            <div className="text-sm text-zinc-400">
              Total consumed material value: ${totalMaterialsCost.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Allocation Log */}
        <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2" />
            </svg>
            Consumed Material Allocation Table
          </h2>

          {allocations.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-lg">
              No materials allocated to this Job Order yet. Use the Store Keeper "Issue to WIP" panel.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-semibold">
                    <th className="pb-3">SKU</th>
                    <th className="pb-3">Material Name</th>
                    <th className="pb-3">Batch Reference</th>
                    <th className="pb-3 text-right">Quantity Consumed</th>
                    <th className="pb-3 text-right">Unit Cost</th>
                    <th className="pb-3 text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 text-zinc-350">
                  {allocations.map((a, i) => (
                    <tr key={i} className="hover:bg-zinc-850/10">
                      <td className="py-3 font-semibold text-zinc-200">{a.sku}</td>
                      <td className="py-3">{a.name}</td>
                      <td className="py-3 text-zinc-500">{a.batch_number}</td>
                      <td className="py-3 text-right font-medium text-white">{a.quantity_allocated}</td>
                      <td className="py-3 text-right">${a.unit_cost.toFixed(2)}</td>
                      <td className="py-3 text-right font-semibold text-emerald-400">
                        ${a.total_cost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-zinc-800 font-bold text-white text-base">
                    <td colSpan={5} className="py-4 text-right">Total Raw Input Valuation:</td>
                    <td className="py-4 text-right text-emerald-400">${totalMaterialsCost.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
