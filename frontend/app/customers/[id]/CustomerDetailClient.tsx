"use client";
import React, { useEffect, useState, use } from "react";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../components/DashboardLayout";

interface LedgerData {
  customer: {
    id: number;
    customer_code: string;
    company_name: string;
    credit_limit: number;
  };
  summary: {
    total_invoiced: number;
    total_paid: number;
    total_credited: number;
    outstanding_balance: number;
    available_credit: number;
  };
  invoices: Array<{
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    grand_total: number;
    amount_paid: number;
    balance_due: number;
    status: string;
  }>;
  payments: Array<{
    payment_number: string;
    payment_date: string;
    amount: number;
    payment_method: string;
  }>;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function CustomerDetailClient({ id }: { id: string }) {
  const { token } = useAuth() as any;
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/customers/${id}/ledger`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [id]);

  if (loading) return <DashboardLayout><div className="p-6 text-zinc-400">Loading customer ledger...</div></DashboardLayout>;
  if (!data) return <DashboardLayout><div className="p-6 text-zinc-400">Customer not found.</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{data.customer.company_name}</h1>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {data.customer.customer_code}
              </span>
            </div>
            <p className="text-zinc-400 text-sm mt-1">Customer Account Ledger &amp; Billing Summary</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
            <div className="text-xs text-zinc-400 uppercase font-medium">Credit Limit</div>
            <div className="text-xl font-bold text-white mt-1">
              ৳{data.customer.credit_limit.toLocaleString()}
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
            <div className="text-xs text-zinc-400 uppercase font-medium">Total Invoiced</div>
            <div className="text-xl font-bold text-white mt-1">
              ৳{data.summary.total_invoiced.toLocaleString()}
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
            <div className="text-xs text-zinc-400 uppercase font-medium">Total Received</div>
            <div className="text-xl font-bold text-emerald-400 mt-1">
              ৳{data.summary.total_paid.toLocaleString()}
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
            <div className="text-xs text-zinc-400 uppercase font-medium">Outstanding Balance</div>
            <div className="text-xl font-bold text-rose-400 mt-1">
              ৳{data.summary.outstanding_balance.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Invoices */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Invoices</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-800/50 text-xs text-zinc-400 uppercase">
                  <th className="text-left px-4 py-3">Invoice #</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Due Date</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3">Balance</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {data.invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-zinc-500">
                      No invoices generated
                    </td>
                  </tr>
                ) : (
                  data.invoices.map((i) => (
                    <tr key={i.invoice_number} className="hover:bg-zinc-800/30">
                      <td className="px-4 py-3 font-mono text-emerald-400">{i.invoice_number}</td>
                      <td className="px-4 py-3 text-zinc-300">{i.invoice_date}</td>
                      <td className="px-4 py-3 text-zinc-400">{i.due_date}</td>
                      <td className="px-4 py-3 text-right text-white font-medium">৳{i.grand_total.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-rose-400">৳{i.balance_due.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${i.status === "PAID" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                          {i.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
