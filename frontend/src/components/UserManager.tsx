import React, { useState, useEffect } from "react";
import { User, UserRole, SecurityPolicy } from "../types";
import { Shield, Eye, Trash, UserPlus, Users as UsersIcon } from "lucide-react";

interface UserManagerProps {
  users: User[];
  currentUser: User;
  onRefresh: () => void;
  policies: SecurityPolicy;
  onRefreshPolicies: () => void;
}

export default function UserManager({ 
  users, 
  currentUser, 
  onRefresh, 
  policies,
  onRefreshPolicies 
}: UserManagerProps) {
  
  // Create User fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("developer");
  const [designation, setDesignation] = useState("");
  const [createUserError, setCreateUserError] = useState("");
  const [createUserSuccess, setCreateUserSuccess] = useState(false);

  // Security policy fields
  const [passwordMinLength, setPasswordMinLength] = useState(policies.passwordMinLength);
  const [requireMfa, setRequireMfa] = useState(policies.requireMfa);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(policies.sessionTimeoutMinutes);
  const [maxCheckoutDurationDays, setMaxCheckoutDurationDays] = useState(policies.maxCheckoutDurationDays);
  
  const [policyError, setPolicyError] = useState("");
  const [policySuccess, setPolicySuccess] = useState(false);

  useEffect(() => {
    setPasswordMinLength(policies.passwordMinLength);
    setRequireMfa(policies.requireMfa);
    setSessionTimeoutMinutes(policies.sessionTimeoutMinutes);
    setMaxCheckoutDurationDays(policies.maxCheckoutDurationDays);
  }, [policies]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateUserError("");
    setCreateUserSuccess(false);

    if (!name || !email) {
      setCreateUserError("Please key in full name and unique email address.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith('@mitconindia.com') && !cleanEmail.endsWith('@mitconcredentia.in')) {
      setCreateUserError("Organizational email must end with @mitconindia.com or @mitconcredentia.in.");
      return;
    }

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Operator-Name": currentUser.name,
          "X-Operator-Role": currentUser.role
        },
        body: JSON.stringify({ name, email, role, designation })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to create user record.");

      setCreateUserSuccess(true);
      setName("");
      setEmail("");
      setDesignation("");
      onRefresh();
    } catch (err: any) {
      setCreateUserError(err.message || "Server Error.");
    }
  };

  const handleUpdatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setPolicyError("");
    setPolicySuccess(false);

    try {
      const response = await fetch("/api/policies", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "X-Operator-Name": currentUser.name,
          "X-Operator-Role": currentUser.role
        },
        body: JSON.stringify({ 
          passwordMinLength, 
          requireMfa, 
          sessionTimeoutMinutes, 
          maxCheckoutDurationDays 
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to update safety policy.");

      setPolicySuccess(true);
      onRefreshPolicies();
    } catch (err: any) {
      setPolicyError(err.message || "Network Error.");
    }
  };

  const handleDeleteUser = async (id: string, userEmail: string) => {
    if (id === currentUser.id) {
      alert("Self action denied: You cannot delete your own active administrator account.");
      return;
    }
    if (!window.confirm(`SECURITY ALERT: Are you sure you want to permanently delete user ${userEmail}? This will strip their active credentials.`)) return;

    try {
      const response = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: {
          "X-Operator-Name": currentUser.name,
          "X-Operator-Role": currentUser.role
        }
      });
      if (response.ok) {
        onRefresh();
      } else {
        const errorData = await response.json();
        alert(errorData.message || "Action refused by security.");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const isSuperAdmin = currentUser.role === "super-admin";

  return (
    <div id="user-mangement-panel" className="grid grid-cols-1 lg:grid-cols-12 gap-6 leading-relaxed font-sans">
      
      {/* COLUMN A: REGISTERED STAFF USERS LIST (8 COLUMNS) */}
      <div className="lg:col-span-8 bg-white p-5 border border-slate-200 rounded-2xl shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold font-display text-slate-900 flex items-center gap-1.5">
            <UsersIcon className="text-violet-500 w-5 h-5 stroke-[1.5]" /> Secure Organizational Users Accounts
          </h2>
          <p className="text-xs text-slate-500">View and update system privileges parameters</p>
        </div>

        {/* STAFF LIST TABLE */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <table className="min-w-full divide-y divide-slate-100 text-left text-xs bg-white">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <tr>
                <th scope="col" className="px-4 py-3">Work Name</th>
                <th scope="col" className="px-4 py-3">Assigned Role</th>
                <th scope="col" className="px-4 py-3">Action Status</th>
                <th scope="col" className="px-4 py-3 text-right">Settings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {users.map((u) => {
                const getRoleBadge = (r: UserRole) => {
                  switch (r) {
                    case "super-admin":
                      return "bg-amber-100 text-amber-800 border-amber-200 font-bold";
                    case "admin":
                      return "bg-sky-100 text-sky-800 border-sky-200";
                    case "developer":
                      return "bg-purple-100 text-purple-800 border-purple-200 font-serif font-bold";
                    default:
                      return "bg-slate-100 text-slate-600 border-slate-200";
                  }
                };

                return (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-950">
                      {u.name}
                      <span className="block text-[10px] text-slate-400 font-normal font-mono font-sans">{u.email}</span>
                      {u.designation && (
                        <span className="block text-[10px] text-amber-600 font-medium font-mono font-sans mt-0.5">{u.designation}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${getRoleBadge(u.role)}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        u.status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isSuperAdmin ? (
                        <button
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          disabled={u.id === currentUser.id}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg disabled:opacity-30 cursor-pointer"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Locked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* CREATE NEW STAFF RECORD FORM */}
        {isSuperAdmin && (
          <div className="border border-slate-200 rounded-xl bg-slate-50/50 p-4 space-y-3.5 mt-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1">
              <UserPlus className="w-4 h-4 text-slate-500" /> Create Organizational Account
            </h3>
            
            {createUserSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs flex items-center gap-2">
                <span>Account generated successfully! Audit path created.</span>
              </div>
            )}

            {createUserError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2.5 rounded-lg text-xs">
                {createUserError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
              <div>
                <input
                  type="text"
                  required
                  placeholder="Full Legal Name..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>

              <div>
                <input
                  type="email"
                  required
                  placeholder="name@mitconindia.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none font-mono"
                />
              </div>

              <div>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-2 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                >
                  <option value="admin">Administrator</option>
                  <option value="super-admin">Super Admin</option>
                  <option value="developer">Developer</option>
                </select>
              </div>
              
              <div>
                <input
                  type="text"
                  placeholder="Designation (e.g. BD Manager)"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>

              <div className="md:col-span-4 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 cursor-pointer"
                >
                  Confirm Staff Credentials Check
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* COLUMN B: SECURITY COMPLIANCE POLICIES (4 COLUMNS) */}
      <div className="lg:col-span-4 bg-slate-900 text-white p-5 border border-slate-800 rounded-2xl shadow-sm space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold font-display flex items-center gap-1.5 text-slate-100">
            <Shield className="text-amber-500 w-5 h-5 stroke-[1.5]" /> Global Security Policies Config
          </h2>
          <p className="text-xs text-slate-400">Manage password constraints and checkout limits</p>
        </div>

        {policySuccess && (
          <div className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 p-2.5 rounded-lg text-[11px] flex items-center gap-1 animate-fadeIn">
            <span>✓ Policy variables successfully written to Express node.</span>
          </div>
        )}

        {policyError && (
          <div className="bg-rose-500/15 border border-rose-500/30 text-rose-300 p-2.5 rounded-lg text-xs">
            {policyError}
          </div>
        )}

        <form onSubmit={handleUpdatePolicy} className="space-y-4 text-xs">
          
          <div className="space-y-3.5">

            {/* MIN LENGTH */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <label className="block font-semibold text-slate-100">Minimum Password Passcode Length</label>
              <input
                id="policy-pwd-len"
                type="number"
                min={4}
                max={30}
                value={passwordMinLength}
                onChange={(e) => setPasswordMinLength(Number(e.target.value))}
                disabled={!isSuperAdmin}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-white text-xs font-mono"
              />
              <p className="text-[10px] text-slate-500 leading-tight">Must possess characters or digit keys.</p>
            </div>

            {/* EXPIRY DAYS */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <label className="block font-semibold text-slate-100">Maximum Checkout Interval (Days)</label>
              <input
                id="policy-checkout-limit"
                type="number"
                min={1}
                max={120}
                value={maxCheckoutDurationDays}
                onChange={(e) => setMaxCheckoutDurationDays(Number(e.target.value))}
                disabled={!isSuperAdmin}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-white text-xs font-mono"
              />
              <p className="text-[10px] text-slate-500 leading-tight">Longest allowed duration for temporary offsite document removal.</p>
            </div>

            {/* TIMEOUT LIMIT */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <label className="block font-semibold text-slate-100">Session Expiration timeout (Minutes)</label>
              <input
                id="policy-session-timeout"
                type="number"
                min={5}
                max={300}
                value={sessionTimeoutMinutes}
                onChange={(e) => setSessionTimeoutMinutes(Number(e.target.value))}
                disabled={!isSuperAdmin}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-white text-xs font-mono"
              />
            </div>
          </div>

          {isSuperAdmin ? (
            <button
              type="submit"
              className="w-full py-2.5 bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold rounded-xl text-xs transition-all uppercase tracking-wide cursor-pointer flex items-center justify-center gap-1"
            >
              Commit Global Safety Parameters
            </button>
          ) : (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-2.5 rounded-lg text-[10px] text-center font-semibold">
              🔒 Clearance Required: Super Admin access tokens authorized to overwrite policy configurations.
            </div>
          )}
        </form>
      </div>

    </div>
  );
}
