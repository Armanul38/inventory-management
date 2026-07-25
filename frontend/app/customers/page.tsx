"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";

interface Customer {
  id: number;
  customer_code: string;
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  credit_limit: number;
  payment_terms_days: number;
  customer_type: string;
  is_active: boolean;
}

interface NewCustomer {
  company_name: string;
  contact_person: string;
  phone: string;
  email: string;
  billing_address: string;
  credit_limit: number;
  payment_terms_days: number;
  customer_type: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function CustomersPage() {
  const { token } = useAuth() as any;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NewCustomer>({
    company_name: "",
    contact_person: "",
    phone: "",
    email: "",
    billing_address: "",
    credit_limit: 50000,
    payment_terms_days: 30,
    customer_type: "RETAIL",
  });

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/customers${search ? `?search=${search}` : ""}`, { headers });
      if (res.ok) setCustomers(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/customers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...form,
          credit_limit: Number(form.credit_limit),
          payment_terms_days: Number(form.payment_terms_days),
        }),
      });
      if (res.ok) {
        setShowModal(false);
        fetchCustomers();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Customers</h1>
            <p className="text-zinc-400 text-sm mt-1">Manage buyers, credit limits, and customer profiles</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all"
          >
            New Customer
          </button>
        </div>

        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customers..."
            className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-800/50 text-xs text-zinc-400 uppercase">
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Company</th>
                <th className="text-left px-4 py-3">Contact</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Credit Limit</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-500">
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-500">
                    No customers found
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-3 font-mono text-emerald-400 text-xs">{c.customer_code}</td>
                    <td className="px-4 py-3 font-medium text-white">
                      <a href={`/customers/${c.id}`} className="hover:underline">
                        {c.company_name}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{c.contact_person || "—"}</td>
                    <td className="px-4 py-3 text-zinc-300">{c.phone || "—"}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{c.customer_type}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-medium">
                      ৳{c.credit_limit.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-700 text-zinc-400"}`}>
                        {c.is_active ? "Active" : "Inactive"}
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
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                <h2 className="text-lg font-bold text-white">New Customer</h2>
                <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-white">
                  ✕
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Company Name *</label>
                  <input
                    required
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Contact Person</label>
                    <input
                      value={form.contact_person}
                      onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Phone</label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Credit Limit (৳)</label>
                    <input
                      type="number"
                      value={form.credit_limit}
                      onChange={(e) => setForm({ ...form, credit_limit: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Customer Type</label>
                    <select
                      value={form.customer_type}
                      onChange={(e) => setForm({ ...form, customer_type: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                    >
                      <option value="RETAIL">Retail</option>
                      <option value="WHOLESALE">Wholesale</option>
                      <option value="DISTRIBUTOR">Distributor</option>
                    </select>
                  </div>
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
                    disabled={saving}
                    className="flex-1 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Create Customer"}
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
