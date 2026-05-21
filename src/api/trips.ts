// API 関数とデータ型の定義ファイル。
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
