import React, { useState } from "react";
import { 
  FolderPlus, Plus, Search, FileText, CheckCircle2, 
  Trash2, Eye, ShieldAlert, BadgeInfo, QrCode, ClipboardList, Layers
} from "lucide-react";
import { Document, User } from "../types";

interface RepoManagerProps {
  documents: Document[];
  currentUser: User;
  onRefresh: () => void;
  onSelectForCheckout: (doc: Document) => void;
}

export default function RepoManager({ documents, currentUser, onRefresh, onSelectForCheckout }: RepoManagerProps) {
  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [sortBy, setSortBy] = useState("dateUploadedDesc");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const getSuggestions = () => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase();
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
      if (d.uploadedBy && d.uploadedBy.toLowerCase().includes(term)) {
        const item = { key: "By", value: d.uploadedBy };
        const serialized = `${item.key}:${item.value}`;
        if (!seen.has(serialized)) {
          seen.add(serialized);
          list.push(item);
        }
      }
    }
    return list.slice(0, 8);
  };

  // Selection folder view
  const [folderView, setFolderView] = useState<'all' | 'client'>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Upload document modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [upName, setUpName] = useState("");
  const [upClient, setUpClient] = useState("");
  const [upDateOfRegistration, setUpDateOfRegistration] = useState(new Date().toISOString().split('T')[0]);
  const [upPlaceOfHolding, setUpPlaceOfHolding] = useState("");
  const [errorUpload, setErrorUpload] = useState("");
  
  const closeUploadModal = () => {
    setShowUploadModal(false);
    setUpName("");
    setUpClient("");
    setUpDateOfRegistration(new Date().toISOString().split('T')[0]);
    setUpPlaceOfHolding("");
    setErrorUpload("");
  };

  // QR Code generator state
  const [showQrModal, setShowQrModal] = useState<{ id: string, docId: string, name: string } | null>(null);

  // Filter lists options
  const statuses = ["All", "Available", "Checked Out", "Returned"];

  // Handle uploading doc
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upName || !upClient || !upDateOfRegistration || !upPlaceOfHolding) {
      setErrorUpload("Please fill in Client Name, Document Name, Date of Registration, and Place of Document Holding.");
      return;
    }
    setErrorUpload("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Operator-Name": currentUser.name,
          "X-Operator-Role": currentUser.role
        },
        body: JSON.stringify({
          documentName: upName,
          client: upClient,
          dateOfRegistration: upDateOfRegistration,
          placeOfHolding: upPlaceOfHolding,
          uploadedBy: currentUser.name
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to commit document to index.");

      // Success
      closeUploadModal();
      onRefresh();
    } catch (err: any) {
      setErrorUpload(err.message || "Network Upload Interrupted.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle document deletion (Super Admin access required)
  const handleDeleteDoc = async (id: string, trackingId: string) => {
    if (!window.confirm(`SECURITY ALERT: Are you sure you want to permanently delete document ${trackingId}? This wipes all metadata records and audits reference targets.`)) return;

    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
        headers: {
          "X-Operator-Name": currentUser.name,
          "X-Operator-Role": currentUser.role
        }
      });
      if (res.ok) {
        onRefresh();
      } else {
        const errorData = await res.json();
        alert(errorData.message || "Deletion refused by security policies.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Seed restoration tool
  const handleRestoreDocs = async () => {
    if (!window.confirm("Verify: Restore all initial high-security demo files?")) return;
    try {
      const res = await fetch("/api/documents/restore-seed", {
        method: "POST",
        headers: {
          "X-Operator-Name": currentUser.name,
          "X-Operator-Role": currentUser.role
        }
      });
      if (res.ok) {
        onRefresh();
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Extract client names dynamically
  const getClientsWithFiles = () => Array.from(new Set(documents.map(d => d.client || "Institutional Base")));

  // Apply search/filtering logic
  const filteredDocs = documents.filter(doc => {
    const matchesSearch = 
      doc.documentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.placeOfHolding.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.uploadedBy.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = selectedStatus === "All" || doc.status === selectedStatus;
    
    // Folder specific filter
    let matchesFolder = true;
    if (selectedFolder) {
      if (folderView === 'client') matchesFolder = doc.client === selectedFolder;
    }

    return matchesSearch && matchesStatus && matchesFolder;
  });

  // Sort files logic
  const sortedDocs = [...filteredDocs].sort((a, b) => {
    if (sortBy === "dateUploadedDesc") return new Date(b.dateUploaded).getTime() - new Date(a.dateUploaded).getTime();
    if (sortBy === "dateUploadedAsc") return new Date(a.dateUploaded).getTime() - new Date(b.dateUploaded).getTime();
    if (sortBy === "nameAsc") return a.documentName.localeCompare(b.documentName);
    if (sortBy === "nameDesc") return b.documentName.localeCompare(a.documentName);
    if (sortBy === "dateRegDesc") return new Date(b.dateOfRegistration).getTime() - new Date(a.dateOfRegistration).getTime();
    if (sortBy === "dateRegAsc") return new Date(a.dateOfRegistration).getTime() - new Date(b.dateOfRegistration).getTime();
    return 0;
  });

  return (
    <div id="repo-panel" className="space-y-6">
      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900">Document Repository Vault</h1>
          <p className="text-xs text-slate-500">Secure storage containing sensitive office assets</p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          {(currentUser.role === "super-admin" || currentUser.role === "admin" || currentUser.role === "developer") && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold font-display flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Registrar New Document
            </button>
          )}
          {currentUser.role === "super-admin" && (
            <button
              onClick={handleRestoreDocs}
              className="px-3 py-2 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              title="Super Admin override: restore initial demo document pool"
            >
              Restore Original Seed Files
            </button>
          )}
        </div>
      </div>

      {/* REPOSITORY LAYOUT: SIDEBAR FOLDERS + DOCUMENTS MAIN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: MULTIPLE STRUCTURES FOLDERS TRACKER */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-semibold text-slate-800 font-display flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-slate-500" /> Folder Indexes
              </h3>
              <p className="text-[11px] text-slate-400">Classify files by client portfolios</p>
            </div>

            {/* FOLDER METHOD TRIGGER TABS */}
            <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-lg text-center text-[10px]">
              <button
                type="button"
                onClick={() => { setFolderView('all'); setSelectedFolder(null); }}
                className={`py-1 rounded font-medium transition-all cursor-pointer ${folderView === 'all' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"}`}
              >
                All Files
              </button>
              <button
                type="button"
                onClick={() => { setFolderView('client'); setSelectedFolder(getClientsWithFiles()[0] || null); }}
                className={`py-1 rounded font-medium transition-all cursor-pointer ${folderView === 'client' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"}`}
              >
                Clients
              </button>
            </div>

            {/* COLLIGATED ACTION LIST */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 pt-1">
              {folderView === 'all' && (
                <button
                  onClick={() => setSelectedFolder(null)}
                  className="w-full text-left px-3 py-2 bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-2"
                >
                  <FolderPlus className="w-4 h-4 text-slate-500" />
                  <span>Main Repository (All Files)</span>
                </button>
              )}

              {folderView === 'client' && getClientsWithFiles().map(client => (
                <button
                  key={client}
                  onClick={() => setSelectedFolder(client)}
                  className={`w-full text-left px-3 py-2 text-xs font-medium rounded-lg flex items-center justify-between transition-all ${
                    selectedFolder === client ? "bg-slate-900 text-white font-semibold" : "hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <span className="flex items-center gap-2">🏢 Client: {client}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 font-bold">
                    {documents.filter(d => d.client === client).length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: SEARCH + MAIN FILES EXPLORER */}
        <div className="lg:col-span-9 space-y-4">
          <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-sm space-y-4">
            
            {/* SEARCH AND FILTERS */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* SearchBar */}
              <div className="md:col-span-6 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="repo-search-input"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Doc Name, ID, uploader..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                />

                {showSuggestions && searchTerm.trim() && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto divide-y divide-slate-100 py-1">
                    {getSuggestions().length > 0 ? (
                      getSuggestions().map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onMouseDown={() => {
                            setSearchTerm(item.value);
                            setShowSuggestions(false);
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
                      <div className="px-4 py-3 text-left text-xs text-slate-400 italic">
                        No matches found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Status dropdown */}
              <div className="md:col-span-3">
                <select
                  id="status-select"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all"
                >
                  <option value="All">All Statuses</option>
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Sort selector */}
              <div className="md:col-span-3">
                <select
                  id="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-2 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                >
                  <option value="dateUploadedDesc">Newest Uploaded</option>
                  <option value="dateUploadedAsc">Oldest Uploaded</option>
                  <option value="nameAsc">Alphabetical A-Z</option>
                  <option value="nameDesc">Alphabetical Z-A</option>
                  <option value="dateRegDesc">Newest Registered</option>
                  <option value="dateRegAsc">Oldest Registered</option>
                </select>
              </div>
            </div>

            {/* ACTIVE FILTERS CHIPS */}
            {selectedFolder && (
              <div className="flex items-center gap-1.5 bg-slate-100 p-2 rounded-xl text-xs text-slate-700 animate-fadeIn">
                <span>Active Scope Index:</span>
                <span className="bg-slate-900 text-white font-bold px-2 py-0.5 rounded uppercase text-[10px]">
                  {selectedFolder}
                </span>
                <button
                  onClick={() => setSelectedFolder(null)}
                  className="text-xs text-slate-400 hover:text-slate-800 leading-none pl-1 cursor-pointer font-bold"
                >
                  &times; Clear
                </button>
              </div>
            )}
          </div>

          {/* DOCUMENTS LIST GRID */}
          <div className="space-y-3">
            {sortedDocs.map((doc) => {
              // Status badge colors
              const getStatusStyle = (st: Document['status']) => {
                switch (st) {
                  case "Checked Out":
                    return "bg-amber-500/10 text-amber-600 border-amber-500/20";
                  default:
                    return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
                }
              };

              return (
                <div 
                  key={doc.id} 
                  id={`doc-card-${doc.id}`}
                  className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm hover:ring-1 hover:ring-slate-300 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-xs"
                >
                  {/* Left Column: Icon and Info */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="bg-slate-100 p-3 rounded-2xl shrink-0 text-slate-700">
                      <FileText className="w-6 h-6 stroke-[1.5]" />
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                          {doc.placeOfHolding}
                        </span>

                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getStatusStyle(doc.status)}`}>
                          {doc.status}
                        </span>
                      </div>
                      
                      <h3 className="text-sm font-semibold text-slate-900 font-display truncate" title={doc.documentName}>
                        {doc.documentName}
                      </h3>

                      <div className="flex flex-wrap text-[11px] text-slate-500 gap-x-3 gap-y-1 font-mono items-center">
                        <span>Client: <b className="text-slate-800">{doc.client}</b></span>
                        <span className="text-slate-300">|</span>
                        <span>Registered: <b className="text-slate-800">{doc.dateOfRegistration}</b></span>
                        <span className="text-slate-300">|</span>
                        <span>Uploaded By: <b className="text-slate-800">{doc.uploadedBy}</b></span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Interaction Controls */}
                  <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 pt-3 md:pt-0">
                    
                    {/* QR Code tracking badge */}
                    <button
                      onClick={() => setShowQrModal({ id: doc.id, docId: doc.documentId, name: doc.documentName })}
                      title="QR Registry Badge"
                      className="p-2 hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl transition-all cursor-pointer bg-white"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>

                    {/* Direct checkout workflow button */}
                    <button
                      disabled={doc.status === "Checked Out"}
                      onClick={() => onSelectForCheckout(doc)}
                      className="px-3.5 py-1.5 bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 rounded-xl text-xs font-semibold font-display transition-all cursor-pointer flex items-center gap-1"
                    >
                      Ref out log
                    </button>

                    {/* Super Admin Deletion button */}
                    {currentUser.role === "super-admin" && (
                      <button
                        onClick={() => handleDeleteDoc(doc.id, doc.documentId)}
                        title="Delete Document"
                        className="p-2 hover:bg-rose-50 text-rose-500 hover:text-rose-700 border border-rose-200 hover:border-rose-300 rounded-xl transition-all cursor-pointer bg-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {sortedDocs.length === 0 && (
              <div className="bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-12 text-center">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-500">No documents found matching database metrics.</p>
                <p className="text-xs text-slate-400 mt-1">Try resetting search filters or upload a document index.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: NEW DOCUMENT METADATA UPLOAD */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 animate-scaleIn">
            <div className="flex justify-between items-start border-b border-slate-100 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                  <Plus className="text-slate-500" /> BCD Document Registry Upload
                </h3>
                <p className="text-xs text-slate-500">File metadata registers to audit tables automatically</p>
              </div>
              <button
                onClick={closeUploadModal}
                className="text-xl font-bold hover:text-slate-500 text-slate-400 cursor-pointer"
              >
                &times;
              </button>
            </div>

            {errorUpload && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl mb-4">
                {errorUpload}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Client Name *</label>
                  <input
                    type="text"
                    value={upClient}
                    onChange={(e) => setUpClient(e.target.value)}
                    required
                    maxLength={100}
                    placeholder="e.g., Invesco Guard Ltd"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Document Name *</label>
                  <input
                    type="text"
                    value={upName}
                    onChange={(e) => setUpName(e.target.value)}
                    required
                    maxLength={100}
                    placeholder="e.g., Q1 Bitcoin Audit Balance Ledger"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Date of Registration *</label>
                  <input
                    type="date"
                    value={upDateOfRegistration}
                    onChange={(e) => setUpDateOfRegistration(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Place of Document Holding *</label>
                  <input
                    type="text"
                    value={upPlaceOfHolding}
                    onChange={(e) => setUpPlaceOfHolding(e.target.value)}
                    required
                    maxLength={100}
                    placeholder="e.g., Main Vault Room 3"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-950"
                  />
                </div>

              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeUploadModal}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-xl text-xs font-semibold font-display transition-all cursor-pointer shadow-sm"
                >
                  {isSubmitting ? "Committing..." : "Commit Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: QR REGISTRY BADGE DISPLAY */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center animate-scaleIn">
            <h3 className="text-base font-bold text-slate-900 font-display mb-1">Document Tracking QR Code</h3>
            <p className="text-xs text-slate-500 mb-4 font-display font-semibold text-slate-800">{showQrModal.name}</p>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 inline-block shadow-inner mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 29 29" className="shape-rendering-crispEdges">
                <path fill="#0f172a" d="M0 0h7v7H0zM22 0h7v7h-7zM0 22h7v7H0zM9 0h2v2H9zM15 0h2v4h-2zM12 3h1v1h-1zM2 2h3v3H2zM24 2h3v3h-3zM2 24h3v3H2zM9 9h3v1H9zM16 10h4v1h-4zM10 14h2v2h-2zM22 17h4v2h-4zM18 20h3v4h-3zM26 22h3v3h-3z" />
                <path fill="#f59e0b" d="M11 11h2v2h-2zM19 14h2v2h-2zM14 17h1v1h-1z" />
                <text x="11.5" y="16.5" fill="#0f172a" style={{fontFamily: 'serif', fontWeight: 'bold', fontSize: '8px'}}>M</text>
              </svg>
            </div>

            <div className="bg-slate-100 p-2.5 rounded-xl text-[10px] text-slate-600 font-mono select-all text-center leading-relaxed">
              <p className="text-slate-500 font-semibold">QR Code contains a secure database key reference</p>
              <p className="mt-1 text-slate-400">Scanned at checkpoint terminals to verify offsite logs</p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  alert("Credential Token QR copied to clipboard!");
                  navigator.clipboard.writeText(`MITCON Credentia VERIFIED PATH: ${window.location.origin}/doc/${showQrModal.docId}`);
                }}
                className="flex-1 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-all cursor-pointer"
              >
                Copy Link Badge
              </button>
              <button
                onClick={() => setShowQrModal(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
