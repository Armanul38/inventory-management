"use client";
import React, { useEffect, useState, use } from "react";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../components/DashboardLayout";

interface LedgerData {
  supplier: {
    id: number;
    company_name: string;
    supplier_code: string;
  };
  summary: {
    total_purchases: number;
    total_paid: number;
    outstanding_balance: number;
  };
  grns: Array<{
    grn_number: string;
    received_date: string;
    total_amount: number;
    amount_paid: number;
    balance_due: number;
  }>;
  payments: Array<{
    payment_number: string;
    payment_date: string;
    amount: number;
    payment_method: string;
    reference_number: string | null;
  }>;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { token } = useAuth() as any;
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [refNo, setRefNo] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/suppliers/${resolvedParams.id}/ledger`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLedger();
  }, [resolvedParams.id]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/v1/suppliers/${resolvedParams.id}/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment_date: new Date().toISOString().split("T")[0],
          amount: parseFloat(paymentAmount),
          payment_method: paymentMethod,
          reference_number: refNo || null,
          notes: notes || null,
        }),
      });
      if (res.ok) {
        setShowPaymentModal(false);
        setPaymentAmount("");
        setRefNo("");
        setNotes("");
        fetchLedger();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <DashboardLayout><div className="p-6 text-zinc-400">Loading supplier detail...</div></DashboardLayout>;
  if (!data) return <DashboardLayout><div className="p-6 text-zinc-400">Supplier not found.</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{data.supplier.company_name}</h1>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {data.supplier.supplier_code}
              </span>
            </div>
            <p className="text-zinc-400 text-sm mt-1">Supplier Ledger & Payment History</p>
          </div>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all"
          >
            Record Payment
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
            <div className="text-xs text-zinc-400 uppercase font-medium">Total Purchases</div>
            <div className="text-2xl font-bold text-white mt-1">
              ৳{data.summary.total_purchases.toLocaleString()}
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
            <div className="text-xs text-zinc-400 uppercase font-medium">Total Paid</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              ৳{data.summary.total_paid.toLocaleString()}
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl">
            <div className="text-xs text-zinc-400 uppercase font-medium">Outstanding Balance</div>
            <div className="text-2xl font-bold text-rose-400 mt-1">
              ৳{data.summary.outstanding_balance.toLocaleString()}
            </div>
          </div>
        </div>

        {/* GRN History */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Goods Receipt Notes (GRNs)</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-800/50 text-xs text-zinc-400 uppercase">
                  <th className="text-left px-4 py-3">GRN #</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-right px-4 py-3">Total Amount</th>
                  <th className="text-right px-4 py-3">Amount Paid</th>
                  <th className="text-right px-4 py-3">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {data.grns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-zinc-500">
                      No GRNs recorded
                    </td>
                  </tr>
                ) : (
                  data.grns.map((g) => (
                    <tr key={g.grn_number} className="hover:bg-zinc-800/30">
                      <td className="px-4 py-3 font-mono text-emerald-400">{g.grn_number}</td>
                      <td className="px-4 py-3 text-zinc-300">{g.received_date}</td>
                      <td className="px-4 py-3 text-right text-white font-medium">
                        ৳{g.total_amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400">
                        ৳{g.amount_paid.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-rose-400">
                        ৳{g.balance_due.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment History */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Payments Issued</h2>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-800/50 text-xs text-zinc-400 uppercase">
                  <th className="text-left px-4 py-3">Payment #</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Method</th>
                  <th className="text-left px-4 py-3">Reference</th>
                  <th className="text-right px-4 py-3">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {data.payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-zinc-500">
                      No payments recorded
                    </td>
                  </tr>
                ) : (
                  data.payments.map((p) => (
                    <tr key={p.payment_number} className="hover:bg-zinc-800/30">
                      <td className="px-4 py-3 font-mono text-emerald-400">{p.payment_number}</td>
                      <td className="px-4 py-3 text-zinc-300">{p.payment_date}</td>
                      <td className="px-4 py-3 text-zinc-300">{p.payment_method}</td>
                      <td className="px-4 py-3 text-zinc-400">{p.reference_number || "—"}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                        ৳{p.amount.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                <h2 className="text-lg font-bold text-white">Record Payment to Supplier</h2>
                <button onClick={() => setShowPaymentModal(false)} className="text-zinc-400 hover:text-white">
                  ✕
                </button>
              </div>
              <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Amount (৳)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="MOBILE_BANKING">Mobile Banking</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Reference No / Cheque No</label>
                  <input
                    type="text"
                    value={refNo}
                    onChange={(e) => setRefNo(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 px-4 py-2 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:border-zinc-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all disabled:opacity-50"
                  >
                    {submitting ? "Saving..." : "Record Payment"}
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
