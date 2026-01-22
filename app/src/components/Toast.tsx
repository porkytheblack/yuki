"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";
import { useToastStore, type Toast as ToastType } from "@/store/toastStore";

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors = {
  success: "bg-success/10 border-success text-success",
  error: "bg-error/10 border-error text-error",
  warning: "bg-warning/10 border-warning text-warning",
  info: "bg-primary-500/10 border-primary-500 text-primary-600 dark:text-primary-400",
};

function ToastItem({ toast }: { toast: ToastType }) {
  const [isVisible, setIsVisible] = useState(false);
  const removeToast = useToastStore((state) => state.removeToast);
  const Icon = icons[toast.type];

  useEffect(() => {
    // Trigger enter animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => removeToast(toast.id), 200);
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg
        transition-all duration-200 ease-out
        ${colors[toast.type]}
        ${isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200 flex-1">
        {toast.message}
      </span>
      <button
        onClick={handleClose}
        className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors"
        aria-label="Close notification"
      >
        <X className="w-4 h-4 text-neutral-500" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
