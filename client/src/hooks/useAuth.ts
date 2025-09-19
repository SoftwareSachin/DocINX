// No authentication needed - always return authenticated state
export function useAuth() {
  const user = { id: 'anonymous', name: 'Anonymous User' }; // Mock user for non-auth mode
  
  return {
    user,
    isLoading: false,
    isAuthenticated: true, // Always authenticated in non-auth mode
  };
}
