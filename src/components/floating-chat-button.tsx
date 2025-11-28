"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { useToast } from "@/contexts/toast-context";
import { useBranding } from "@/contexts/branding-context";

interface FloatingChatButtonProps {
  customBackground?: string;
}

export function FloatingChatButton({ customBackground }: FloatingChatButtonProps = {}) {
  const { getThemeColor } = useTheme();
  const { error: showError } = useToast();
  const { branding } = useBranding();
  const themeColor = getThemeColor();
  // Use branding chat button image if available, otherwise use customBackground prop
  const chatButtonImage = branding.chatButtonImage || customBackground;
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [hasShownWelcome, setHasShownWelcome] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hasDismissedPreview, setHasDismissedPreview] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const chatModalRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatModalRef.current && !chatModalRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Show welcome message when chat opens for the first time
  useEffect(() => {
    if (isOpen && !hasShownWelcome && chatHistory.length === 0) {
      setHasShownWelcome(true);
      const welcomeMessage = {
        role: 'assistant' as const,
        content: "👋 Hi! I'm Kwame, your AI assistant.\n\nI'm here to help you navigate the system, answer questions, and make your work easier. Feel free to ask me anything!"
      };
      setChatHistory([welcomeMessage]);
    }
  }, [isOpen, hasShownWelcome, chatHistory.length]);

  // Check if user has previously dismissed the preview
  useEffect(() => {
    const dismissed = localStorage.getItem('kwame-preview-dismissed');
    const lastShown = localStorage.getItem('kwame-preview-last-shown');
    const visitCount = parseInt(localStorage.getItem('kwame-visit-count') || '0');
    
    // Increment visit count
    localStorage.setItem('kwame-visit-count', (visitCount + 1).toString());
    
    if (dismissed === 'true') {
      setHasDismissedPreview(true);
      return;
    }
    
    // Show preview periodically:
    // 1. User hasn't dismissed it permanently
    // 2. User has visited at least 2 times (not first visit)
    // 3. Not on mobile (less intrusive)
    // 4. Either hasn't been shown in last 7 days, or visit count is a multiple of 10
    const now = Date.now();
    const lastShownTime = lastShown ? parseInt(lastShown) : 0;
    const isMobile = window.innerWidth < 768;
    const daysSinceLastShown = (now - lastShownTime) / (24 * 60 * 60 * 1000);
    const shouldShow = visitCount >= 2 && 
                      !isMobile &&
                      (daysSinceLastShown >= 7 || (visitCount % 10 === 0 && daysSinceLastShown >= 1));
    
    if (shouldShow) {
      const showTimer = setTimeout(() => {
        setShowPreview(true);
        localStorage.setItem('kwame-preview-last-shown', now.toString());
      }, 3000); // Show after 3 seconds
      
      const hideTimer = setTimeout(() => {
        setShowPreview(false);
      }, 10000); // Hide after 10 seconds
      
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
  }, []);

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = { role: 'user' as const, content: message };
    const updatedHistory = [...chatHistory, userMessage];
    setChatHistory(updatedHistory);
    setMessage("");
    setIsLoading(true);

    try {
      // Build conversation history for API (exclude welcome message)
      const welcomeMessageText = "👋 Hi! I'm Kwame, your AI assistant.\n\nI'm here to help you navigate the system, answer questions, and make your work easier. Feel free to ask me anything!";
      const conversationHistory = updatedHistory
        .filter(msg => msg.content !== welcomeMessageText)
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));

      const response = await fetch('/api/ai/kwame', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          conversationHistory: conversationHistory.slice(-10) // Last 10 messages for context
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      const aiResponse = {
        role: 'assistant' as const,
        content: data.response?.text || "I'm sorry, I couldn't process your request. Please try again."
      };
      setChatHistory(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error sending message to Kwame:', error);
      const errorMessage = {
        role: 'assistant' as const,
        content: error instanceof Error ? error.message : "I'm sorry, I encountered an error. Please try again or check your AI settings."
      };
      setChatHistory(prev => [...prev, errorMessage]);
      showError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced dismissal function with animation
  const handleDismissPreview = (permanent = true) => {
    setIsDismissing(true);
    
    // Animate out
    setTimeout(() => {
      setShowPreview(false);
      setIsDismissing(false);
      
      if (permanent) {
        setHasDismissedPreview(true);
        localStorage.setItem('kwame-preview-dismissed', 'true');
      }
    }, 300); // Match animation duration
  };

  // Utility function to reset preview dismissal (for development/testing)
  const resetPreviewDismissal = () => {
    setHasDismissedPreview(false);
    setIsDismissing(false);
    localStorage.removeItem('kwame-preview-dismissed');
    localStorage.removeItem('kwame-preview-last-shown');
    localStorage.removeItem('kwame-visit-count');
  };

  // Expose reset function to window for debugging
  useEffect(() => {
    (window as any).resetKwamePreview = resetPreviewDismissal;
  }, []);

  return (
    <>
      {/* Preview Message */}
      {showPreview && !isOpen && !hasDismissedPreview && (
        <div className={`fixed bottom-32 right-4 md:bottom-24 md:right-6 z-50 transition-all duration-300 ${
          isDismissing 
            ? 'animate-out slide-out-to-bottom-2 fade-out' 
            : 'animate-in slide-in-from-bottom-2 fade-in'
        }`}>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 max-w-xs">
            <div className="flex items-start space-x-3">
              <div 
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: themeColor }}
              >
                <MessageCircle className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Hi! I'm Kwame 👋</p>
                <p className="text-xs text-gray-600 mt-1">Need help? Click here to chat with me!</p>
                <button
                  onClick={() => handleDismissPreview(true)}
                  className="text-xs text-gray-500 hover:text-gray-700 mt-1 underline"
                >
                  Don't show again
                </button>
              </div>
              <button
                onClick={() => handleDismissPreview(true)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          setShowPreview(false); // Hide preview when opening chat
        }}
        className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center z-50 ${
          isOpen ? 'scale-0' : 'scale-100'
        }`}
        style={{
          background: chatButtonImage 
            ? `url(${chatButtonImage}) center/cover` 
            : themeColor
        }}
      >
        {!chatButtonImage && <MessageCircle className="h-6 w-6 text-white" />}
      </button>

      {/* Chat Modal */}
      {isOpen && (
        <div 
          ref={chatModalRef}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col border border-gray-200"
        >
          {/* Header */}
          <div 
            className="text-white p-4 rounded-t-2xl flex items-center justify-between"
            style={{ backgroundColor: themeColor }}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">AI Assistant</h3>
                <p className="text-xs text-white text-opacity-80">Ask me anything!</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white hover:bg-opacity-20 rounded-full p-1 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    msg.role === 'user'
                      ? 'text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                  style={msg.role === 'user' ? { backgroundColor: themeColor } : {}}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 max-w-[80%] rounded-2xl px-4 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex space-x-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type your message..."
                className="flex-1 resize-none border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 text-sm"
                style={{ 
                  focusRingColor: themeColor,
                  '--tw-ring-color': themeColor 
                } as React.CSSProperties & { focusRingColor?: string; '--tw-ring-color'?: string }}
                onFocus={(e) => {
                  e.target.style.boxShadow = `0 0 0 2px ${themeColor}40`;
                }}
                onBlur={(e) => {
                  e.target.style.boxShadow = '';
                }}
                rows={2}
              />
              <button
                onClick={handleSendMessage}
                disabled={!message.trim() || isLoading}
                className="disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl px-4 py-2 transition-opacity"
                style={{ 
                  backgroundColor: themeColor,
                  opacity: (!message.trim() || isLoading) ? 0.5 : 1
                }}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
