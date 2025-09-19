import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bot, User, ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";

interface ChatMessageProps {
  message: {
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
  };
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy message:", error);
    }
  };

  const handleViewSource = (documentId: string) => {
    // In a real implementation, this would navigate to the document or open a modal
    console.log("View document:", documentId);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="chat-message" data-testid={`chat-message-${message.id}`}>
      <div className="flex items-start space-x-3">
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${
            message.role === "user"
              ? "bg-primary text-primary-foreground"
              : "bg-chart-2 text-white"
          }`}
        >
          {message.role === "user" ? (
            <User className="h-4 w-4" />
          ) : (
            <Bot className="h-4 w-4" />
          )}
        </div>

        {/* Message Content */}
        <div className="flex-1 min-w-0">
          <div
            className={`rounded-lg p-4 ${
              message.role === "user"
                ? "bg-secondary"
                : "bg-accent"
            }`}
          >
            {/* Message Header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {message.role === "user" ? "You" : "Assistant"}
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground">
                  {formatTime(message.createdAt)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyMessage}
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  data-testid={`button-copy-${message.id}`}
                >
                  {copiedId === message.id ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>

            {/* Message Text */}
            <div className="text-sm whitespace-pre-wrap" data-testid={`message-content-${message.id}`}>
              {message.content}
            </div>

            {/* Sources (only for assistant messages) */}
            {message.role === "assistant" && message.sources && message.sources.length > 0 && (
              <div className="border-t border-border pt-3 mt-4">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Sources:</p>
                <div className="space-y-2">
                  {message.sources.map((source, index) => (
                    <Card
                      key={`${source.documentId}-${source.chunkId}`}
                      className="border-border bg-muted/50"
                      data-testid={`source-${message.id}-${index}`}
                    >
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-primary/20 rounded flex items-center justify-center">
                              <span className="text-xs font-medium text-primary">
                                {index + 1}
                              </span>
                            </div>
                            <span className="text-xs font-medium truncate max-w-48">
                              {source.documentTitle}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-muted-foreground">
                              {source.confidence}% confidence
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewSource(source.documentId)}
                              className="h-6 w-6 p-0 text-primary hover:text-primary/80"
                              data-testid={`button-view-source-${message.id}-${index}`}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {source.content}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
