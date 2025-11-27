"use client";

import React from 'react';
import { ToastComponent, Toast } from './toast';
import { useTheme } from '@/contexts/theme-context';
import { cn } from '@/lib/utils';

interface ToasterProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'bottom-center' | 'bottom-right';
}

export function Toaster({ toasts, onDismiss, position = 'top-right' }: ToasterProps) {
  const { getThemeClasses } = useTheme();
  const theme = getThemeClasses();

  const positionClass =
    position === 'bottom-center'
      ? 'fixed bottom-4 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col space-y-2'
      : position === 'bottom-right'
      ? 'fixed bottom-4 right-4 z-50 flex w-96 max-w-sm flex-col space-y-2'
      : 'fixed top-4 right-4 z-50 flex w-96 max-w-sm flex-col space-y-2';

  return (
    <div className={cn(positionClass)}>
      {toasts.map((toast) => (
        <ToastComponent
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          theme={theme}
        />
      ))}
    </div>
  );
}
