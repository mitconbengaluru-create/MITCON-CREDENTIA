import React, { useState, useEffect } from "react";
import { 
  FileText, ShieldCheck, Users, Activity, 
  ArrowUpRight, FileSignature, CheckCircle, ShieldAlert, Clock, Bell
} from "lucide-react";
import { Document, Checkout, User } from "../types";

interface DashboardProps {
  documents: Document[];
  checkouts: Checkout[];
  users: User[];
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ documents, checkouts, users, onNavigate }: DashboardProps) {
  // Derive stats
  const totalDocs = documents.length;
  const activeCheckouts = checkouts.filter(c => c.status === "Checked Out").length;
  const returnedDocs = checkouts.filter(c => c.status === "Returned" || c.status === "Closed").length;
  const totalUsers = users.length;
  
  const activeCheckedOutList = checkouts.filter(c => c.status === "Checked Out");

  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setPermissionState(window.Notification.permission);
    }
  }, []);

  const handleRequestPermission = async () => {
    if ("Notification" in window) {
      const res = await window.Notification.requestPermission();
      setPermissionState(res);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Live Alerts pre-permission promotion card */}
      {permissionState === "default" && (
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-4.5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs animate-fadeIn">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0 shadow-xs">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest font-display">Enable Desktop Live Alerts</h4>
              <p className="text-xs text-slate-500 mt-1">Receive instant offsite document tracking and return confirmations directly on your desktop even when in other tabs.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRequestPermission}
            className="px-4.5 py-2.5 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all shrink-0 cursor-pointer"
          >
            Enable Notifications
          </button>
        </div>
      )}

      {/* 4 CORE STATS WIDGETS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total Documents */}
        <div onClick={() => onNavigate("repo")} className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm hover:border-slate-300 transition-all cursor-pointer">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vault Files</span>
            <span className="bg-slate-100 p-2 rounded-xl text-slate-700">
              <FileText className="w-5 h-5 stroke-[1.5]" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 font-display">{totalDocs}</span>
            <span className="text-[10px] text-slate-500 font-medium bg-slate-50 px-1 rounded">Files stored</span>
          </div>
        </div>

        {/* Checked Out */}
        <div onClick={() => onNavigate("checkouts")} className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm hover:border-slate-300 transition-all cursor-pointer">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Checked Out</span>
            <span className="bg-amber-50 p-2 rounded-xl text-amber-600">
              <FileSignature className="w-5 h-5 stroke-[1.5]" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 font-display">{activeCheckouts}</span>
            <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-1 rounded">Active loans</span>
          </div>
        </div>

        {/* Returned Docs */}
        <div onClick={() => onNavigate("checkouts")} className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm hover:border-slate-300 transition-all cursor-pointer">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Returned logs</span>
            <span className="bg-emerald-50 p-2 rounded-xl text-emerald-600">
              <CheckCircle className="w-5 h-5 stroke-[1.5]" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 font-display">{returnedDocs}</span>
            <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1 rounded">Closed logs</span>
          </div>
        </div>

        {/* Registered Users */}
        <div onClick={() => onNavigate("users")} className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm hover:border-slate-300 transition-all cursor-pointer">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registered Users</span>
            <span className="bg-blue-50 p-2 rounded-xl text-blue-600">
              <Users className="w-5 h-5 stroke-[1.5]" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 font-display">{totalUsers}</span>
            <span className="text-[10px] text-blue-600 font-medium bg-blue-50 px-1 rounded">Active profiles</span>
          </div>
        </div>
      </div>

      {/* MID SECTION: ACTIVE CHECKOUTS + STAFF LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Active Checked Out list */}
        <div className="lg:col-span-8 bg-white p-5 border border-slate-200 rounded-2xl shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800 font-display">Active Checked Out Documents</h3>
            <p className="text-xs text-slate-400 font-medium">Verify offsite document travel status</p>
          </div>
          
          <div className="overflow-x-auto border border-slate-100 rounded-xl bg-slate-50 p-1">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase">
                <tr>
                  <th className="px-3 py-2">Document</th>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Destination</th>
                  <th className="px-3 py-2">Due Return</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-sans">
                {activeCheckedOutList.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2.5 font-semibold text-slate-950">
                      {c.documentName}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {c.employeeName}
                      <span className="block font-mono text-[9px] text-slate-400">{c.employeeId}</span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">{c.destination}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[10px] text-indigo-600 font-bold">
                      {c.expectedReturnDate === "Document Travel (Courier)" ? (
                        <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 font-sans font-bold">Courier Travel</span>
                      ) : (
                        c.expectedReturnDate
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {activeCheckedOutList.length === 0 && (
              <p className="text-xs text-slate-400 p-6 text-center bg-white rounded-lg">No documents are currently checked out.</p>
            )}
          </div>
        </div>

        {/* STAFF USERS OVERLAY */}
        <div className="lg:col-span-4 bg-white p-5 border border-slate-200 rounded-2xl shadow-sm flex flex-col h-full max-h-[500px]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 font-display">System Administrators</h3>
              <p className="text-[11px] text-slate-400">Privileged accounts listing</p>
            </div>
            <button
              onClick={() => onNavigate("users")}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
            >
              Manage
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {users.map((u) => (
              <div key={u.id} className="flex gap-3 leading-relaxed items-center">
                <div className="p-1.5 rounded-lg h-8 w-8 flex items-center justify-center shrink-0 bg-slate-100 text-slate-700">
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex-1 text-xs">
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold text-slate-800">{u.name}</span>
                    <span className="text-[10px] text-indigo-500 font-bold font-mono uppercase bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">{u.role}</span>
                  </div>
                  <p className="text-slate-400 text-[10px] font-mono leading-none mt-1">{u.email}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
