import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X, AlertCircle, Trash2 } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ConfirmOptions {
  title?: string;
  variant?: 'danger' | 'warning' | 'default';
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
  message: string;
  resolve: ((val: boolean) => void) | null;
}

interface UIContextValue {
  /** Show a toast notification. Defaults to 'info' type. */
  toast: (message: string, type?: ToastType) => void;
  /** Show a custom confirm dialog. Returns Promise<boolean>. */
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const UIContext = createContext<UIContextValue>({
  toast: () => {},
  confirm: async () => false,
});

export const useUI = () => useContext(UIContext);

// ─── Toast Icons ─────────────────────────────────────────────────────────────

const TOAST_CONFIG: Record<ToastType, { icon: React.ElementType; bg: string; border: string; iconColor: string; titleColor: string }> = {
  success: {
    icon: CheckCircle,
    bg: 'bg-white',
    border: 'border-l-4 border-l-emerald-500',
    iconColor: 'text-emerald-500',
    titleColor: 'text-emerald-700',
  },
  error: {
    icon: XCircle,
    bg: 'bg-white',
    border: 'border-l-4 border-l-red-500',
    iconColor: 'text-red-500',
    titleColor: 'text-red-700',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-white',
    border: 'border-l-4 border-l-amber-400',
    iconColor: 'text-amber-500',
    titleColor: 'text-amber-700',
  },
  info: {
    icon: Info,
    bg: 'bg-white',
    border: 'border-l-4 border-l-blue-500',
    iconColor: 'text-blue-500',
    titleColor: 'text-blue-700',
  },
};

// ─── Single Toast Item ────────────────────────────────────────────────────────

const ToastItemComponent: React.FC<{ item: ToastItem; onRemove: (id: string) => void }> = ({ item, onRemove }) => {
  const [visible, setVisible] = useState(false);
  const cfg = TOAST_CONFIG[item.type];
  const Icon = cfg.icon;

  useEffect(() => {
    // Mount animation
    requestAnimationFrame(() => setVisible(true));

    // Auto-dismiss after 4s
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(item.id), 300);
    }, 4000);

    return () => clearTimeout(timer);
  }, [item.id, onRemove]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onRemove(item.id), 300);
  };

  return (
    <div
      className={`
        flex items-start gap-3 min-w-[320px] max-w-sm w-full rounded-xl shadow-lg
        ${cfg.bg} ${cfg.border} border border-gray-100 px-4 py-3
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
      `}
    >
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${cfg.iconColor}`} />
      <p className="flex-1 text-sm text-gray-700 leading-snug">{item.message}</p>
      <button
        onClick={handleClose}
        className="ml-1 shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// ─── Toast Container ──────────────────────────────────────────────────────────

const ToastContainer: React.FC<{ toasts: ToastItem[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItemComponent item={t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
};

// ─── Confirm Dialog ──────────────────────────────────────────────────────────

const CONFIRM_CONFIG = {
  danger: {
    icon: Trash2,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    btnClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    btnClass: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  default: {
    icon: AlertCircle,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    btnClass: 'bg-primary-600 hover:bg-primary-700 text-white',
  },
};

const ConfirmDialog: React.FC<{ state: ConfirmState; onClose: (val: boolean) => void }> = ({ state, onClose }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (state.open) requestAnimationFrame(() => setMounted(true));
    else setMounted(false);
  }, [state.open]);

  if (!state.open) return null;

  const variant = state.variant ?? 'default';
  const cfg = CONFIRM_CONFIG[variant];
  const Icon = cfg.icon;
  const title = state.title ?? 'Konfirmasi';
  const confirmLabel = state.confirmLabel ?? 'Ya, Lanjutkan';
  const cancelLabel = state.cancelLabel ?? 'Batal';

  return (
    <div
      className={`
        fixed inset-0 z-[9998] flex items-center justify-center p-4
        transition-all duration-200
        ${mounted ? 'opacity-100' : 'opacity-0'}
      `}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onClose(false)}
      />

      {/* Dialog */}
      <div
        className={`
          relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6
          transition-all duration-200
          ${mounted ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}
        `}
      >
        {/* Icon */}
        <div className={`w-12 h-12 rounded-full ${cfg.iconBg} flex items-center justify-center mb-4`}>
          <Icon className={`w-6 h-6 ${cfg.iconColor}`} />
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>

        {/* Message */}
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap mb-6">{state.message}</p>

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => onClose(false)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onClose(true)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${cfg.btnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Provider ────────────────────────────────────────────────────────────────

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    message: '',
    resolve: null,
  });

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const confirm = useCallback((message: string, options?: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      setConfirmState({
        open: true,
        message,
        resolve,
        title: options?.title,
        variant: options?.variant,
        confirmLabel: options?.confirmLabel,
        cancelLabel: options?.cancelLabel,
      });
    });
  }, []);

  const handleConfirmClose = (val: boolean) => {
    if (confirmState.resolve) confirmState.resolve(val);
    setConfirmState(prev => ({ ...prev, open: false, resolve: null }));
  };

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <ConfirmDialog state={confirmState} onClose={handleConfirmClose} />
    </UIContext.Provider>
  );
};
