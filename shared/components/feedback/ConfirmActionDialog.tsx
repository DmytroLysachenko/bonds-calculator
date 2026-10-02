'use client';

import { AlertTriangle } from 'lucide-react';
import { Dialog } from 'radix-ui';
import React, { useRef } from 'react';

import { Button } from '@/components/ui/button';

interface ConfirmActionDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmActionDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmActionDialogProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border border-border bg-background p-6 shadow-none"
          onOpenAutoFocus={() => {
            returnFocusRef.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusRef.current?.focus();
          }}
        >
          <div className="flex items-start gap-3">
            <div className="border-l-2 border-warning px-3 py-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <Dialog.Title className="ui-card-title">{title}</Dialog.Title>
              <Dialog.Description className="ui-body text-muted-foreground">
                {description}
              </Dialog.Description>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button variant="outline" className="rounded-md" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              className="rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                void onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
