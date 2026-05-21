// Pinia ストア: コンポーネント間で共有する状態（State）を管理する。
// useAuthStore() を呼ぶとこのストアのインスタンスを取得できる。
// どのコンポーネントから呼んでも同じインスタンスを返すため、状態が同期される。
import { defineStore } from 'pinia'
// ref: リアクティブな値を作る。値が変わると、その値を参照しているテンプレートが自動で再描画される。
// computed: 他の ref を元に計算した読み取り専用の値。依存する ref が変わると自動で再計算される。
import { ref, computed } from 'vue'
import api from '@/api/client'

interface User {
  id: number
  email: string
  username: string
  notification_enabled: boolean
}

// defineStore('auth', () => {...}): 'auth' という名前のストアを定義する。
// Composition API スタイル（setup関数と同じ書き方）で書いている。
export const useAuthStore = defineStore('auth', () => {
  // ref<User | null>(null): User 型か null を持つリアクティブ変数。
  const user = ref<User | null>(null)
  // ページ読み込み時に localStorage からトークンを復元する。
  // ブラウザを閉じてもログイン状態を維持できる理由はこれ。
  const accessToken = ref<string | null>(localStorage.getItem('access_token'))

  // computed: isLoggedIn は accessToken が null でなければ true。
  // !!: 任意の値を boolean に変換する（null/undefined → false、文字列 → true）。
  const isLoggedIn = computed(() => !!accessToken.value)

  async function login(email: string, password: string) {
    // Django の TokenObtainPairView にメール+パスワードを送ってJWTを取得する。
    const { data } = await api.post('/auth/login/', { email, password })
    accessToken.value = data.access
    // localStorage: ブラウザにデータを永続保存する。タブを閉じても消えない。
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    // ログイン後にユーザー情報を取得してストアに保存する。
    await fetchMe()
  }

  async function register(email: string, username: string, password: string) {
    const { data } = await api.post('/auth/register/', { email, username, password })
    accessToken.value = data.access
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    user.value = data.user
  }

  async function fetchMe() {
    try {
      const { data } = await api.get('/auth/me/')
      // .value: ref の実際の値にアクセス・更新するには .value が必要（テンプレート内は不要）。
      user.value = data
    } catch (e: any) {
      user.value = null
      // 401 のみログアウト処理をする。
      // ネットワークエラー等（401以外）でもログアウトすると困るため条件を絞っている。
      if (e.response?.status === 401) {
        logout()
      }
    }
  }

  function logout() {
    user.value = null
    accessToken.value = null
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  }

  // ストアが初期化されるとき（アプリ起動時）にトークンがあればユーザー情報を取得する。
  // これによりページリロードしてもログイン状態が復元される。
  if (accessToken.value) {
    fetchMe()
  }

  // return: 外部のコンポーネントやストアからアクセスできるものを明示的に公開する。
  return { user, accessToken, isLoggedIn, login, register, fetchMe, logout }
})
