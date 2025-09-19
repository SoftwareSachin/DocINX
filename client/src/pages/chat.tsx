import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/Sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, ExternalLink } from "lucide-react";
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
        <header className="bg-card border-b border-border px-6 py-4" data-testid="header-chat">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold" data-testid="text-page-title">Knowledge Chat</h2>
              <p className="text-sm text-muted-foreground">Ask questions about your documents</p>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden p-6" data-testid="main-chat">
          <Card className="h-full border-border flex flex-col">
            {/* Chat Messages */}
            <div className="flex-1 overflow-auto p-6 space-y-6" data-testid="chat-messages">
              {messagesLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
                  <p className="text-muted-foreground mb-4">
                    Ask questions about your uploaded documents and get AI-powered answers with source citations.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Example: "What are the key findings in the quarterly report?"
                  </p>
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
                    <div className="w-8 h-8 bg-chart-2 rounded-full flex items-center justify-center text-white">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="bg-accent rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"></div>
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse animation-delay-100"></div>
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse animation-delay-200"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Chat Input */}
            <div className="p-6 border-t border-border">
              <div className="flex items-center space-x-4">
                <div className="flex-1 relative">
                  <Input
                    type="text"
                    placeholder="Ask a question about your documents..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={sendMessageMutation.isPending}
                    className="pr-12"
                    data-testid="input-chat-message"
                  />
                  <Button
                    size="sm"
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || sendMessageMutation.isPending}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Answers are generated from your uploaded documents with source attribution
              </p>
            </div>
          </Card>
        </main>
      </div>
    </div>
    </>
  );
}
