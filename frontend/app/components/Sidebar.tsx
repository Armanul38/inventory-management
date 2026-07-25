"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "STORE_KEEPER":
        return "bg-sky-500/10 text-sky-400 border-sky-500/20";
      case "PRODUCTION_SUPERVISOR":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "SALES_OFFICER":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "PURCHASE_OFFICER":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "ACCOUNTANT":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
    }
  };

  const menuSections = [
    {
      title: "OPERATIONS",
      items: [
        { name: "Dashboard", path: "/dashboard", roles: ["ADMIN", "STORE_KEEPER", "PRODUCTION_SUPERVISOR", "SALES_OFFICER", "PURCHASE_OFFICER", "ACCOUNTANT"] },
        { name: "Raw Inventory", path: "/inventory", roles: ["ADMIN", "STORE_KEEPER", "PRODUCTION_SUPERVISOR", "PURCHASE_OFFICER"] },
        { name: "WIP Job Orders", path: "/jobs", roles: ["ADMIN", "STORE_KEEPER", "PRODUCTION_SUPERVISOR"] },
        { name: "Finished Goods", path: "/finished-goods", roles: ["ADMIN", "STORE_KEEPER", "PRODUCTION_SUPERVISOR", "SALES_OFFICER"] },
      ],
    },
    {
      title: "PROCUREMENT",
      items: [
        { name: "Suppliers", path: "/suppliers", roles: ["ADMIN", "PURCHASE_OFFICER", "STORE_KEEPER", "ACCOUNTANT"] },
        { name: "Purchase Orders", path: "/purchase-orders", roles: ["ADMIN", "PURCHASE_OFFICER", "STORE_KEEPER"] },
      ],
    },
    {
      title: "SALES & DISTRIBUTION",
      items: [
        { name: "Customers", path: "/customers", roles: ["ADMIN", "SALES_OFFICER", "ACCOUNTANT"] },
        { name: "Sales Orders", path: "/sales/orders", roles: ["ADMIN", "SALES_OFFICER", "STORE_KEEPER"] },
        { name: "Invoices", path: "/sales/invoices", roles: ["ADMIN", "SALES_OFFICER", "ACCOUNTANT"] },
      ],
    },
    {
      title: "FINANCE & ACCOUNTS",
      items: [
        { name: "Accounts Payable", path: "/accounts/payable", roles: ["ADMIN", "ACCOUNTANT", "PURCHASE_OFFICER"] },
        { name: "Accounts Receivable", path: "/accounts/receivable", roles: ["ADMIN", "ACCOUNTANT", "SALES_OFFICER"] },
        { name: "General Ledger", path: "/accounts/ledger", roles: ["ADMIN", "ACCOUNTANT"] },
        { name: "Reports", path: "/reports", roles: ["ADMIN", "ACCOUNTANT"] },
      ],
    },
    {
      title: "ADMINISTRATION",
      items: [
        { name: "Catalog SKU", path: "/catalog", roles: ["ADMIN", "STORE_KEEPER", "PRODUCTION_SUPERVISOR"] },
        { name: "Users Management", path: "/users", roles: ["ADMIN"] },
        { name: "Audit Logs", path: "/audit", roles: ["ADMIN", "STORE_KEEPER", "PRODUCTION_SUPERVISOR", "ACCOUNTANT"] },
      ],
    },
  ];

  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col justify-between h-screen sticky top-0">
      {/* Upper Area */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Branding */}
        <div className="h-16 flex items-center gap-2 px-6 border-b border-zinc-800 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-bold text-black text-sm">
            IF
          </div>
          <span className="font-bold text-white text-lg tracking-tight">Inventory Flow</span>
        </div>

        {/* User Card */}
        <div className="p-5 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
          <div className="text-sm font-semibold text-white truncate">{user.full_name}</div>
          <div className="text-xs text-zinc-400 mt-0.5 truncate">{user.email}</div>
          <div
            className={`inline-block border rounded-full px-2 py-0.5 text-[9px] font-bold mt-2 tracking-wide uppercase ${getRoleBadge(
              user.role
            )}`}
          >
            {user.role.replace("_", " ")}
          </div>
        </div>

        {/* Grouped Navigation */}
        <nav className="p-4 space-y-6 flex-1">
          {menuSections.map((section, idx) => {
            const visibleItems = section.items.filter((item) => item.roles.includes(user.role));
            if (visibleItems.length === 0) return null;

            return (
              <div key={idx} className="space-y-2">
                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-3">
                  {section.title}
                </div>
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const isActive = pathname === item.path || (item.path !== "/dashboard" && pathname.startsWith(item.path));
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        className={`flex items-center px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          isActive
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/20"
                            : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                        }`}
                      >
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer / Log out */}
      <div className="p-4 border-t border-zinc-800 shrink-0">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-2.5 text-xs font-medium text-zinc-400 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Log Out
        </button>
      </div>
    </div>
  );
}
