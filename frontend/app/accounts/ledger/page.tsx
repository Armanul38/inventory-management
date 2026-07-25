"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../components/DashboardLayout";

interface JournalLine {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: number;
  entry_number: string;
  entry_date: string;
  description: string;
  reference_type: string;
  lines: JournalLine[];
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function GeneralLedgerPage() {
  const { token } = useAuth() as any;
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/accounts/journal-entries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setEntries(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">General Ledger</h1>
            <p className="text-zinc-400 text-sm mt-1">Double-entry audit log & financial journal entries</p>
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-zinc-500">Loading journal entries...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">No journal entries found</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.entry_number} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-emerald-400 font-bold">{entry.entry_number}</span>
                    <span className="text-white text-sm font-medium">{entry.description}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-400">
                    <span>Ref: {entry.reference_type}</span>
                    <span>Date: {entry.entry_date}</span>
                  </div>
                </div>

                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-zinc-500 text-left">
                      <th className="py-1">Account Code</th>
                      <th className="py-1">Account Name</th>
                      <th className="py-1 text-right">Debit</th>
                      <th className="py-1 text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {entry.lines.map((l, idx) => (
                      <tr key={idx} className="text-zinc-300">
                        <td className="py-1.5 font-mono text-emerald-400/80">{l.account_code}</td>
                        <td className="py-1.5">{l.account_name}</td>
                        <td className="py-1.5 text-right font-mono text-white">
                          {l.debit > 0 ? `৳${l.debit.toFixed(2)}` : "—"}
                        </td>
                        <td className="py-1.5 text-right font-mono text-white">
                          {l.credit > 0 ? `৳${l.credit.toFixed(2)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
