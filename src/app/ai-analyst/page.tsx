"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/contexts/theme-context";
import { useToast } from "@/contexts/toast-context";
import { Send, Bot, User, Sparkles, MessageSquare, Clock, Plus } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  chart?: any;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export default function AIAnalystPage() {
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();
  const { error: showError } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showPastChats, setShowPastChats] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load past conversations
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const response = await fetch('/api/ai/chat/conversations');
        if (response.ok) {
          const data = await response.json();
          setConversations(data.conversations || []);
        }
      } catch (error) {
        console.error('Error loading conversations:', error);
      }
    };
    loadConversations();
  }, []);

  // Load conversation messages
  const loadConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/ai/chat/conversations/${conversationId}`);
      if (response.ok) {
        const data = await response.json();
        const convMessages = (data.conversation.messages as any[]).map((msg: any) => ({
          id: msg.id || Date.now().toString(),
          role: msg.role,
          content: msg.content,
          chart: msg.chart,
          timestamp: new Date(msg.timestamp || Date.now())
        }));
        setMessages(convMessages);
        setCurrentConversationId(conversationId);
        setShowPastChats(false);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      showError('Error', 'Failed to load conversation');
    }
  };

  // Start new conversation
  const startNewConversation = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `👋 Hi! I'm Jayne, your Strategic Business Partner.\n\nI'm here to help you think strategically, make better decisions, and grow your business. Think of me as your trusted advisor—like having Warren Buffett and a McKinsey consultant in your corner.\n\nI can help you with:\n\n📊 Strategic Analysis:\n• "What's my revenue trend and what does it mean?"\n• "Analyze my customer concentration risk"\n• "What's my competitive position?"\n\n💡 Strategic Planning:\n• "Help me plan for Q2 growth"\n• "Should I expand to new markets?"\n• "What's my pricing strategy?"\n\n🎯 Decision Support:\n• "Should I hire more sales reps?"\n• "Is this a good time to invest in inventory?"\n• "What are the risks of this expansion?"\n\n📈 Performance Insights:\n• "What's driving my profitability?"\n• "Where are my biggest opportunities?"\n• "What should I focus on next quarter?"\n\nLet's strategize together! What's on your mind?`,
        timestamp: new Date(),
      },
    ]);
    setCurrentConversationId(null);
    setShowPastChats(false);
  };

  useEffect(() => {
    if (messages.length === 0 || (messages.length === 1 && messages[0].id === "welcome")) {
      startNewConversation();
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    // Save the input value before clearing
    const messageText = input.trim();
    
    // Clear input immediately
    setInput("");
    
    // Add user message to UI immediately so it doesn't disappear
    const messagesWithUser = [...messages, userMessage];
    setMessages(messagesWithUser);
    
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageText,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }));
        const errorMessage = errorData.error || errorData.message || `Failed to get AI response: ${response.status} ${response.statusText}`;
        console.error('AI Chat API Error:', errorMessage, errorData);
        throw new Error(errorMessage);
      }

      const result = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: result.response.text || result.response,
        chart: result.response.chart || null,
        timestamp: new Date(),
      };

      // Add assistant message to the existing messages (user message already added)
      const updatedMessages = [...messagesWithUser, assistantMessage];
      setMessages(updatedMessages);

      // Save conversation
      const conversationData = {
        title: userMessage.content.substring(0, 50) || 'New Chat',
        messages: updatedMessages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          chart: msg.chart,
          timestamp: msg.timestamp.toISOString()
        }))
      };

      if (currentConversationId) {
        // Update existing conversation
        await fetch(`/api/ai/chat/conversations/${currentConversationId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(conversationData)
        });
      } else {
        // Create new conversation
        const response = await fetch('/api/ai/chat/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(conversationData)
        });
        if (response.ok) {
          const data = await response.json();
          setCurrentConversationId(data.conversation.id);
          // Reload conversations list
          const convsResponse = await fetch('/api/ai/chat/conversations');
          if (convsResponse.ok) {
            const convsData = await convsResponse.json();
            setConversations(convsData.conversations || []);
          }
        }
      }
    } catch (error) {
      console.error("AI chat error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to process your question. Please try again.";
      showError("Error", errorMessage);
      
      // Add error message to chat for user visibility
      // User message is already in messagesWithUser, so just add error message
      const errorChatMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `⚠️ ${errorMessage}\n\nPlease check:\n- AI settings are configured correctly\n- API keys are valid\n- Network connection is stable`,
        timestamp: new Date(),
      };
      setMessages([...messagesWithUser, errorChatMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Enter allows new lines (default textarea behavior)
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/ai/chat/conversations/${conversationId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setConversations(conversations.filter(c => c.id !== conversationId));
        if (currentConversationId === conversationId) {
          startNewConversation();
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      showError('Error', 'Failed to delete conversation');
    }
  };

  return (
    <>
      <div className="flex space-x-6">
        {/* Past Chats Sidebar */}
        <div className={`w-64 flex-shrink-0 transition-all ${showPastChats ? '' : 'hidden lg:block'}`}>
          <Card className="border border-gray-200 flex flex-col" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
            <CardHeader className="flex-shrink-0 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <MessageSquare className="h-5 w-5" />
                  <span>Past Chats</span>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={startNewConversation}
                  style={{ color: getThemeColor() }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No past conversations
                  </div>
                ) : (
                  <div className="space-y-1 pb-2">
                    {conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`p-3 mx-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors ${
                          currentConversationId === conv.id ? 'bg-blue-50 border border-blue-200' : ''
                        }`}
                        onClick={() => loadConversation(conv.id)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {conv.title || 'Untitled Chat'}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center space-x-1 mt-1">
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <span>{formatDate(conv.updatedAt)}</span>
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation(conv.id);
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: `${getThemeColor()}20` }}
                >
                  <Sparkles
                    className="h-6 w-6"
                    style={{ color: getThemeColor() }}
                  />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Jayne (Strategic Business Partner)
                  </h1>
                  <p className="text-gray-600">
                    Strategize with Jayne—your AI business partner for strategic planning, decision-making, and long-term growth
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPastChats(!showPastChats)}
                className="lg:hidden"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Past Chats
              </Button>
            </div>
          </div>

          {/* Chat Interface */}
          <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bot className="h-5 w-5" />
              <span>Strategic Session with Jayne</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Messages */}
              <div className="h-[500px] overflow-y-auto space-y-4 pr-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`flex items-start space-x-3 max-w-[80%] ${
                        message.role === "user" ? "flex-row-reverse space-x-reverse" : ""
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          message.role === "user"
                            ? "bg-gray-200"
                            : "bg-gray-100"
                        }`}
                      >
                        {message.role === "user" ? (
                          <User className="h-4 w-4 text-gray-600" />
                        ) : (
                          <Bot
                            className="h-4 w-4"
                            style={{ color: getThemeColor() }}
                          />
                        )}
                      </div>
                      <div
                        className={`rounded-lg p-4 ${
                          message.role === "user"
                            ? "bg-gray-100 text-gray-900"
                            : "bg-white border border-gray-200 text-gray-900"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">
                          {message.content}
                        </p>
                        {message.chart && (
                          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <h4 className="text-sm font-medium mb-2">Chart: {message.chart.type}</h4>
                            <div className="text-xs text-gray-600">
                              <p>Labels: {message.chart.data.labels.join(', ')}</p>
                              <p>Values: {message.chart.data.values.join(', ')}</p>
                            </div>
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex items-start space-x-3 max-w-[80%]">
                      <div
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-100"
                      >
                        <Bot
                          className="h-4 w-4"
                          style={{ color: getThemeColor() }}
                        />
                      </div>
                      <div className="rounded-lg p-4 bg-white border border-gray-200">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                          <div
                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          />
                          <div
                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: "0.4s" }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="flex items-end space-x-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Let's strategize... Ask me about your business, decisions, or plans (Shift+Enter for new line)"
                  disabled={isLoading}
                  className="flex-1 min-h-[80px] max-h-[200px] resize-y"
                  rows={3}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  style={{ backgroundColor: getThemeColor(), color: "white" }}
                  className="hover:opacity-90"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  );
}