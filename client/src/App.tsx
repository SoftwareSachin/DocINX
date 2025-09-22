import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Documents from "@/pages/documents";
import DocumentDetail from "@/pages/document-detail";
import Chat from "@/pages/chat";
import Admin from "@/pages/admin";
import Datasets from "@/pages/datasets";
import Search from "@/pages/search";
import MCP from "@/pages/mcp";
import Tools from "@/pages/tools";
import Agents from "@/pages/agents";
import Users from "@/pages/users";

function Router() {
  // No authentication needed - directly render main app routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/documents" component={Documents} />
      <Route path="/documents/:id" component={DocumentDetail} />
      <Route path="/datasets" component={Datasets} />
      <Route path="/search" component={Search} />
      <Route path="/mcp" component={MCP} />
      <Route path="/tools" component={Tools} />
      <Route path="/agents" component={Agents} />
      <Route path="/users" component={Users} />
      <Route path="/chat" component={Chat} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
