import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Edit, Trash2, Users, FileText, Activity, Database } from "lucide-react";

export default function Admin() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading } = useAuth();

  // No authentication required - allow all users to access admin page

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users"],
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/stats/dashboard"],
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "User role updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
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
        description: "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getUserInitials = (firstName?: string, lastName?: string, email?: string) => {
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    if (email) {
      return email.charAt(0).toUpperCase();
    }
    return "U";
  };

  const getUserDisplayName = (firstName?: string, lastName?: string, email?: string) => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) {
      return firstName;
    }
    return email || "Unknown User";
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

  // Allow access to all users

  return (
    <div className="flex h-screen bg-background">
      <Sidebar currentPage="admin" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-card border-b border-border px-6 py-4" data-testid="header-admin">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold" data-testid="text-page-title">Administration</h2>
            <Button data-testid="button-add-user">
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-6 space-y-6" data-testid="main-admin">
          {/* User Management */}
          <Card className="border-border">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">User Management</h3>
                <Button data-testid="button-add-user-secondary">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              {usersLoading ? (
                <div className="p-6">
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center space-x-4 p-4 border border-border rounded-lg animate-pulse">
                        <div className="w-8 h-8 bg-muted rounded-full"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-1/3"></div>
                          <div className="h-3 bg-muted rounded w-1/4"></div>
                        </div>
                        <div className="w-16 h-6 bg-muted rounded"></div>
                        <div className="w-24 h-4 bg-muted rounded"></div>
                        <div className="w-20 h-8 bg-muted rounded"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <table className="w-full" data-testid="table-users">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Joined</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Active</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {(Array.isArray(users) ? users : []).map((usr: any) => (
                      <tr key={usr.id} className="hover:bg-accent transition-colors" data-testid={`row-user-${usr.id}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground mr-3">
                              <span className="text-sm font-medium">
                                {getUserInitials(usr.firstName, usr.lastName, usr.email)}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium" data-testid={`text-user-name-${usr.id}`}>
                                {getUserDisplayName(usr.firstName, usr.lastName, usr.email)}
                              </div>
                              <div className="text-sm text-muted-foreground">{usr.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Select
                            value={usr.role}
                            onValueChange={(role) => updateRoleMutation.mutate({ userId: usr.id, role })}
                            disabled={updateRoleMutation.isPending}
                          >
                            <SelectTrigger className="w-24" data-testid={`select-role-${usr.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(usr.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {formatDate(usr.updatedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary hover:text-primary/80"
                              data-testid={`button-edit-${usr.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive/80"
                              data-testid={`button-delete-${usr.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          {/* System Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border" data-testid="card-system-health">
              <CardContent className="p-6">
                <h4 className="text-lg font-semibold mb-4 flex items-center">
                  <Activity className="mr-2 h-5 w-5" />
                  System Health
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Processing Queue</span>
                    <Badge variant="secondary" data-testid="badge-processing-queue">
                      {(stats as any)?.processing || 0} jobs
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Vector Database</span>
                    <Badge 
                      className={`${
                        (stats as any)?.vectorDbHealth === 'healthy' 
                          ? 'bg-chart-2/10 text-chart-2 hover:bg-chart-2/20' 
                          : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                      }`} 
                      data-testid="badge-vector-db"
                    >
                      {(stats as any)?.vectorDbHealth || 'Unknown'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Storage Usage</span>
                    <span className="text-sm font-medium">
                      {(stats as any)?.storageUsed || '0 GB'} / {(stats as any)?.storageLimit || '100 GB'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">API Response Time</span>
                    <Badge className="bg-chart-2/10 text-chart-2 hover:bg-chart-2/20">
                      {(stats as any)?.avgResponseTime || '0ms'} avg
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border" data-testid="card-processing-stats">
              <CardContent className="p-6">
                <h4 className="text-lg font-semibold mb-4 flex items-center">
                  <Database className="mr-2 h-5 w-5" />
                  Processing Stats
                </h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Documents Processed Today</span>
                    <span className="text-sm font-medium" data-testid="text-docs-processed-today">
                      {(stats as any)?.documentsProcessedToday || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Failed Processing</span>
                    <span className="text-sm font-medium text-destructive">
                      {(stats as any)?.failedProcessing || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Processing Time</span>
                    <span className="text-sm font-medium">
                      {(stats as any)?.avgProcessingTime || '0 min'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Embeddings</span>
                    <span className="text-sm font-medium">
                      {(stats as any)?.totalEmbeddings || 0}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
