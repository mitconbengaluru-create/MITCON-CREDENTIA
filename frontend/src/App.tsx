import React, { useState, useEffect } from "react";
import { io } from "socket.io-client";
import {
  LogOut, LayoutDashboard, FolderOpen, RefreshCw, History, Sliders, FileBarChart
} from "lucide-react";
import { User, Document, Checkout, Notification, SecurityPolicy, ReturnRecord } from "./types";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import RepoManager from "./components/RepoManager";
import CheckoutReturn from "./components/CheckoutReturn";
import UserManager from "./components/UserManager";
import ReportModule from "./components/ReportModule";
import NotificationCenter from "./components/NotificationCenter";
import mitconLogo from "./assets/logo.png";

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("bcd_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("bcd_token");
  });
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem("bcd_active_tab") || "dashboard";
  });

  useEffect(() => {
    if (activeTab) {
      localStorage.setItem("bcd_active_tab", activeTab);
    }
  }, [activeTab]);

  // Database synchronist state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [policies, setPolicies] = useState<SecurityPolicy | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);


  // Cross tab selectors state
  const [selectedDocForCheckout, setSelectedDocForCheckout] = useState<Document | null>(null);

  // Interval synchronization flag
  const [syncing, setSyncing] = useState(false);

  // Request desktop notification permission on mount
  useEffect(() => {
    if ("Notification" in window && window.Notification.permission === "default") {
      window.Notification.requestPermission();
    }
  }, []);

  // Fetch full dataset core
  const fetchAllData = async () => {
    if (!token) return;
    setSyncing(true);
    try {
      const headers = {
        "Authorization": `Bearer ${token}`,
        "X-Operator-Name": user?.name || "System",
        "X-Operator-Role": user?.role || "user"
      };

      const [docsRes, checksRes, usersRes, retRes, notRes, polRes] = await Promise.all([
        fetch("/api/documents", { headers }),
        fetch("/api/checkouts", { headers }),
        fetch("/api/users", { headers }),
        fetch("/api/returns", { headers }),
        fetch("/api/notifications", { headers }),
        fetch("/api/policies", { headers })
      ]);

      const [docs, checks, userItems, returnItems, notifyItems, policyData] = await Promise.all([
        docsRes.json(),
        checksRes.json(),
        usersRes.json(),
        retRes.json(),
        notRes.json(),
        polRes.json()
      ]);

      if (docsRes.ok) setDocuments(docs);
      if (checksRes.ok) setCheckouts(checks);
      if (usersRes.ok) {
        setUsers(userItems);
        const freshUser = userItems.find((u: User) => u.email === user?.email);
        if (freshUser) {
          setUser(freshUser);
          localStorage.setItem("bcd_user", JSON.stringify(freshUser));
        }
      }
      if (retRes.ok) setReturns(returnItems);
      if (notRes.ok) setNotifications(notifyItems);
      if (polRes.ok) setPolicies(policyData);

    } catch (error) {
      console.error("Error synchronization indices:", error);
    } finally {
      setSyncing(false);
    }
  };

  // Sync data on startup + tab switch + poller
  useEffect(() => {
    if (token) {
      fetchAllData();
      // Setup live poller to mimic websockets real-time ticker
      const poller = setInterval(fetchAllData, 8000);

      // Connect to Socket.IO Server
      const socket = io(window.location.origin || "http://localhost:5000", {
        auth: { token }
      });

      socket.on("connect", () => {
        console.log("Socket.IO connected to MITCON Credentia Node");
      });

      socket.on("notification:new", (newNot: Notification) => {
        // Prepend new notification to state
        setNotifications(prev => [newNot, ...prev]);
        // Also sync all details since checkouts/documents statuses changed!
        fetchAllData();

        // Native browser desktop notification push
        if ("Notification" in window && window.Notification.permission === "granted") {
          new window.Notification(newNot.title, {
            body: newNot.message,
            icon: "/logo.png"
          });
        }
      });

      return () => {
        clearInterval(poller);
        socket.disconnect();
      };
    }
  }, [token]);

  const handleLoginSuccess = (authenticatedUser: User, authenticatedToken: string) => {
    setUser(authenticatedUser);
    setToken(authenticatedToken);
    localStorage.setItem("bcd_user", JSON.stringify(authenticatedUser));
    localStorage.setItem("bcd_token", authenticatedToken);
    setActiveTab("dashboard");
  };

  const handleLogout = async () => {
    setConfirmModal({
      isOpen: true,
      title: "Confirm Sign Out",
      message: "Verify: Are you sure you want to sign out of MITCON Credentia Secure Vault?",
      onConfirm: () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem("bcd_user");
        localStorage.removeItem("bcd_token");
        localStorage.removeItem("bcd_active_tab");
        setConfirmModal(null);
      }
    });
  };

  const notifyMarkRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
      fetchAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const notifyClearAll = async () => {
    try {
      await fetch("/api/notifications/clear-all", { method: "POST" });
      fetchAllData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectDocForCheckout = (doc: Document) => {
    setSelectedDocForCheckout(doc);
    setActiveTab("checkouts");
  };

  // If unauthenticated, redirect direct to secure login screen
  if (!user || !token) {
    return (
      <LoginPage
        onSuccess={handleLoginSuccess}
        mfaDefaultSetting={policies?.requireMfa || true}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 antialiased selection:bg-amber-500/20">

      {/* GLOBAL ENTERPRISE TOP HEADER BAR */}
      <header className="bg-slate-900 text-white shadow-xl px-4 sm:px-6 lg:px-8 border-b border-slate-800 shrink-0 select-none">
        <div className="max-w-7xl mx-auto flex justify-between h-16 items-center">

          {/* LOGO AREA */}
          <div className="flex items-center gap-3">
            <img src={mitconLogo} className="h-9 w-auto" alt="Mitcon Credentia Logo" />
            <div>
              <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Module Tracker</p>
            </div>
          </div>

          {/* PRIVILEGED USER INFO PROFILE & NOTIFICATIONS & LOGOUT */}
          <div className="flex items-center gap-4 text-xs font-medium">

            {/* Real-time sync ticker */}
            <button
              onClick={fetchAllData}
              disabled={syncing}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 hidden sm:flex items-center gap-1 transition-all"
              title="Manual refresh server indexes"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin text-amber-400" : ""}`} />
            </button>

            {/* Notification drop-down center component */}
            <NotificationCenter
              notifications={notifications}
              onMarkRead={notifyMarkRead}
              onClearAll={notifyClearAll}
            />

            {/* User session Profile Box */}
            <div className="hidden md:flex flex-col items-end border-l border-slate-800 pl-4 h-9 justify-center">
              <span className="text-slate-100 font-bold leading-tight">{user.name}</span>
              <span className={`text-[9px] uppercase font-bold text-right px-1.5 py-0.2 rounded mt-0.5 ${user.role === "super-admin" ? "bg-amber-500 text-slate-950" :
                  user.role === "admin" ? "bg-blue-600/10 text-blue-400" :
                    user.role === "developer" ? "bg-purple-600/10 text-purple-400" :
                      "bg-slate-700 text-slate-300"
                }`}>
                {user.role === "super-admin" ? "🔑 Super Admin Override" : user.role}
              </span>
            </div>

            {/* Force Sign-Out */}
            <button
              onClick={handleLogout}
              className="px-3 py-2 bg-slate-800 hover:bg-rose-950 hover:text-rose-200 border border-slate-700/50 hover:border-rose-900 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-slate-400"
              title="Terminate Secure Session"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Terminate Session</span>
            </button>

          </div>
        </div>
      </header>

      {/* CORE NAVIGATION SLIDER BAR */}
      <nav className="bg-white border-b border-slate-200 shadow-xs px-4 sm:px-6 select-none shrink-0 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex gap-1.5 h-12 items-center text-xs font-semibold uppercase scrollbar-none">

          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${activeTab === "dashboard" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0" />
            <span>Core Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab("repo")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${activeTab === "repo" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
          >
            <FolderOpen className="w-4 h-4 shrink-0" />
            <span>Vault Repository</span>
          </button>

          <button
            onClick={() => setActiveTab("checkouts")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${activeTab === "checkouts" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
          >
            <History className="w-4 h-4 shrink-0" />
            <span>Checkouts & Returns</span>
          </button>



          <button
            onClick={() => setActiveTab("users")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${activeTab === "users" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span>Roles & Security custom</span>
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${activeTab === "reports" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
          >
            <FileBarChart className="w-4 h-4 shrink-0" />
            <span>Compliance Reports</span>
          </button>


        </div>
      </nav>

      {/* CORE WORKSPACE INNER CONTENT MOUNT */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 overflow-y-auto">

        {activeTab === "dashboard" && (
          <Dashboard
            documents={documents}
            checkouts={checkouts}
            users={users}
            onNavigate={setActiveTab}
          />
        )}

        {activeTab === "repo" && (
          <RepoManager
            documents={documents}
            currentUser={user}
            onRefresh={fetchAllData}
            onSelectForCheckout={handleSelectDocForCheckout}
          />
        )}

        {activeTab === "checkouts" && (
          <CheckoutReturn
            documents={documents}
            checkouts={checkouts}
            users={users}
            currentUser={user}
            onRefresh={fetchAllData}
            selectedDocForCheckout={selectedDocForCheckout}
            onClearSelectedDoc={() => setSelectedDocForCheckout(null)}
            onNavigate={setActiveTab}
          />
        )}



        {activeTab === "users" && (
          <UserManager
            users={users}
            currentUser={user}
            onRefresh={fetchAllData}
            policies={policies || {
              passwordMinLength: 8,
              requireMfa: true,
              sessionTimeoutMinutes: 30,
              allowedUploadFormats: ["pdf", "docx"],
              autoRejectExpiredCheckouts: false,
              maxCheckoutDurationDays: 30
            }}
            onRefreshPolicies={fetchAllData}
          />
        )}

        {activeTab === "reports" && (
          <ReportModule
            documents={documents}
            checkouts={checkouts}
            users={users}
            returns={returns}
          />
        )}


      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-[10px] text-slate-400 select-none shrink-0 font-mono">
        © 2026 MITCON Credentia. Secure Node Status: Active & Official
      </footer>

      {/* Reusable Custom Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative overflow-hidden dark-glass transform scale-100 transition-all duration-200">
            {/* Background design accents */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full filter blur-xl pointer-events-none" />
            
            {/* Header info */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">{confirmModal.title}</h3>
                <p className="text-[10px] text-slate-500 font-mono">MITCON CREDENTIA SECURITY</p>
              </div>
            </div>

            {/* Message content */}
            <p className="text-xs text-slate-300 mb-6 leading-relaxed">
              {confirmModal.message}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-2xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-semibold rounded-2xl shadow-lg shadow-orange-500/20 transition-all"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

    </div>

  );
}
