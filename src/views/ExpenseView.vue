<template>
  <div class="expense-page">
    <!-- ヘッダー: 旅行名と戻るボタン -->
    <header class="page-header">
      <button class="back-btn" @click="router.push(`/trips/${hashUrl}`)">← 戻る</button>
      <h1>費用・精算</h1>
    </header>

    <!-- タブ切り替え: 費用一覧 / 精算 -->
    <!--
      Vue の :class バインディング: オブジェクト形式で条件付きクラスを指定できる。
      { active: activeTab === 'expenses' } → activeTab が 'expenses' のとき class="active" が付く。
    -->
    <div class="tabs">
      <button :class="{ active: activeTab === 'expenses' }" @click="activeTab = 'expenses'">
        費用一覧
      </button>
      <button :class="{ active: activeTab === 'settlement' }" @click="switchToSettlement">
        精算
      </button>
    </div>

    <!-- ===== 費用一覧タブ ===== -->
    <div v-if="activeTab === 'expenses'">
      <!-- 費用追加ボタン -->
      <div class="add-btn-row">
        <button class="add-btn" @click="openAddModal">＋ 費用を追加</button>
      </div>

      <!-- 費用がない場合のメッセージ -->
      <div v-if="expenses.length === 0" class="empty-msg">
        まだ費用が登録されていません。
      </div>

      <!--
        スポット別グループ表示。
        computed の groupedExpenses が { spotKey: { label, expenses[] }[] } 形式で返す。
        v-for でグループをループし、各グループ内の費用カードをネストして表示する。
      -->
      <div v-for="group in groupedExpenses" :key="group.key" class="expense-group">
        <div class="group-header">
          <span class="group-label">{{ group.label }}</span>
          <span class="group-total">合計 {{ group.total }} 円</span>
        </div>

        <div v-for="expense in group.items" :key="expense.id" class="expense-card">
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
              参加: {{ getParticipantNames(expense.participant_ids) }}
            </span>
          </div>
          <div v-if="expense.memo" class="expense-memo">{{ expense.memo }}</div>
          <div class="expense-actions">
            <button class="edit-btn" @click="openEditModal(expense)">編集</button>
            <button class="delete-btn" @click="deleteExpense(expense.id)">削除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 精算タブ ===== -->
    <div v-if="activeTab === 'settlement'">
      <div v-if="loadingSettlement" class="loading">計算中...</div>

      <template v-else-if="settlementResult">
        <!-- 収支サマリ: 各メンバーの純収支（正=受取、負=支払） -->
        <section class="settlement-section">
          <h2>収支サマリ</h2>
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

        <!-- 精算リスト: 誰が誰にいくら払うか -->
        <section class="settlement-section">
          <h2>精算リスト</h2>
          <div v-if="settlementResult.settlements.length === 0" class="empty-msg">
            精算不要です！
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
      </template>
    </div>

    <!-- ===== 費用追加・編集モーダル ===== -->
    <!--
      v-if でモーダルの表示/非表示を切り替える。
      @click.self: オーバーレイ自体をクリックしたときだけ閉じる（カード内のクリックは無視）。
    -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <h2>{{ editingExpense ? '費用を編集' : '費用を追加' }}</h2>

        <div class="form-group">
          <label>費用名 <span class="required">*</span></label>
          <input v-model="form.name" type="text" placeholder="例: 夕食、交通費" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>金額 <span class="required">*</span></label>
            <input v-model="form.amount" type="number" min="0" placeholder="0" />
          </div>
          <div class="form-group">
            <label>通貨</label>
            <select v-model="form.currency">
              <option value="JPY">円 (JPY)</option>
              <option value="KRW">ウォン (KRW)</option>
              <option value="USD">ドル (USD)</option>
            </select>
          </div>
        </div>

        <!-- スポット選択: どのスポットの費用かを関連づける（任意）。 -->
        <div class="form-group">
          <label>スポット</label>
          <select v-model="form.spotId">
            <option :value="null">旅行全体（スポット指定なし）</option>
            <option v-for="s in spots" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>支払者 <span class="required">*</span></label>
          <select v-model="form.payer">
            <option v-for="m in members" :key="m.id" :value="m.id">{{ m.user_name }}</option>
          </select>
        </div>

        <div class="form-group">
          <label>参加者（割り勘対象）<span class="required">*</span></label>
          <!--
            v-model で配列を使うと、チェックボックスは自動で value を push/splice してくれる。
            Vue のリアクティビティのおかげで、チェック状態が form.participantIds に反映される。
          -->
          <div class="checkbox-group">
            <label v-for="m in members" :key="m.id" class="checkbox-label">
              <input
                type="checkbox"
                :value="m.id"
                v-model="form.participantIds"
              />
              {{ m.user_name }}
            </label>
          </div>
        </div>

        <div class="form-group">
          <label>日付</label>
          <input
            v-model="form.date"
            type="date"
            @click="($event.target as HTMLInputElement).showPicker()"
          />
        </div>

        <div class="form-group">
          <label>メモ</label>
          <textarea v-model="form.memo" placeholder="メモ（任意）" rows="2" />
        </div>

        <div class="modal-actions">
          <button class="cancel-btn" @click="closeModal">キャンセル</button>
          <button class="save-btn" @click="saveExpense" :disabled="saving">
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ExpenseView.vue
 *
 * 【Vue の仕組み】
 * <script setup> は Vue 3 の Composition API のシュガーシンタックス。
 * setup() 関数の中身を直接書けて、return 不要でテンプレートから使える。
 *
 * 【Django との連携】
 * - expensesApi.list()       → GET  /api/trips/<hash>/expenses/
 * - expensesApi.create()     → POST /api/trips/<hash>/expenses/
 * - expensesApi.update()     → PATCH /api/expenses/<id>/
 * - expensesApi.delete()     → DELETE /api/expenses/<id>/
 * - expensesApi.settlement() → GET /api/trips/<hash>/settlement/
 */

import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { membersApi, expensesApi, tripsApi, type TripMember, type Expense, type SettlementResult, type Spot } from '@/api/trips'

const route = useRoute()
const router = useRouter()

// URLパラメータ :hashUrl を取得する。
const hashUrl = route.params.hashUrl as string

// --- リアクティブな状態 ---
// ref(): プリミティブ値（string/number/boolean）をリアクティブにするラッパー。
// .value でアクセスする。テンプレート内では .value 不要。
const activeTab = ref<'expenses' | 'settlement'>('expenses')
const expenses = ref<Expense[]>([])
const members = ref<TripMember[]>([])
const spots = ref<Spot[]>([])
const settlementResult = ref<SettlementResult | null>(null)
const loadingSettlement = ref(false)
const showModal = ref(false)
const saving = ref(false)
const editingExpense = ref<Expense | null>(null)

// defaultForm: spotId フィールドを追加。null = スポット指定なし（旅行全体）。
const defaultForm = () => ({
  name: '',
  amount: '',
  currency: 'JPY',
  payer: null as number | null,
  participantIds: [] as number[],
  date: '',
  memo: '',
  spotId: null as string | null,
})

// groupedExpenses: 費用をスポット別にグループ化した computed。
// スポットなし → 「旅行全体」グループ、スポットあり → スポット名グループ。
const groupedExpenses = computed(() => {
  const groups: Record<string, { key: string; label: string; items: Expense[]; total: string }> = {}

  for (const exp of expenses.value) {
    const key = exp.spot ?? '__trip__'
    const label = exp.spot_name ?? '🌐 旅行全体'
    if (!groups[key]) {
      groups[key] = { key, label, items: [], total: '0' }
    }
    groups[key].items.push(exp)
  }

  // 各グループの合計金額を計算する。
  for (const g of Object.values(groups)) {
    const sum = g.items.reduce((acc, e) => acc + Number(e.amount), 0)
    g.total = sum.toLocaleString()
  }

  // スポットなし（旅行全体）を先頭に、以降はスポット名順に並べる。
  return Object.values(groups).sort((a, b) => {
    if (a.key === '__trip__') return -1
    if (b.key === '__trip__') return 1
    return a.label.localeCompare(b.label, 'ja')
  })
})

// reactive でなく ref を使う理由: オブジェクト全体を入れ替える（= defaultForm()）ため。
// reactive の場合は Object.assign でプロパティを更新しないといけない。
const form = ref(defaultForm())

// --- 初期データ取得 ---
// onMounted: コンポーネントがDOMにマウントされた直後に実行される。
// ページ表示時に費用一覧とメンバー一覧を並行して取得する。
onMounted(async () => {
  // 費用・メンバー・スポット一覧を並行取得する。
  const [expRes, memRes, tripRes] = await Promise.all([
    expensesApi.list(hashUrl),
    membersApi.list(hashUrl),
    tripsApi.get(hashUrl),
  ])
  expenses.value = expRes.data
  members.value = memRes.data
  // Trip に含まれるスポット一覧をそのまま使う（別途 spotsApi を呼ばない）。
  spots.value = tripRes.data.spots
})

// --- ユーティリティ ---

// 金額を3桁カンマ区切りでフォーマットする。
function formatAmount(amount: string | number): string {
  return Number(amount).toLocaleString()
}

// 参加者IDのリストから名前リストの文字列を生成する。
function getParticipantNames(ids: number[]): string {
  return ids
    .map(id => members.value.find(m => m.id === id)?.user_name ?? '?')
    .join(', ')
}

// --- モーダル操作 ---

function openAddModal() {
  editingExpense.value = null
  form.value = defaultForm()
  // デフォルトで全メンバーを参加者として選択しておく（BBumBBai と同じ挙動）。
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

// --- CRUD 操作 ---

async function saveExpense() {
  // バリデーション
  if (!form.value.name.trim()) {
    alert('費用名を入力してください。')
    return
  }
  if (!form.value.amount || Number(form.value.amount) <= 0) {
    alert('金額を入力してください。')
    return
  }
  if (!form.value.payer) {
    alert('支払者を選択してください。')
    return
  }
  if (form.value.participantIds.length === 0) {
    alert('参加者を1人以上選択してください。')
    return
  }

  saving.value = true
  try {
    if (editingExpense.value) {
      // 既存費用の更新（PATCH）。
      const { data } = await expensesApi.update(editingExpense.value.id, {
        name: form.value.name,
        amount: form.value.amount,
        currency: form.value.currency,
        payer: form.value.payer,
        date: form.value.date || null,
        memo: form.value.memo,
        participant_ids: form.value.participantIds,
      })
      // 一覧の対応するアイテムを更新する（再取得しない分速い）。
      const idx = expenses.value.findIndex(e => e.id === editingExpense.value!.id)
      if (idx !== -1) expenses.value[idx] = data
    } else {
      // 新規費用の登録（POST）。spot は任意。
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
      // 一覧の末尾に追加する。
      expenses.value.push(data)
    }
    closeModal()
  } catch (e) {
    alert('保存に失敗しました。')
  } finally {
    // finally: 成功・失敗問わず必ず実行される（ローディング状態をリセット）。
    saving.value = false
  }
}

async function deleteExpense(id: string) {
  if (!confirm('この費用を削除しますか？')) return
  await expensesApi.delete(id)
  // filter: 削除した費用以外のリストを新しい配列として作成し、リアクティブ更新する。
  expenses.value = expenses.value.filter(e => e.id !== id)
}

// --- 精算タブに切り替えたときに計算を取得する ---
async function switchToSettlement() {
  activeTab.value = 'settlement'
  // まだ取得していない場合だけAPIを呼ぶ。
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
/* scoped: このコンポーネントのDOM要素にだけスタイルが適用される。他のコンポーネントに影響しない。 */

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

/* 費用追加ボタン */
.add-btn-row {
  display: flex;
  justify-content: flex-end;
  padding: 12px 0;
}

.add-btn {
  background: #42b983;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s;
}
.add-btn:hover { background: #369f73; }

/* スポット別グループ */
.expense-group {
  margin-bottom: 20px;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 4px;
  margin-bottom: 6px;
  border-bottom: 2px solid #e8e8e8;
}

.group-label {
  font-size: 0.9rem;
  font-weight: 700;
  color: #2c3e50;
}

.group-total {
  font-size: 0.82rem;
  color: #42b983;
  font-weight: 600;
}

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

.expense-name {
  font-weight: 600;
  font-size: 1rem;
}

.expense-date {
  font-size: 0.78rem;
  color: #999;
  margin-left: 8px;
}

.expense-amount {
  font-size: 1.1rem;
  font-weight: 700;
  color: #e74c3c;
}

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
.settlement-section {
  margin: 20px 0;
}
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

.form-group {
  margin-bottom: 14px;
}

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

.form-row {
  display: flex;
  gap: 12px;
}
.form-row .form-group { flex: 1; }

/* チェックボックスグループ */
.checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

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
