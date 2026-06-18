import { create } from 'zustand'

interface Usuario {
  id: string
  nome: string
  email: string
  perfil: string
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  usuario: Usuario | null
  login: (accessToken: string, refreshToken: string, usuario: Usuario) => void
  updateTokens: (accessToken: string, refreshToken: string) => void
  logout: () => void
}

function parseUsuario(): Usuario | null {
  try { return JSON.parse(localStorage.getItem('erp:usuario') ?? 'null') } catch { return null }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('erp:token'),
  refreshToken: localStorage.getItem('erp:refreshToken'),
  usuario: parseUsuario(),
  login: (accessToken, refreshToken, usuario) => {
    localStorage.setItem('erp:token', accessToken)
    localStorage.setItem('erp:refreshToken', refreshToken)
    localStorage.setItem('erp:usuario', JSON.stringify(usuario))
    set({ token: accessToken, refreshToken, usuario })
  },
  updateTokens: (accessToken, refreshToken) => {
    localStorage.setItem('erp:token', accessToken)
    localStorage.setItem('erp:refreshToken', refreshToken)
    set({ token: accessToken, refreshToken })
  },
  logout: () => {
    localStorage.removeItem('erp:token')
    localStorage.removeItem('erp:refreshToken')
    localStorage.removeItem('erp:usuario')
    set({ token: null, refreshToken: null, usuario: null })
  },
}))
