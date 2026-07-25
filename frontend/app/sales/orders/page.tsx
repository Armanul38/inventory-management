"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../components/DashboardLayout";

interface Customer {
  id: number;
  company_name: string;
}

interface Item {
  id: number;
  name: string;
  sku: string;
}

interface SOLine {
  finished_item_id: number;
  quantity_ordered: number;
  unit_price: number;
  discount_pct: number;
  tax_pct: number;
}

interface SO {
  id: number;
  so_number: string;
  customer_id: number;
  customer_name?: string;
  order_date: string;
  status: string;
  grand_total: number;
  created_at: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SalesOrdersPage() {
  const { token } = useAuth() as any;
  const [orders, setOrders] = useState<SO[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0]);
  const [lines, setLines] = useState<SOLine[]>([
    { finished_item_id: 0, quantity_ordered: 1, unit_price: 0, discount_pct: 0, tax_pct: 15 },
  ]);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [soRes, custRes, itemRes] = await Promise.all([
        fetch(`${API}/api/v1/sales/orders`, { headers }),
        fetch(`${API}/api/v1/customers?is_active=true`, { headers }),
        fetch(`${API}/api/v1/inventory/items?item_type=FINISHED_GOOD`, { headers }),
      ]);
      if (soRes.ok) setOrders(await soRes.json());
      if (custRes.ok) setCustomers(await custRes.json());
      if (itemRes.ok) setItems(await itemRes.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return alert("Select customer");
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/v1/sales/orders`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          customer_id: parseInt(customerId),
          order_date: orderDate,
          lines,
        }),
      });
      if (res.ok) {
        setShowModal(false);
        fetchData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Sales Orders</h1>
            <p className="text-zinc-400 text-sm mt-1">Manage finished goods sales orders</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all"
          >
            Create Sales Order
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-800/50 text-xs text-zinc-400 uppercase">
                <th className="text-left px-4 py-3">SO #</th>
                <th className="text-left px-4 py-3">Customer</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-right px-4 py-3">Grand Total</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-zinc-500">
                    Loading sales orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-zinc-500">
                    No sales orders found
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-mono text-emerald-400 font-medium">
                      <a href={`/sales/orders/${o.id}`} className="hover:underline">
                        {o.so_number}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-white">{o.customer_name || "—"}</td>
                    <td className="px-4 py-3 text-zinc-300">{o.order_date}</td>
                    <td className="px-4 py-3 text-right text-white font-semibold">
                      ৳{o.grand_total.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {o.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-xl shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                <h2 className="text-lg font-bold text-white">Create Sales Order</h2>
                <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-white">
                  ✕
                </button>
              </div>
              <form onSubmit={handleCreateSO} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Customer *</label>
                  <select
                    required
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select Customer</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.company_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="text-xs font-semibold text-white">Line Items</div>
                  {lines.map((l, idx) => (
                    <div key={idx} className="flex gap-2 items-center bg-zinc-800/40 p-2 rounded-lg border border-zinc-800">
                      <select
                        value={l.finished_item_id}
                        onChange={(e) => {
                          const newLines = [...lines];
                          newLines[idx].finished_item_id = parseInt(e.target.value);
                          setLines(newLines);
                        }}
                        className="flex-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs"
                      >
                        <option value={0}>Select Finished Good</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        placeholder="Qty"
                        value={l.quantity_ordered}
                        onChange={(e) => {
                          const newLines = [...lines];
                          newLines[idx].quantity_ordered = parseFloat(e.target.value) || 0;
                          setLines(newLines);
                        }}
                        className="w-16 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs"
                      />

                      <input
                        type="number"
                        placeholder="Price"
                        value={l.unit_price}
                        onChange={(e) => {
                          const newLines = [...lines];
                          newLines[idx].unit_price = parseFloat(e.target.value) || 0;
                          setLines(newLines);
                        }}
                        className="w-20 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs"
                      />
                    </div>
                  ))}
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
                    {submitting ? "Saving..." : "Create SO"}
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
