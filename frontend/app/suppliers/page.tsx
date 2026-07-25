"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";

interface Supplier {
  id: number;
  supplier_code: string;
  company_name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  payment_terms_days: number;
  is_active: boolean;
}

interface NewSupplier {
  company_name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  payment_terms_days: number;
  tax_id: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function SuppliersPage() {
  const { token } = useAuth() as any;
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NewSupplier>({
    company_name: "", contact_person: "", phone: "",
    email: "", address: "", payment_terms_days: 30, tax_id: "",
  });

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/suppliers${search ? `?search=${search}` : ""}`, { headers });
      if (res.ok) setSuppliers(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSuppliers(); }, [search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/suppliers`, {
        method: "POST", headers,
        body: JSON.stringify({ ...form, payment_terms_days: Number(form.payment_terms_days) }),
      });
      if (res.ok) { setShowModal(false); fetchSuppliers(); }
    } finally { setSaving(false); }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Suppliers</h1>
            <p className="text-zinc-400 text-sm mt-1">Manage raw material vendors and procurement</p>
          </div>
          <button
            id="new-supplier-btn"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Supplier
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="supplier-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or code…"
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-800/50">
                {["Code", "Company", "Contact", "Phone", "Email", "Terms", "Status"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-zinc-400 font-medium text-xs uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-zinc-500">Loading…</td></tr>
              ) : suppliers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-zinc-500">No suppliers found</td></tr>
              ) : suppliers.map(s => (
                <tr key={s.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-emerald-400 text-xs">{s.supplier_code}</td>
                  <td className="px-4 py-3 font-medium text-white">
                    <a href={`/suppliers/${s.id}`} className="hover:text-emerald-400 transition-colors">{s.company_name}</a>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{s.contact_person || "—"}</td>
                  <td className="px-4 py-3 text-zinc-300">{s.phone || "—"}</td>
                  <td className="px-4 py-3 text-zinc-400">{s.email || "—"}</td>
                  <td className="px-4 py-3 text-zinc-300">{s.payment_terms_days} days</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-700 text-zinc-400"
                    }`}>
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Create Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-zinc-800">
                <h2 className="text-lg font-bold text-white">New Supplier</h2>
                <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                {[
                  { label: "Company Name *", key: "company_name", type: "text", required: true },
                  { label: "Contact Person", key: "contact_person", type: "text" },
                  { label: "Phone", key: "phone", type: "text" },
                  { label: "Email", key: "email", type: "email" },
                  { label: "Address", key: "address", type: "text" },
                  { label: "Tax ID", key: "tax_id", type: "text" },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">{field.label}</label>
                    <input
                      id={`supplier-${field.key}`}
                      type={field.type}
                      required={field.required}
                      value={(form as any)[field.key]}
                      onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Payment Terms (days)</label>
                  <input
                    id="supplier-payment-terms"
                    type="number" min="0"
                    value={form.payment_terms_days}
                    onChange={e => setForm(f => ({ ...f, payment_terms_days: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 text-sm text-zinc-400 border border-zinc-700 rounded-lg hover:border-zinc-500">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 px-4 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all disabled:opacity-50">
                    {saving ? "Saving…" : "Create Supplier"}
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
