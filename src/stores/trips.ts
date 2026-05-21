// 旅行データを管理する Pinia ストア。
// TripDetailView や HomeView など複数コンポーネントが同じ旅行データを参照するため、
// ストアに置くことで「データの一元管理」と「キャッシュ」を実現する。
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { tripsApi, spotsApi, type Trip, type Spot } from '@/api/trips'

export const useTripsStore = defineStore('trips', () => {
  // ref([]): リアクティブな配列。push/filter などで更新すると画面が再描画される。
  const trips = ref<Trip[]>([])
  // currentTrip: 現在表示中の旅行詳細データ。TripDetailView が参照する。
  const currentTrip = ref<Trip | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTrips() {
    loading.value = true
    try {
      const { data } = await tripsApi.list()
      trips.value = data
    } catch (e: any) {
      error.value = e.message
    } finally {
      // finally: 成功・失敗に関わらず必ず実行される。ローディングを確実に解除するために使う。
      loading.value = false
    }
  }

  async function createTrip(data: Partial<Trip>) {
    const { data: trip } = await tripsApi.create(data)
    // unshift(): 配列の先頭に追加する（新しい旅行が一覧の最初に表示される）。
    trips.value.unshift(trip)
    return trip
  }

  async function fetchTrip(hashUrl: string) {
    loading.value = true
    try {
      const { data } = await tripsApi.get(hashUrl)
      currentTrip.value = data
      return data
    } catch (e: any) {
      error.value = e.message
      // throw e: エラーを呼び出し元（TripDetailView）に再スローする。
      // これにより TripDetailView で pin_required のチェックができる。
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteTrip(hashUrl: string) {
    await tripsApi.delete(hashUrl)
    // filter(): 削除した旅行を配列から取り除いて新しい配列を作る。
    trips.value = trips.value.filter((t) => t.hash_url !== hashUrl)
    if (currentTrip.value?.hash_url === hashUrl) currentTrip.value = null
  }

  async function addSpot(hashUrl: string, data: Partial<Spot>) {
    const { data: spot } = await spotsApi.create(hashUrl, data)
    if (currentTrip.value) {
      // 既存の旅行データに新しいスポットを追加する。
      // APIから旅行を再取得せずに画面を更新できる（楽観的更新）。
      currentTrip.value.spots.push(spot)
    }
    return spot
  }

  async function updateSpot(id: string, data: Partial<Spot>) {
    const { data: updated } = await spotsApi.update(id, data)
    if (currentTrip.value) {
      // findIndex(): 条件に一致する要素のインデックスを返す。見つからない場合は -1。
      const idx = currentTrip.value.spots.findIndex((s) => s.id === id)
      if (idx !== -1) currentTrip.value.spots[idx] = updated
    }
    return updated
  }

  async function deleteSpot(hashUrl: string, id: string) {
    await spotsApi.delete(id)
    if (currentTrip.value) {
      currentTrip.value.spots = currentTrip.value.spots.filter((s) => s.id !== id)
    }
  }

  return {
    trips, currentTrip, loading, error,
    fetchTrips, createTrip, fetchTrip, deleteTrip,
    addSpot, updateSpot, deleteSpot,
  }
})
