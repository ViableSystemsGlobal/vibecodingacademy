"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { X, Mail, Sparkles } from "lucide-react";
import { useBranding } from "@/contexts/branding-context";
import { cn } from "@/lib/utils";

const STATUS_STORAGE_KEY = "poolshop-newsletter-popup-status";
const SESSION_STORAGE_KEY = "poolshop-newsletter-popup-session";
const DISMISS_COOLDOWN_DAYS = 7;

interface PopupStatus {
  subscribed: boolean;
  dismissedAt?: number | null;
}

function readStatus(): PopupStatus {
  if (typeof window === "undefined") {
    return { subscribed: false };
  }

  try {
    const raw = window.localStorage.getItem(STATUS_STORAGE_KEY);
    if (!raw) {
      return { subscribed: false };
    }
    const parsed = JSON.parse(raw);
    return {
      subscribed: Boolean(parsed?.subscribed),
      dismissedAt: typeof parsed?.dismissedAt === "number" ? parsed.dismissedAt : null,
    };
  } catch (error) {
    console.warn("Failed to parse newsletter popup status:", error);
    return { subscribed: false };
  }
}

function saveStatus(status: PopupStatus) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(status));
  } catch (error) {
    console.warn("Failed to persist newsletter popup status:", error);
  }
}

export function NewsletterPopup() {
  const { branding, getThemeColor } = useBranding();
  const [isVisible, setIsVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const themeColor = getThemeColor();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const status = readStatus();
    if (status.subscribed) {
      return;
    }

    const dismissedRecently =
      typeof status.dismissedAt === "number" &&
      Date.now() - status.dismissedAt < DISMISS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

    if (dismissedRecently) {
      return;
    }

    if (window.sessionStorage.getItem(SESSION_STORAGE_KEY) === "true") {
      return;
    }

    const delay = 6000 + Math.random() * 8000; // 6-14 seconds
    const timer = window.setTimeout(() => {
      setIsVisible(true);
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, "true");
    }, delay);

    return () => window.clearTimeout(timer);
  }, []);

  const handleClose = (persistDismiss = true) => {
    setIsVisible(false);
    if (persistDismiss) {
      saveStatus({ subscribed: false, dismissedAt: Date.now() });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/public/newsletter-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          source: "Newsletter Popup",
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "We couldn't save your email just yet.");
      }

      setIsSuccess(true);
      saveStatus({ subscribed: true, dismissedAt: Date.now() });
      setErrorMessage(null);
    } catch (error) {
      console.error("Newsletter subscription failed:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please check your connection and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayImage = useMemo(() => branding.newsletterPopupImage?.trim(), [branding.newsletterPopupImage]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 sm:px-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => handleClose(false)} />
      <div className="relative z-50 w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          onClick={() => handleClose()}
          className="absolute right-4 top-4 rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close newsletter popup"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex flex-col sm:flex-row">
          {displayImage ? (
            <div className="relative hidden w-full overflow-hidden bg-slate-100 sm:block sm:w-1/2">
              <Image
                src={displayImage}
                alt="Newsletter welcome"
                fill
                priority
                className="object-cover"
              />
            </div>
          ) : (
            <div
              className="hidden w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 sm:flex sm:w-1/2"
              style={{ color: themeColor }}
            >
              <Sparkles className="h-20 w-20 opacity-60" />
            </div>
          )}

          <div className="flex w-full flex-col gap-6 p-6 sm:w-1/2 sm:p-10">
            {isSuccess ? (
              <div className="space-y-4 text-center sm:text-left">
                <div
                  className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white"
                  style={{ backgroundColor: themeColor }}
                >
                  Welcome aboard
                </div>
                <h3 className="text-2xl font-bold text-gray-900">
                  Thank you!
                </h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {branding.newsletterPopupSuccessMessage ||
                    "You're on the list! Check your inbox for poolside inspiration soon."}
                </p>
                <button
                  onClick={() => setIsVisible(false)}
                  className="inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition sm:w-auto"
                  style={{ backgroundColor: themeColor }}
                >
                  Continue browsing
                </button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white"
                    style={{ backgroundColor: themeColor }}
                  >
                    Just for first-time visitors
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                    {branding.newsletterPopupHeadline || "Get 5% off your first order"}
                  </h3>
                  <p className="text-sm text-gray-600 sm:text-base">
                    {branding.newsletterPopupDescription ||
                      "Join our newsletter for pool care tips, new arrivals, and exclusive deals."}
                  </p>
                </div>

                <form id="newsletter-popup-form" className="space-y-4" onSubmit={handleSubmit}>
                  {errorMessage ? (
                    <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
                      {errorMessage}
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="col-span-1">
                      <label className="text-xs font-semibold text-gray-600">Name (optional)</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Your name"
                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2"
                        style={{ ["--tw-ring-color" as string]: themeColor }}
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs font-semibold text-gray-600">Email address</label>
                      <div className="relative mt-1">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@example.com"
                          className="w-full rounded-xl border border-gray-200 py-2 pl-10 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2"
                          style={{ ["--tw-ring-color" as string]: themeColor }}
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || !email.trim()}
                    className={cn(
                      "flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition",
                      isSubmitting ? "opacity-80" : "hover:opacity-90"
                    )}
                    style={{ backgroundColor: themeColor }}
                  >
                    {isSubmitting ? "Joining..." : "Join the newsletter"}
                  </button>
                  <p className="text-xs text-gray-500">
                    We respect your inbox. Unsubscribe anytime.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


