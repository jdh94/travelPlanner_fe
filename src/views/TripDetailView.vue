<script setup lang="ts">
// Vue Composition API: setup() 関数の中でリアクティブな状態・ロジックを定義する。
// <script setup> は setup() の糖衣構文（シンタックスシュガー）で、return が不要になる。
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useTripsStore } from '@/stores/trips'
import { commentsApi, expensesApi, membersApi, type Comment, type Expense, type TripMember } from '@/api/trips'
import type { Spot } from '@/api/trips'

// useRoute(): 現在のルート情報（URLパラメータ、クエリ等）を取得する。
const { t, locale } = useI18n()
const route = useRoute()
// useRouter(): プログラム的なページ遷移（push/replace）を行う。
const router = useRouter()
// ストアのインスタンスを取得する。どこで呼んでも同じインスタンス。
const tripsStore = useTripsStore()

const hashUrl = route.params.hashUrl as string
const tripDeleted = ref(false)
const activeTab = ref<'timeline' | 'map'>('timeline')
const showAddSpot = ref(false)
const addSpotError = ref('')
const addSpotLoading = ref(false)
// Record<string, Comment[]>: スポットIDをキーにしてコメント配列を管理する辞書型。
// { "spot-id-1": [comment1, comment2], "spot-id-2": [] } のような構造。
const comments = ref<Record<string, Comment[]>>({})
const newComment = ref<Record<string, string>>({})
const showCommentForm = ref<Record<string, boolean>>({})
const selectedSpotId = ref<string | null>(null)

const showEditSpot = ref(false)
const editSpotError = ref('')
const editSpotLoading = ref(false)

// --- スポット別費用 ---
// spotExpenses: スポットID → 費用リスト の辞書（comments と同じパターン）。
const spotExpenses = ref<Record<string, Expense[]>>({})
// showExpenseForm: スポットIDをキーに「費用追加フォームを表示するか」を管理する。
const showExpenseForm = ref<Record<string, boolean>>({})
// tripMembers: ストアのtrip.membersを参照する（joinなどで更新されると自動反映）
const tripMembers = computed<TripMember[]>(() => trip.value?.members ?? [])
// expenseForm: スポットIDをキーに入力中のフォーム値を管理する。
const expenseForm = ref<Record<string, {
  name: string; amount: string; currency: string; payer: number | null; participantIds: number[]
}>>({})

// 費用編集用のstate
const editingExpenseId = ref<string | null>(null)
const editExpenseForm = ref<{
  name: string; amount: string; currency: string; payer: number | null; participantIds: number[]
}>({ name: '', amount: '', currency: 'JPY', payer: null, participantIds: [] })

// スポットの費用フォームの初期値を返す。
function defaultExpenseForm(members: TripMember[], currency: string) {
  return {
    name: '',
    amount: '',
    currency,
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
  // スポットの通貨 → なければ旅行の通貨 をデフォルトにする。
  const spot = trip.value?.spots.find(s => s.id === spotId)
  const defaultCurrency = spot?.currency || trip.value?.currency || 'JPY'
  expenseForm.value[spotId] = defaultExpenseForm(tripMembers.value, defaultCurrency)
  showExpenseForm.value[spotId] = true
}

// 費用を登録してリストに追加する。
async function addSpotExpense(spotId: string) {
  const form = expenseForm.value[spotId]
  if (!form.name.trim()) { alert(t('expense.validName')); return }
  if (!form.amount || Number(form.amount) <= 0) { alert(t('expense.validAmount')); return }
  if (!form.payer) { alert(t('expense.validPayer')); return }
  if (form.participantIds.length === 0) { alert(t('expense.validParticipants')); return }

  const { data } = await expensesApi.create(hashUrl, {
    name: form.name,
    amount: form.amount,
    currency: form.currency,
    payer: form.payer,
    participant_ids: form.participantIds,
    spot: spotId,
  })
  // リストの末尾に追加（再取得しないので高速）。
  if (!spotExpenses.value[spotId]) spotExpenses.value[spotId] = []
  spotExpenses.value[spotId].push(data)
  showExpenseForm.value[spotId] = false
  showToast(t('tripDetail.expenseAdded', { name: data.name }))
}

// 費用を削除する。
async function deleteSpotExpense(spotId: string, expenseId: string) {
  if (!confirm(t('tripDetail.deleteExpenseConfirm'))) return
  await expensesApi.delete(expenseId)
  spotExpenses.value[spotId] = spotExpenses.value[spotId].filter(e => e.id !== expenseId)
  showToast(t('tripDetail.expenseDeleted'))
}

// 費用編集フォームを開く。
function openEditExpense(exp: Expense) {
  editingExpenseId.value = exp.id
  editExpenseForm.value = {
    name: exp.name,
    amount: String(Math.floor(Number(exp.amount))),
    currency: exp.currency,
    payer: exp.payer,
    participantIds: [...exp.participant_ids],
  }
}

// 費用を更新する。
async function saveEditExpense(spotId: string) {
  if (!editingExpenseId.value) return
  const form = editExpenseForm.value
  if (!form.name.trim()) { alert(t('expense.validName')); return }
  if (!form.amount || Number(form.amount) <= 0) { alert(t('expense.validAmount')); return }
  if (!form.payer) { alert(t('expense.validPayer')); return }
  if (form.participantIds.length === 0) { alert(t('expense.validParticipants')); return }
  const { data } = await expensesApi.update(editingExpenseId.value, {
    name: form.name,
    amount: form.amount,
    currency: form.currency,
    payer: form.payer,
    participant_ids: form.participantIds,
  })
  const list = spotExpenses.value[spotId]
  if (list) {
    const idx = list.findIndex(e => e.id === editingExpenseId.value)
    if (idx !== -1) list[idx] = data
  }
  editingExpenseId.value = null
  showToast(t('common.save') + 'しました')
}

// そのスポットの費用合計を計算する。
function spotTotal(spotId: string): string {
  const list = spotExpenses.value[spotId] ?? []
  const total = list.reduce((sum, e) => sum + Number(e.amount), 0)
  return total.toLocaleString()
}

// 数字文字列をカンマ区切りで表示用にフォーマットする。内部値は数字のみで保持。
function formatNumberDisplay(val: string): string {
  if (!val) return ''
  // 小数点付き文字列（"1000.00"）を整数に変換してからフォーマット
  const num = Math.floor(Number(val))
  if (isNaN(num)) return ''
  return num.toLocaleString('en-US')
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
  address: '',
  visit_date: '',
  visit_time: '',
  memo: '',
  currency: '',
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
  loadSpotExpenses(spotId)
}

const spotForm = ref({
  name: '',
  address: '',
  visit_date: '',
  visit_time: '',
  memo: '',
  currency: 'JPY',
})

function openAddSpot() {
  spotForm.value = {
    name: '',
    address: '',
    visit_date: '',
    visit_time: '',
    memo: '',
    currency: trip.value?.currency ?? 'JPY',
  }
  showAddSpot.value = true
}

// onMounted: コンポーネントが DOM にマウントされた直後に実行される。
// ここで API からデータを取得するのが一般的なパターン。
onMounted(async () => {
  try {
    // 旅行データを取得する（メンバーはtripデータに含まれる）。
    await tripsStore.fetchTrip(hashUrl)
    // 全スポットの費用を一括ロード（クリック不要で表示）
    const spots = tripsStore.currentTrip?.spots ?? []
    await Promise.all(spots.map(s => loadSpotExpenses(s.id)))
  } catch (e: any) {
    if (e.response?.data?.pin_required) {
      localStorage.removeItem(`pin_token_${hashUrl}`)
      router.push(`/trips/${hashUrl}/pin`)
    } else if (e.response?.data?.deleted) {
      tripDeleted.value = true
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
      visit_date: spotForm.value.visit_date || undefined,
      visit_time: spotForm.value.visit_time || undefined,
    })
    selectedSpotId.value = spot.id
    showAddSpot.value = false
    spotForm.value = { name: '', address: '', visit_date: '', visit_time: '', memo: '', currency: trip.value?.currency ?? 'JPY' }
    loadSpotExpenses(spot.id)
  } catch (e: any) {
    // DRF のバリデーションエラーは { field: ["エラーメッセージ"] } 形式で返ってくる。
    const data = e.response?.data
    if (data && typeof data === 'object') {
      addSpotError.value = Object.keys(data).map((k: string) => {
        const v: unknown = (data as Record<string, unknown>)[k]
        return `${k}: ${Array.isArray(v) ? (v as string[]).join(', ') : String(v)}`
      }).join(' / ')
    } else {
      addSpotError.value = t('tripDetail.addSpotFailed')
    }
  } finally {
    addSpotLoading.value = false
  }
}

function openEdit(spot: Spot) {
  editingSpotId.value = spot.id
  editForm.value = {
    name: spot.name,
    address: spot.address ?? '',
    visit_date: spot.visit_date ?? '',
    visit_time: spot.visit_time ?? '',
    memo: spot.memo ?? '',
    currency: spot.currency || trip.value?.currency || 'JPY',
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
      visit_date: editForm.value.visit_date || undefined,
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
      editSpotError.value = t('tripDetail.editSpotFailed')
    }
  } finally {
    editSpotLoading.value = false
  }
}

async function deleteSpot(id: string) {
  if (!confirm(t('tripDetail.deleteSpotConfirm'))) return
  // 削除前にスポット名を取得しておく（削除後は参照できなくなるため）。
  const spotName = trip.value?.spots.find(s => s.id === id)?.name ?? ''
  await tripsStore.deleteSpot(hashUrl, id)
  if (selectedSpotId.value === id) {
    selectedSpotId.value = trip.value?.spots[0]?.id ?? null
  }
  // 削除成功後にトースト通知を表示する。
  showToast(t('tripDetail.spotDeleted', { name: spotName }))
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
  showCommentForm.value[spotId] = false
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
  <div v-if="tripsStore.loading" class="loading-full">{{ t('common.loading') }}</div>

  <div v-else-if="tripDeleted" class="deleted-page">
    <div class="deleted-card">
      <div class="deleted-icon">🗑️</div>
      <h2>{{ t('tripDetail.deletedTitle') }}</h2>
      <p>{{ t('tripDetail.deletedDesc') }}</p>
      <button class="btn-back" @click="router.push('/')">{{ t('tripDetail.backToHome') }}</button>
    </div>
  </div>

  <div v-else-if="trip" class="trip-detail">
    <header class="header">
      <button class="back-btn" @click="router.push('/')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="header-info">
        <h1>{{ trip.title }}</h1>
        <span class="dates">{{ formatDate(trip.start_date) }} 〜 {{ formatDate(trip.end_date) }}</span>
      </div>
      <div class="header-actions">
        <!-- 費用：グリーン -->
        <RouterLink :to="`/trips/${hashUrl}/expenses`" class="action-btn action-btn--expense" :title="t('nav.expenses')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          <span>{{ t('nav.expenses') }}</span>
        </RouterLink>
        <!-- 管理：スレートブルー -->
        <RouterLink :to="`/trips/${hashUrl}/manage`" class="action-btn action-btn--manage" :title="t('nav.manage')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>{{ t('nav.manage') }}</span>
        </RouterLink>
        <!-- 共有：オレンジ -->
        <RouterLink :to="`/trips/${hashUrl}/share`" class="action-btn action-btn--share" :title="t('nav.share')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          <span>{{ t('nav.share') }}</span>
        </RouterLink>
      </div>
    </header>

    <div class="tabs mobile-only">
      <button :class="{ active: activeTab === 'timeline' }" @click="activeTab = 'timeline'">
        {{ t('tripDetail.tabTimeline') }}
      </button>
      <button :class="{ active: activeTab === 'map' }" @click="activeTab = 'map'">
        {{ t('tripDetail.tabMap') }}
      </button>
    </div>

    <div class="workspace">
      <div class="timeline" :class="{ 'hidden-mobile': activeTab === 'map' }">
        <div class="timeline-header">
          <h2>{{ t('tripDetail.spotList') }}</h2>
          <button class="btn-primary" @click="openAddSpot">{{ t('tripDetail.addSpot') }}</button>
        </div>

        <div v-if="trip.spots.length === 0" class="empty-spots">
          {{ t('tripDetail.emptySpots') }}
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
              <div class="spot-info">
                <strong>{{ spot.name }}</strong>
                <p v-if="spot.address" class="spot-address">{{ spot.address }}</p>
                <div class="spot-time-row">
                  <span v-if="spot.visit_date" class="spot-date">📅 {{ spot.visit_date }}</span>
                  <span v-if="spot.visit_time" class="spot-time">🕐 {{ spot.visit_time }}</span>
                </div>
              </div>
            </div>
            <div class="spot-actions">
              <button class="btn-action-edit" @click.stop="openEdit(spot)">{{ t('common.edit') }}</button>
              <button class="btn-action-del" @click.stop="deleteSpot(spot.id)">{{ t('common.delete') }}</button>
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
              <span class="expenses-label">💰 {{ t('tripDetail.expense') }}</span>
              <span v-if="spotExpenses[spot.id]" class="expenses-total">
                {{ t('tripDetail.expenseTotal', { amount: spotTotal(spot.id), currency: trip.currency }) }}
              </span>
            </div>

            <!-- 費用一覧（ロード済みの場合だけ表示） -->
            <template v-if="spotExpenses[spot.id]">
              <div v-if="spotExpenses[spot.id].length === 0" class="no-expenses">
                {{ t('expense.noExpenses') }}
              </div>
              <div v-for="exp in spotExpenses[spot.id]" :key="exp.id" class="expense-row">
                <!-- 通常表示 -->
                <template v-if="editingExpenseId !== exp.id">
                  <div class="expense-row-info">
                    <span class="expense-row-name">{{ exp.name }}</span>
                    <span class="expense-row-meta">
                      💳 {{ exp.payer_name }} &nbsp;👥 {{ exp.participant_names?.join(', ') ?? '' }}
                    </span>
                  </div>
                  <div class="expense-row-right">
                    <span class="expense-row-amount">{{ Number(exp.amount).toLocaleString() }} {{ exp.currency }}</span>
                    <button class="btn-expense-edit" @click="openEditExpense(exp)" :title="t('common.edit')">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button class="btn-expense-del" @click="deleteSpotExpense(spot.id, exp.id)" :title="t('common.delete')">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                  </div>
                </template>
                <!-- 編集フォーム -->
                <template v-else>
                  <div class="expense-edit-form">
                    <input v-model="editExpenseForm.name" :placeholder="t('tripDetail.expenseName')" class="expense-input" />
                    <div class="expense-form-row">
                      <div class="expense-amount-wrap">
                        <input
                          :value="formatNumberDisplay(editExpenseForm.amount)"
                          type="tel" inputmode="numeric" placeholder="0"
                          class="expense-input expense-input-amount"
                          @input="editExpenseForm.amount = ($event.target as HTMLInputElement).value.replace(/[^0-9]/g, '')"
                          @compositionend="editExpenseForm.amount = ($event.target as HTMLInputElement).value.replace(/[^0-9]/g, '')"
                        />
                        <select v-model="editExpenseForm.currency" class="expense-currency-inline">
                          <option value="JPY">¥ JPY</option>
                          <option value="KRW">₩ KRW</option>
                          <option value="USD">$ USD</option>
                        </select>
                      </div>
                      <div class="expense-payer-wrap">
                        <span class="expense-field-label">{{ t('tripDetail.payer') }}</span>
                        <select v-model="editExpenseForm.payer" class="expense-select">
                          <option v-for="m in tripMembers" :key="m.id" :value="m.id">{{ m.user_name }}</option>
                        </select>
                      </div>
                    </div>
                    <div class="expense-participants-wrap">
                      <span class="expense-field-label">{{ t('tripDetail.participants') }}</span>
                      <div class="expense-participants">
                        <label v-for="m in tripMembers" :key="m.id" class="expense-check-label">
                          <input type="checkbox" :value="m.id" v-model="editExpenseForm.participantIds" />
                          {{ m.user_name }}
                        </label>
                      </div>
                    </div>
                    <div class="expense-form-actions">
                      <button class="btn-expense-cancel" @click="editingExpenseId = null">{{ t('common.cancel') }}</button>
                      <button class="btn-expense-save" @click="saveEditExpense(spot.id)">{{ t('common.save') }}</button>
                    </div>
                  </div>
                </template>
              </div>

              <!-- 費用追加フォーム（トグル式） -->
              <div v-if="!showExpenseForm[spot.id]" class="expense-add-row">
                <button class="btn-add-expense" @click="openExpenseForm(spot.id)">{{ t('tripDetail.addExpense') }}</button>
              </div>
              <div v-else class="expense-inline-form">
                <!-- 費用名 -->
                <input
                  v-model="expenseForm[spot.id].name"
                  :placeholder="t('tripDetail.expenseName')"
                  class="expense-input"
                />
                <!-- 金額 + 通貨 -->
                <div class="expense-form-row">
                  <div class="expense-amount-wrap">
                    <input
                      :value="formatNumberDisplay(expenseForm[spot.id].amount)"
                      type="tel"
                      inputmode="numeric"
                      placeholder="0"
                      class="expense-input expense-input-amount"
                      @input="expenseForm[spot.id].amount = ($event.target as HTMLInputElement).value.replace(/[^0-9]/g, '')"
                      @compositionend="expenseForm[spot.id].amount = ($event.target as HTMLInputElement).value.replace(/[^0-9]/g, '')"
                    />
                    <select v-model="expenseForm[spot.id].currency" class="expense-currency-inline">
                      <option value="JPY">¥ JPY</option>
                      <option value="KRW">₩ KRW</option>
                      <option value="USD">$ USD</option>
                    </select>
                  </div>
                  <!-- payer -->
                  <div class="expense-payer-wrap">
                    <span class="expense-field-label">{{ t('tripDetail.payer') }}</span>
                    <select v-model="expenseForm[spot.id].payer" class="expense-select">
                      <option v-for="m in tripMembers" :key="m.id" :value="m.id">
                        {{ m.user_name }}
                      </option>
                    </select>
                  </div>
                </div>
                <!-- participants -->
                <div class="expense-participants-wrap">
                  <span class="expense-field-label">{{ t('tripDetail.participants') }}</span>
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
                </div>
                <div class="expense-form-actions">
                  <button class="btn-expense-cancel" @click="showExpenseForm[spot.id] = false">{{ t('common.cancel') }}</button>
                  <button class="btn-expense-save" @click="addSpotExpense(spot.id)">{{ t('common.add') }}</button>
                </div>
              </div>
            </template>
          </div>

          <div v-if="selectedSpotId === spot.id" class="comments-section" @click.stop>
            <div v-for="c in comments[spot.id]" :key="c.id" class="comment">
              <span class="comment-author">{{ c.author_name }}</span>
              <span class="comment-content">{{ c.content }}</span>
              <span class="comment-time">{{ new Date(c.created_at).toLocaleString(locale === 'ko' ? 'ko-KR' : locale === 'ja' ? 'ja-JP' : 'en-US') }}</span>
            </div>
            <template v-if="showCommentForm[spot.id]">
              <div class="comment-form">
                <input v-model="newComment[spot.id]" :placeholder="t('tripDetail.commentPlaceholder')" class="comment-input" @keyup.enter="postComment(spot.id)" autofocus />
                <button class="btn-primary" @click="postComment(spot.id)">{{ t('tripDetail.postComment') }}</button>
              </div>
              <button class="btn-comment-cancel" @click="showCommentForm[spot.id] = false; newComment[spot.id] = ''">{{ t('common.cancel') }}</button>
            </template>
            <button v-else class="btn-add-comment" @click="showCommentForm[spot.id] = true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              {{ t('tripDetail.postComment') }}
            </button>
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

    <!-- Add Spot Modal -->
    <div v-if="showAddSpot" class="modal-overlay" @click.self="showAddSpot = false">
      <div class="modal">
        <h2>{{ t('tripDetail.addSpotTitle') }}</h2>
        <div class="field">
          <label>{{ t('tripDetail.spotName') }}</label>
          <input v-model="spotForm.name" :placeholder="t('tripDetail.spotNamePlaceholder')" required />
        </div>
        <div class="field">
          <label>{{ t('tripDetail.address') }}</label>
          <input v-model="spotForm.address" :placeholder="t('tripDetail.addressPlaceholder')" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>📅 日付</label>
            <div class="date-input-wrap">
              <input v-model="spotForm.visit_date" type="date" class="date-input-spot" />
              <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"
                @click="(($event.currentTarget as SVGElement).previousElementSibling as HTMLInputElement).showPicker()">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
          </div>
          <div class="field">
            <label>{{ t('tripDetail.visitTime') }}</label>
            <input v-model="spotForm.visit_time" type="time" />
          </div>
        </div>
        <div class="field">
          <label>{{ t('tripDetail.memo') }}</label>
          <textarea v-model="spotForm.memo" :placeholder="t('tripDetail.memoPlaceholder')" rows="3"></textarea>
        </div>
        <p v-if="addSpotError" class="spot-error">{{ addSpotError }}</p>
        <div class="modal-actions">
          <button class="btn-outline" @click="showAddSpot = false">{{ t('common.cancel') }}</button>
          <button class="btn-primary" :disabled="addSpotLoading" @click="addSpot">
            {{ addSpotLoading ? t('tripDetail.adding') : t('tripDetail.addSpotBtn') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Spot Modal -->
    <div v-if="showEditSpot" class="modal-overlay" @click.self="showEditSpot = false">
      <div class="modal">
        <h2>{{ t('tripDetail.editSpotTitle') }}</h2>
        <div class="field">
          <label>{{ t('tripDetail.spotName') }}</label>
          <input v-model="editForm.name" :placeholder="t('tripDetail.spotNamePlaceholder')" required />
        </div>
        <div class="field">
          <label>{{ t('tripDetail.address') }}</label>
          <input v-model="editForm.address" :placeholder="t('tripDetail.addressPlaceholder')" />
        </div>
        <div class="field-row">
          <div class="field">
            <label>📅 日付</label>
            <div class="date-input-wrap">
              <input v-model="editForm.visit_date" type="date" class="date-input-spot" />
              <svg class="cal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"
                @click="(($event.currentTarget as SVGElement).previousElementSibling as HTMLInputElement).showPicker()">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
          </div>
          <div class="field">
            <label>{{ t('tripDetail.visitTime') }}</label>
            <input v-model="editForm.visit_time" type="time" />
          </div>
        </div>
        <div class="field">
          <label>{{ t('tripDetail.memo') }}</label>
          <textarea v-model="editForm.memo" :placeholder="t('tripDetail.memoPlaceholder')" rows="3"></textarea>
        </div>
        <p v-if="editSpotError" class="spot-error">{{ editSpotError }}</p>
        <div class="modal-actions">
          <button class="btn-outline" @click="showEditSpot = false">{{ t('common.cancel') }}</button>
          <button class="btn-primary" :disabled="editSpotLoading" @click="saveEdit">
            {{ editSpotLoading ? t('tripDetail.saving') : t('tripDetail.saveBtn') }}
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
.deleted-page { min-height: 100vh; background: #f5f7fa; display: flex; align-items: center; justify-content: center; padding: 24px; }
.deleted-card { background: #fff; border-radius: 16px; padding: 48px 36px; text-align: center; max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
.deleted-icon { font-size: 3rem; margin-bottom: 16px; }
.deleted-card h2 { font-size: 1.2rem; color: #2c3e50; margin: 0 0 12px; }
.deleted-card p { font-size: 0.9rem; color: #888; margin: 0 0 28px; line-height: 1.6; }
.btn-back { background: #42b983; color: #fff; border: none; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-size: 0.9rem; }

.trip-detail { min-height: 100vh; background: #f5f7fa; display: flex; flex-direction: column; }

/* ヘッダー: モバイルで2行レイアウト */
.header {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  padding: 0 12px;
  height: 56px;
  box-shadow: 0 1px 0 rgba(0,0,0,0.07);
  position: sticky;
  top: 0;
  z-index: 50;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.back-btn {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  background: none; border: none; cursor: pointer;
  color: #42b983; border-radius: 8px; flex-shrink: 0;
  transition: background 0.15s;
}
.back-btn:hover { background: #f0faf6; }
.header-info { flex: 1; min-width: 0; }
.header-info h1 {
  margin: 0; font-size: 0.95rem; font-weight: 600;
  color: #1a2332; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  line-height: 1.3;
}
.dates { font-size: 0.7rem; color: #aaa; display: block; }
.action-btn {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 20px;
  font-size: 0.78rem; font-weight: 600;
  text-decoration: none; transition: all 0.15s;
  white-space: nowrap; flex-shrink: 0;
}
.action-btn svg { flex-shrink: 0; }
/* 費用：グリーン */
.action-btn--expense { background: #e8f5e9; color: #2e7d52; }
.action-btn--expense:hover, .action-btn--expense.router-link-active { background: #42b983; color: #fff; }
/* 管理：スレートブルー */
.action-btn--manage { background: #e8eaf6; color: #3949ab; }
.action-btn--manage:hover, .action-btn--manage.router-link-active { background: #3949ab; color: #fff; }
/* 共有：オレンジ */
.action-btn--share { background: #fff3e0; color: #e65100; }
.action-btn--share:hover, .action-btn--share.router-link-active { background: #f57c00; color: #fff; }

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

.spot-item {
  background: #fff; border-radius: 12px; padding: 14px 14px 10px;
  margin-bottom: 10px; border: 2px solid transparent;
  transition: border-color 0.15s; cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}
.spot-item:hover { border-color: #a8e6cf; }
.spot-selected { border-color: #42b983; background: #f0faf6; }
.spot-header { display: flex; align-items: flex-start; gap: 8px; }
.spot-left { display: flex; gap: 8px; align-items: flex-start; flex: 1; min-width: 0; }
.spot-info { flex: 1; min-width: 0; }
.category-badge { font-size: 0.85rem; white-space: nowrap; padding-top: 1px; flex-shrink: 0; }
.spot-info strong { font-size: 0.95rem; color: #2c3e50; display: block; }
.spot-address { margin: 2px 0 0; font-size: 0.78rem; color: #888; }
.spot-time-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 3px; }
.spot-date { font-size: 0.78rem; color: #42b983; font-weight: 500; }
.spot-time { font-size: 0.78rem; color: #888; }
.date-input-wrap {
  position: relative;
  width: 100%;
}
.date-input-spot {
  width: 100%;
  padding: 9px 36px 9px 11px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.9rem;
  box-sizing: border-box;
  cursor: pointer;
  background: #fff;
  /* ネイティブのカレンダーアイコンを非表示 */
  -webkit-appearance: none;
  appearance: none;
}
.date-input-spot::-webkit-calendar-picker-indicator { opacity: 0; width: 0; }
.date-input-spot:focus { outline: none; border-color: #42b983; }
.cal-icon {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: #42b983;
  cursor: pointer;
  pointer-events: all;
}
.spot-actions { display: flex; gap: 6px; flex-shrink: 0; }
.btn-action-edit {
  background: #f4f9ff; border: 1px solid #b8d4f0; color: #4a90d9;
  cursor: pointer; font-size: 0.78rem; font-weight: 500;
  padding: 4px 12px; border-radius: 6px; min-height: 30px;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.btn-action-edit:hover { background: #4a90d9; border-color: #4a90d9; color: #fff; }
.btn-action-del {
  background: #fff4f4; border: 1px solid #f0b8b8; color: #e74c3c;
  cursor: pointer; font-size: 0.78rem; font-weight: 500;
  padding: 4px 12px; border-radius: 6px; min-height: 30px;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.btn-action-del:hover { background: #e74c3c; border-color: #e74c3c; color: #fff; }
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

.no-expenses { font-size: 0.78rem; color: #bbb; padding: 4px 0; }
.expense-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px dashed #f0f0f0;
  gap: 8px;
}
.expense-row-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.expense-row-name { font-size: 0.85rem; font-weight: 500; color: #2c3e50; }
.expense-row-meta { font-size: 0.72rem; color: #999; margin-top: 2px; }
.expense-row-right { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.expense-row-amount { font-size: 0.85rem; font-weight: 600; color: #e74c3c; }
.btn-expense-edit {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  background: #f4f9ff; border: 1px solid #b8d4f0; color: #4a90d9;
  cursor: pointer; border-radius: 6px;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  flex-shrink: 0;
}
.btn-expense-edit:hover { background: #4a90d9; border-color: #4a90d9; color: #fff; }
.btn-expense-del {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  background: #fff4f4; border: 1px solid #f0b8b8; color: #e74c3c;
  cursor: pointer; border-radius: 6px;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  flex-shrink: 0;
}
.btn-expense-del:hover { background: #e74c3c; border-color: #e74c3c; color: #fff; }
.expense-edit-form { width: 100%; padding: 6px 0; }
.expense-add-row { padding: 6px 0 2px; }
.btn-add-expense {
  background: none; border: 1px dashed #42b983; color: #42b983;
  border-radius: 6px; padding: 4px 10px; font-size: 0.78rem; cursor: pointer;
  width: 100%;
}
.btn-add-expense:hover { background: #f0faf6; }
.expense-inline-form {
  margin-top: 8px;
  display: flex; flex-direction: column; gap: 8px;
  background: #f8fdf9;
  border: 1px solid #d4edd9;
  border-radius: 10px;
  padding: 12px;
}
.expense-input {
  width: 100%; padding: 7px 10px; border: 1px solid #ddd; border-radius: 7px;
  font-size: 0.88rem; box-sizing: border-box; background: #fff;
}
.expense-input:focus { outline: none; border-color: #42b983; }

/* 金額＋通貨 | 支払者 の2カラム */
.expense-form-row { display: flex; gap: 8px; align-items: flex-end; }

/* 金額入力と通貨セレクトを横並びでひとつのボックスに */
.expense-amount-wrap {
  flex: 1;
  display: flex;
  border: 1px solid #ddd;
  border-radius: 7px;
  overflow: hidden;
  background: #fff;
  min-width: 0;
}
.expense-amount-wrap:focus-within { border-color: #42b983; }
.expense-input-amount {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  border: none;
  outline: none;
  font-size: 0.88rem;
  box-sizing: border-box;
  background: transparent;
}
.expense-input-amount::-webkit-inner-spin-button,
.expense-input-amount::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.expense-input-amount[type=number] { -moz-appearance: textfield; }
.expense-currency-inline {
  flex-shrink: 0;
  border: none; border-left: 1px solid #ddd;
  padding: 0 8px; font-size: 0.82rem; color: #555;
  background: #f5f5f5; cursor: pointer; outline: none;
  width: 82px;
}

/* 支払者 */
.expense-payer-wrap { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.expense-field-label { font-size: 0.75rem; color: #888; font-weight: 500; }
.expense-select {
  width: 100%; padding: 7px 8px; border: 1px solid #ddd; border-radius: 7px;
  font-size: 0.88rem; box-sizing: border-box; background: #fff;
}
.expense-select:focus { outline: none; border-color: #42b983; }

/* 参加者 */
.expense-participants-wrap { display: flex; flex-direction: column; gap: 4px; }
.expense-participants { display: flex; flex-wrap: wrap; gap: 5px; }
.expense-check-label {
  display: flex; align-items: center; gap: 4px; font-size: 0.82rem;
  padding: 3px 9px; background: #fff; border: 1px solid #ddd;
  border-radius: 20px; cursor: pointer; transition: all 0.15s;
  white-space: nowrap;
}
.expense-check-label:has(input:checked) {
  background: #e8f7ef; border-color: #42b983; color: #2a8a5e;
}
.expense-check-label input[type="checkbox"] { accent-color: #42b983; }
.expense-form-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px; }
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
.btn-add-comment {
  display: inline-flex; align-items: center; gap: 5px;
  background: none; border: 1px dashed #b0d4c4; color: #42b983;
  font-size: 0.78rem; padding: 5px 12px; border-radius: 20px;
  cursor: pointer; transition: background 0.15s, border-color 0.15s;
  margin-top: 4px;
}
.btn-add-comment:hover { background: #f0faf6; border-color: #42b983; }
.btn-comment-cancel {
  background: none; border: none; color: #aaa; font-size: 0.75rem;
  cursor: pointer; margin-top: 4px; padding: 2px 4px;
}
.btn-comment-cancel:hover { color: #666; }
.comment { display: flex; gap: 8px; margin-bottom: 8px; font-size: 0.85rem; align-items: baseline; }
.comment-author { font-weight: bold; color: #42b983; white-space: nowrap; }
.comment-content { color: #444; flex: 1; }
.comment-time { font-size: 0.7rem; color: #bbb; white-space: nowrap; }
.comment-form { display: flex; gap: 8px; margin-top: 8px; }
.comment-name { width: 100px; padding: 6px 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; flex-shrink: 0; }
.comment-input { flex: 1; padding: 6px 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.85rem; }

.btn-primary { background: #42b983; color: #fff; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 0.9rem; white-space: nowrap; }
.btn-primary:hover { background: #369870; }
.btn-outline {
  background: transparent; color: #42b983; border: 1px solid #42b983;
  padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.82rem;
  text-decoration: none; display: inline-block; white-space: nowrap; flex-shrink: 0;
}

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
  .timeline { width: 100%; padding: 12px; }
  .map-area { min-height: 300px; }
  .mobile-only { display: flex; }
  .hidden-mobile { display: none !important; }

  /* スポットカード: モバイルでタッチターゲット拡大 */
  .spot-item { padding: 12px; }
  .btn-action-edit, .btn-action-del { min-height: 36px; padding: 6px 12px; font-size: 0.82rem; }

  /* 費用フォーム: 縦並びに変更 */
  .expense-form-row { flex-direction: column; }
  .expense-amount-wrap { width: 100%; }
  .expense-payer-wrap { width: 100%; }

  /* コメント入力 */
  .comment-form { flex-wrap: wrap; }
  .comment-input { min-width: 0; flex: 1 1 100%; }
  .comment-form .btn-primary { width: 100%; margin-top: 4px; padding: 10px; }

  /* タイムラインヘッダー */
  .timeline-header { margin-bottom: 12px; }
  .timeline-header h2 { font-size: 1rem; }
}

@media (max-width: 480px) {
  /* モバイルではテキスト非表示・アイコンのみ */
  .action-btn span { display: none; }
  .action-btn { padding: 8px; border-radius: 10px; }

  /* スポット追加ボタン */
  .btn-primary { padding: 8px 14px; font-size: 0.85rem; }
}

@media (min-width: 769px) {
  .tabs { display: none; }
  .header { padding: 0 24px; height: 60px; gap: 12px; }
  .header-info h1 { font-size: 1.05rem; }
  .icon-btn { width: 38px; height: 38px; }
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
