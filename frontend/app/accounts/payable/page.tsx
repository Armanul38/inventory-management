"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../components/DashboardLayout";
import { exportToCSV } from "../../utils/exportUtils";

interface APItem {
  supplier_id: number;
  supplier_code: string;
  company_name: string;
  total_purchases: number;
  total_paid: number;
  outstanding_balance: number;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AccountsPayablePage() {
  const { token } = useAuth() as any;
  const [apData, setApData] = useState<{ total_outstanding: number; suppliers: APItem[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAP = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/accounts/payable`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setApData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAP();
  }, []);

  const handleExportCSV = () => {
    if (!apData || !apData.suppliers) return;
    exportToCSV(
      "Accounts_Payable_Report",
      apData.suppliers,
      [
        { key: "supplier_code", label: "Supplier Code" },
        { key: "company_name", label: "Supplier Name" },
        { key: "total_purchases", label: "Total Purchases (BDT)" },
        { key: "total_paid", label: "Total Paid (BDT)" },
        { key: "outstanding_balance", label: "Outstanding Balance (BDT)" },
      ]
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Accounts Payable (AP)</h1>
            <p className="text-zinc-400 text-sm mt-1">Vendor payables summary and outstanding liabilities</p>
          </div>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Excel (CSV)
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl max-w-sm">
          <div className="text-xs text-zinc-400 uppercase font-medium">Total Payable</div>
          <div className="text-3xl font-bold text-rose-400 mt-1">
            ৳{apData?.total_outstanding.toLocaleString() || 0}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-800/50 text-xs text-zinc-400 uppercase">
                <th className="text-left px-4 py-3">Supplier Code</th>
                <th className="text-left px-4 py-3">Supplier Name</th>
                <th className="text-right px-4 py-3">Total Purchases</th>
                <th className="text-right px-4 py-3">Total Paid</th>
                <th className="text-right px-4 py-3">Outstanding Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-zinc-500">
                    Loading payables...
                  </td>
                </tr>
              ) : !apData || apData.suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-zinc-500">
                    No outstanding payables
                  </td>
                </tr>
              ) : (
                apData.suppliers.map((s) => (
                  <tr key={s.supplier_id} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-mono text-emerald-400 text-xs">{s.supplier_code}</td>
                    <td className="px-4 py-3 font-medium text-white">{s.company_name}</td>
                    <td className="px-4 py-3 text-right text-zinc-300">
                      ৳{s.total_purchases.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400">
                      ৳{s.total_paid.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-400 font-semibold">
                      ৳{s.outstanding_balance.toLocaleString()}
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
