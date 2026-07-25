"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";
import { exportToCSV, printElement } from "../utils/exportUtils";

interface TrialBalanceAccount {
  account_code: string;
  account_name: string;
  account_type: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ReportsPage() {
  const { token } = useAuth() as any;
  const [tbAccounts, setTbAccounts] = useState<TrialBalanceAccount[]>([]);
  const [tbTotals, setTbTotals] = useState<{ total_debit: number; total_credit: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTrialBalance = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/reports/trial-balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTbAccounts(data.accounts);
        setTbTotals(data.totals);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrialBalance();
  }, []);

  const handleExportCSV = () => {
    if (!tbAccounts || tbAccounts.length === 0) return;
    exportToCSV("Trial_Balance_Report", tbAccounts, [
      { key: "account_code", label: "Account Code" },
      { key: "account_name", label: "Account Name" },
      { key: "account_type", label: "Account Type" },
      { key: "total_debit", label: "Debit (BDT)" },
      { key: "total_credit", label: "Credit (BDT)" },
      { key: "balance", label: "Net Balance (BDT)" },
    ]);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Financial Reports</h1>
            <p className="text-zinc-400 text-sm mt-1">Trial balance & accounting overview</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => printElement("printable-tb", "Trial_Balance_Report")}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg border border-zinc-700 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Save PDF
            </button>
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
        </div>

        <div id="printable-tb" className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Trial Balance</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-800/50 text-xs text-zinc-400 uppercase">
                  <th className="text-left px-4 py-3">Code</th>
                  <th className="text-left px-4 py-3">Account Name</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-right px-4 py-3">Debit</th>
                  <th className="text-right px-4 py-3">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-zinc-500">
                      Loading trial balance...
                    </td>
                  </tr>
                ) : tbAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-zinc-500">
                      No accounting records found
                    </td>
                  </tr>
                ) : (
                  tbAccounts.map((a) => (
                    <tr key={a.account_code} className="hover:bg-zinc-800/30">
                      <td className="px-4 py-3 font-mono text-emerald-400 text-xs">{a.account_code}</td>
                      <td className="px-4 py-3 font-medium text-white">{a.account_name}</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">{a.account_type}</td>
                      <td className="px-4 py-3 text-right text-white font-mono">
                        {a.total_debit > 0 ? `৳${a.total_debit.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-white font-mono">
                        {a.total_credit > 0 ? `৳${a.total_credit.toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {tbTotals && (
                <tfoot>
                  <tr className="border-t border-zinc-700 bg-zinc-800/80 font-bold text-white text-sm">
                    <td colSpan={3} className="px-4 py-3">
                      TOTALS
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-400">
                      ৳{tbTotals.total_debit.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-400">
                      ৳{tbTotals.total_credit.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
