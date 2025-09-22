import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, ExternalLink, ArrowLeft, MessageSquare } from "lucide-react";
import ChatMessage from "@/components/ChatMessage";
import SEOHead from "@/components/SEOHead";

interface ChatMessageType {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    documentId: string;
    documentTitle: string;
    chunkId: string;
    content: string;
    confidence: number;
  }>;
  createdAt: string;
}

export default function Chat() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputValue, setInputValue] = useState("");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  // Load messages when session changes
  const { data: sessionMessages, isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/chat/sessions", currentSessionId, "messages"],
    enabled: isAuthenticated && !!currentSessionId,
  });

  useEffect(() => {
    if (Array.isArray(sessionMessages)) {
      setMessages(sessionMessages);
    }
  }, [sessionMessages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await apiRequest("POST", "/api/chat/query", {
        query,
        sessionId: currentSessionId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setCurrentSessionId(data.sessionId);
      // Add both user and assistant messages
      const userMessage: ChatMessageType = {
        id: `user-${Date.now()}`,
        role: "user",
        content: inputValue,
        createdAt: new Date().toISOString(),
      };
      
      const assistantMessage: ChatMessageType = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.answer,
        sources: data.sources,
        createdAt: new Date().toISOString(),
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);
      setInputValue("");
      
      // Invalidate and refetch messages
      queryClient.invalidateQueries({ 
        queryKey: ["/api/chat/sessions", data.sessionId, "messages"] 
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!inputValue.trim() || sendMessageMutation.isPending) return;
    
    sendMessageMutation.mutate(inputValue.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login
  }

  return (
    <>
      <SEOHead
        title="Knowledge Chat"
        description="Chat with your documents using DocINX AI. Ask questions and get intelligent answers with source citations from your uploaded files."
        keywords="AI chat, document Q&A, RAG chat, document intelligence, AI assistant"
      />
      <div className="flex h-screen bg-background">
      <Sidebar currentPage="chat" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 shadow-sm" data-testid="header-chat">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 p-2"
                onClick={() => window.location.href = '/documents'}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100" data-testid="text-page-title">Knowledge Chat</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ask questions about your documents</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900 p-6" data-testid="main-chat">
          <div className="bg-white dark:bg-gray-800 h-full rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col">
            {/* Chat Messages */}
            <div className="flex-1 overflow-auto p-6 space-y-4" data-testid="chat-messages">
              {messagesLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-6">
                    <MessageSquare className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Start a conversation</h3>
                  <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto">
                    Ask questions about your uploaded documents and get AI-powered answers with source citations.
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 max-w-sm mx-auto">
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-medium mb-1">Example questions:</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      "What are the key findings in the quarterly report?"
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))
              )}
              
              {/* Loading indicator for new message */}
              {sendMessageMutation.isPending && (
                <div className="chat-message">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse" style={{animationDelay: '100ms'}}></div>
                          <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-pulse" style={{animationDelay: '200ms'}}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Chat Input */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="flex items-center space-x-4">
                <div className="flex-1 relative">
                  <Input
                    type="text"
                    placeholder="Ask a question about your documents..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={sendMessageMutation.isPending}
                    className="pr-12 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-gray-100 dark:placeholder-gray-400"
                    data-testid="input-chat-message"
                  />
                  <Button
                    size="sm"
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || sendMessageMutation.isPending}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700"
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                Answers are generated from your uploaded documents with source attribution
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
    </>
  );
}
