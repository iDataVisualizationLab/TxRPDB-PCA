'use client';

import { ReactNode, useEffect } from 'react';
import {
  AlertTriangle, XCircle, CheckCircle2, Info,
  X as CloseIcon,
} from 'lucide-react';
import clsx from 'clsx';

type Variant = 'error' | 'warning' | 'success' | 'info' | 'neutral';

export type ActionVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'ghost'
  | 'outline'
  | 'link';

export interface ModalAction {
  /** semantic key so we know which button was pressed: 'ok' | 'cancel' | 'delete' | ... */
  key?: string;
  /** button text */
  label: string;
  /** handler (can be async) */
  onClick?: () => void | Promise<void>;
  /** after handler, close the modal? default: true */
  closeAfter?: boolean;
  /** visual style */
  variant?: ActionVariant;
  autoFocus?: boolean;
  disabled?: boolean;
  /** show spinner & disable button during async */
  loading?: boolean;
}

interface IssueModalProps {
  isOpen: boolean;
  variant?: Variant;
  title?: ReactNode;
  body?: ReactNode;

  /** Make body scrollable; default true */
  scrollBody?: boolean;
  /** Tailwind height class for body when scrollBody=true; default 'max-h-80' */
  bodyMaxHeightClass?: string;

  actions?: ModalAction[];

  /** Close callback, receives reason e.g. 'ok' | 'cancel' | 'dismiss' | 'delete' */
  onClose: (reason?: string) => void;

  /** default true: clicking backdrop closes */
  closeOnBackdrop?: boolean;
  /** default true: show top-right X */
  showCloseX?: boolean;
  /** reason to pass when user closes via backdrop; default 'dismiss' */
  onBackdropCloseReason?: string;
}

const VARIANT_STYLES: Record<Variant, { text: string; border: string; icon?: JSX.Element }> = {
  error:   { text: 'text-red-600',    border: 'border-red-400',    icon: <XCircle className="size-6" /> },
  warning: { text: 'text-yellow-600', border: 'border-yellow-400', icon: <AlertTriangle className="size-6" /> },
  success: { text: 'text-green-600',  border: 'border-green-400',  icon: <CheckCircle2 className="size-6" /> },
  info:    { text: 'text-blue-600',   border: 'border-blue-400',   icon: <Info className="size-6" /> },
  neutral: { text: 'text-gray-700',   border: 'border-gray-300' },
};

const ACTION_STYLES: Record<ActionVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-400',
  secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-400',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-300',
  outline: 'border border-gray-300 text-gray-900 hover:bg-gray-50 focus:ring-gray-300',
  link: 'bg-transparent text-blue-700 underline-offset-2 hover:underline focus:ring-blue-300',
  success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-400', // new
};
export function IssueModal({
  isOpen,
  variant = 'info',
  title,
  body,
  scrollBody = true,
  bodyMaxHeightClass = 'max-h-80',
  actions = [],
  onClose,
  closeOnBackdrop = true,
  showCloseX = true,
  onBackdropCloseReason = 'dismiss',
}: IssueModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) onClose('dismiss');
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const v = VARIANT_STYLES[variant];

  const defaultActions: ModalAction[] = actions.length
    ? actions
    : [{ key: 'ok', label: 'OK', variant: 'primary', closeAfter: true }];

  const safeHandle = async (a: ModalAction) => {
    if (a.onClick) await a.onClick();
    if (a.closeAfter !== false) onClose(a.key ?? 'ok');
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => closeOnBackdrop && onClose(onBackdropCloseReason)}
      />

      {/* Panel */}
      <div className="relative bg-white w-[min(92vw,640px)] rounded-xl shadow-2xl p-6 z-[10001]">
        {/* Close X */}
        {showCloseX && (
          <button
            onClick={() => onClose('dismiss')}
            className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Close modal"
          >
            <CloseIcon className="size-5 text-gray-600" />
          </button>
        )}

        {/* Header */}
        <div className={clsx('flex items-center gap-3 mb-4', v.text)}>
          {v.icon}
          <h2 className="text-lg font-bold">
            {title ?? ({
              error: 'Error',
              warning: 'Warning',
              success: 'Success',
              info: 'Information',
              neutral: 'Notice',
            }[variant])}
          </h2>
        </div>

        {/* Body */}
        <div className={clsx('text-gray-800', scrollBody && `${bodyMaxHeightClass} overflow-y-auto`)}>
          {body ?? null}
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-wrap gap-2 justify-end">
          {defaultActions.map((a, idx) => (
            <button
              key={a.key ?? `${idx}-${a.label}`}
              onClick={() => safeHandle(a)}
              autoFocus={a.autoFocus}
              disabled={a.disabled || a.loading}
              className={clsx(
                'px-4 py-2 rounded-md focus:outline-none focus:ring-2 inline-flex items-center justify-center gap-2',
                ACTION_STYLES[a.variant ?? 'secondary'],
                (a.disabled || a.loading) && 'opacity-60 cursor-not-allowed'
              )}
            >
              {a.loading && (
                <svg className="animate-spin size-4" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                </svg>
              )}
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
