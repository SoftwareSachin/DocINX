import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Search, MessageSquare, Shield, CheckCircle, Upload, Bot, Users } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20">
          <div className="text-center">
            <Badge variant="secondary" className="mb-6" data-testid="badge-hero">
              Enterprise Document Intelligence Platform
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-6 tracking-tight" data-testid="hero-title">
              Transform Documents into <br />
              <span className="text-primary">Intelligent Knowledge</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed" data-testid="hero-description">
              Enterprise-grade document processing with AI-powered search and conversational Q&A. 
              Upload, analyze, and extract insights from your documents with advanced RAG technology.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                onClick={handleLogin} 
                size="lg" 
                className="text-lg px-8 py-4 h-14 w-full sm:w-auto"
                data-testid="button-login"
              >
                Start Free Trial
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="text-lg px-8 py-4 h-14 w-full sm:w-auto"
                data-testid="button-demo"
              >
                View Demo
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>No setup required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Enterprise security</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>24/7 support</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl lg:text-4xl font-bold text-primary mb-2">10M+</div>
              <div className="text-sm text-muted-foreground">Documents Processed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl lg:text-4xl font-bold text-primary mb-2">99.9%</div>
              <div className="text-sm text-muted-foreground">Uptime SLA</div>
            </div>
            <div className="text-center">
              <div className="text-3xl lg:text-4xl font-bold text-primary mb-2">500+</div>
              <div className="text-sm text-muted-foreground">Enterprise Clients</div>
            </div>
            <div className="text-center">
              <div className="text-3xl lg:text-4xl font-bold text-primary mb-2">&lt;1s</div>
              <div className="text-sm text-muted-foreground">Query Response Time</div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4" data-testid="badge-features">
              Core Features
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-6" data-testid="features-title">
              Enterprise Document Intelligence
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="features-description">
              Advanced AI-powered document processing with enterprise-grade security and scalability
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="border-border hover:shadow-lg transition-shadow duration-300" data-testid="card-feature-upload">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Smart Upload</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Advanced OCR and text extraction from PDFs, DOCX, and text files with automatic format detection.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border hover:shadow-lg transition-shadow duration-300" data-testid="card-feature-search">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-chart-2/10 rounded-xl flex items-center justify-center mb-6">
                  <Search className="h-8 w-8 text-chart-2" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Vector Search</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Semantic search powered by advanced embeddings for precise content discovery across documents.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border hover:shadow-lg transition-shadow duration-300" data-testid="card-feature-chat">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-chart-1/10 rounded-xl flex items-center justify-center mb-6">
                  <Bot className="h-8 w-8 text-chart-1" />
                </div>
                <h3 className="text-xl font-semibold mb-3">RAG Chat</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Retrieval-Augmented Generation for accurate Q&A with full source attribution and citations.
                </p>
              </CardContent>
            </Card>

            <Card className="border-border hover:shadow-lg transition-shadow duration-300" data-testid="card-feature-security">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-chart-4/10 rounded-xl flex items-center justify-center mb-6">
                  <Users className="h-8 w-8 text-chart-4" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Team Management</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Role-based access control, user management, and enterprise security compliance.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-primary/5">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <Badge variant="outline" className="mb-6" data-testid="badge-cta">
            Ready to Get Started?
          </Badge>
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-6" data-testid="cta-title">
            Transform Your Documents Today
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto" data-testid="cta-description">
            Join hundreds of enterprises using Amplifi to unlock the power of their document repositories with advanced AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={handleLogin} 
              size="lg" 
              className="text-lg px-8 py-4 h-14 w-full sm:w-auto"
              data-testid="button-cta-login"
            >
              Start Free Trial
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="text-lg px-8 py-4 h-14 w-full sm:w-auto"
              data-testid="button-cta-contact"
            >
              Contact Sales
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            No credit card required • 14-day free trial • Enterprise support available
          </p>
        </div>
      </div>
    </div>
  );
}
