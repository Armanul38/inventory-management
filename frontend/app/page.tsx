"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // If user is already logged in, redirect to dashboard
  useEffect(() => {
    if (user && !loading) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Failed to log in. Please check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreFill = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
    setError("");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-700 border-t-emerald-500"></div>
          <p className="text-sm font-medium text-zinc-400">Loading system session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 flex-col md:flex-row">
      {/* Visual Left Panel */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-8 py-16 md:px-16 lg:px-24 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 border-b border-zinc-800 md:border-b-0 md:border-r border-zinc-850">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.08),rgba(255,255,255,0))]"></div>
        <div className="relative max-w-lg text-center md:text-left z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Enterprise Production Management
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Inventory <span className="text-emerald-500">Flow</span>
          </h1>
          <p className="mt-6 text-lg text-zinc-400 leading-relaxed">
            Real-time material lifecycle tracking spanning Company Inventory, Work-In-Progress batches, and Finished Goods dispatches. Secured with role-based credentials.
          </p>
          
          <div className="mt-12 hidden md:grid grid-cols-3 gap-4 border-t border-zinc-800 pt-8 text-zinc-400">
            <div>
              <div className="text-xl font-bold text-white">WIP</div>
              <div className="text-xs mt-1">Batch Order Yields</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white">FIFO</div>
              <div className="text-xs mt-1">Batch Cost Tracking</div>
            </div>
            <div>
              <div className="text-xl font-bold text-white">Audit</div>
              <div className="text-xs mt-1">Immutable Logs</div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Right Panel */}
      <div className="flex flex-1 items-center justify-center p-8 bg-zinc-950">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center md:text-left">
            <h2 className="text-2xl font-bold text-white">Welcome back</h2>
            <p className="mt-2 text-sm text-zinc-400">Sign in with your enterprise credentials</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-zinc-300">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                  placeholder="name@company.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-zinc-300">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="relative w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 disabled:scale-100 flex items-center justify-center"
            >
              {isSubmitting ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white"></div>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Quick Demo Pre-fills */}
          <div className="mt-8 border-t border-zinc-900 pt-6">
            <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase mb-3">
              Quick access demo credentials
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => handlePreFill("admin@example.com", "AdminPassword123!")}
                className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700 text-xs text-left transition-all"
              >
                <div className="font-semibold text-zinc-300">Admin</div>
                <div className="text-[10px] text-zinc-500 truncate">admin@example.com</div>
              </button>
              <button
                onClick={() => handlePreFill("storekeeper@example.com", "StorePassword123!")}
                className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700 text-xs text-left transition-all"
              >
                <div className="font-semibold text-zinc-300">Store Keeper</div>
                <div className="text-[10px] text-zinc-500 truncate">storekeeper@...</div>
              </button>
              <button
                onClick={() => handlePreFill("supervisor@example.com", "SupervisorPassword123!")}
                className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700 text-xs text-left transition-all"
              >
                <div className="font-semibold text-zinc-300">Supervisor</div>
                <div className="text-[10px] text-zinc-500 truncate">supervisor@...</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
