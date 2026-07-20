import React, { useState } from "react";
import { KeyRound, Mail, ShieldAlert, ArrowRight, Sparkles, LogIn, Laptop, FileDigit } from "lucide-react";
import { User, UserRole } from "../types";
import mitconLogo from "../assets/logo.png";

interface LoginPageProps {
  onSuccess: (user: User, token: string) => void;
  mfaDefaultSetting: boolean;
}

export default function LoginPage({ onSuccess, mfaDefaultSetting }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please key in your organizational email address.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to match user records.");
      }

      onSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || "Network Error accessing MITCON Credentia Node.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Dynamic Background Accents */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.08),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(59,130,246,0.08),transparent_50%)] pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative">
        <div className="flex justify-center items-center">
          <img src={mitconLogo} className="h-16 w-auto" alt="Mitcon Credentia Logo" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-display font-bold tracking-tight text-white">
          Secure Core Repository
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Module Tracker
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative">
        <div className="bg-slate-800/80 backdrop-blur-md py-8 px-4 shadow-xl border border-slate-700/50 rounded-2xl sm:px-10">
          
          {error && (
            <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleInitialSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Organizational Work Email
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@mitconindia.com"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Access Key Passcode
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-4 w-4 text-slate-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="block w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl text-sm font-semibold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-orange-500 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 transition-all cursor-pointer font-display shadow-lg shadow-amber-500/10"
              >
                {loading ? "Decrypting Session..." : "Authorize Access"}
                {!loading && <ArrowRight className="ml-2 w-4 h-4" />}
              </button>
            </div>
          </form>


        </div>
      </div>
    </div>
  );
}
