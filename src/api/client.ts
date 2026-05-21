// Axios: ブラウザから HTTP リクエストを送るためのライブラリ。
// fetch API より使いやすく、インターセプター（リクエスト/レスポンスの横断処理）が強力。
import axios from 'axios'

// axios.create(): 共通設定（baseURL など）を持つ axios インスタンスを作成する。
// 全てのAPIリクエストはこの api インスタンス経由で送る。
const api = axios.create({
  // VITE_API_URL 環境変数があればそれを使い、なければ localhost:8000 を使う。
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  // withCredentials は不要（JWT トークンをヘッダーで送るため Cookie は使わない）。
  // withCredentials: true を設定するとブラウザが Cookie を送ろうとし、
  // CORS のプリフライトが厳しくなる → CORS エラーの原因になる。
})

// interceptors.request.use(): 全リクエストの送信前に処理を差し込む。
// ここで Authorization ヘッダーと X-Pin-Token ヘッダーを自動付与する。
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    // Bearer トークン: JWT認証の標準的な送り方。
    // Django側では JWTAuthentication がこのヘッダーを読み取ってユーザーを特定する。
    config.headers.Authorization = `Bearer ${token}`
  }

  // PIN トークンを自動付与（10分有効）。
  // URL が /trips/<hashUrl> にマッチする場合、その旅行用のPINトークンを付ける。
  const match = (config.url || '').match(/\/trips\/([^/]+)/)
  if (match) {
    const stored = localStorage.getItem(`pin_token_${match[1]}`)
    if (stored) {
      try {
        // PINトークンは { token: string, expires: number } の JSON 形式で保存してある。
        const { token, expires } = JSON.parse(stored)
        if (Date.now() < expires) {
          // 有効期限内 → X-Pin-Token ヘッダーに付与する。
          // Django 側で _generate_pin_token() と比較して PIN認証済みかを確認する。
          config.headers['X-Pin-Token'] = token
        } else {
          // 期限切れ → 古いトークンを削除する（次回アクセス時にPIN入力が求められる）。
          localStorage.removeItem(`pin_token_${match[1]}`)
        }
      } catch {
        localStorage.removeItem(`pin_token_${match[1]}`)
      }
    }
  }
  return config
})

// interceptors.response.use(): 全レスポンス受信後に処理を差し込む。
// 第1引数: 成功時の処理、第2引数: エラー時の処理。
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    // 401（未認証）かつ1回目のリトライの場合、リフレッシュトークンでアクセストークンを再発行する。
    // _retry フラグで無限ループを防ぐ（リフレッシュ自体が401になった場合の対策）。
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          // リフレッシュトークンで新しいアクセストークンを取得する。
          // この時点ではアクセストークンが無効なので、axios インスタンスではなく
          // 素の axios.post を使う（インターセプターが再帰的に動かないようにするため）。
          const { data } = await axios.post(
            `${original.baseURL || 'http://localhost:8000/api'}/auth/token/refresh/`,
            { refresh },
          )
          localStorage.setItem('access_token', data.access)
          // 新しいトークンで元のリクエストを再送する。
          original.headers.Authorization = `Bearer ${data.access}`
          return api(original)
        } catch {
          // リフレッシュも失敗した場合はトークンを全削除してログアウト扱いにする。
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
        }
      }
    }
    return Promise.reject(error)
  },
)

export default api
