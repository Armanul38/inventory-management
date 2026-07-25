"use client";

import React, { useEffect, useState } from "react";
import { useAuth, User } from "../context/AuthContext";
import DashboardLayout from "../components/DashboardLayout";

export default function UsersPage() {
  const { apiFetch, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create User form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("STORE_KEEPER");
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Edit User state
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    if (currentUser?.role === "ADMIN") {
      loadUsers();
    } else {
      setLoading(false);
    }
  }, [currentUser]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/auth-users/users");
      setUsers(data);
    } catch (err: any) {
      setError(err.message || "Failed to load system users");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);
    try {
      await apiFetch("/auth-users/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          full_name: fullName,
          role,
          password,
        }),
      });
      setSuccess(`User ${fullName} created successfully.`);
      setEmail("");
      setFullName("");
      setPassword("");
      setShowCreateModal(false);
      loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    setError("");
    setSuccess("");
    try {
      const updatedUser = await apiFetch(`/auth-users/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({
          full_name: user.full_name,
          role: user.role,
          is_active: !user.is_active,
        }),
      });
      setSuccess(`User ${user.full_name} status updated.`);
      loadUsers();
    } catch (err: any) {
      setError(err.message || "Failed to update user status");
    }
  };

  if (currentUser?.role !== "ADMIN") {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Access Denied</h1>
          <p className="text-zinc-400 mt-2 max-w-md">
            You do not have administrative permissions to view or manage user accounts in this inventory system.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      case "STORE_KEEPER":
        return "bg-sky-500/10 text-sky-400 border-sky-500/20";
      case "PRODUCTION_SUPERVISOR":
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
            <h1 className="text-3xl font-bold tracking-tight text-white">User LifeCycle Management</h1>
            <p className="text-zinc-400 mt-1">Create, configure, and deactivate user accounts.</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-all flex items-center gap-2 text-sm self-start md:self-auto"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Add New User
          </button>
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

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-12 bg-zinc-900 rounded-lg"></div>
            <div className="h-12 bg-zinc-900 rounded-lg"></div>
            <div className="h-12 bg-zinc-900 rounded-lg"></div>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-850 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-semibold">
                    <th className="p-4">Full Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">System Role</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-850/30 text-zinc-350 transition-colors">
                      <td className="p-4 font-semibold text-white">{u.full_name}</td>
                      <td className="p-4">{u.email}</td>
                      <td className="p-4">
                        <span className={`inline-block border rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ${getRoleBadge(u.role)}`}>
                          {u.role.replace("_", " ")}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                          u.is_active 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-zinc-800 text-zinc-500 border-zinc-700"
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? "bg-emerald-400 animate-pulse" : "bg-zinc-650"}`}></span>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleToggleActive(u)}
                          disabled={u.email === currentUser.email} // cannot deactivate self
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            u.is_active
                              ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                          } disabled:opacity-30 disabled:hover:bg-transparent`}
                        >
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create Modal Dialog */}
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
              
              <h2 className="text-xl font-bold text-white mb-6">Create System User</h2>
              
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="john@company.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    System Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="STORE_KEEPER">Store Keeper</option>
                    <option value="PRODUCTION_SUPERVISOR">Production Supervisor</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    Initial Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-4 py-2 text-white text-sm focus:border-emerald-500 focus:outline-none"
                    placeholder="••••••••"
                  />
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
                      "Create User"
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
