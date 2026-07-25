"use client";
import React, { useEffect, useState, use } from "react";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../components/DashboardLayout";
import { printElement } from "../../utils/exportUtils";

interface POLine {
  id: number;
  item_id: number;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  line_total: number;
}

interface PO {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier_name?: string;
  order_date: string;
  expected_delivery_date: string | null;
  status: string;
  notes: string | null;
  lines: POLine[];
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { token } = useAuth() as any;
  const [po, setPo] = useState<PO | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGRNModal, setShowGRNModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // GRN State
  const [grnLines, setGrnLines] = useState<
    Array<{ item_id: number; quantity_received: number; unit_cost: number; batch_number: string }>
  >([]);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchPO = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/purchase-orders/${resolvedParams.id}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPo(data);
        setGrnLines(
          data.lines.map((l: POLine) => ({
            item_id: l.item_id,
            quantity_received: Math.max(0, l.quantity_ordered - l.quantity_received),
            unit_cost: l.unit_cost,
            batch_number: `BATCH-${Date.now().toString().slice(-4)}`,
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPO();
  }, [resolvedParams.id]);

  const handleCreateGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/v1/purchase-orders/${resolvedParams.id}/grn`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          received_date: new Date().toISOString().split("T")[0],
          lines: grnLines.filter((l) => l.quantity_received > 0),
        }),
      });
      if (res.ok) {
        setShowGRNModal(false);
        fetchPO();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <DashboardLayout><div className="p-6 text-zinc-400">Loading PO details...</div></DashboardLayout>;
  if (!po) return <DashboardLayout><div className="p-6 text-zinc-400">PO not found.</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{po.po_number}</h1>
              <span className="font-mono text-xs px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                {po.status}
              </span>
            </div>
            <p className="text-zinc-400 text-sm mt-1">Supplier: {po.supplier_name || po.supplier_id}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => printElement("printable-po", `PurchaseOrder_${po.po_number}`)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg border border-zinc-700 transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Save PDF
            </button>

            {po.status !== "FULLY_RECEIVED" && po.status !== "CANCELLED" && (
              <button
                onClick={() => setShowGRNModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all"
              >
                Receive Goods (GRN)
              </button>
            )}
          </div>
        </div>

        {/* Printable Area */}
        <div id="printable-po" className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-zinc-500 text-xs">Order Date</div>
              <div className="text-white mt-0.5">{po.order_date}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">Expected Delivery</div>
              <div className="text-white mt-0.5">{po.expected_delivery_date || "—"}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">Total Items</div>
              <div className="text-white mt-0.5">{po.lines.length}</div>
            </div>
            <div>
              <div className="text-zinc-500 text-xs">Notes</div>
              <div className="text-zinc-300 mt-0.5">{po.notes || "—"}</div>
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
                    <th className="text-right px-4 py-3">Received</th>
                    <th className="text-right px-4 py-3">Unit Cost</th>
                    <th className="text-right px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {po.lines.map((l) => (
                    <tr key={l.id} className="hover:bg-zinc-800/30">
                      <td className="px-4 py-3 font-mono text-emerald-400">Item #{l.item_id}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{l.quantity_ordered}</td>
                      <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                        {l.quantity_received}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-300">৳{l.unit_cost.toFixed(2)}</td>
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

        {/* GRN Modal */}
        {showGRNModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                <h2 className="text-lg font-bold text-white">Receive Goods (GRN)</h2>
                <button onClick={() => setShowGRNModal(false)} className="text-zinc-400 hover:text-white">
                  ✕
                </button>
              </div>
              <form onSubmit={handleCreateGRN} className="p-6 space-y-4">
                <div className="space-y-3">
                  {grnLines.map((l, idx) => (
                    <div key={idx} className="bg-zinc-800/40 p-3 rounded-lg border border-zinc-800 space-y-2">
                      <div className="text-xs font-semibold text-emerald-400">Item #{l.item_id}</div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] text-zinc-400">Qty Receiving</label>
                          <input
                            type="number"
                            step="0.01"
                            value={l.quantity_received}
                            onChange={(e) => {
                              const newLines = [...grnLines];
                              newLines[idx].quantity_received = parseFloat(e.target.value) || 0;
                              setGrnLines(newLines);
                            }}
                            className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400">Unit Cost (৳)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={l.unit_cost}
                            onChange={(e) => {
                              const newLines = [...grnLines];
                              newLines[idx].unit_cost = parseFloat(e.target.value) || 0;
                              setGrnLines(newLines);
                            }}
                            className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-zinc-400">Batch Number</label>
                          <input
                            type="text"
                            value={l.batch_number}
                            onChange={(e) => {
                              const newLines = [...grnLines];
                              newLines[idx].batch_number = e.target.value;
                              setGrnLines(newLines);
                            }}
                            className="w-full px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowGRNModal(false)}
                    className="flex-1 px-4 py-2 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:border-zinc-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all disabled:opacity-50"
                  >
                    {submitting ? "Processing..." : "Confirm Goods Receipt"}
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
