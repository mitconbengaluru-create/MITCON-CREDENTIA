import React, { useState } from "react";
import { Bell, BookmarkCheck, Check, Clock, Radio, X } from "lucide-react";
import { Notification } from "../types";

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onClearAll: () => void;
}

export default function NotificationCenter({ notifications, onMarkRead, onClearAll }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = notifications.filter(n => n.status === "unread").length;

  return (
    <div className="relative font-sans text-xs shrink-0 self-center">
      
      {/* BELL TRIGGER BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-500 hover:text-slate-800 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl transition-all relative shrink-0 cursor-pointer flex items-center justify-center"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded-full text-[9px] min-w-[16px] text-center border-2 border-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* DROPDOWN POPUP */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-30" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2.5 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-scaleIn">
            <div className="bg-slate-900 text-white p-3.5 flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-amber-500 animate-ping" />
              <span className="font-bold text-slate-100 font-display">System Notices Ticker</span>
            </div>
            
            {unreadCount > 0 && (
              <button
                onClick={onClearAll}
                className="text-[10px] font-bold text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {notifications.map((notif) => {
              const timeFormatted = new Date(notif.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
              return (
                <div 
                  key={notif.id} 
                  className={`p-3 text-xs space-y-1 transition-all ${
                    notif.status === "unread" ? "bg-amber-50/40" : ""
                  }`}
                >
                  <div className="flex justify-between items-baseline gap-2">
                    <p className={`font-semibold ${notif.status === "unread" ? "text-slate-950" : "text-slate-700"}`}>
                      {notif.title}
                    </p>
                    <span className="text-[9px] text-slate-400 shrink-0 font-mono flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" /> {timeFormatted}
                    </span>
                  </div>
                  <p className="text-slate-500 leading-normal">{notif.message}</p>
                  
                  {notif.status === "unread" && (
                    <button
                      onClick={() => onMarkRead(notif.id)}
                      className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-0.5 cursor-pointer pt-0.5"
                    >
                      <Check className="w-3 h-3" /> Acknowledge
                    </button>
                  )}
                </div>
              );
            })}

            {notifications.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs">
                <BookmarkCheck className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                No unread compliant alerts in vault.
              </div>
            )}
          </div>

          <div className="bg-slate-50 p-2 border-t border-slate-100 text-center">
            <button
              onClick={() => setIsOpen(false)}
              className="text-[10px] text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
            >
              Close Ticker Panel
            </button>
          </div>
        </div>
      </>
    )}
    </div>
  );
}
