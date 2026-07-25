"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";

interface Item {
  id: number;
  sku: string;
  name: string;
  item_type: string;
}

interface Supplier {
  id: number;
  company_name: string;
}

interface POLine {
  item_id: number;
  quantity_ordered: number;
  unit_cost: number;
}

interface PO {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier_name?: string;
  order_date: string;
  expected_delivery_date: string | null;
  status: string;
  created_at: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function PurchaseOrdersPage() {
  const { token } = useAuth() as any;
  const [pos, setPos] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<POLine[]>([{ item_id: 0, quantity_ordered: 1, unit_cost: 0 }]);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [poRes, supRes, itemRes] = await Promise.all([
        fetch(`${API}/api/v1/purchase-orders`, { headers }),
        fetch(`${API}/api/v1/suppliers?is_active=true`, { headers }),
        fetch(`${API}/api/v1/inventory/items?item_type=RAW_MATERIAL`, { headers }),
      ]);
      if (poRes.ok) setPos(await poRes.json());
      if (supRes.ok) setSuppliers(await supRes.json());
      if (itemRes.ok) setItems(await itemRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddLine = () => {
    setLines([...lines, { item_id: 0, quantity_ordered: 1, unit_cost: 0 }]);
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: keyof POLine, value: number) => {
    const newLines = [...lines];
    newLines[idx][field] = value;
    setLines(newLines);
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) return alert("Select a supplier");
    if (lines.some((l) => l.item_id === 0 || l.quantity_ordered <= 0)) {
      return alert("Complete all line items properly");
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/v1/purchase-orders`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          supplier_id: parseInt(supplierId),
          order_date: orderDate,
          expected_delivery_date: expectedDate || null,
          notes: notes || null,
          lines,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        setSupplierId("");
        setNotes("");
        setLines([{ item_id: 0, quantity_ordered: 1, unit_cost: 0 }]);
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-zinc-700/50 text-zinc-300 border-zinc-600/30";
      case "SENT":
        return "bg-sky-500/10 text-sky-400 border-sky-500/20";
      case "PARTIALLY_RECEIVED":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "FULLY_RECEIVED":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "CANCELLED":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-zinc-700 text-zinc-400";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Purchase Orders</h1>
            <p className="text-zinc-400 text-sm mt-1">Issue and manage supplier purchase orders</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all"
          >
            Create Purchase Order
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-800/50 text-xs text-zinc-400 uppercase">
                <th className="text-left px-4 py-3">PO Number</th>
                <th className="text-left px-4 py-3">Supplier</th>
                <th className="text-left px-4 py-3">Order Date</th>
                <th className="text-left px-4 py-3">Expected Delivery</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-zinc-500">
                    Loading purchase orders...
                  </td>
                </tr>
              ) : pos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-zinc-500">
                    No purchase orders found
                  </td>
                </tr>
              ) : (
                pos.map((po) => (
                  <tr key={po.id} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-mono text-emerald-400 font-medium">
                      <a href={`/purchase-orders/${po.id}`} className="hover:underline">
                        {po.po_number}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-white">{po.supplier_name || "—"}</td>
                    <td className="px-4 py-3 text-zinc-300">{po.order_date}</td>
                    <td className="px-4 py-3 text-zinc-400">{po.expected_delivery_date || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(po.status)}`}>
                        {po.status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                <h2 className="text-lg font-bold text-white">Create Purchase Order</h2>
                <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-white">
                  ✕
                </button>
              </div>
              <form onSubmit={handleCreatePO} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Supplier *</label>
                    <select
                      required
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.company_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Order Date *</label>
                    <input
                      type="date"
                      required
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Items Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Line Items</h3>
                    <button
                      type="button"
                      onClick={handleAddLine}
                      className="text-xs text-emerald-400 hover:underline"
                    >
                      + Add Item
                    </button>
                  </div>

                  {lines.map((line, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-zinc-800/40 p-3 rounded-lg border border-zinc-800">
                      <select
                        value={line.item_id}
                        onChange={(e) => handleLineChange(idx, "item_id", parseInt(e.target.value))}
                        className="flex-1 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                      >
                        <option value={0}>Select Raw Material</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.sku})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        placeholder="Qty"
                        min="1"
                        value={line.quantity_ordered}
                        onChange={(e) => handleLineChange(idx, "quantity_ordered", parseFloat(e.target.value) || 0)}
                        className="w-20 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                      />

                      <input
                        type="number"
                        placeholder="Unit Cost"
                        step="0.01"
                        value={line.unit_cost}
                        onChange={(e) => handleLineChange(idx, "unit_cost", parseFloat(e.target.value) || 0)}
                        className="w-24 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                      />

                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                    rows={2}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:border-zinc-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all disabled:opacity-50"
                  >
                    {submitting ? "Creating..." : "Save PO"}
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
