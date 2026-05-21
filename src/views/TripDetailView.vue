<script setup lang="ts">
// Vue Composition API: setup() 関数の中でリアクティブな状態・ロジックを定義する。
// <script setup> は setup() の糖衣構文（シンタックスシュガー）で、return が不要になる。
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTripsStore } from '@/stores/trips'
import { commentsApi, type Comment } from '@/api/trips'
import type { Spot } from '@/api/trips'

// useRoute(): 現在のルート情報（URLパラメータ、クエリ等）を取得する。
const route = useRoute()
// useRouter(): プログラム的なページ遷移（push/replace）を行う。
const router = useRouter()
// ストアのインスタンスを取得する。どこで呼んでも同じインスタンス。
const tripsStore = useTripsStore()

const hashUrl = route.params.hashUrl as string
const activeTab = ref<'timeline' | 'map'>('timeline')
const showAddSpot = ref(false)
const addSpotError = ref('')
const addSpotLoading = ref(false)
// Record<string, Comment[]>: スポットIDをキーにしてコメント配列を管理する辞書型。
// { "spot-id-1": [comment1, comment2], "spot-id-2": [] } のような構造。
const comments = ref<Record<string, Comment[]>>({})
const newComment = ref<Record<string, string>>({})
const selectedSpotId = ref<string | null>(null)

const showEditSpot = ref(false)
const editSpotError = ref('')
const editSpotLoading = ref(false)
const editingSpotId = ref<string | null>(null)
const editForm = ref({
  name: '',
  category: 'other' as Spot['category'],
  address: '',
  visit_time: '',
  duration_min: '',
  memo: '',
})

// computed: tripsStore.currentTrip を参照する。
// ストアのデータが変わると、trip を参照しているテンプレート全体が自動で再描画される。
const trip = computed(() => tripsStore.currentTrip)

// watch: 監視対象の値が変わったときに処理を実行する。
// trip.value?.spots を監視 → スポットが追加・変更されたときに反応する。
// immediate: true → コンポーネント初期化時にも1回実行する。
watch(() => trip.value?.spots, async (spots) => {
  if (!spots || spots.length === 0) return
  // 最初のスポットをデフォルト選択にする（まだ何も選んでいない場合）。
  if (!selectedSpotId.value) selectedSpotId.value = spots[0].id
  // Promise.all(): 複数の非同期処理を並列実行して全て完了するのを待つ。
  // 順番に fetch するより速い（スポット数が多いほど効果大）。
  await Promise.all(
    spots
      .filter((s) => !comments.value[s.id])  // まだコメントを取得していないスポットだけ
      .map(async (s) => {
        const { data } = await commentsApi.list(s.id)
        comments.value[s.id] = data
      })
  )
}, { immediate: true })

// computed の mapSrc: selectedSpotId が変わると自動で地図URLが更新される。
const mapSrc = computed(() => {
  const spots = trip.value?.spots ?? []
  const target = spots.find((s) => s.id === selectedSpotId.value) ?? spots[0]
  const q = target
    ? encodeURIComponent(target.address || target.name)
    : encodeURIComponent(trip.value?.title ?? 'Japan')
  // Google Maps の埋め込み用URL。?output=embed を付けると iframe 表示になる。
  return `https://maps.google.com/maps?q=${q}&output=embed&hl=ja`
})

function selectSpot(spotId: string) {
  selectedSpotId.value = spotId
}

const spotForm = ref({
  name: '',
  category: 'other' as Spot['category'],
  address: '',
  visit_time: '',
  duration_min: '',
  memo: '',
})

const categoryLabels: Record<string, string> = {
  restaurant: '🍽 飲食店',
  attraction: '🏛 観光地',
  accommodation: '🏨 宿泊',
  transport: '🚌 交通',
  other: '📍 その他',
}

// onMounted: コンポーネントが DOM にマウントされた直後に実行される。
// ここで API からデータを取得するのが一般的なパターン。
onMounted(async () => {
  try {
    await tripsStore.fetchTrip(hashUrl)
  } catch (e: any) {
    if (e.response?.data?.pin_required) {
      // PIN 必須エラーが返ってきた場合、古いトークンを削除して PIN 入力ページへ遷移する。
      localStorage.removeItem(`pin_token_${hashUrl}`)
      router.push(`/trips/${hashUrl}/pin`)
    }
  }
})

async function addSpot() {
  if (!spotForm.value.name) return
  addSpotError.value = ''
  addSpotLoading.value = true
  try {
    const spot = await tripsStore.addSpot(hashUrl, {
      ...spotForm.value,
      // 空文字の場合は undefined にして API に送らない（DBで null になる）。
      duration_min: spotForm.value.duration_min ? Number(spotForm.value.duration_min) : undefined,
      visit_time: spotForm.value.visit_time || undefined,
    })
    selectedSpotId.value = spot.id
    showAddSpot.value = false
    spotForm.value = { name: '', category: 'other', address: '', visit_time: '', duration_min: '', memo: '' }
  } catch (e: any) {
    // DRF のバリデーションエラーは { field: ["エラーメッセージ"] } 形式で返ってくる。
    const data = e.response?.data
    if (data && typeof data === 'object') {
      addSpotError.value = Object.keys(data).map((k: string) => {
        const v: unknown = (data as Record<string, unknown>)[k]
        return `${k}: ${Array.isArray(v) ? (v as string[]).join(', ') : String(v)}`
      }).join(' / ')
    } else {
      addSpotError.value = 'スポットの追加に失敗しました。'
    }
  } finally {
    addSpotLoading.value = false
  }
}

function openEdit(spot: Spot) {
  editingSpotId.value = spot.id
  editForm.value = {
    name: spot.name,
    category: spot.category,
    address: spot.address ?? '',
    visit_time: spot.visit_time ?? '',
    duration_min: spot.duration_min ? String(spot.duration_min) : '',
    memo: spot.memo ?? '',
  }
  editSpotError.value = ''
  showEditSpot.value = true
}

async function saveEdit() {
  if (!editForm.value.name || !editingSpotId.value) return
  editSpotError.value = ''
  editSpotLoading.value = true
  try {
    await tripsStore.updateSpot(editingSpotId.value, {
      ...editForm.value,
      duration_min: editForm.value.duration_min ? Number(editForm.value.duration_min) : undefined,
      visit_time: editForm.value.visit_time || undefined,
    })
    showEditSpot.value = false
  } catch (e: any) {
    const data = e.response?.data
    if (data && typeof data === 'object') {
      editSpotError.value = Object.keys(data).map((k: string) => {
        const v: unknown = (data as Record<string, unknown>)[k]
        return `${k}: ${Array.isArray(v) ? (v as string[]).join(', ') : String(v)}`
      }).join(' / ')
    } else {
      editSpotError.value = 'スポットの更新に失敗しました。'
    }
  } finally {
    editSpotLoading.value = false
  }
}

async function deleteSpot(id: string) {
  if (!confirm('このスポットを削除しますか？')) return
  await tripsStore.deleteSpot(hashUrl, id)
  if (selectedSpotId.value === id) {
    selectedSpotId.value = trip.value?.spots[0]?.id ?? null
  }
}

async function postComment(spotId: string) {
  const text = newComment.value[spotId]?.trim()
  if (!text) return
  const { data } = await commentsApi.create(spotId, { content: text })
  if (!comments.value[spotId]) comments.value[spotId] = []
  // コメントをストアではなくローカルの comments ref に追加する。
  // 旅行全体を再取得しなくてもコメントだけ即時反映できる。
  comments.value[spotId].push(data)
  newComment.value[spotId] = ''
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('ja-JP')
}
</script>

<template>
  <!--
    v-if / v-else-if / v-else: 条件に応じて DOM 要素を表示・非表示にする。
    v-show と違い、v-if は条件が false のとき DOM から要素を完全に除去する。
  -->
  <div v-if="tripsStore.loading" class="loading-full">読み込み中...</div>

  <div v-else-if="trip" class="trip-detail">
    <header class="header">
      <button class="back-btn" @click="router.push('/')">← 戻る</button>
      <div class="header-info">
        <h1>{{ trip.title }}</h1>
        <!-- {{ }}: Mustache構文。リアクティブな値をテキストとして描画する。 -->
        <span class="dates">{{ formatDate(trip.start_date) }} 〜 {{ formatDate(trip.end_date) }}</span>
      </div>
      <RouterLink :to="`/trips/${hashUrl}/manage`" class="btn-outline">管理</RouterLink>
      <RouterLink :to="`/trips/${hashUrl}/share`" class="btn-outline">共有</RouterLink>
    </header>

    <div class="tabs mobile-only">
      <button :class="{ active: activeTab === 'timeline' }" @click="activeTab = 'timeline'">
        タイムライン
      </button>
      <button :class="{ active: activeTab === 'map' }" @click="activeTab = 'map'">
        地図
      </button>
    </div>

    <div class="workspace">
      <div class="timeline" :class="{ 'hidden-mobile': activeTab === 'map' }">
        <div class="timeline-header">
          <h2>スポット一覧</h2>
          <button class="btn-primary" @click="showAddSpot = true">+ スポット追加</button>
        </div>

        <div v-if="trip.spots.length === 0" class="empty-spots">
          スポットがまだありません。「+ スポット追加」から追加してください。
        </div>

        <!--
          v-for: 配列の要素数だけ要素を繰り返す。
          :key: Vue がどの要素が変わったかを追跡するための一意なID。必須。
          :class="{ 'spot-selected': selectedSpotId === spot.id }":
            条件が true のときだけ 'spot-selected' クラスを付与する。
        -->
        <div
          v-for="spot in trip.spots"
          :key="spot.id"
          class="spot-item"
          :class="{ 'spot-selected': selectedSpotId === spot.id }"
          @click="selectSpot(spot.id)"
        >
          <div class="spot-header">
            <div class="spot-left">
              <span class="category-badge">{{ categoryLabels[spot.category] }}</span>
              <div>
                <strong>{{ spot.name }}</strong>
                <p v-if="spot.address" class="spot-address">{{ spot.address }}</p>
                <p v-if="spot.visit_time" class="spot-time">{{ spot.visit_time }}{{ spot.duration_min ? ` (${spot.duration_min}分)` : '' }}</p>
              </div>
            </div>
            <div class="spot-actions">
              <!--
                @click.stop: クリックイベントの伝播（バブリング）を止める。
                これがないと、ボタンクリックが親の @click="selectSpot()" にも伝わってしまう。
              -->
              <button class="btn-text" @click.stop="openEdit(spot)">編集</button>
              <button class="btn-danger-text" @click.stop="deleteSpot(spot.id)">削除</button>
            </div>
          </div>

          <p v-if="spot.memo" class="spot-memo">{{ spot.memo }}</p>

          <div class="comments-section" @click.stop>
            <div v-if="!comments[spot.id] || comments[spot.id].length === 0" class="no-comments">コメントはまだありません。</div>
            <div v-for="c in comments[spot.id]" :key="c.id" class="comment">
              <span class="comment-author">{{ c.author_name }}</span>
              <span class="comment-content">{{ c.content }}</span>
              <span class="comment-time">{{ new Date(c.created_at).toLocaleString('ja-JP') }}</span>
            </div>
            <div class="comment-form">
              <!--
                v-model: input の値と ref を双方向バインドする。
                ユーザーが入力すると newComment[spot.id] が更新され、
                newComment[spot.id] を変更すると input の表示も変わる。
                @keyup.enter: Enter キーを離したときに postComment を実行する。
              -->
              <input v-model="newComment[spot.id]" placeholder="コメントを入力..." class="comment-input" @keyup.enter="postComment(spot.id)" />
              <button class="btn-primary" @click="postComment(spot.id)">送信</button>
            </div>
          </div>
        </div>
      </div>

      <div class="map-area" :class="{ 'hidden-mobile': activeTab === 'timeline' }">
        <!--
          :src="mapSrc": computed の mapSrc を動的に設定する。
          selectedSpotId が変わると mapSrc が再計算され、iframe の地図が自動で切り替わる。
        -->
        <iframe
          :src="mapSrc"
          class="map-iframe"
          frameborder="0"
          allowfullscreen
          referrerpolicy="no-referrer-when-downgrade"
        ></iframe>
      </div>
    </div>

    <!-- スポット追加モーダル -->
    <div v-if="showAddSpot" class="modal-overlay" @click.self="showAddSpot = false">
      <!-- @click.self: モーダルの外側（オーバーレイ自身）をクリックした時だけ閉じる。 -->
      <div class="modal">
        <h2>スポットを追加</h2>
        <div class="field">
          <label>スポット名 *</label>
          <input v-model="spotForm.name" placeholder="例：金閣寺" required />
        </div>
        <div class="field">
          <label>カテゴリ</label>
          <select v-model="spotForm.category">
            <option value="restaurant">🍽 飲食店</option>
            <option value="attraction">🏛 観光地</option>
            <option value="accommodation">🏨 宿泊</option>
            <option value="transport">🚌 交通</option>
            <option value="other">📍 その他</option>
          </select>
        </div>
        <div class="field">
          <label>住所</label>
          <input v-model="spotForm.address" placeholder="例：京都市北区..." />
        </div>
        <div class="field-row">
          <div class="field">
            <label>訪問時刻</label>
            <input v-model="spotForm.visit_time" type="time" />
          </div>
          <div class="field">
            <label>滞在時間（分）</label>
            <input v-model="spotForm.duration_min" type="number" placeholder="60" />
          </div>
        </div>
        <div class="field">
          <label>メモ</label>
          <textarea v-model="spotForm.memo" placeholder="予約情報など..." rows="3"></textarea>
        </div>
        <p v-if="addSpotError" class="spot-error">{{ addSpotError }}</p>
        <div class="modal-actions">
          <button class="btn-outline" @click="showAddSpot = false">キャンセル</button>
          <button class="btn-primary" :disabled="addSpotLoading" @click="addSpot">
            {{ addSpotLoading ? '追加中...' : '追加する' }}
          </button>
        </div>
      </div>
    </div>

    <!-- スポット編集モーダル -->
    <div v-if="showEditSpot" class="modal-overlay" @click.self="showEditSpot = false">
      <div class="modal">
        <h2>スポットを編集</h2>
        <div class="field">
          <label>スポット名 *</label>
          <input v-model="editForm.name" placeholder="例：金閣寺" required />
        </div>
        <div class="field">
          <label>カテゴリ</label>
          <select v-model="editForm.category">
            <option value="restaurant">🍽 飲食店</option>
            <option value="attraction">🏛 観光地</option>
            <option value="accommodation">🏨 宿泊</option>
            <option value="transport">🚌 交通</option>
            <option value="other">📍 その他</option>
          </select>
        </div>
        <div class="field">
          <label>住所</label>
          <input v-model="editForm.address" placeholder="例：京都市北区..." />
        </div>
        <div class="field-row">
          <div class="field">
            <label>訪問時刻</label>
            <input v-model="editForm.visit_time" type="time" />
          </div>
          <div class="field">
            <label>滞在時間（分）</label>
            <input v-model="editForm.duration_min" type="number" placeholder="60" />
          </div>
        </div>
        <div class="field">
          <label>メモ</label>
          <textarea v-model="editForm.memo" placeholder="予約情報など..." rows="3"></textarea>
        </div>
        <p v-if="editSpotError" class="spot-error">{{ editSpotError }}</p>
        <div class="modal-actions">
          <button class="btn-outline" @click="showEditSpot = false">キャンセル</button>
          <button class="btn-primary" :disabled="editSpotLoading" @click="saveEdit">
            {{ editSpotLoading ? '保存中...' : '保存する' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* scoped: このコンポーネントの要素だけにスタイルを適用する。
   他のコンポーネントの同名クラスに影響しない。
   Vue がコンパイル時に一意な属性（data-v-xxxxxx）を自動付与することで実現する。 */
.loading-full { display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #888; }

.trip-detail { min-height: 100vh; background: #f5f7fa; display: flex; flex-direction: column; }

.header {
  background: #fff;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.back-btn { background: none; border: none; cursor: pointer; font-size: 0.9rem; color: #42b983; padding: 0; }
.header-info { flex: 1; }
.header-info h1 { margin: 0; font-size: 1.2rem; color: #2c3e50; }
.dates { font-size: 0.8rem; color: #888; }

.tabs { display: flex; background: #fff; border-bottom: 1px solid #eee; }
.tabs button {
  flex: 1; padding: 12px; border: none; background: none;
  cursor: pointer; font-size: 0.9rem; color: #666; border-bottom: 2px solid transparent;
}
.tabs button.active { color: #42b983; border-bottom-color: #42b983; }

.workspace { display: flex; flex: 1; overflow: hidden; }

.timeline {
  width: 50%; min-width: 320px; padding: 20px;
  overflow-y: auto; background: #f5f7fa;
}
.map-area { flex: 1; position: relative; }
.map-iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; }

.timeline-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.timeline-header h2 { margin: 0; font-size: 1.1rem; color: #2c3e50; }

.empty-spots { text-align: center; padding: 40px 0; color: #aaa; font-size: 0.9rem; }

.spot-item { background: #fff; border-radius: 10px; padding: 16px; margin-bottom: 12px; border: 2px solid transparent; transition: border-color 0.15s; cursor: pointer; }
.spot-item:hover { border-color: #a8e6cf; }
.spot-selected { border-color: #42b983; background: #f0faf6; }
.spot-header { display: flex; justify-content: space-between; align-items: flex-start; }
.spot-left { display: flex; gap: 10px; align-items: flex-start; }
.category-badge { font-size: 0.75rem; white-space: nowrap; padding-top: 2px; }
.spot-left strong { font-size: 0.95rem; color: #2c3e50; }
.spot-address, .spot-time { margin: 2px 0 0; font-size: 0.8rem; color: #888; }
.spot-actions { display: flex; gap: 8px; flex-shrink: 0; }
.btn-text { background: none; border: none; color: #42b983; cursor: pointer; font-size: 0.8rem; padding: 0; }
.btn-danger-text { background: none; border: none; color: #e74c3c; cursor: pointer; font-size: 0.8rem; padding: 0; }
.spot-memo { font-size: 0.85rem; color: #666; margin: 8px 0 0; background: #f9f9f9; padding: 8px; border-radius: 6px; }

.comments-section { margin-top: 12px; border-top: 1px solid #f0f0f0; padding-top: 12px; }
.no-comments { font-size: 0.8rem; color: #bbb; margin-bottom: 8px; }
.comment { display: flex; gap: 8px; margin-bottom: 8px; font-size: 0.85rem; align-items: baseline; }
.comment-author { font-weight: bold; color: #42b983; white-space: nowrap; }
.comment-content { color: #444; flex: 1; }
.comment-time { font-size: 0.7rem; color: #bbb; white-space: nowrap; }
.comment-form { display: flex; gap: 8px; margin-top: 8px; }
.comment-name { width: 100px; padding: 6px 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; flex-shrink: 0; }
.comment-input { flex: 1; padding: 6px 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; }

.btn-primary { background: #42b983; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 0.9rem; }
.btn-primary:hover { background: #369870; }
.btn-outline { background: transparent; color: #42b983; border: 1px solid #42b983; padding: 7px 14px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; text-decoration: none; display: inline-block; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
.modal { background: #fff; border-radius: 12px; padding: 28px; width: 100%; max-width: 440px; max-height: 90vh; overflow-y: auto; }
.modal h2 { margin: 0 0 20px; font-size: 1.2rem; }
.field { margin-bottom: 14px; }
.field-row { display: flex; gap: 12px; }
.field-row .field { flex: 1; }
label { display: block; font-size: 0.85rem; color: #666; margin-bottom: 4px; }
input, select, textarea { width: 100%; padding: 9px 11px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.9rem; box-sizing: border-box; }
.spot-error { color: #e74c3c; font-size: 0.82rem; margin: 8px 0 0; }
.modal-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 16px; }

@media (max-width: 768px) {
  .workspace { flex-direction: column; }
  .timeline { width: 100%; }
  .map-area { min-height: 300px; }
  .mobile-only { display: flex; }
  .hidden-mobile { display: none !important; }
}
@media (min-width: 769px) {
  .tabs { display: none; }
}
</style>
