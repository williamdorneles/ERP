import axios from 'axios'
import { useAuthStore } from '../store/auth'

export const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('erp:token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => error ? reject(error) : resolve(token!))
  failedQueue = []
}

function clearSessionAndRedirect() {
  useAuthStore.getState().logout()
  window.location.href = '/login'
}

api.interceptors.response.use(
  res => res,
  async (err) => {
    const original = err.config

    // Só tenta refresh em 401 de rotas protegidas (não do próprio refresh/login)
    const isAuthEndpoint = original?.url?.includes('/auth/refresh') || original?.url?.includes('/auth/login')
    if (err.response?.status !== 401 || original?._retry || isAuthEndpoint) {
      return Promise.reject(err)
    }

    const storedRefreshToken = localStorage.getItem('erp:refreshToken')
    if (!storedRefreshToken) {
      clearSessionAndRedirect()
      return Promise.reject(err)
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then(token => {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      })
    }

    original._retry = true
    isRefreshing = true

    try {
      const res = await api.post('/auth/refresh', { refreshToken: storedRefreshToken })
      const { accessToken, refreshToken: newRefreshToken } = res.data

      useAuthStore.getState().updateTokens(accessToken, newRefreshToken)
      processQueue(null, accessToken)

      original.headers.Authorization = `Bearer ${accessToken}`
      return api(original)
    } catch (refreshErr) {
      processQueue(refreshErr, null)
      clearSessionAndRedirect()
      return Promise.reject(refreshErr)
    } finally {
      isRefreshing = false
    }
  },
)
