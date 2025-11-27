"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { useBranding } from "@/contexts/branding-context";
import { useToast } from "@/contexts/toast-context";
import { usePathname } from "next/navigation";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface StoredLead {
  leadId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

const LEAD_STORAGE_KEY = "kwame-customer-lead";
const DEFAULT_WELCOME_MESSAGE =
  "👋 Hi {firstName}! I'm Kwame, your pool care assistant. I can help you find products, explain features, or check on existing orders. What would you like to know?";
const PREVIEW_DISMISSED_AT_KEY = "kwame-ecommerce-preview-dismissed-at";
const PREVIEW_COOLDOWN_MS = 20 * 60 * 1000; // 20 minutes

function formatWelcomeMessage(template: string | undefined, firstName: string, companyName: string) {
  const messageTemplate = template?.trim() || DEFAULT_WELCOME_MESSAGE;
  const safeName = firstName.trim() || "there";
  const safeCompany = companyName.trim() || "The PoolShop";

  return messageTemplate
    .replace(/\{firstName\}/gi, safeName)
    .replace(/\{companyName\}/gi, safeCompany);
}

export function EcommerceKwameChat() {
  const { branding, getThemeColor } = useBranding();
  const { success: showSuccess, error: showError } = useToast();
  const themeColor = getThemeColor();
  const buttonBackground = branding.chatButtonImage || undefined;
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadInfo, setLeadInfo] = useState<StoredLead | null>(null);
  const [leadForm, setLeadForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [welcomeSent, setWelcomeSent] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const previewTimerRef = useRef<number | null>(null);
  const isOpenRef = useRef(isOpen);
  const pathnameRef = useRef(pathname);
  const previewInitRef = useRef(false);

  const schedulePreview = useCallback((delayMs: number) => {
    if (typeof window === "undefined") {
      return;
    }
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
    }
    previewTimerRef.current = window.setTimeout(() => {
      if (!isOpenRef.current && pathnameRef.current === "/") {
        setShowPreview(true);
      }
    }, Math.max(delayMs, 0));
  }, []);

  const updatePreviewDismissal = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    localStorage.setItem(PREVIEW_DISMISSED_AT_KEY, Date.now().toString());
    schedulePreview(PREVIEW_COOLDOWN_MS);
  }, [schedulePreview]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Hydrate lead info from localStorage on mount
  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem(LEAD_STORAGE_KEY) : null;
      if (stored) {
        const parsed = JSON.parse(stored) as StoredLead;
        if (parsed?.firstName && parsed?.lastName) {
          setLeadCaptured(true);
          setLeadInfo(parsed);
          setLeadForm({
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            email: parsed.email ?? "",
            phone: parsed.phone ?? "",
          });
        }
      }
    } catch (error) {
      console.warn("Failed to load stored lead info:", error);
    }
  }, []);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  // Inject welcome message once lead is captured
  useEffect(() => {
    if (leadCaptured && isOpen && !welcomeSent) {
      const firstName = leadInfo?.firstName ?? "there";
      const welcomeMessage: ChatMessage = {
        role: "assistant",
        content: formatWelcomeMessage(branding.chatPopupMessage, firstName, branding.companyName || "The PoolShop"),
      };
      setChatHistory([welcomeMessage]);
      setWelcomeSent(true);
    }
  }, [branding.chatPopupMessage, branding.companyName, isOpen, leadCaptured, leadInfo, welcomeSent]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (pathname !== "/") {
      setShowPreview(false);
      if (previewTimerRef.current) {
        window.clearTimeout(previewTimerRef.current);
      }
      return;
    }

    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
    }

    const dismissedAtRaw = localStorage.getItem(PREVIEW_DISMISSED_AT_KEY);
    const dismissedAt = dismissedAtRaw ? parseInt(dismissedAtRaw, 10) : 0;
    const now = Date.now();
    const elapsed = dismissedAt ? now - dismissedAt : PREVIEW_COOLDOWN_MS + 1;
    const delay =
      elapsed >= PREVIEW_COOLDOWN_MS ? 0 : PREVIEW_COOLDOWN_MS - elapsed;

    schedulePreview(delay);

    return () => {
      if (previewTimerRef.current) {
        window.clearTimeout(previewTimerRef.current);
      }
    };
  }, [pathname, schedulePreview]);

  useEffect(() => {
    if (!previewInitRef.current) {
      previewInitRef.current = true;
      return;
    }

    if (isOpen) {
      setShowPreview(false);
      if (previewTimerRef.current) {
        window.clearTimeout(previewTimerRef.current);
      }
      return;
    }

    if (pathnameRef.current === "/") {
      updatePreviewDismissal();
    }
  }, [isOpen, updatePreviewDismissal]);

  const handleOpenChat = () => {
    setIsOpen((prev) => !prev);
    setShowPreview(false);
  };

  const handleDismissPreview = () => {
    setShowPreview(false);
    updatePreviewDismissal();
  };

  const saveLeadLocally = (lead: StoredLead) => {
    try {
      localStorage.setItem(LEAD_STORAGE_KEY, JSON.stringify(lead));
    } catch (error) {
      console.warn("Failed to persist lead info:", error);
    }
  };

  const handleLeadSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (leadSubmitting) return;

    if (!leadForm.firstName || !leadForm.lastName) {
      showError("Please add your name", "We use it to greet you and follow up.");
      return;
    }

    if (!leadForm.email && !leadForm.phone) {
      showError("Add a contact", "We need at least an email or phone number.");
      return;
    }

    setLeadSubmitting(true);
    try {
      const response = await fetch("/api/public/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: leadForm.firstName.trim(),
          lastName: leadForm.lastName.trim(),
          email: leadForm.email.trim() || undefined,
          phone: leadForm.phone.trim() || undefined,
          source: "Ecommerce Chat",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "We couldn't save your details");
      }

      const storedLead: StoredLead = {
        leadId: data.lead?.id,
        firstName: data.lead?.firstName ?? leadForm.firstName.trim(),
        lastName: data.lead?.lastName ?? leadForm.lastName.trim(),
        email: data.lead?.email ?? leadForm.email.trim() || undefined,
        phone: data.lead?.phone ?? leadForm.phone.trim() || undefined,
      };

      setLeadInfo(storedLead);
      setLeadCaptured(true);
      saveLeadLocally(storedLead);
      showSuccess("Thanks! You're all set.", "Kwame is ready to assist you.");
    } catch (error) {
      console.error("Failed to capture lead:", error);
      showError("Unable to start chat", error instanceof Error ? error.message : "Please try again in a moment.");
    } finally {
      setLeadSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!leadCaptured || !message.trim() || isSending) {
      return;
    }

    const trimmedMessage = message.trim();
    const userMessage: ChatMessage = { role: "user", content: trimmedMessage };
    const nextHistory = [...chatHistory, userMessage];

    setChatHistory(nextHistory);
    setMessage("");
    setIsSending(true);

    try {
      const sanitizedHistory = nextHistory.slice(-12).map((entry) => ({
        role: entry.role,
        content: entry.content,
      }));

      const response = await fetch("/api/public/ai/kwame", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedMessage,
          conversationHistory: sanitizedHistory,
          lead: leadInfo,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Kwame couldn't respond right now");
      }

      const aiMessage: ChatMessage = {
        role: "assistant",
        content: data.response?.text || "Sorry, I didn't catch that. Could you try again?",
      };

      setChatHistory((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Kwame chat error:", error);
      const fallback: ChatMessage = {
        role: "assistant",
        content:
          error instanceof Error
            ? `I ran into an issue: ${error.message}. Please try again shortly or call us directly.`
            : "I ran into an issue while replying. Please try again shortly or call us directly.",
      };
      setChatHistory((prev) => [...prev, fallback]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <button
        onClick={handleOpenChat}
        className={`fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform duration-300 ${isOpen ? "scale-0" : "scale-100"}`}
        style={{
          background: buttonBackground ? `url(${buttonBackground}) center / cover no-repeat` : themeColor,
        }}
        aria-label="Chat with Kwame"
      >
        {!buttonBackground && <MessageCircle className="h-6 w-6 text-white" />}
      </button>

      {showPreview && !isOpen && (
        <div className="fixed bottom-28 right-6 z-40 max-w-xs animate-in slide-in-from-bottom-2 fade-in rounded-3xl border border-gray-200 bg-white p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: themeColor }}
            >
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="flex-1 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">Hi! I’m Kwame 👋</p>
              <p className="mt-1 text-gray-600">
                Need help finding products or tracking an order? Start a chat and I’ll guide you.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    handleDismissPreview();
                    handleOpenChat();
                  }}
                  className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: themeColor }}
                >
                  Chat now
                </button>
                <button
                  onClick={handleDismissPreview}
                  className="rounded-full px-3 py-1 text-xs font-semibold text-gray-500 hover:text-gray-700"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div
          ref={modalRef}
          className="fixed bottom-6 right-6 z-40 flex h-[520px] w-[360px] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl"
        >
          <header
            className="flex items-center justify-between px-5 py-4 text-white"
            style={{ backgroundColor: themeColor }}
          >
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white bg-opacity-20">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Kwame • PoolShop Assistant</p>
                <p className="text-xs text-white/80">Ask about products, availability, or orders.</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 hover:bg-white hover:bg-opacity-20"
              aria-label="Close chat"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {!leadCaptured ? (
            <form className="flex flex-1 flex-col gap-4 px-6 py-6" onSubmit={handleLeadSubmit}>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Let’s get you connected</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Enter your details so our team can follow up if needed.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <label className="text-xs font-medium text-gray-700">First name</label>
                  <input
                    required
                    value={leadForm.firstName}
                    onChange={(event) =>
                      setLeadForm((prev) => ({ ...prev, firstName: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2"
                    style={{ ["--tw-ring-color" as string]: themeColor }}
                    placeholder="Ama"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="text-xs font-medium text-gray-700">Last name</label>
                  <input
                    required
                    value={leadForm.lastName}
                    onChange={(event) =>
                      setLeadForm((prev) => ({ ...prev, lastName: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2"
                    style={{ ["--tw-ring-color" as string]: themeColor }}
                    placeholder="Mensah"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <label className="text-xs font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={leadForm.email}
                    onChange={(event) =>
                      setLeadForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2"
                    style={{ ["--tw-ring-color" as string]: themeColor }}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="text-xs font-medium text-gray-700">Phone</label>
                  <input
                    type="tel"
                    value={leadForm.phone}
                    onChange={(event) =>
                      setLeadForm((prev) => ({ ...prev, phone: event.target.value }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2"
                    style={{ ["--tw-ring-color" as string]: themeColor }}
                    placeholder="+233..."
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500">
                By starting the chat you agree to be contacted about your enquiry.
              </p>

              <button
                type="submit"
                disabled={leadSubmitting}
                className="mt-auto inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow transition"
                style={{
                  backgroundColor: themeColor,
                  opacity: leadSubmitting ? 0.7 : 1,
                }}
              >
                {leadSubmitting ? "Saving..." : "Start chatting"}
              </button>
            </form>
          ) : (
            <>
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
                {chatHistory.map((entry, index) => (
                  <div
                    key={`${entry.role}-${index}-${entry.content.slice(0, 8)}`}
                    className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                        entry.role === "user"
                          ? "text-white"
                          : "bg-gray-100 text-gray-900"
                      }`}
                      style={
                        entry.role === "user" ? { backgroundColor: themeColor } : undefined
                      }
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{entry.content}</p>
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl bg-gray-100 px-4 py-2">
                      <div className="flex space-x-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0.15s]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0.3s]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t px-5 py-4">
                <div className="flex items-end space-x-2">
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask Kwame about products or your order..."
                    className="min-h-[60px] flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2"
                    style={{ ["--tw-ring-color" as string]: themeColor }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!message.trim() || isSending}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: themeColor }}
                    aria-label="Send message"
                  >
                    {isSending ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

