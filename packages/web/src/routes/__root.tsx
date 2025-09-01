import { Outlet, createRootRouteWithContext } from '@tanstack/react-router';

interface AuthState {
  isAuthenticated: boolean
  user: { id: string; username: string; email: string } | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

interface AppContext {
  auth: AuthState
}


export const Route = createRootRouteWithContext<AppContext>()({
  component: () => <Outlet />,
});
