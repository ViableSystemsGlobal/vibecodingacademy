"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";

declare global {
  interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  if (!visible || !deferredPrompt) {
    return null;
  }

  const handleInstall = async () => {
    try {
      setVisible(false);
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome !== "accepted") {
        setDeferredPrompt(null);
      }
    } catch (error) {
      console.error("[PWA] Install prompt failed", error);
    }
  };

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 max-w-sm rounded-2xl border border-blue-100 bg-white p-4 shadow-xl shadow-blue-500/20 sm:inset-x-auto sm:right-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">Install The POOLSHOP</h3>
          <p className="mt-1 text-xs text-gray-600">Add the app to your home screen for faster access.</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleInstall}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-700"
            >
              Install App
            </button>
            <button
              onClick={() => {
                setVisible(false);
                setDeferredPrompt(null);
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

