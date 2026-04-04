import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'HEAD_ADMIN' | 'BRANCH_MANAGER' | 'COUNTER_STAFF'

export interface AuthUser {
  id: string
  username: string
  full_name: string
  email: string
  role: UserRole
  permissions: string[]
  branch_id: number | null
  branch_name: string | null
  mfa_enabled: boolean
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: AuthUser, access: string, refresh: string) => void
  clearAuth: () => void
  hasPermission: (permission: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),

      hasPermission: (permission: string) => {
        const { user } = get()
        if (!user) return false
        return user.permissions.includes('admin:all') || user.permissions.includes(permission)
      },
    }),
    {
      name: 'pharma-auth',
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken, isAuthenticated: s.isAuthenticated }),
    }
  )
)

// ─── UI State ────────────────────────────────────────────────────────────────
interface UIState {
  sidebarCollapsed: boolean
  activeBranchId: number | null
  toggleSidebar: () => void
  setActiveBranch: (id: number | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  activeBranchId: null,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setActiveBranch: (id) => set({ activeBranchId: id }),
}))
