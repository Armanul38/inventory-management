"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";

interface Item {
  id: number;
  sku: string;
  name: string;
  item_type: string;
  unit_of_measure: string;
  reorder_level: number;
  quantity_on_hand: number;
}

export default function CatalogPage() {
  const { apiFetch, user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Search & Filters
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // SKU Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [itemType, setItemType] = useState("RAW_MATERIAL");
  const [uom, setUom] = useState("PCS");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [isSaving, setIsSaving] = useState(false);

  const canCreateSKU = user?.role === "ADMIN" || user?.role === "STORE_KEEPER";

  useEffect(() => {
    loadCatalog();
  }, [search, typeFilter]);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      let queryPath = "/inventory/items";
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (typeFilter) params.append("item_type", typeFilter);
      
      const queryString = params.toString();
      if (queryString) queryPath += `?${queryString}`;
      
      const data = await apiFetch(queryPath);
      setItems(data);
    } catch (err: any) {
      setError(err.message || "Failed to load item catalog");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSKU = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);
    try {
      await apiFetch("/inventory/items", {
        method: "POST",
        body: JSON.stringify({
          sku: sku.trim().toUpperCase(),
          name: name.trim(),
          item_type: itemType,
          unit_of_measure: uom.trim().toUpperCase(),
          reorder_level: parseFloat(reorderLevel) || 0.0,
        }),
      });
      setSuccess(`SKU ${sku.toUpperCase()} successfully added to the catalog.`);
      setSku("");
      setName("");
      setUom("PCS");
      setReorderLevel("0");
      setShowCreateModal(false);
      loadCatalog();
    } catch (err: any) {
      setError(err.message || "Failed to add new SKU");
    } finally {
      setIsSaving(false);
    }
  };

  const getItemTypeBadge = (type: string) => {
    switch (type) {
      case "RAW_MATERIAL":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "SUPPLY":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "FINISHED_GOOD":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Items Catalog SKU</h1>
            <p className="text-zinc-400 mt-1">Configure and manage item specifications and reorder levels.</p>
          </div>
          {canCreateSKU && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all flex items-center gap-2 text-sm self-start md:self-auto"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New SKU
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-400">
            {success}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 bg-zinc-900 border border-zinc-850 p-4 rounded-xl">
          <div className="flex-1 relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by SKU, item name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 pl-10 pr-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="w-full sm:w-48">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
            >
              <option value="">All Item Types</option>
              <option value="RAW_MATERIAL">Raw Materials</option>
              <option value="SUPPLY">Supplies</option>
              <option value="FINISHED_GOOD">Finished Goods</option>
            </select>
          </div>
        </div>

        {/* Items list */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-12 bg-zinc-900 rounded-lg"></div>
            <div className="h-12 bg-zinc-900 rounded-lg"></div>
            <div className="h-12 bg-zinc-900 rounded-lg"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 text-sm border border-dashed border-zinc-800 rounded-xl">
            No items found matching the selected filters.
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-850 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-semibold">
                    <th className="p-4">SKU / Code</th>
                    <th className="p-4">Item Name</th>
                    <th className="p-4">Item Type</th>
                    <th className="p-4">UOM</th>
                    <th className="p-4 text-right">Min Reorder Level</th>
                    <th className="p-4 text-right">Physical Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {items.map((item) => {
                    const isLowStock = item.quantity_on_hand <= item.reorder_level && item.item_type !== "FINISHED_GOOD";
                    return (
                      <tr key={item.id} className="hover:bg-zinc-850/30 text-zinc-350 transition-colors">
                        <td className="p-4 font-bold text-emerald-400">{item.sku}</td>
                        <td className="p-4 text-white font-medium">{item.name}</td>
                        <td className="p-4">
                          <span className={`inline-block border rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wide uppercase ${getItemTypeBadge(item.item_type)}`}>
                            {item.item_type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="p-4">{item.unit_of_measure}</td>
                        <td className="p-4 text-right">{item.reorder_level}</td>
                        <td className={`p-4 text-right font-bold ${
                          isLowStock ? "text-amber-500" : "text-white"
                        }`}>
                          {item.quantity_on_hand} {item.unit_of_measure}
                          {isLowStock && (
                            <span className="ml-2 inline-block w-2 h-2 rounded-full bg-amber-500" title="Low stock warning"></span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create SKU Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-2xl relative">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h2 className="text-xl font-bold text-white mb-6">Create Catalog SKU</h2>

              <form onSubmit={handleCreateSKU} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Unique SKU Code
                  </label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g., RAW-ALUM-01"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Item Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g., Aluminium Alloy Bar"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Item Type
                    </label>
                    <select
                      value={itemType}
                      onChange={(e) => setItemType(e.target.value)}
                      className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    >
                      <option value="RAW_MATERIAL">Raw Material</option>
                      <option value="SUPPLY">Supply</option>
                      <option value="FINISHED_GOOD">Finished Good</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                      Unit of Measure (UOM)
                    </label>
                    <input
                      type="text"
                      required
                      value={uom}
                      onChange={(e) => setUom(e.target.value)}
                      className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                      placeholder="e.g., KG, PCS, METERS"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Minimum Reorder level
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={reorderLevel}
                    onChange={(e) => setReorderLevel(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="e.g., 50"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Generates a dashboard alert when physical stock levels drop below this threshold.
                  </p>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-zinc-850 hover:bg-zinc-850 text-zinc-400 font-semibold text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors flex items-center justify-center"
                  >
                    {isSaving ? (
                      <div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
                    ) : (
                      "Save SKU"
                    )}
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
