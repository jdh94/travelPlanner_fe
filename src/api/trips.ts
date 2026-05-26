// API 関数とデータ型の定義ファイル。
// authApi: メール認証関連のAPI（会員登録フローで使う）。
export const authApi = {
  // STEP1: メールアドレスに6桁認証コードを送信する。
  sendVerification: (email: string) =>
    api.post<{ detail: string }>('/auth/send-verification/', { email }),
  // STEP2: 入力されたコードを検証し、成功すれば verification_token を返す。
  verifyEmail: (email: string, code: string) =>
    api.post<{ verification_token: string }>('/auth/verify-email/', { email, code }),
}


// ビューコンポーネントから直接 axios を呼ぶ代わりに、ここに集約することで
// エンドポイントの変更時に修正箇所が1ヶ所で済む。
import api from './client'

// TypeScript のインターフェース: APIレスポンスの型定義。
// これにより、変数に何が入っているかをエディタが補完・チェックしてくれる。
export interface Trip {
  id: string
  title: string
  description: string
  start_date: string
  end_date: string
  hash_url: string
  share_url: string
  pin_enabled: boolean
  visibility: string
  currency: string
  creator: number | null
  spots: Spot[]
  members: TripMember[]
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface Spot {
  id: string
  name: string
  place_id: string
  category: 'restaurant' | 'attraction' | 'accommodation' | 'transport' | 'other'
  address: string
  latitude: number | null
  longitude: number | null
  visit_time: string | null
  duration_min: number | null
  memo: string
  order_index: number
  estimated_cost: number | null
  // スポット固有通貨。空文字の場合は旅行の通貨を使う。
  currency: string
}

export interface Comment {
  id: string
  spot: string
  author: number | null
  author_name: string
  guest_name: string
  content: string
  created_at: string
}

export interface TripMember {
  id: number
  user: number | null
  user_email: string | null
  user_name: string
  role: string
  joined_at: string
}

// api.get<Trip[]>('/trips/'): レスポンスの型を Trip[] と指定することで
// data が Trip[] 型として扱われ、TypeScript の型チェックが効く。
export const tripsApi = {
  list: () => api.get<Trip[]>('/trips/'),
  create: (data: Partial<Trip>) => api.post<Trip>('/trips/', data),
  // Partial<Trip>: Trip の全フィールドをオプションにした型。更新時は一部フィールドだけ送れる。
  get: (hashUrl: string) => api.get<Trip>(`/trips/${hashUrl}/`),
  // PATCH: 一部フィールドのみ更新する（PUT は全フィールド必須）。
  update: (hashUrl: string, data: Partial<Trip>) => api.patch<Trip>(`/trips/${hashUrl}/`, data),
  delete: (hashUrl: string) => api.delete(`/trips/${hashUrl}/`),
  verifyPin: (hashUrl: string, pin: string) => api.post<{ pin_token: string }>(`/trips/${hashUrl}/pin/`, { pin }),
  join: (hashUrl: string) => api.post<Trip>(`/trips/${hashUrl}/join/`),
}

export const spotsApi = {
  list: (hashUrl: string) => api.get<Spot[]>(`/trips/${hashUrl}/spots/`),
  create: (hashUrl: string, data: Partial<Spot>) => api.post<Spot>(`/trips/${hashUrl}/spots/`, data),
  update: (id: string, data: Partial<Spot>) => api.patch<Spot>(`/spots/${id}/`, data),
  delete: (id: string) => api.delete(`/spots/${id}/`),
  updateOrder: (hashUrl: string, orders: { id: string; order_index: number }[]) =>
    api.post(`/trips/${hashUrl}/spots/order/`, { orders }),
}

export const membersApi = {
  list: (hashUrl: string) => api.get<TripMember[]>(`/trips/${hashUrl}/members/`),
  add: (hashUrl: string, email: string, role: string) =>
    api.post<TripMember>(`/trips/${hashUrl}/members/add/`, { email, role }),
  updateRole: (hashUrl: string, memberId: number, role: string) =>
    api.patch<TripMember>(`/trips/${hashUrl}/members/${memberId}/`, { role }),
  remove: (hashUrl: string, memberId: number) =>
    api.delete(`/trips/${hashUrl}/members/${memberId}/`),
}

export const commentsApi = {
  list: (spotId: string) => api.get<Comment[]>(`/spots/${spotId}/comments/`),
  create: (spotId: string, data: { content: string; guest_name?: string }) =>
    api.post<Comment>(`/spots/${spotId}/comments/`, data),
}

// 費用データの型定義。
export interface Expense {
  id: string
  trip: string
  spot: string | null       // スポットUUID（旅行全体の費用の場合は null）
  spot_name: string | null  // スポット名（表示用）
  payer: number | null
  payer_name: string
  name: string
  amount: string   // Django DecimalField は文字列として返ってくる
  currency: string
  date: string | null
  memo: string
  participant_ids: number[]
  participant_names: string[]
  created_at: string
}

// 精算計算結果の型定義。
export interface Settlement {
  from_member_id: number
  from_member_name: string
  to_member_id: number
  to_member_name: string
  amount: number
  currency: string
}

export interface BalanceSummary {
  member_id: number
  member_name: string
  balance: number
  currency: string
}

export interface SettlementResult {
  settlements: Settlement[]
  balance_summary: BalanceSummary[]
  currency: string
}

// expensesApi: 費用CRUD と精算計算のAPI関数をまとめたオブジェクト。
export interface UserProfile {
  id: number
  username: string
  email: string
}

export const accountApi = {
  deactivate: () => api.post('/auth/deactivate/'),
  changeUsername: (username: string) => api.post('/auth/change-username/', { username }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password/', { current_password: currentPassword, new_password: newPassword }),
  sendReset: (email: string) =>
    api.post('/auth/send-reset/', { email }),
  verifyAndReset: (email: string, verificationToken: string, newPassword: string) =>
    api.post('/auth/reset-password/', { email, verification_token: verificationToken, new_password: newPassword }),
}

export const expensesApi = {
  // 旅行の費用一覧を取得する。
  list: (hashUrl: string) => api.get<Expense[]>(`/trips/${hashUrl}/expenses/`),
  // 新しい費用を登録する。participant_ids は M2M の参加者IDリスト。spot は任意。
  create: (hashUrl: string, data: {
    payer: number
    name: string
    amount: number | string
    currency: string
    date?: string
    memo?: string
    participant_ids: number[]
    spot?: string | null
  }) => api.post<Expense>(`/trips/${hashUrl}/expenses/`, data),
  // スポット別の費用一覧を取得する（?spot_id= でフィルタ）。
  listBySpot: (hashUrl: string, spotId: string) =>
    api.get<Expense[]>(`/trips/${hashUrl}/expenses/?spot_id=${spotId}`),
  // 費用を更新する（PATCH なので変更したフィールドだけ送ればよい）。
  update: (id: string, data: Partial<Expense> & { participant_ids?: number[] }) =>
    api.patch<Expense>(`/expenses/${id}/`, data),
  // 費用を削除する。
  delete: (id: string) => api.delete(`/expenses/${id}/`),
  // 精算計算結果を取得する。
  settlement: (hashUrl: string) => api.get<SettlementResult>(`/trips/${hashUrl}/settlement/`),
}
