import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Search, Users as UsersIcon, Mail, Shield } from "lucide-react";
import SEOHead from "@/components/SEOHead";

export default function Users() {
  const users = [
    {
      id: 1,
      name: "Admin User",
      email: "admin@docinx.com",
      role: "Administrator",
      status: "active",
      lastSeen: "Online now"
    },
    {
      id: 2,
      name: "Demo User",
      email: "demo@example.com",
      role: "User",
      status: "active",
      lastSeen: "2 hours ago"
    }
  ];

  return (
    <>
      <SEOHead
        title="Users"
        description="Manage users, roles, and permissions in your DocINX workspace."
        keywords="users, roles, permissions, user management"
      />
      <Layout currentPage="users">
        <div className="p-6">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <button className="text-gray-600 hover:text-gray-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-lg font-semibold text-gray-900">Users</h1>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {users.length}
              </span>
            </div>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2">
              Invite User
            </Button>
          </div>
          
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search users"
                className="pl-10 bg-white border-gray-200"
              />
            </div>
          </div>
          
          {/* Users Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map((user) => (
              <Card key={user.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <UsersIcon className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{user.name}</h3>
                      <p className="text-sm text-gray-500 flex items-center">
                        <Mail className="w-3 h-3 mr-1" />
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Role</span>
                    <span className={`flex items-center ${
                      user.role === "Administrator" ? "text-purple-600" : "text-gray-900"
                    }`}>
                      <Shield className="w-3 h-3 mr-1" />
                      {user.role}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Last seen</span>
                    <span className="text-gray-900">{user.lastSeen}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                    Active
                  </span>
                  <Button variant="outline" size="sm" className="text-indigo-600 border-indigo-600 hover:bg-indigo-50">
                    Manage
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    </>
  );
}