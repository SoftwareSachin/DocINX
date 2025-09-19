import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Search, MessageSquare, Shield } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6" data-testid="hero-title">
              <span className="text-primary">Amplifi</span> Document Intelligence
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto" data-testid="hero-description">
              Transform your documents into searchable knowledge with AI-powered conversational Q&A. 
              Upload PDFs, Word documents, and text files to get instant, cited answers.
            </p>
            <Button 
              onClick={handleLogin} 
              size="lg" 
              className="text-lg px-8 py-6"
              data-testid="button-login"
            >
              Get Started
            </Button>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="features-title">
              Powerful Document Intelligence
            </h2>
            <p className="text-lg text-muted-foreground" data-testid="features-description">
              Everything you need to make your documents searchable and queryable
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-border" data-testid="card-feature-upload">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Smart Upload</h3>
                <p className="text-muted-foreground">
                  Upload PDFs, DOCX, and text files with automatic text extraction and OCR support.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border" data-testid="card-feature-search">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-chart-2/10 rounded-lg flex items-center justify-center mb-4">
                  <Search className="h-6 w-6 text-chart-2" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Semantic Search</h3>
                <p className="text-muted-foreground">
                  Find relevant information using natural language queries with AI-powered semantic search.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border" data-testid="card-feature-chat">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-chart-1/10 rounded-lg flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-chart-1" />
                </div>
                <h3 className="text-lg font-semibold mb-2">AI Chat</h3>
                <p className="text-muted-foreground">
                  Ask questions in natural language and get accurate answers with source citations.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border" data-testid="card-feature-security">
              <CardContent className="pt-6">
                <div className="w-12 h-12 bg-chart-4/10 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-chart-4" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Enterprise Ready</h3>
                <p className="text-muted-foreground">
                  Role-based access control and secure document management for teams.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="cta-title">
            Ready to unlock your document intelligence?
          </h2>
          <p className="text-lg text-muted-foreground mb-8" data-testid="cta-description">
            Start uploading documents and asking questions in minutes.
          </p>
          <Button 
            onClick={handleLogin} 
            size="lg" 
            className="text-lg px-8 py-6"
            data-testid="button-cta-login"
          >
            Sign In to Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
