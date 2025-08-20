'use client';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { IssueModal, ActionVariant } from '@/components/ui/IssueModal'; // the component we built
type Variant = 'error' | 'warning' | 'success' | 'info';

// export type ActionVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'link';

export interface ModalAction {
  key?: string;
  label: string;
  onClick?: () => void | Promise<void>;
  closeAfter?: boolean;
  variant?: ActionVariant;
  autoFocus?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

type ModalState = {
  open: boolean;
  variant: Variant;
  title?: ReactNode;
  body?: ReactNode;
  actions?: ModalAction[];
  closeOnBackdrop?: boolean;
  showCloseX?: boolean;
} | null;

type ModalAPI = {
  showModal: (opts: Omit<NonNullable<ModalState>, 'open'>) => void;
  hideModal: (reason?: string) => void;
  alert: (title: ReactNode, body?: ReactNode, variant?: Variant) => Promise<void>;
  confirm: (title: ReactNode, body?: ReactNode, opts?: { okText?: string; cancelText?: string; variant?: Variant }) => Promise<boolean>;
  choices: (title: ReactNode, body: ReactNode, opts: {
    actions: ModalAction[];
    variant?: Variant;
    closeOnBackdrop?: boolean;
  }) => Promise<string | undefined>;
};

const ModalContext = createContext<ModalAPI | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>(null);
  const [resolver, setResolver] = useState<((v: unknown) => void) | null>(null);

  const hideModal = useCallback((reason?: string) => {
    setModal(null);
    if (resolver) { resolver(reason ?? true); setResolver(null); }
  }, [resolver]);

  const showModal: ModalAPI['showModal'] = useCallback((opts) => {
    setModal({ open: true, showCloseX: true, closeOnBackdrop: true, ...opts });
  }, []);

  // Promise-based helpers
  const alert: ModalAPI['alert'] = useCallback((title, body, variant = 'info') => {
    return new Promise<void>((resolve) => {
      setResolver(() => () => resolve());
      showModal({
        variant,
        title,
        body,
        actions: [{ key: 'ok', label: 'OK', variant: 'primary', closeAfter: true }],
      });
    });
  }, [showModal]);

  const confirm: ModalAPI['confirm'] = useCallback((title, body, opts) => {
    const { okText = 'OK', cancelText = 'Cancel', variant = 'info' } = opts || {};
    return new Promise<boolean>((resolve) => {
      setResolver(() => (reason: string) => resolve(reason === 'ok'));
      showModal({
        variant,
        title,
        body,
        closeOnBackdrop: false,
        actions: [
          { key: 'cancel', label: cancelText, variant: 'secondary', closeAfter: true },
          { key: 'ok', label: okText, variant: 'primary', closeAfter: true, autoFocus: true },
        ],
      });
    });
  }, [showModal]);
const choices: ModalAPI['choices'] = useCallback((title, body, opts) => {
    const { actions, variant = 'warning', closeOnBackdrop = false } = opts;
    return new Promise<string | undefined>((resolve) => {
      setResolver(() => (reason: string) => resolve(reason));
      showModal({
        variant,
        title,
        body,
        closeOnBackdrop,
        actions, // keys will be returned via hideModal(key)
      });
    });
  }, [showModal]);
  const value = useMemo<ModalAPI>(() => ({ showModal, hideModal, alert, confirm, choices }), [showModal, hideModal, alert, confirm, choices]);

  return (
    <ModalContext.Provider value={value}>
      {children}
      {/* Render the singleton modal */}
      <IssueModal
        isOpen={!!modal?.open}
        variant={modal?.variant ?? 'info'}
        title={modal?.title}
        body={modal?.body}
        actions={modal?.actions?.map(a => ({
          ...a,
          onClick: async () => {
            // run action
            await a.onClick?.();
            // close if needed
            if (a.closeAfter !== false) hideModal(a.key ?? 'ok');
          },
        })) as ModalAction[]}
        onClose={() => hideModal('dismiss')}
        closeOnBackdrop={modal?.closeOnBackdrop ?? true}
        showCloseX={modal?.showCloseX ?? true}
        // body is scrollable by default in IssueModal
      />
    </ModalContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useDialog must be used within ModalProvider');
  return ctx;
}
