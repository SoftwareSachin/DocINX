import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bot, User, ExternalLink, Copy, Check } from "lucide-react";
import { Link } from "wouter";
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
    // Navigation handled by Link component in JSX
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
              ? "bg-blue-600 text-white"
              : "bg-blue-100 text-blue-600"
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
            className={`rounded-lg p-4 border ${
              message.role === "user"
                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            }`}
          >
            {/* Message Header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {message.role === "user" ? "You" : "Assistant"}
              </span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatTime(message.createdAt)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyMessage}
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
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
            <div className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed" data-testid={`message-content-${message.id}`}>
              {message.content}
            </div>

            {/* Sources (only for assistant messages) */}
            {message.role === "assistant" && message.sources && message.sources.length > 0 && (
              <div className="border-t border-gray-200 pt-3 mt-4">
                <p className="text-xs text-gray-600 mb-3 font-semibold">Sources:</p>
                <div className="space-y-2">
                  {message.sources.map((source, index) => (
                    <Card
                      key={`${source.documentId}-${source.chunkId}`}
                      className="border-gray-200 bg-white shadow-sm"
                      data-testid={`source-${message.id}-${index}`}
                    >
                      <div className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-blue-100 rounded flex items-center justify-center">
                              <span className="text-xs font-semibold text-blue-600">
                                {index + 1}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-gray-900 truncate max-w-48">
                              {source.documentTitle}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">
                              {Math.round(source.confidence > 1 ? source.confidence : source.confidence * 100)}% confidence
                            </span>
                            <Link href={`/documents/${source.documentId}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
                                data-testid={`button-view-source-${message.id}-${index}`}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2">
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
