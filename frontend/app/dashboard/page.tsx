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
  unit_of_measure: string;
  reorder_level: number;
  quantity_on_hand: number;
}

interface Job {
  id: number;
  order_number: string;
  finished_item_sku: string;
  finished_item_name: string;
  target_quantity: number;
  status: string;
}

interface Transaction {
  id: number;
  item_sku: string;
  item_name: string;
  quantity_change: number;
  transaction_type: string;
  performed_by_name: string;
  timestamp: string;
  notes: string;
}

export default function DashboardPage() {
  const { apiFetch, user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [completedJobsCount, setCompletedJobsCount] = useState(0);
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);
        const [itemsData, activeJobsData, allJobsData, txnsData] = await Promise.all([
          apiFetch("/inventory/items"),
          apiFetch("/production/jobs?status_filter=IN_PROGRESS"),
          apiFetch("/production/jobs"),
          apiFetch("/audit/transactions"),
        ]);

        setItems(itemsData);
        setActiveJobs(activeJobsData);
        
        // Filter completed jobs from all jobs
        const completed = allJobsData.filter((j: any) => j.status === "COMPLETED");
        setCompletedJobsCount(completed.length);
        
        setRecentTxns(txnsData.slice(0, 5));
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, []);

  const lowStockItems = items.filter(
    (item) => item.quantity_on_hand <= item.reorder_level && item.item_type !== "FINISHED_GOOD"
  );

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
        {/* Top welcome */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard Overview</h1>
            <p className="text-zinc-400 mt-1">Real-time status of material flow and job yields.</p>
          </div>
          <div className="text-sm text-zinc-500 bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-lg">
            Role: <span className="text-white font-semibold">{user?.role}</span>
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-zinc-900 border border-zinc-850 rounded-xl"></div>
            ))}
          </div>
        ) : (
          /* Stats grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-zinc-900 border border-zinc-850 rounded-xl relative overflow-hidden group hover:border-zinc-800 transition-all">
              <div className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Catalog SKU Count</div>
              <div className="text-3xl font-bold text-white mt-2">{items.length}</div>
              <div className="text-xs text-zinc-500 mt-1">Unique catalog entries</div>
              <div className="absolute right-4 bottom-4 text-zinc-800 group-hover:text-emerald-950 transition-colors">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
                </svg>
              </div>
            </div>

            <div className={`p-6 border rounded-xl relative overflow-hidden group transition-all ${
              lowStockItems.length > 0 
                ? "bg-amber-950/10 border-amber-900/30 hover:border-amber-900/50" 
                : "bg-zinc-900 border-zinc-850 hover:border-zinc-800"
            }`}>
              <div className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Low Stock SKUs</div>
              <div className={`text-3xl font-bold mt-2 ${lowStockItems.length > 0 ? "text-amber-400" : "text-white"}`}>
                {lowStockItems.length}
              </div>
              <div className="text-xs text-zinc-500 mt-1">Below target reorder level</div>
              <div className="absolute right-4 bottom-4 text-zinc-800 transition-colors">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>

            <div className="p-6 bg-zinc-900 border border-zinc-850 rounded-xl relative overflow-hidden group hover:border-zinc-800 transition-all">
              <div className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Active WIP Jobs</div>
              <div className="text-3xl font-bold text-white mt-2">{activeJobs.length}</div>
              <div className="text-xs text-zinc-500 mt-1">Currently in progress</div>
              <div className="absolute right-4 bottom-4 text-zinc-800 group-hover:text-purple-950 transition-colors">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2" />
                </svg>
              </div>
            </div>

            <div className="p-6 bg-zinc-900 border border-zinc-850 rounded-xl relative overflow-hidden group hover:border-zinc-800 transition-all">
              <div className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">Completed Batches</div>
              <div className="text-3xl font-bold text-white mt-2">{completedJobsCount}</div>
              <div className="text-xs text-zinc-500 mt-1">Finished good batch runs</div>
              <div className="absolute right-4 bottom-4 text-zinc-800 group-hover:text-blue-950 transition-colors">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic content tables split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Low Stock Alerts */}
          <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Low-Stock Warnings
            </h2>
            {loading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-10 bg-zinc-800 rounded"></div>
                <div className="h-10 bg-zinc-800 rounded"></div>
              </div>
            ) : lowStockItems.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-lg">
                No low-stock items detected. Healthy levels.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 font-semibold">
                      <th className="pb-3">SKU</th>
                      <th className="pb-3">Item Name</th>
                      <th className="pb-3 text-right">Available</th>
                      <th className="pb-3 text-right">Min Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {lowStockItems.map((item) => (
                      <tr key={item.id} className="text-zinc-300">
                        <td className="py-3 font-semibold text-emerald-400">{item.sku}</td>
                        <td className="py-3">{item.name}</td>
                        <td className="py-3 text-right text-amber-400 font-bold">
                          {item.quantity_on_hand} {item.unit_of_measure}
                        </td>
                        <td className="py-3 text-right text-zinc-500">
                          {item.reorder_level} {item.unit_of_measure}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Active Job Orders */}
          <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2" />
              </svg>
              Active WIP Manufacturing
            </h2>
            {loading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-10 bg-zinc-800 rounded"></div>
                <div className="h-10 bg-zinc-800 rounded"></div>
              </div>
            ) : activeJobs.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-lg">
                No active jobs. Open a Job Order in the supervisor panel.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-400 font-semibold">
                      <th className="pb-3">Job Number</th>
                      <th className="pb-3">Target Product</th>
                      <th className="pb-3 text-right">Target Output</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {activeJobs.map((job) => (
                      <tr key={job.id} className="text-zinc-300">
                        <td className="py-3 font-semibold text-purple-400">{job.order_number}</td>
                        <td className="py-3 truncate max-w-[150px]">
                          {job.finished_item_name} ({job.finished_item_sku})
                        </td>
                        <td className="py-3 text-right font-semibold">
                          {job.target_quantity} units
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Recent Audit Log */}
        <div className="bg-zinc-900 border border-zinc-850 rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" />
              </svg>
              Recent Audit Log (Stock Movement)
            </h2>
            <Link href="/audit" className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">
              View All logs
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2 animate-pulse">
              <div className="h-12 bg-zinc-800 rounded"></div>
              <div className="h-12 bg-zinc-800 rounded"></div>
            </div>
          ) : recentTxns.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-lg">
              No recent transactions recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-semibold">
                    <th className="pb-3">Timestamp</th>
                    <th className="pb-3">Item</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3 text-right">Delta Change</th>
                    <th className="pb-3">User</th>
                    <th className="pb-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {recentTxns.map((t) => (
                    <tr key={t.id} className="text-zinc-300">
                      <td className="py-3 text-xs text-zinc-500">
                        {new Date(t.timestamp).toLocaleDateString()}{" "}
                        {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3">
                        <span className="font-semibold text-zinc-200">{t.item_sku}</span>{" "}
                        <span className="text-xs text-zinc-500">({t.item_name})</span>
                      </td>
                      <td className="py-3">
                        <span className={`inline-block border rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase ${getTxnTypeBadge(t.transaction_type)}`}>
                          {t.transaction_type.replace("_", " ")}
                        </span>
                      </td>
                      <td className={`py-3 text-right font-bold ${t.quantity_change > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {t.quantity_change > 0 ? "+" : ""}
                        {t.quantity_change}
                      </td>
                      <td className="py-3 text-xs text-zinc-400">{t.performed_by_name}</td>
                      <td className="py-3 text-xs text-zinc-500 truncate max-w-[200px]">{t.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
