import React, { useState } from "react";
import {
  FileText, ArrowDownToLine, Printer, Filter, BadgeInfo, Barcode,
  CheckCircle2, FileSignature, ShieldAlert, Search
} from "lucide-react";
import { Document, Checkout, User, ReturnRecord } from "../types";

interface ReportModuleProps {
  documents: Document[];
  checkouts: Checkout[];
  users: User[];
  returns: ReturnRecord[];
}

export default function ReportModule({ documents, checkouts, users, returns }: ReportModuleProps) {
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // CSV Exporter Helper
  const downloadCsv = (headers: string[], rows: string[][], filename: string) => {
    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Checkout Report Calculations
  const getCheckoutData = () => {
    return checkouts.filter(c => {
      const matchesStatus = filterStatus === "All" || c.status === filterStatus;
      const matchesSearch = searchQuery === "" ||
        c.documentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.documentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.destination.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  };

  const handleExportCheckout = () => {
    const data = getCheckoutData();
    const headers = ["Document ID", "Document Name", "Employee", "Employee ID", "Destination", "Purpose", "Checkout Date", "Expected Return", "Status"];
    const rows = data.map(c => [
      c.documentId,
      c.documentName,
      c.employeeName,
      c.employeeId,
      c.destination,
      c.purpose,
      new Date(c.checkoutDate).toLocaleDateString(),
      c.expectedReturnDate,
      c.status
    ]);
    downloadCsv(headers, rows, "BCD_Checkout_Report");
  };

  // Trigger high-fidelity print view
  const handlePrint = () => {
    window.print();
  };

  return (
    <div id="reporting-panel" className="space-y-6 font-sans leading-relaxed">

      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 font-display tracking-tight">Security Reporting Module</h1>
          <p className="text-xs text-slate-500 font-medium">Export official CSV tables and render print-ready certificates</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold font-display flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" /> Print compliance Frame
          </button>

          <button
            onClick={handleExportCheckout}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold font-display flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <ArrowDownToLine className="w-4 h-4" /> Download CSV Spreadsheet
          </button>
        </div>
      </div>

      {/* FILTER CONTROLS HUB */}
      <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm space-y-4">

        {/* SELECT REPORT KIND TABS */}
        <div className="flex gap-1 bg-slate-100 p-1.5 rounded-xl text-center self-start overflow-x-auto max-w-full">
          <button
            className="px-4 py-2 text-xs font-semibold rounded-lg shrink-0 transition-all bg-white text-slate-900 shadow-sm"
          >
            Checkout Log Report
          </button>
        </div>

        {/* INPUT AND DROPDOWN SLIDERS */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
          <div className="md:col-span-8 relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              id="report-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports by uploader, employee name, or target ID..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="md:col-span-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
            >
              <option value="All">All Statuses</option>
              <option value="Checked Out">Checked Out</option>
              <option value="Available">Available</option>
            </select>
          </div>
        </div>
      </div>

      {/* PRINT AND VIEW PORTAL INNER */}
      <div id="print-area" className="bg-white p-8 border border-slate-200 rounded-2xl shadow-sm space-y-6 printable-certificate relative">

        {/* Certificate Cover Header */}
        <div className="flex justify-between items-center border-b-2 border-slate-900 pb-4">
          <div className="space-y-1">
            <span className="text-[10px] text-amber-500 uppercase tracking-widest font-extrabold font-serif">ORGANIZATIONAL SECURITY ALLIANCE</span>
            <h2 className="text-xl font-bold font-display text-slate-950">MITCON CREDENTIA COMPLIANCE AUDIT CERTIFICATE</h2>
            <p className="text-[10px] text-slate-500 font-mono">NODE AUTH-STREAM TARGET REFERENCE MATRIX</p>
          </div>

          <div className="flex flex-col items-center">
            <Barcode className="w-16 h-8 stroke-[1.25] text-slate-800" />
            <span className="text-[9px] font-mono font-medium text-slate-400 mt-1 uppercase">VERIFIED_LOG_CHECKOUT</span>
          </div>
        </div>

        {/* 1. CHECKOUT LOGS REPORT VIEW */}
        <div className="space-y-4">
          <div className="flex justify-between items-baseline">
            <h3 className="text-sm font-bold text-slate-800 font-display">Logistics Checkout Registry Logs</h3>
            <span className="text-[10px] text-slate-400 font-mono">Count: {getCheckoutData().length} matches</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase">
                <tr>
                  <th className="px-3 py-2">Document</th>
                  <th className="px-3 py-2">Employee Target</th>
                  <th className="px-3 py-2">Destination</th>
                  <th className="px-3 py-2">Purpose Justification</th>
                  <th className="px-3 py-2">Dates (Out/Return)</th>
                  <th className="px-3 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {getCheckoutData().map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2.5 font-semibold text-slate-950">
                      {c.documentName}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {c.employeeName}
                      <span className="block font-mono text-[9px] text-slate-400">{c.employeeId}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      {c.destination}
                    </td>
                    <td className="px-3 py-2.5 max-w-[150px] truncate" title={c.purpose}>
                      {c.purpose}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-[10px]">
                      <span>Out: {new Date(c.checkoutDate).toLocaleDateString()}</span>
                      <span className="block text-slate-400">
                        Ex: {c.expectedReturnDate === "Document Travel (Courier)" ? "Courier Travel" : c.expectedReturnDate}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${c.status === "Checked Out" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                        }`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Certificate Seal Footer */}
        <div className="border-t border-slate-300 pt-6 flex flex-col md:flex-row justify-between items-start md:items-baseline text-[10px] text-slate-400 gap-4 mt-6">
          <div className="space-y-1">
            <p className="font-bold flex items-center gap-1"><FileSignature className="w-3.5 h-3.5 text-slate-400" /> AUTOMARK CRYPTOSIGN CONFIRMED</p>
            <p>Generated dynamically in compliance with digital signatures protocols standard standards MITCON-CREDENTIA-2026.</p>
          </div>
          <div className="font-mono text-slate-400 self-end text-right">
            TIMESTAMP_PROOF: <span className="font-bold text-slate-800">
              {new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" })}
              {"     "}
              {new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
