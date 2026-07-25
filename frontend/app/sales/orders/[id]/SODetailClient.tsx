"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import DashboardLayout from "../../../components/DashboardLayout";

interface SOLine {
  id: number;
  finished_item_id: number;
  quantity_ordered: number;
  quantity_delivered: number;
  unit_price: number;
  line_total: number;
}

interface SO {
  id: number;
  so_number: string;
  customer_id: number;
  customer_name?: string;
  order_date: string;
  status: string;
  grand_total: number;
  lines: SOLine[];
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SODetailClient({ id }: { id: string }) {
  const { token } = useAuth() as any;
  const [so, setSo] = useState<SO | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchSO = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/sales/orders/${id}`, { headers });
      if (res.ok) setSo(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSO(); }, [id]);

  const handleConfirm = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/sales/orders/${id}/confirm`, { method: "PATCH", headers });
      if (res.ok) fetchSO();
      else { const err = await res.json(); alert(err.detail || "Failed to confirm order"); }
    } finally { setActionLoading(false); }
  };

  const handleCreateInvoice = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/sales/orders/${id}/invoices?invoice_date=${new Date().toISOString().split("T")[0]}`, { method: "POST", headers });
      if (res.ok) { alert("Invoice created successfully!"); fetchSO(); }
      else { const err = await res.json(); alert(err.detail || "Failed to create invoice"); }
    } finally { setActionLoading(false); }
  };

  if (loading) return <DashboardLayout><div className="p-6 text-zinc-400">Loading order detail...</div></DashboardLayout>;
  if (!so) return <DashboardLayout><div className="p-6 text-zinc-400">Sales order not found.</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{so.so_number}</h1>
              <span className="font-mono text-xs px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">{so.status}</span>
            </div>
            <p className="text-zinc-400 text-sm mt-1">Customer: {so.customer_name || so.customer_id}</p>
          </div>
          <div className="flex gap-3">
            {so.status === "DRAFT" && (
              <button onClick={handleConfirm} disabled={actionLoading} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all">
                Confirm Order &amp; Reserve Stock
              </button>
            )}
            {so.status !== "DRAFT" && so.status !== "CANCELLED" && (
              <button onClick={handleCreateInvoice} disabled={actionLoading} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-lg transition-all">
                Generate Invoice
              </button>
            )}
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Line Items</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-800/50 text-xs text-zinc-400 uppercase">
                  <th className="text-left px-4 py-3">Item ID</th>
                  <th className="text-right px-4 py-3">Ordered</th>
                  <th className="text-right px-4 py-3">Delivered</th>
                  <th className="text-right px-4 py-3">Unit Price</th>
                  <th className="text-right px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {so.lines.map((l) => (
                  <tr key={l.id} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-mono text-emerald-400">Item #{l.finished_item_id}</td>
                    <td className="px-4 py-3 text-right text-zinc-300">{l.quantity_ordered}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-medium">{l.quantity_delivered}</td>
                    <td className="px-4 py-3 text-right text-zinc-300">৳{l.unit_price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-white font-semibold">৳{l.line_total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
