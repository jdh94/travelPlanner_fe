<template>
  <div class="expense-page">
    <!-- ヘッダー -->
    <header class="page-header">
      <button class="back-btn" @click="router.push(`/trips/${hashUrl}`)">← 戻る</button>
      <h1>費用・精算</h1>
    </header>

    <!-- タブ切り替え -->
    <div class="tabs">
      <button :class="{ active: activeTab === 'expenses' }" @click="activeTab = 'expenses'">
        {{ t('expense.tabExpenses') }}
      </button>
      <button :class="{ active: activeTab === 'settlement' }" @click="switchToSettlement">
        {{ t('expense.tabSettlement') }}
      </button>
    </div>

    <!-- ===== 費用一覧タブ ===== -->
    <div v-if="activeTab === 'expenses'">

      <!--
        スポットフィルターバー。
        「旅行全体」がデフォルト（selectedSpotId = null）。
        スポットを選ぶとそのスポットの費用だけ表示する。
      -->
      <div class="spot-filter-bar">
        <button
          class="spot-filter-btn"
          :class="{ active: selectedSpotId === null }"
          @click="selectSpot(null)"
        >
          {{ t('expense.allTrip') }}
        </button>
        <button
          v-for="spot in spots"
          :key="spot.id"
          class="spot-filter-btn"
          :class="{ active: selectedSpotId === spot.id }"
          @click="selectSpot(spot.id)"
        >
          📍 {{ spot.name }}
        </button>
      </div>

      <!-- 現在のビュータイトルと合計 -->
      <div class="current-scope-header">
        <span class="scope-label">
          {{ selectedSpotId === null ? '🌐 旅行全体' : '📍 ' + selectedSpotName }}
        </span>
        <span class="scope-total">合計 {{ currentTotal }} 円</span>
        <button class="add-btn" @click="openAddModal">{{ t('expense.addExpense') }}</button>
      </div>

      <!-- 費用がない場合 -->
      <div v-if="filteredExpenses.length === 0" class="empty-msg">
        {{ t('expense.noExpenses') }}
      </div>

      <!-- 費用カード一覧 -->
      <div v-for="expense in filteredExpenses" :key="expense.id" class="expense-card">
        <div class="expense-main">
          <div class="expense-info">
            <span class="expense-name">{{ expense.name }}</span>
            <span class="expense-date">{{ expense.date || '日付なし' }}</span>
          </div>
          <div class="expense-amount">
            {{ formatAmount(expense.amount) }} {{ expense.currency }}
          </div>
        </div>
        <div class="expense-meta">
          <span class="payer-badge">💳 {{ expense.payer_name }}</span>
          <span class="participants-label">
            {{ t('tripDetail.participants') }}: {{ expense.participant_names.join(', ') }}
          </span>
        </div>
        <!-- スポット名（旅行全体ビューのときだけ表示） -->
        <div v-if="selectedSpotId === null && expense.spot_name" class="expense-spot-tag">
          📍 {{ expense.spot_name }}
        </div>
        <div v-if="expense.memo" class="expense-memo">{{ expense.memo }}</div>
        <div class="expense-actions">
          <button class="edit-btn" @click="openEditModal(expense)">{{ t('expense.editBtn') }}</button>
          <button class="delete-btn" @click="deleteExpense(expense.id)">{{ t('expense.deleteBtn') }}</button>
        </div>
      </div>
    </div>

    <!-- ===== 精算タブ ===== -->
    <div v-if="activeTab === 'settlement'">
      <div v-if="loadingSettlement" class="loading">{{ t('expense.calculating') }}</div>

      <template v-else-if="settlementResult">
        <section class="settlement-section">
          <h2>{{ t('expense.balanceSummary') }}</h2>
          <div
            v-for="b in settlementResult.balance_summary"
            :key="b.member_id"
            class="balance-row"
            :class="{ positive: b.balance > 0, negative: b.balance < 0 }"
          >
            <span class="balance-name">{{ b.member_name }}</span>
            <span class="balance-amount">
              {{ b.balance > 0 ? '+' : '' }}{{ b.balance.toLocaleString() }} {{ b.currency }}
            </span>
          </div>
        </section>

        <section class="settlement-section">
          <h2>{{ t('expense.settlementList') }}</h2>
          <div v-if="settlementResult.settlements.length === 0" class="empty-msg">
            {{ t('expense.noSettlement') }}
          </div>
          <div
            v-for="(s, idx) in settlementResult.settlements"
            :key="idx"
            class="settlement-row"
          >
            <span class="from-name">{{ s.from_member_name }}</span>
            <span class="arrow">→</span>
            <span class="to-name">{{ s.to_member_name }}</span>
            <span class="settle-amount">
              {{ s.amount.toLocaleString() }} {{ s.currency }}
            </span>
          </div>
        </section>

        <!-- 計算過程 -->
        <section class="settlement-section">
          <button class="breakdown-toggle" @click="showBreakdown = !showBreakdown">
            <span>📊 計算過程</span>
            <svg
              :style="{ transform: showBreakdown ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }"
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round"
            ><polyline points="6 9 12 15 18 9"/></svg>
          </button>

          <div v-if="showBreakdown" class="breakdown-list">
            <div v-for="person in personBreakdown" :key="person.member_id" class="breakdown-card">
              <!-- ヘッダー: 名前 + 最終収支 -->
              <div class="breakdown-header">
                <div class="breakdown-avatar">{{ person.member_name.charAt(0).toUpperCase() }}</div>
                <span class="breakdown-member-name">{{ person.member_name }}</span>
                <span
                  class="breakdown-final"
                  :class="{ positive: person.balance > 0, negative: person.balance < 0 }"
                >
                  {{ person.balance > 0 ? '+' : '' }}{{ person.balance.toLocaleString() }} {{ person.currency }}
                </span>
              </div>

              <!-- 計算式 -->
              <div class="breakdown-formula-row">
                <template v-for="(item, idx) in person.items" :key="idx">
                  <span
                    class="formula-term"
                    :class="{ 'term-positive': item.amount >= 0, 'term-negative': item.amount < 0 }"
                  >
                    <span class="term-sign">{{ item.amount >= 0 ? (idx === 0 ? '' : '+') : '−' }}</span>
                    <span class="term-value">{{ Math.abs(item.amount).toLocaleString() }}</span>
                    <span class="term-label">{{ item.name }}</span>
                  </span>
                </template>
                <span v-if="person.items.length === 0" class="formula-none">参加費用なし</span>
                <template v-if="person.items.length > 0">
                  <span class="formula-eq">=</span>
                  <span
                    class="formula-result"
                    :class="{ positive: person.balance > 0, negative: person.balance < 0 }"
                  >
                    {{ person.balance > 0 ? '+' : '' }}{{ person.balance.toLocaleString() }} {{ person.currency }}
                  </span>
                </template>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>

    <!-- ===== 費用追加・編集モーダル ===== -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <h2>{{ editingExpense ? t('expense.editTitle') : t('expense.addTitle') }}</h2>

        <div class="form-group">
          <label>{{ t('expense.expenseName') }}</label>
          <input v-model="form.name" type="text" :placeholder="t('expense.expenseNamePlaceholder')" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>{{ t('expense.amount') }}</label>
            <input
              :value="form.amount ? formatAmount(form.amount) : ''"
              type="tel"
              inputmode="numeric"
              placeholder="0"
              @input="form.amount = ($event.target as HTMLInputElement).value.replace(/[^0-9]/g, '')"
              @compositionend="form.amount = ($event.target as HTMLInputElement).value.replace(/[^0-9]/g, '')"
            />
          </div>
          <div class="form-group">
            <label>{{ t('expense.currency') }}</label>
            <select v-model="form.currency">
              <option value="JPY">{{ t('common.currency.JPY') }}</option>
              <option value="KRW">{{ t('common.currency.KRW') }}</option>
              <option value="USD">{{ t('common.currency.USD') }}</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>{{ t('expense.spot') }}</label>
          <select v-model="form.spotId">
            <option :value="null">{{ t('expense.spotDefault') }}</option>
            <option v-for="s in spots" :key="s.id" :value="s.id">📍 {{ s.name }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>{{ t('expense.payerLabel') }}</label>
          <select v-model="form.payer">
            <option v-for="m in members" :key="m.id" :value="m.id">{{ m.user_name }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>{{ t('expense.participantsLabel') }}</label>
          <div class="checkbox-group">
            <label v-for="m in members" :key="m.id" class="checkbox-label">
              <input type="checkbox" :value="m.id" v-model="form.participantIds" />
              {{ m.user_name }}
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>{{ t('expense.date') }}</label>
          <input
            v-model="form.date"
            type="date"
            @click="($event.target as HTMLInputElement).showPicker()"
          />
        </div>

        <div class="form-group">
          <label>{{ t('expense.memoLabel') }}</label>
          <textarea v-model="form.memo" :placeholder="t('expense.memoPlaceholder')" rows="2" />
        </div>

        <div class="modal-actions">
          <button class="cancel-btn" @click="closeModal">{{ t('common.cancel') }}</button>
          <button class="save-btn" @click="saveExpense" :disabled="saving">
            {{ saving ? t('common.saving') : t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  membersApi, expensesApi, tripsApi,
  type Trip, type TripMember, type Expense, type SettlementResult, type Spot
} from '@/api/trips'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const hashUrl = route.params.hashUrl as string

// --- 状態 ---
const activeTab = ref<'expenses' | 'settlement'>('expenses')
const expenses = ref<Expense[]>([])
const members = ref<TripMember[]>([])
const spots = ref<Spot[]>([])
const trip = ref<Trip | null>(null)
const settlementResult = ref<SettlementResult | null>(null)
const loadingSettlement = ref(false)
const showBreakdown = ref(false)
const showModal = ref(false)
const saving = ref(false)
const editingExpense = ref<Expense | null>(null)

// 選択中のスポットフィルター。null = 旅行全体（デフォルト）。
const selectedSpotId = ref<string | null>(null)

// --- computed ---

// 選択中のスポット名を返す（フィルターヘッダー表示用）。
const selectedSpotName = computed(() => {
  if (selectedSpotId.value === null) return ''
  return spots.value.find(s => s.id === selectedSpotId.value)?.name ?? ''
})

// 選択中のスポットフィルターに合わせて費用を絞り込む。
// 旅行全体（null）の場合はすべての費用を表示する。
const filteredExpenses = computed(() => {
  if (selectedSpotId.value === null) {
    return expenses.value
  }
  return expenses.value.filter(e => e.spot === selectedSpotId.value)
})

// 現在表示中の費用の合計金額。
const currentTotal = computed(() => {
  const sum = filteredExpenses.value.reduce((acc, e) => acc + Number(e.amount), 0)
  return sum.toLocaleString()
})

// --- フォーム ---
const defaultForm = () => ({
  name: '',
  amount: '',
  // 選択中スポットの通貨 → スポット未設定なら旅行の通貨 → フォールバック JPY
  currency: contextCurrency(selectedSpotId.value),
  payer: null as number | null,
  participantIds: [] as number[],
  date: '',
  memo: '',
  // フィルターで選択中のスポットをデフォルトにする。
  // 旅行全体ビューなら null（旅行全体）、スポットビューならそのスポットID。
  spotId: selectedSpotId.value as string | null,
})

const form = ref(defaultForm())

// モーダル内でスポットを変更したとき、通貨を自動切り替えする。
// 編集中（editingExpense あり）の場合は上書きしない。
watch(() => form.value.spotId, (newSpotId) => {
  if (!editingExpense.value) {
    form.value.currency = contextCurrency(newSpotId)
  }
})

// --- 初期データ取得 ---
onMounted(async () => {
  const [expRes, memRes, tripRes] = await Promise.all([
    expensesApi.list(hashUrl),
    membersApi.list(hashUrl),
    tripsApi.get(hashUrl),
  ])
  expenses.value = expRes.data
  members.value = memRes.data
  trip.value = tripRes.data
  spots.value = tripRes.data.spots
})

// --- スポットフィルター切り替え ---
function selectSpot(spotId: string | null) {
  selectedSpotId.value = spotId
}

// 現在のコンテキスト（スポット or 旅行）の通貨を返す。
// スポットに通貨が設定されていればそれを、なければ旅行の通貨を使う。
function contextCurrency(spotId: string | null): string {
  if (spotId) {
    const spot = spots.value.find(s => s.id === spotId)
    if (spot?.currency) return spot.currency
  }
  return trip.value?.currency ?? 'JPY'
}

// --- ユーティリティ ---
function formatAmount(amount: string | number): string {
  return Number(amount).toLocaleString()
}

function getParticipantNames(ids: number[]): string {
  return ids
    .map(id => members.value.find(m => m.id === id)?.user_name ?? '?')
    .join(', ')
}

function getMemberName(id: number): string {
  return members.value.find(m => m.id === id)?.user_name ?? '?'
}

// メンバーごとに各費用の貢献額を計算する。
// 支払者: +（総額 − 自分の取り分）= 他の参加者から回収すべき金額
// 非支払者: −自分の取り分 = 支払者に返すべき金額
const personBreakdown = computed(() => {
  if (!settlementResult.value) return []
  return settlementResult.value.balance_summary.map(b => {
    const items: { name: string; amount: number; currency: string }[] = []
    expenses.value.forEach(exp => {
      if (!exp.participant_ids.includes(b.member_id)) return
      const share = Math.round(Number(exp.amount) / exp.participant_ids.length)
      const net = exp.payer === b.member_id
        ? Math.round(Number(exp.amount)) - share  // 立替分（自分の取り分を除く）
        : -share                                   // 負担分（返す金額）
      items.push({ name: exp.name, amount: net, currency: exp.currency })
    })
    return { ...b, items }
  })
})

// --- モーダル ---
function openAddModal() {
  editingExpense.value = null
  form.value = defaultForm()
  // 全メンバーをデフォルトで参加者に選択する。
  form.value.participantIds = members.value.map(m => m.id)
  showModal.value = true
}

function openEditModal(expense: Expense) {
  editingExpense.value = expense
  form.value = {
    name: expense.name,
    amount: expense.amount,
    currency: expense.currency,
    payer: expense.payer,
    participantIds: [...expense.participant_ids],
    date: expense.date ?? '',
    memo: expense.memo,
    spotId: expense.spot ?? null,
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  editingExpense.value = null
}

// --- CRUD ---
async function saveExpense() {
  if (!form.value.name.trim()) { alert(t('expense.validName')); return }
  if (!form.value.amount || Number(form.value.amount) <= 0) { alert(t('expense.validAmount')); return }
  if (!form.value.payer) { alert(t('expense.validPayer')); return }
  if (form.value.participantIds.length === 0) { alert(t('expense.validParticipants')); return }

  saving.value = true
  try {
    if (editingExpense.value) {
      const { data } = await expensesApi.update(editingExpense.value.id, {
        name: form.value.name,
        amount: form.value.amount,
        currency: form.value.currency,
        payer: form.value.payer,
        date: form.value.date || null,
        memo: form.value.memo,
        participant_ids: form.value.participantIds,
        spot: form.value.spotId,
      })
      const idx = expenses.value.findIndex(e => e.id === editingExpense.value!.id)
      if (idx !== -1) expenses.value[idx] = data
    } else {
      const { data } = await expensesApi.create(hashUrl, {
        name: form.value.name,
        amount: form.value.amount,
        currency: form.value.currency,
        payer: form.value.payer!,
        date: form.value.date || undefined,
        memo: form.value.memo,
        participant_ids: form.value.participantIds,
        spot: form.value.spotId,
      })
      expenses.value.push(data)
    }
    closeModal()
  } catch (e) {
    alert(t('expense.saveFail'))
  } finally {
    saving.value = false
  }
}

async function deleteExpense(id: string) {
  if (!confirm(t('expense.deleteConfirm'))) return
  await expensesApi.delete(id)
  expenses.value = expenses.value.filter(e => e.id !== id)
}

async function switchToSettlement() {
  activeTab.value = 'settlement'
  if (!settlementResult.value) {
    loadingSettlement.value = true
    try {
      const { data } = await expensesApi.settlement(hashUrl)
      settlementResult.value = data
    } finally {
      loadingSettlement.value = false
    }
  }
}
</script>

<style scoped>
.expense-page {
  max-width: 600px;
  margin: 0 auto;
  padding: 0 16px 80px;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  color: #333;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid #eee;
}

.page-header h1 {
  font-size: 1.3rem;
  font-weight: 700;
  margin: 0;
  color: #2c3e50;
}

.back-btn {
  background: none;
  border: none;
  color: #42b983;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 4px 8px;
}
.back-btn:hover { text-decoration: underline; }

/* タブ */
.tabs {
  display: flex;
  border-bottom: 2px solid #eee;
  margin: 16px 0 0;
}
.tabs button {
  flex: 1;
  padding: 10px;
  background: none;
  border: none;
  font-size: 0.95rem;
  cursor: pointer;
  color: #666;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  transition: color 0.2s, border-color 0.2s;
}
.tabs button.active {
  color: #42b983;
  border-bottom-color: #42b983;
  font-weight: 600;
}

/* スポットフィルターバー */
.spot-filter-bar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 14px 0 10px;
  scrollbar-width: none; /* Firefox */
}
.spot-filter-bar::-webkit-scrollbar { display: none; } /* Chrome */

.spot-filter-btn {
  flex-shrink: 0;
  padding: 6px 14px;
  border: 1.5px solid #ddd;
  border-radius: 20px;
  background: #fff;
  color: #555;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.spot-filter-btn:hover {
  border-color: #42b983;
  color: #42b983;
}
.spot-filter-btn.active {
  background: #42b983;
  border-color: #42b983;
  color: #fff;
  font-weight: 600;
}

/* 現在のスコープヘッダー */
.current-scope-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0 12px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 12px;
}
.scope-label {
  font-size: 0.95rem;
  font-weight: 700;
  color: #2c3e50;
  flex: 1;
}
.scope-total {
  font-size: 0.85rem;
  color: #42b983;
  font-weight: 600;
}
.add-btn {
  background: #42b983;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 7px 14px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}
.add-btn:hover { background: #369f73; }

/* 費用カード */
.expense-card {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,.05);
}
.expense-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
}
.expense-name { font-weight: 600; font-size: 1rem; }
.expense-date { font-size: 0.78rem; color: #999; margin-left: 8px; }
.expense-amount { font-size: 1.1rem; font-weight: 700; color: #e74c3c; }
.expense-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 0.8rem;
  color: #555;
}
.payer-badge {
  background: #f0f9f5;
  color: #42b983;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}
.participants-label { color: #777; }
.expense-spot-tag {
  display: inline-block;
  margin-top: 6px;
  font-size: 0.78rem;
  color: #888;
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 10px;
}
.expense-memo {
  font-size: 0.82rem;
  color: #777;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed #eee;
}
.expense-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.edit-btn, .delete-btn {
  border: none;
  border-radius: 6px;
  padding: 4px 12px;
  font-size: 0.8rem;
  cursor: pointer;
}
.edit-btn { background: #f0f0f0; color: #333; }
.edit-btn:hover { background: #e0e0e0; }
.delete-btn { background: #fdecea; color: #e74c3c; }
.delete-btn:hover { background: #f5c6c6; }

/* 精算 */
.settlement-section { margin: 20px 0; }
.settlement-section h2 {
  font-size: 1rem;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 10px;
}
.balance-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 6px;
  background: #f9f9f9;
}
.balance-row.positive { background: #f0f9f5; }
.balance-row.negative { background: #fef6f5; }
.balance-name { font-weight: 500; }
.balance-amount { font-weight: 600; }
.balance-row.positive .balance-amount { color: #42b983; }
.balance-row.negative .balance-amount { color: #e74c3c; }
.settlement-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  margin-bottom: 8px;
}
.from-name { font-weight: 600; color: #e74c3c; }
.arrow { color: #aaa; }
.to-name { font-weight: 600; color: #42b983; }
.settle-amount { margin-left: auto; font-weight: 700; color: #2c3e50; }

/* 計算過程 */
.breakdown-toggle {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; background: #f5f5f5; border: 1px solid #e0e0e0;
  border-radius: 10px; padding: 10px 14px; cursor: pointer;
  font-size: 0.92rem; font-weight: 600; color: #2c3e50;
  transition: background 0.15s;
}
.breakdown-toggle:hover { background: #eee; }
.breakdown-list { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }

.breakdown-card {
  background: #fff; border: 1px solid #e8e8e8;
  border-radius: 12px; padding: 14px 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,.05);
}
.breakdown-header {
  display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
}
.breakdown-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: #42b983; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.85rem; font-weight: 700; flex-shrink: 0;
}
.breakdown-member-name { font-weight: 700; font-size: 0.95rem; color: #2c3e50; flex: 1; }
.breakdown-final { font-weight: 700; font-size: 0.95rem; }
.breakdown-final.positive { color: #42b983; }
.breakdown-final.negative { color: #e74c3c; }

/* 計算式の行 */
.breakdown-formula-row {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
  background: #f8f8f8; border-radius: 8px; padding: 10px 12px;
}
.formula-term {
  display: inline-flex; align-items: center; gap: 2px;
  padding: 3px 8px; border-radius: 6px; font-size: 0.82rem;
}
.formula-term.term-positive { background: #eaf7f1; }
.formula-term.term-negative { background: #fef0ef; }
.term-sign { font-weight: 700; font-size: 0.78rem; color: #888; margin-right: 1px; }
.term-value { font-weight: 700; }
.formula-term.term-positive .term-value { color: #27ae60; }
.formula-term.term-negative .term-value { color: #e74c3c; }
.term-label {
  font-size: 0.73rem; color: #888;
  background: rgba(0,0,0,0.05); border-radius: 4px;
  padding: 1px 5px; margin-left: 3px; white-space: nowrap;
}
.formula-eq { font-weight: 700; color: #aaa; font-size: 1rem; padding: 0 2px; }
.formula-result { font-weight: 800; font-size: 0.92rem; }
.formula-result.positive { color: #27ae60; }
.formula-result.negative { color: #e74c3c; }
.formula-none { font-size: 0.82rem; color: #bbb; }

/* モーダル */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}
.modal {
  background: #fff;
  border-radius: 14px;
  padding: 24px;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 30px rgba(0,0,0,.15);
}
.modal h2 {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0 0 20px;
  color: #2c3e50;
}
.form-group { margin-bottom: 14px; }
.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: #555;
  margin-bottom: 5px;
}
.required { color: #e74c3c; }
.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.95rem;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #42b983;
}
.form-row { display: flex; gap: 12px; }
.form-row .form-group { flex: 1; }
.checkbox-group { display: flex; flex-wrap: wrap; gap: 8px; }
.checkbox-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 5px 10px;
  background: #f5f5f5;
  border-radius: 8px;
}
.checkbox-label input[type="checkbox"] {
  width: auto;
  border: none;
  padding: 0;
  accent-color: #42b983;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
.cancel-btn {
  background: #f0f0f0;
  color: #555;
  border: none;
  border-radius: 8px;
  padding: 8px 18px;
  cursor: pointer;
}
.cancel-btn:hover { background: #e0e0e0; }
.save-btn {
  background: #42b983;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 20px;
  font-weight: 600;
  cursor: pointer;
}
.save-btn:hover { background: #369f73; }
.save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.empty-msg {
  text-align: center;
  color: #aaa;
  padding: 40px 0;
  font-size: 0.95rem;
}
.loading {
  text-align: center;
  color: #aaa;
  padding: 40px 0;
}
</style>
