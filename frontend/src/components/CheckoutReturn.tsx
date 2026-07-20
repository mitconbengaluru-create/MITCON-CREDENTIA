import React, { useState, useEffect } from "react";
import { 
  FileSignature, CheckCircle2, History, ShieldAlert, BadgeInfo, Undo2 
} from "lucide-react";
import { Document, Checkout, User } from "../types";
import SignatureCanvas from "./SignatureCanvas";

interface CheckoutReturnProps {
  documents: Document[];
  checkouts: Checkout[];
  users: User[];
  currentUser: User;
  onRefresh: () => void;
  selectedDocForCheckout: Document | null;
  onClearSelectedDoc: () => void;
  onNavigate: (tab: string) => void;
}

export default function CheckoutReturn({
  documents,
  checkouts,
  users = [],
  currentUser,
  onRefresh,
  selectedDocForCheckout,
  onClearSelectedDoc,
  onNavigate
}: CheckoutReturnProps) {
  
  // Checkout form state
  const [docId, setDocId] = useState("");
  const [docName, setDocName] = useState("");
  const [docDbId, setDocDbId] = useState("");
  
  // Checkout details
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [isDocumentTravel, setIsDocumentTravel] = useState(false);
  const [checkoutSearch, setCheckoutSearch] = useState("");
  
  // Checkout signature
  const [signatureData, setSignatureData] = useState("");
  const [signatureType, setSignatureType] = useState<'drawn' | 'uploaded' | 'typed'>('drawn');

  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // Return Document state
  const [activeReturnCheckout, setActiveReturnCheckout] = useState<Checkout | null>(null);
  const [returnCondition, setReturnCondition] = useState<'Perfect' | 'Good' | 'Damaged' | 'Missing Pages' | 'Digital Copy Only'>("Perfect");
  const [returnNotes, setReturnNotes] = useState("");
  const [returningEmployeeSig, setReturningEmployeeSig] = useState("");
  const [returnSuccess, setReturnSuccess] = useState(false);
  const [returnError, setReturnError] = useState("");
  const [isReturnDocumentTravel, setIsReturnDocumentTravel] = useState(false);
  const [returnSearch, setReturnSearch] = useState("");
  const [showCheckoutSuggestions, setShowCheckoutSuggestions] = useState(false);
  const [showReturnSuggestions, setShowReturnSuggestions] = useState(false);
  const [isOpenCheckoutDropdown, setIsOpenCheckoutDropdown] = useState(false);
  const [isOpenReturnDropdown, setIsOpenReturnDropdown] = useState(false);

  const getCheckoutSuggestions = () => {
    if (!checkoutSearch.trim()) return [];
    const term = checkoutSearch.toLowerCase();
    const list: { key: string; value: string }[] = [];
    const seen = new Set<string>();

    for (const d of documents) {
      if (d.client.toLowerCase().includes(term)) {
        const item = { key: "Client", value: d.client };
        const serialized = `${item.key}:${item.value}`;
        if (!seen.has(serialized)) {
          seen.add(serialized);
          list.push(item);
        }
      }
      if (d.documentName.toLowerCase().includes(term)) {
        const item = { key: "Doc", value: d.documentName };
        const serialized = `${item.key}:${item.value}`;
        if (!seen.has(serialized)) {
          seen.add(serialized);
          list.push(item);
        }
      }
      if (d.placeOfHolding.toLowerCase().includes(term)) {
        const item = { key: "Holding", value: d.placeOfHolding };
        const serialized = `${item.key}:${item.value}`;
        if (!seen.has(serialized)) {
          seen.add(serialized);
          list.push(item);
        }
      }
    }
    return list.slice(0, 6);
  };

  const getReturnSuggestions = () => {
    if (!returnSearch.trim()) return [];
    const term = returnSearch.toLowerCase();
    const list: { key: string; value: string }[] = [];
    const seen = new Set<string>();

    for (const c of activeCheckouts) {
      if (c.documentName.toLowerCase().includes(term)) {
        const item = { key: "Doc", value: c.documentName };
        const serialized = `${item.key}:${item.value}`;
        if (!seen.has(serialized)) {
          seen.add(serialized);
          list.push(item);
        }
      }
      if (c.employeeName.toLowerCase().includes(term)) {
        const item = { key: "Employee", value: c.employeeName };
        const serialized = `${item.key}:${item.value}`;
        if (!seen.has(serialized)) {
          seen.add(serialized);
          list.push(item);
        }
      }
      if (c.destination.toLowerCase().includes(term)) {
        const item = { key: "Destination", value: c.destination };
        const serialized = `${item.key}:${item.value}`;
        if (!seen.has(serialized)) {
          seen.add(serialized);
          list.push(item);
        }
      }
    }
    return list.slice(0, 6);
  };

  // Sync selected document from repository triggering
  useEffect(() => {
    if (selectedDocForCheckout) {
      setDocDbId(selectedDocForCheckout.id);
      setDocId(selectedDocForCheckout.documentId);
      setDocName(selectedDocForCheckout.documentName);
    } else {
      // Pick first available doc that is not already checked out or pending as default
      const available = documents.find(d => d.status === "Available");
      if (available) {
        setDocDbId(available.id);
        setDocId(available.documentId);
        setDocName(available.documentName);
      }
    }
  }, [selectedDocForCheckout, documents]);

  const handleDocChange = (dbId: string) => {
    const matched = documents.find(d => d.id === dbId);
    if (matched) {
      setDocDbId(matched.id);
      setDocId(matched.documentId);
      setDocName(matched.documentName);
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError("");
    setCheckoutSuccess(false);

    if (!docDbId || !currentUser.id || !currentUser.name || !destination || (!isDocumentTravel && !returnDate) || !purpose) {
      setCheckoutError("Please fill in all mandatory fields before logging checkout.");
      return;
    }

    if (!signatureData) {
      setCheckoutError("Security Lock: Digital verification signature is mandatory. Please draw or type signature below.");
      return;
    }

    // Direct checkout log (Immediate checkout for all roles)
    try {
      const response = await fetch("/api/checkouts", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Operator-Name": currentUser.name,
          "X-Operator-Role": currentUser.role
        },
        body: JSON.stringify({
          documentDbId: docDbId,
          employeeName: currentUser.name,
          employeeId: currentUser.id,
          designation: currentUser.designation || "Not Assigned",
          destination,
          purpose: isDocumentTravel ? `${purpose} [Document Travel / Courier Required]`.trim() : purpose,
          expectedReturnDate: isDocumentTravel ? "Document Travel (Courier)" : returnDate,
          approvalAuthority: "Direct Checkout Log",
          signature: signatureData,
          signatureType
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Registration of checkout record rejected.");

      setCheckoutSuccess(true);
      // Reset details and form inputs
      setDestination(""); setPurpose(""); setReturnDate(""); setSignatureData("");
      setIsDocumentTravel(false);
      setCheckoutSearch("");
      setIsOpenCheckoutDropdown(false);
      onClearSelectedDoc();
      onRefresh();
    } catch (err: any) {
      setCheckoutError(err.message || "Connection failure.");
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReturnError("");
    setReturnSuccess(false);

    if (!activeReturnCheckout) {
      setReturnError("Please select a checked-out document log target from the drop-down.");
      return;
    }

    if (!returningEmployeeSig) {
      setReturnError("Audit block: A digital signature from the returning employee is mandatory!");
      return;
    }

    try {
      const response = await fetch(`/api/checkouts/${activeReturnCheckout.id}/return`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Operator-Name": currentUser.name,
          "X-Operator-Role": currentUser.role
        },
        body: JSON.stringify({
          condition: returnCondition,
          notes: isReturnDocumentTravel ? `${returnNotes} [Document Travel / Returned via Courier]`.trim() : returnNotes,
          returningEmployeeSignature: returningEmployeeSig,
          returningEmployeeName: currentUser.name
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Verification of returned artifact failed.");

      setReturnSuccess(true);
      setReturnNotes("");
      setReturningEmployeeSig("");
      setReturnCondition("Perfect");
      setActiveReturnCheckout(null);
      setIsReturnDocumentTravel(false);
      setReturnSearch("");
      setIsOpenReturnDropdown(false);
      onRefresh();
    } catch (err: any) {
      setReturnError(err.message || "Network return validation failure.");
    }
  };

  const activeCheckouts = checkouts.filter(c => c.status === "Checked Out");

  return (
    <div id="checkout-returns-panel" className="grid grid-cols-1 lg:grid-cols-12 gap-6 leading-relaxed font-sans">
      
      {/* LEFT FORM MODULE: CHECK OUT LOG ENTRY (7 COLUMNS) */}
      <div className="lg:col-span-7 bg-white p-5 border border-slate-200 rounded-2xl shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold font-display text-slate-900 flex items-center gap-1.5">
              <FileSignature className="text-amber-500 w-5 h-5 stroke-[1.5]" /> Secure Repository Checkout Log
            </h2>
            <p className="text-xs text-slate-500">Record offsite document travel paths securely</p>
          </div>
          
          {selectedDocForCheckout && (
            <button
              onClick={onClearSelectedDoc}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 transition-all cursor-pointer"
            >
              <Undo2 className="w-3 h-3" /> Clear Select
            </button>
          )}
        </div>

        {checkoutSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3.5 rounded-xl flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold">Checkout Log cataloged successfully.</p>
              <p className="text-[11px] text-emerald-600">The document state has been locked as Checked Out in the repository.</p>
            </div>
          </div>
        )}

        {checkoutError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3.5 rounded-xl flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{checkoutError}</span>
          </div>
        )}

        <form onSubmit={handleCheckoutSubmit} className="space-y-4">
          
          {/* SECTION A: Vault Document Select */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-1">
              A. Vault Document Select
            </h3>
            
            <div className="grid grid-cols-1 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Target Document *</label>
                <div className="space-y-2 relative">
                  <input
                    type="text"
                    placeholder="Search available documents (by name, client, or place)..."
                    value={checkoutSearch}
                    onChange={(e) => {
                      setCheckoutSearch(e.target.value);
                      setShowCheckoutSuggestions(true);
                    }}
                    onFocus={() => setShowCheckoutSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowCheckoutSuggestions(false), 200)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-400"
                  />

                  {showCheckoutSuggestions && checkoutSearch.trim() && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-slate-100 py-1">
                      {getCheckoutSuggestions().length > 0 ? (
                        getCheckoutSuggestions().map((item, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onMouseDown={() => {
                              setCheckoutSearch(item.value);
                              setShowCheckoutSuggestions(false);
                            }}
                            className="w-full px-4 py-2 text-left text-xs hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <span className="font-semibold text-slate-800 truncate mr-2">{item.value}</span>
                            <span className="text-[9px] uppercase font-bold text-slate-400 font-mono tracking-wider shrink-0 px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                              {item.key}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-left text-xs text-slate-400 italic">No matches found</div>
                      )}
                    </div>
                  )}

                  {/* Custom Selector Trigger Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsOpenCheckoutDropdown(!isOpenCheckoutDropdown)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                    >
                      <span className="truncate">
                        {docDbId 
                          ? documents.find(d => d.id === docDbId)?.documentName || "Select Document..."
                          : "Select Document..."
                        }
                      </span>
                      <span className="text-slate-400 text-[10px] shrink-0 ml-2">
                        {isOpenCheckoutDropdown ? "▲" : "▼"}
                      </span>
                    </button>

                    {isOpenCheckoutDropdown && (
                      <>
                        <div 
                          className="fixed inset-0 z-30" 
                          onClick={() => setIsOpenCheckoutDropdown(false)}
                        />
                        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-40 max-h-60 overflow-y-auto divide-y divide-slate-100 py-1 text-slate-800">
                          <div 
                            onClick={() => {
                              handleDocChange("");
                              setIsOpenCheckoutDropdown(false);
                            }}
                            className="px-3 py-2 text-xs text-slate-450 hover:bg-slate-50 hover:text-slate-650 cursor-pointer transition-colors"
                          >
                            Reset selection
                          </div>
                          {documents.filter(d => 
                            d.id === docDbId ||
                            d.documentName.toLowerCase().includes(checkoutSearch.toLowerCase()) ||
                            d.client.toLowerCase().includes(checkoutSearch.toLowerCase()) ||
                            d.placeOfHolding.toLowerCase().includes(checkoutSearch.toLowerCase())
                          ).length > 0 ? (
                            documents.filter(d => 
                              d.id === docDbId ||
                              d.documentName.toLowerCase().includes(checkoutSearch.toLowerCase()) ||
                              d.client.toLowerCase().includes(checkoutSearch.toLowerCase()) ||
                              d.placeOfHolding.toLowerCase().includes(checkoutSearch.toLowerCase())
                            ).map(d => {
                              const isOut = d.status === "Checked Out";
                              return (
                                <div
                                  key={d.id}
                                  onClick={() => {
                                    if (!isOut) {
                                      handleDocChange(d.id);
                                      setIsOpenCheckoutDropdown(false);
                                    }
                                  }}
                                  className={`px-3 py-2 text-xs transition-colors ${
                                    isOut 
                                      ? "text-slate-300 bg-slate-50/50 cursor-not-allowed" 
                                      : docDbId === d.id
                                        ? "bg-slate-900 border-l-2 border-slate-900 text-white font-semibold cursor-pointer" 
                                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-950 cursor-pointer"
                                  }`}
                                >
                                  <div className="font-semibold truncate flex items-center justify-between">
                                    <span>{d.documentName}</span>
                                    {isOut && (
                                      <span className="text-[9px] px-1 bg-amber-50 text-amber-700 rounded shrink-0 font-normal font-sans border border-amber-200">
                                        Checked Out
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-2 truncate">
                                    <span>Client: {d.client}</span>
                                    <span>•</span>
                                    <span>Holding: {d.placeOfHolding}</span>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="px-3 py-3 text-slate-400 italic text-center">No documents matching search filters.</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {selectedDocForCheckout && (
                  <p className="text-[10px] text-amber-600 font-bold mt-1">✓ Pin-locked from Repository explorer.</p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION B: LOGGING EMPLOYEE CREDENTIALS */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">B. Employee Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Employee Name</label>
                <input
                  type="text"
                  value={currentUser.name}
                  readOnly
                  className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Employee ID</label>
                <input
                  type="text"
                  value={currentUser.id}
                  readOnly
                  className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-650 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Designation</label>
                <input
                  type="text"
                  value={currentUser.designation || "Not Assigned"}
                  readOnly
                  className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-650 cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* SECTION C: LOGISTICS PATH & REMOVAL PURPOSE */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">C. Out-of-Office Travel Coordinates</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Target Travel Destination *</label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                  placeholder="e.g., Central SEC Meeting Room/Branch Office 2"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                  Expected Return Date {isDocumentTravel ? "" : "*"}
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  required={!isDocumentTravel}
                  disabled={isDocumentTravel}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>

              <div className="md:col-span-2 flex items-center gap-2 bg-white border border-slate-200 p-3.5 rounded-xl">
                <input
                  id="document-travel-checkbox"
                  type="checkbox"
                  checked={isDocumentTravel}
                  onChange={(e) => setIsDocumentTravel(e.target.checked)}
                  className="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                />
                <label htmlFor="document-travel-checkbox" className="text-xs font-semibold text-slate-700 cursor-pointer flex items-center gap-1">
                  Document Travel (Requires Courier Service - Return Date Optional)
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">Removal Purpose Statement *</label>
                <textarea
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  required
                  rows={2}
                  placeholder="Must record detailed purpose justification..."
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* SECTION D: DIGITAL SIGNATURE FOR AUTHENTICATION */}
          <div className="space-y-2">
            <SignatureCanvas 
              onSave={(data, type) => {
                setSignatureData(data);
                setSignatureType(type);
              }} 
            />
          </div>

          <div className="pt-4 flex justify-end gap-2">
            <button
              type="submit"
              className="px-5 py-2.5 bg-slate-900 border border-transparent rounded-xl text-xs font-semibold text-white hover:bg-slate-800 transition-all cursor-pointer shadow-sm ml-auto"
            >
              Sign & Register Document Checkout
            </button>
          </div>
        </form>
      </div>

      {/* RIGHT COLUMN: SECURE CHECK-IN / RETURN PORTAL (5 COLUMNS) */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-slate-900 text-white p-5 border border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold font-display flex items-center gap-1.5 text-slate-100">
              <History className="text-emerald-400 w-5 h-5 stroke-[1.5]" /> Secure Document Check-In / Return
            </h2>
            <p className="text-xs text-slate-400">Process returned physical documents back inside vaults</p>
          </div>

          {returnSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 rounded-xl text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold">Document return logged & verified.</p>
                <p className="text-[10px] mt-0.5 text-slate-400">Lock restored. Index state updated back to Approved.</p>
              </div>
            </div>
          )}

          {returnError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{returnError}</span>
            </div>
          )}

          <form onSubmit={handleReturnSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Select Checked-Out Log *</label>
            <div className="space-y-2 relative">
              <input
                type="text"
                placeholder="Search checked out logs (by name, employee, or destination)..."
                value={returnSearch}
                onChange={(e) => {
                  setReturnSearch(e.target.value);
                  setShowReturnSuggestions(true);
                }}
                onFocus={() => setShowReturnSuggestions(true)}
                onBlur={() => setTimeout(() => setShowReturnSuggestions(false), 200)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />

              {showReturnSuggestions && returnSearch.trim() && (
                <div className="absolute left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-slate-800 py-1 text-white">
                  {getReturnSuggestions().length > 0 ? (
                    getReturnSuggestions().map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onMouseDown={() => {
                          setReturnSearch(item.value);
                          setShowReturnSuggestions(false);
                        }}
                        className="w-full px-4 py-2 text-left text-xs hover:bg-slate-900 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <span className="font-semibold text-slate-200 truncate mr-2">{item.value}</span>
                        <span className="text-[9px] uppercase font-bold text-slate-400 font-mono tracking-wider shrink-0 px-1.5 py-0.5 bg-slate-900 rounded border border-slate-750">
                          {item.key}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-left text-xs text-slate-500 italic">No matches found</div>
                  )}
                </div>
              )}

              {/* Custom Selector Trigger Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsOpenReturnDropdown(!isOpenReturnDropdown)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white text-left flex items-center justify-between focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <span className="truncate">
                    {activeReturnCheckout 
                      ? `${activeReturnCheckout.documentName} - ${activeReturnCheckout.employeeName}` 
                      : "Choose active checkout file..."
                    }
                  </span>
                  <span className="text-slate-500 text-[10px] shrink-0 ml-2">
                    {isOpenReturnDropdown ? "▲" : "▼"}
                  </span>
                </button>

                {isOpenReturnDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setIsOpenReturnDropdown(false)}
                    />
                    <div className="absolute left-0 right-0 mt-1 bg-slate-950 border border-slate-800 rounded-xl shadow-xl z-40 max-h-60 overflow-y-auto divide-y divide-slate-900 py-1 text-white">
                      <div 
                        onClick={() => {
                          setActiveReturnCheckout(null);
                          setIsOpenReturnDropdown(false);
                        }}
                        className="px-3 py-2 text-xs text-slate-500 hover:bg-slate-900 hover:text-slate-400 cursor-pointer transition-colors"
                      >
                        Reset selection
                      </div>
                      {activeCheckouts.filter(c => 
                        c.id === activeReturnCheckout?.id ||
                        c.documentName.toLowerCase().includes(returnSearch.toLowerCase()) ||
                        c.employeeName.toLowerCase().includes(returnSearch.toLowerCase()) ||
                        c.destination.toLowerCase().includes(returnSearch.toLowerCase())
                      ).length > 0 ? (
                        activeCheckouts.filter(c => 
                          c.id === activeReturnCheckout?.id ||
                          c.documentName.toLowerCase().includes(returnSearch.toLowerCase()) ||
                          c.employeeName.toLowerCase().includes(returnSearch.toLowerCase()) ||
                          c.destination.toLowerCase().includes(returnSearch.toLowerCase())
                        ).map(c => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setActiveReturnCheckout(c);
                              setIsOpenReturnDropdown(false);
                            }}
                            className={`px-3 py-2.5 text-xs transition-colors cursor-pointer flex flex-col gap-0.5 ${
                              activeReturnCheckout?.id === c.id 
                                ? "bg-slate-900 border-l-2 border-emerald-500 text-white font-semibold" 
                                : "text-slate-350 hover:bg-slate-900/50 hover:text-white"
                            }`}
                          >
                            <div className="font-semibold truncate flex items-center justify-between">
                              <span>{c.documentName}</span>
                              <span className="text-[9px] px-1 bg-slate-900 text-slate-500 rounded shrink-0 font-normal">
                                {c.employeeId}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-550 flex items-center gap-2 truncate">
                              <span>{c.employeeName}</span>
                              <span>•</span>
                              <span>{c.destination}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-3 text-slate-550 italic text-center">No active checkouts matching filters.</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

                  {activeReturnCheckout && (
                    <div className="mt-2 text-[11px] bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 font-mono text-slate-400">
                      <p className="text-slate-200 font-bold mb-1 uppercase text-xs">Checkout Tracking</p>
                      <p>• Employee: <b className="text-white">{activeReturnCheckout.employeeName} ({activeReturnCheckout.employeeId})</b></p>
                      <p>• Out Since: <span className="text-amber-400">{new Date(activeReturnCheckout.checkoutDate).toLocaleDateString()}</span></p>
                      <p>• Expected Return: {activeReturnCheckout.expectedReturnDate === "Document Travel (Courier)" ? (
                        <span className="text-amber-400 font-bold">Document Travel (Courier)</span>
                      ) : (
                        <span className="text-indigo-400 font-bold">{activeReturnCheckout.expectedReturnDate}</span>
                      )}</p>
                    </div>
                  )}
            </div>

            {/* Returning Employee Static Info Card */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <p className="text-slate-200 font-bold uppercase text-[10px] tracking-widest font-mono">Returning Employee Info</p>
              <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-slate-400">
                <div>
                  <span className="block text-slate-500 uppercase text-[8px] tracking-wider">Employee Name</span>
                  <span className="text-white font-bold">{currentUser.name}</span>
                </div>
                <div>
                  <span className="block text-slate-500 uppercase text-[8px] tracking-wider">Employee ID</span>
                  <span className="text-white font-bold font-mono">{currentUser.id}</span>
                </div>
                <div>
                  <span className="block text-slate-500 uppercase text-[8px] tracking-wider">Designation</span>
                  <span className="text-white font-bold">{currentUser.designation || "Not Assigned"}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">State Condition of Document *</label>
              <select
                value={returnCondition}
                onChange={(e) => setReturnCondition(e.target.value as any)}
                className="w-full px-2.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white"
              >
                <option value="Perfect">Perfect / Pristine state</option>
                <option value="Good">Good / Standard Office Wear</option>
                <option value="Damaged">Damaged / Needs repair (Audit required)</option>
                <option value="Missing Pages">Missing Pages (Security alert!)</option>
                <option value="Digital Copy Only">Returned as Digital Scan Copy</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Verification Notes</label>
              <textarea
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                rows={2}
                placeholder="Notes regarding dual return check..."
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 bg-slate-950/40 border border-slate-800 p-3.5 rounded-xl">
              <input
                id="return-document-travel-checkbox"
                type="checkbox"
                checked={isReturnDocumentTravel}
                onChange={(e) => setIsReturnDocumentTravel(e.target.checked)}
                className="w-4 h-4 text-emerald-500 border-slate-800 rounded focus:ring-emerald-500 bg-slate-900"
              />
              <label htmlFor="return-document-travel-checkbox" className="text-xs font-semibold text-slate-400 cursor-pointer flex items-center gap-1">
                Document Travel (Returned via Courier Service)
              </label>
            </div>

            {/* EMPLOYEE SECURITY SIGNATURE REQUIREMENT */}
            <div className="border-t border-slate-800 pt-3.5 space-y-4">
              <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                <BadgeInfo className="w-4 h-4 text-emerald-500" /> Returning Employee Signature Required
              </h4>

              {/* Returning Employee Signature */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-semibold text-slate-400 uppercase">Employee Sign *</span>
                <SignatureCanvas 
                  onSave={(data, type) => {
                    setReturningEmployeeSig(data);
                  }} 
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={!activeReturnCheckout}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-md"
              >
                Validate Employee Return Check
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
}
