"use client";
import React, { useEffect, useState, use } from "react";
import { useAuth } from "../../../context/AuthContext";
import DashboardLayout from "../../../components/DashboardLayout";
import { printElement } from "../../../utils/exportUtils";

interface InvoiceData {
  invoice: {
    id: number;
    invoice_number: string;
    customer_id: number;
    customer_name?: string;
    invoice_date: string;
    due_date: string;
    subtotal: number;
    tax_amount: number;
    grand_total: number;
    amount_paid: number;
    balance_due: number;
    status: string;
  };
  lines: Array<{
    id: number;
    finished_item_id: number;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  payments: Array<{
    id: number;
    payment_number: string;
    payment_date: string;
    amount: number;
    payment_method: string;
  }>;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { token } = useAuth() as any;
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("BANK_TRANSFER");
  const [submitting, setSubmitting] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/sales/invoices/${resolvedParams.id}`, { headers });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [resolvedParams.id]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/v1/sales/invoices/${resolvedParams.id}/payments`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          payment_date: new Date().toISOString().split("T")[0],
          amount: parseFloat(paymentAmount),
          payment_method: paymentMethod,
        }),
      });
      if (res.ok) {
        setShowPaymentModal(false);
        setPaymentAmount("");
        fetchInvoice();
      } else {
        const err = await res.json();
        alert(err.detail || "Payment failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <DashboardLayout><div className="p-6 text-zinc-400">Loading invoice detail...</div></DashboardLayout>;
  if (!data) return <DashboardLayout><div className="p-6 text-zinc-400">Invoice not found.</div></DashboardLayout>;

  const { invoice, lines, payments } = data;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{invoice.invoice_number}</h1>
              <span className="font-mono text-xs px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                {invoice.status}
              </span>
            </div>
            <p className="text-zinc-400 text-sm mt-1">Customer ID: {invoice.customer_id}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => printElement("printable-invoice", `Invoice_${invoice.invoice_number}`)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg border border-zinc-700 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Save PDF
            </button>

            {invoice.status !== "PAID" && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all"
              >
                Record Customer Payment
              </button>
            )}
          </div>
        </div>

        {/* Printable Area */}
        <div id="printable-invoice" className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-zinc-500 text-xs">Invoice Date</div>
              <div className="text-white mt-0.5">{invoice.invoice_date}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">Due Date</div>
              <div className="text-white mt-0.5">{invoice.due_date}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">Total Amount</div>
              <div className="text-white font-semibold mt-0.5">৳{invoice.grand_total.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">Balance Due</div>
              <div className="text-rose-400 font-semibold mt-0.5">৳{invoice.balance_due.toLocaleString()}</div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Line Items</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-800/50 text-xs text-zinc-400 uppercase">
                    <th className="text-left px-4 py-3">Item ID</th>
                    <th className="text-right px-4 py-3">Qty</th>
                    <th className="text-right px-4 py-3">Unit Price</th>
                    <th className="text-right px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {lines.map((l) => (
                    <tr key={l.id} className="hover:bg-zinc-800/30">
                      <td className="px-4 py-3 font-mono text-emerald-400">Item #{l.finished_item_id}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{l.quantity}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">৳{l.unit_price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-white font-semibold">
                        ৳{l.line_total.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                <h2 className="text-lg font-bold text-white">Record Customer Payment</h2>
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
                    max={invoice.balance_due}
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
                    {submitting ? "Processing..." : "Confirm Payment"}
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
