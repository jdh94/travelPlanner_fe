<script setup lang="ts">
// Vue Composition API: setup() 関数の中でリアクティブな状態・ロジックを定義する。
// <script setup> は setup() の糖衣構文（シンタックスシュガー）で、return が不要になる。
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTripsStore } from '@/stores/trips'
import { commentsApi, expensesApi, membersApi, type Comment, type Expense, type TripMember } from '@/api/trips'
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

// --- スポット別費用 ---
// spotExpenses: スポットID → 費用リスト の辞書（comments と同じパターン）。
const spotExpenses = ref<Record<string, Expense[]>>({})
// showExpenseForm: スポットIDをキーに「費用追加フォームを表示するか」を管理する。
const showExpenseForm = ref<Record<string, boolean>>({})
// tripMembers: 支払者・参加者の選択肢に使う旅行メンバーリスト。
const tripMembers = ref<TripMember[]>([])
// expenseForm: スポットIDをキーに入力中のフォーム値を管理する。
const expenseForm = ref<Record<string, {
  name: string; amount: string; payer: number | null; participantIds: number[]
}>>({})

// スポットの費用フォームの初期値を返す。
function defaultExpenseForm(members: TripMember[]) {
  return {
    name: '',
    amount: '',
    payer: members[0]?.id ?? null,
    participantIds: members.map(m => m.id),
  }
}

// 指定スポットの費用一覧を取得する（まだ取得していない場合のみ）。
async function loadSpotExpenses(spotId: string) {
  if (spotExpenses.value[spotId]) return
  const { data } = await expensesApi.listBySpot(hashUrl, spotId)
  spotExpenses.value[spotId] = data
}

// 費用追加フォームを開く。
function openExpenseForm(spotId: string) {
  // フォームの初期値をセット（全メンバー参加者として選択済みにする）。
  expenseForm.value[spotId] = defaultExpenseForm(tripMembers.value)
  showExpenseForm.value[spotId] = true
}

// 費用を登録してリストに追加する。
async function addSpotExpense(spotId: string) {
  const form = expenseForm.value[spotId]
  if (!form.name.trim()) { alert('費用名を入力してください。'); return }
  if (!form.amount || Number(form.amount) <= 0) { alert('金額を入力してください。'); return }
  if (!form.payer) { alert('支払者を選択してください。'); return }
  if (form.participantIds.length === 0) { alert('参加者を1人以上選択してください。'); return }

  const { data } = await expensesApi.create(hashUrl, {
    name: form.name,
    amount: form.amount,
    // trip の通貨をデフォルトで使う。
    currency: trip.value?.currency ?? 'JPY',
    payer: form.payer,
    participant_ids: form.participantIds,
    spot: spotId,
  })
  // リストの末尾に追加（再取得しないので高速）。
  if (!spotExpenses.value[spotId]) spotExpenses.value[spotId] = []
  spotExpenses.value[spotId].push(data)
  showExpenseForm.value[spotId] = false
  showToast(`「${data.name}」を追加しました`)
}

// 費用を削除する。
async function deleteSpotExpense(spotId: string, expenseId: string) {
  if (!confirm('この費用を削除しますか？')) return
  await expensesApi.delete(expenseId)
  spotExpenses.value[spotId] = spotExpenses.value[spotId].filter(e => e.id !== expenseId)
  showToast('費用を削除しました')
}

// そのスポットの費用合計を計算する。
function spotTotal(spotId: string): string {
  const list = spotExpenses.value[spotId] ?? []
  const total = list.reduce((sum, e) => sum + Number(e.amount), 0)
  return total.toLocaleString()
}

// トースト通知: 削除などの操作後に画面下部に一瞬表示するポップアップ。
const toastMessage = ref('')
const toastVisible = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | null = null

// showToast(): メッセージを受け取り、2.5秒後に自動で消えるトーストを表示する。
// setTimeout: 指定ミリ秒後に1回だけコールバックを実行するブラウザAPI。
function showToast(message: string) {
  // 前のタイマーが残っていたらキャンセルする（連続削除時に表示がリセットされる）。
  if (toastTimer) clearTimeout(toastTimer)
  toastMessage.value = message
  toastVisible.value = true
  toastTimer = setTimeout(() => {
    toastVisible.value = false
  }, 2500)
}
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
    // 旅行データとメンバーリストを並行取得する。
    const [, memRes] = await Promise.all([
      tripsStore.fetchTrip(hashUrl),
      membersApi.list(hashUrl),
    ])
    tripMembers.value = memRes.data
  } catch (e: any) {
    if (e.response?.data?.pin_required) {
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
  // 削除前にスポット名を取得しておく（削除後は参照できなくなるため）。
  const spotName = trip.value?.spots.find(s => s.id === id)?.name ?? 'スポット'
  await tripsStore.deleteSpot(hashUrl, id)
  if (selectedSpotId.value === id) {
    selectedSpotId.value = trip.value?.spots[0]?.id ?? null
  }
  // 削除成功後にトースト通知を表示する。
  showToast(`「${spotName}」を削除しました`)
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
      <RouterLink :to="`/trips/${hashUrl}/expenses`" class="btn-outline">費用</RouterLink>
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

          <!-- 費用セクション -->
          <!--
            @click.stop: スポットカード全体のクリック（selectSpot）に伝播しないようにする。
            @vue:mounted や @focus でなく、ボタンクリック時だけ費用をロードする遅延取得にする。
          -->
          <div class="spot-expenses-section" @click.stop>
            <div class="spot-expenses-header">
              <span class="expenses-label">💰 費用</span>
              <!--
                v-if / v-else: 費用が読み込まれているかどうかで表示を切り替える。
                まだ取得していないスポットは「タップして表示」と表示する。
              -->
              <span v-if="spotExpenses[spot.id]" class="expenses-total">
                合計 {{ spotTotal(spot.id) }} {{ trip.currency }}
              </span>
              <button
                class="btn-expense-toggle"
                @click="loadSpotExpenses(spot.id)"
              >{{ spotExpenses[spot.id] ? '' : '▼ 表示' }}</button>
            </div>

            <!-- 費用一覧（ロード済みの場合だけ表示） -->
            <template v-if="spotExpenses[spot.id]">
              <div v-if="spotExpenses[spot.id].length === 0" class="no-expenses">
                費用はまだありません。
              </div>
              <div v-for="exp in spotExpenses[spot.id]" :key="exp.id" class="expense-row">
                <div class="expense-row-main">
                  <span class="expense-row-name">{{ exp.name }}</span>
                  <span class="expense-row-payer">{{ exp.payer_name }}</span>
                </div>
                <div class="expense-row-right">
                  <span class="expense-row-amount">{{ Number(exp.amount).toLocaleString() }} {{ exp.currency }}</span>
                  <button class="btn-expense-del" @click="deleteSpotExpense(spot.id, exp.id)">✕</button>
                </div>
              </div>

              <!-- 費用追加フォーム（トグル式） -->
              <div v-if="!showExpenseForm[spot.id]" class="expense-add-row">
                <button class="btn-add-expense" @click="openExpenseForm(spot.id)">＋ 費用を追加</button>
              </div>
              <div v-else class="expense-inline-form">
                <input
                  v-model="expenseForm[spot.id].name"
                  placeholder="費用名（例: ランチ）"
                  class="expense-input"
                />
                <div class="expense-form-row">
                  <input
                    v-model="expenseForm[spot.id].amount"
                    type="number"
                    placeholder="金額"
                    class="expense-input expense-input-amount"
                  />
                  <!-- 支払者セレクト -->
                  <select v-model="expenseForm[spot.id].payer" class="expense-select">
                    <option v-for="m in tripMembers" :key="m.id" :value="m.id">
                      {{ m.user_name }}
                    </option>
                  </select>
                </div>
                <!-- 参加者チェックボックス -->
                <div class="expense-participants">
                  <label v-for="m in tripMembers" :key="m.id" class="expense-check-label">
                    <input
                      type="checkbox"
                      :value="m.id"
                      v-model="expenseForm[spot.id].participantIds"
                    />
                    {{ m.user_name }}
                  </label>
                </div>
                <div class="expense-form-actions">
                  <button class="btn-expense-cancel" @click="showExpenseForm[spot.id] = false">キャンセル</button>
                  <button class="btn-expense-save" @click="addSpotExpense(spot.id)">追加</button>
                </div>
              </div>
            </template>
          </div>

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

    <!--
      トースト通知。
      Transition: Vue の組み込みコンポーネント。v-if/v-show と組み合わせて
      要素の表示・非表示にCSSアニメーションを付けられる。
      name="toast" → .toast-enter-active などのCSSクラスが自動で付与される。
    -->
    <Transition name="toast">
      <div v-if="toastVisible" class="toast">
        <span class="toast-icon">✓</span>
        {{ toastMessage }}
      </div>
    </Transition>
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

/* スポット別費用セクション */
.spot-expenses-section {
  margin-top: 10px;
  border-top: 1px solid #f0f0f0;
  padding-top: 10px;
}
.spot-expenses-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.expenses-label { font-size: 0.82rem; font-weight: 600; color: #555; }
.expenses-total { font-size: 0.8rem; color: #42b983; font-weight: 600; margin-left: auto; }
.btn-expense-toggle {
  background: none; border: none; font-size: 0.78rem; color: #42b983;
  cursor: pointer; padding: 2px 6px; margin-left: auto;
}
.no-expenses { font-size: 0.78rem; color: #bbb; padding: 4px 0; }
.expense-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px dashed #f0f0f0;
  gap: 8px;
}
.expense-row-main { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.expense-row-name { font-size: 0.85rem; font-weight: 500; color: #2c3e50; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.expense-row-payer { font-size: 0.75rem; color: #888; }
.expense-row-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.expense-row-amount { font-size: 0.85rem; font-weight: 600; color: #e74c3c; }
.btn-expense-del {
  background: none; border: none; color: #ccc; font-size: 0.75rem;
  cursor: pointer; padding: 1px 4px;
}
.btn-expense-del:hover { color: #e74c3c; }
.expense-add-row { padding: 6px 0 2px; }
.btn-add-expense {
  background: none; border: 1px dashed #42b983; color: #42b983;
  border-radius: 6px; padding: 4px 10px; font-size: 0.78rem; cursor: pointer;
  width: 100%;
}
.btn-add-expense:hover { background: #f0faf6; }
.expense-inline-form { margin-top: 6px; display: flex; flex-direction: column; gap: 6px; }
.expense-input {
  width: 100%; padding: 6px 9px; border: 1px solid #ddd; border-radius: 7px;
  font-size: 0.85rem; box-sizing: border-box;
}
.expense-input:focus { outline: none; border-color: #42b983; }
.expense-form-row { display: flex; gap: 6px; }
.expense-input-amount { flex: 1; }
.expense-select {
  flex: 1; padding: 6px 8px; border: 1px solid #ddd; border-radius: 7px;
  font-size: 0.85rem; box-sizing: border-box;
}
.expense-participants { display: flex; flex-wrap: wrap; gap: 6px; }
.expense-check-label {
  display: flex; align-items: center; gap: 4px; font-size: 0.8rem;
  padding: 3px 8px; background: #f5f5f5; border-radius: 6px; cursor: pointer;
}
.expense-check-label input[type="checkbox"] { accent-color: #42b983; }
.expense-form-actions { display: flex; justify-content: flex-end; gap: 8px; }
.btn-expense-cancel {
  background: #f0f0f0; border: none; border-radius: 6px;
  padding: 5px 12px; font-size: 0.8rem; cursor: pointer;
}
.btn-expense-save {
  background: #42b983; color: #fff; border: none; border-radius: 6px;
  padding: 5px 14px; font-size: 0.8rem; font-weight: 600; cursor: pointer;
}
.btn-expense-save:hover { background: #369f73; }

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

/* トースト通知 */
.toast {
  position: fixed;
  bottom: 28px;
  left: 50%;
  /* translateX(-50%): left:50% で左端が中央になるので、自身の幅の半分だけ左にずらして中央揃えにする。 */
  transform: translateX(-50%);
  background: #2c3e50;
  color: #fff;
  padding: 12px 22px;
  border-radius: 24px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  white-space: nowrap;
  z-index: 9999;
}

.toast-icon {
  background: #42b983;
  color: #fff;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  flex-shrink: 0;
}

/* Transition のアニメーション。
   enter: 非表示 → 表示のアニメーション
   leave: 表示 → 非表示のアニメーション */
.toast-enter-active  { transition: opacity 0.25s ease, transform 0.25s ease; }
.toast-leave-active  { transition: opacity 0.3s ease, transform 0.3s ease; }
.toast-enter-from    { opacity: 0; transform: translateX(-50%) translateY(12px); }
.toast-leave-to      { opacity: 0; transform: translateX(-50%) translateY(12px); }
</style>
