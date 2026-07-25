"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../components/DashboardLayout";

interface Invoice {
  id: number;
  invoice_number: string;
  customer_id: number;
  customer_name?: string;
  invoice_date: string;
  due_date: string;
  grand_total: number;
  balance_due: number;
  status: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function InvoicesPage() {
  const { token } = useAuth() as any;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/sales/invoices`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setInvoices(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Invoices</h1>
            <p className="text-zinc-400 text-sm mt-1">Customer billing and accounts receivable status</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-800/50 text-xs text-zinc-400 uppercase">
                <th className="text-left px-4 py-3">Invoice #</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Due Date</th>
                <th className="text-right px-4 py-3">Total Amount</th>
                <th className="text-right px-4 py-3">Balance Due</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-500">
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-500">
                    No invoices found
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-mono text-emerald-400 font-medium">
                      <a href={`/sales/invoices/${inv.id}`} className="hover:underline">
                        {inv.invoice_number}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-white">{inv.customer_name || "—"}</td>
                    <td className="px-4 py-3 text-zinc-300">{inv.invoice_date}</td>
                    <td className="px-4 py-3 text-zinc-400">{inv.due_date}</td>
                    <td className="px-4 py-3 text-right text-white font-semibold">
                      ৳{inv.grand_total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-400 font-semibold">
                      ৳{inv.balance_due.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${inv.status === "PAID" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
