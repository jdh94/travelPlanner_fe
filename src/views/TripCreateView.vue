<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useTripsStore } from '@/stores/trips'
import { useAuthStore } from '@/stores/auth'

const { locale } = useI18n()
const router = useRouter()
const tripsStore = useTripsStore()
const auth = useAuthStore()

const step = ref(1)
const creating = ref(false)
const error = ref('')

// 日付ユーティリティ: n日後の日付を YYYY-MM-DD 形式で返す。
function dateAfter(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ブラウザ言語に合わせてデフォルト通貨を決める。
function defaultCurrency(): string {
  if (locale.value === 'ko') return 'KRW'
  return 'JPY'
}

const form = ref({
  title: '',
  start_date: dateAfter(1),   // デフォルト: 明日
  end_date: dateAfter(3),     // デフォルト: 3日後（2泊3日）
  description: '',
  currency: defaultCurrency(), // デフォルト: 言語に合わせて自動設定
  visibility: 'public',
  pin: '',
  pin_enabled: false,
})


const nightCount = computed(() => {
  if (!form.value.start_date || !form.value.end_date) return 0
  const diff = new Date(form.value.end_date).getTime() - new Date(form.value.start_date).getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
})

const step1Valid = computed(() => !!form.value.title.trim())
const step2Valid = computed(() => !!form.value.start_date && !!form.value.end_date && form.value.end_date >= form.value.start_date)
const step3Valid = computed(() => form.value.visibility === 'public' || (form.value.visibility === 'private' && form.value.pin.length === 4))

function nextStep() {
  if (step.value === 1 && step1Valid.value) step.value = 2
  else if (step.value === 2 && step2Valid.value) step.value = 3
}

function prevStep() {
  if (step.value > 1) step.value--
}

async function submit() {
  if (!step3Valid.value) return
  error.value = ''
  creating.value = true
  try {
    const payload = {
      ...form.value,
      pin_enabled: form.value.visibility === 'private',
    }
    const trip = await tripsStore.createTrip(payload)
    router.push(`/trips/${trip.hash_url}`)
  } catch (e: any) {
    const data = e.response?.data
    if (data && typeof data === 'object') {
      const entries = Object.keys(data).map((field: string) => {
        const msgs: unknown = (data as Record<string, unknown>)[field]
        return `${field}: ${Array.isArray(msgs) ? (msgs as string[]).join(', ') : String(msgs)}`
      })
      error.value = entries.length ? entries.join(' / ') : '旅行の作成に失敗しました。'
    } else {
      error.value = '旅行の作成に失敗しました。'
    }
    creating.value = false
  }
}

const currencySymbol: Record<string, string> = { JPY: '¥', KRW: '₩', USD: '$' }
const visibilityDesc: Record<string, string> = {
  public: 'URLを知っていれば誰でもアクセス可能',
  private: 'PINコードを設定して入室を制限する',
}
</script>

<template>
  <div class="create-page">
    <header class="header">
      <button class="back-btn" @click="router.push('/')">← 戻る</button>
      <h1>新しい旅行を作成</h1>
    </header>

    <div class="content">
      <!-- ステップインジケーター -->
      <div class="steps">
        <div v-for="n in 3" :key="n" class="step-item">
          <div class="step-circle" :class="{ active: step === n, done: step > n }">
            <span v-if="step > n">✓</span>
            <span v-else>{{ n }}</span>
          </div>
          <span class="step-label">
            {{ n === 1 ? '基本情報' : n === 2 ? '日程' : '設定' }}
          </span>
        </div>
        <div class="step-line"></div>
      </div>

      <div class="card">
        <!-- Step 1：基本情報 -->
        <div v-if="step === 1">
          <h2>旅行のタイトルを決めましょう</h2>
          <p class="step-desc">旅行を分かりやすく表す名前をつけてください。</p>
          <div class="field">
            <label>旅行タイトル *</label>
            <input
              v-model="form.title"
              type="text"
              placeholder="例：京都・大阪2泊3日の旅"
              maxlength="100"
              autofocus
              @keyup.enter="nextStep"
            />
            <span class="char-count">{{ form.title.length }}/100</span>
          </div>
          <div class="field">
            <label>旅行の説明（任意）</label>
            <textarea
              v-model="form.description"
              placeholder="旅行の目的や概要を入力してください..."
              rows="3"
              maxlength="500"
            ></textarea>
          </div>
        </div>

        <!-- Step 2：日程 -->
        <div v-if="step === 2">
          <h2>日程を設定しましょう</h2>
          <p class="step-desc">旅行の出発日と帰宅日を選んでください。</p>
          <div class="field-row">
            <div class="field">
              <!-- for="start_date": label をクリックすると id="start_date" の input にフォーカスが移る。
                   showPicker(): フォーカスだけでなくカレンダーを確実に開く。 -->
              <label for="start_date" class="date-label" @click.prevent="($refs.startDate as HTMLInputElement).showPicker()">出発日 *</label>
              <div class="date-input-wrap">
                <svg class="date-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <input id="start_date" ref="startDate" v-model="form.start_date" type="date" @click="($event.target as HTMLInputElement).showPicker()" class="date-input" />
              </div>
            </div>
            <div class="field">
              <label for="end_date" class="date-label" @click.prevent="($refs.endDate as HTMLInputElement).showPicker()">帰宅日 *</label>
              <div class="date-input-wrap">
                <svg class="date-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <input id="end_date" ref="endDate" v-model="form.end_date" type="date" :min="form.start_date" @click="($event.target as HTMLInputElement).showPicker()" class="date-input" />
              </div>
            </div>
          </div>
          <div v-if="nightCount > 0" class="night-badge">
            {{ nightCount }}泊{{ nightCount + 1 }}日の旅行
          </div>
          <div v-if="form.start_date && form.end_date && form.end_date < form.start_date" class="field-error">
            帰宅日は出発日以降の日付を選んでください。
          </div>
        </div>

        <!-- Step 3：設定 -->
        <div v-if="step === 3">
          <h2>その他の設定</h2>
          <p class="step-desc">通貨と公開設定を選んでください（後から変更できます）。</p>

          <div class="field">
            <label>通貨</label>
            <div class="currency-options">
              <button
                v-for="(sym, code) in currencySymbol"
                :key="code"
                class="currency-btn"
                :class="{ selected: form.currency === code }"
                type="button"
                @click="form.currency = code"
              >
                <span class="currency-sym">{{ sym }}</span>
                <span class="currency-code">{{ code }}</span>
              </button>
            </div>
          </div>

          <div class="field">
            <label>公開設定</label>
            <div class="visibility-options">
              <label
                v-for="v in ['public', 'private']"
                :key="v"
                class="visibility-option"
                :class="{ selected: form.visibility === v }"
                @click="form.visibility = v; if (v === 'public') form.pin = ''"
              >
                <input type="radio" v-model="form.visibility" :value="v" hidden />
                <div class="vis-icon">{{ v === 'public' ? '🌐' : '🔒' }}</div>
                <div>
                  <p class="vis-label">{{ v === 'public' ? '公開' : '非公開（PIN保護）' }}</p>
                  <p class="vis-desc">{{ visibilityDesc[v] }}</p>
                </div>
              </label>
            </div>
          </div>

          <!-- 非公開選択時：PIN入力（必須） -->
          <div v-if="form.visibility === 'private'" class="field pin-field">
            <label>🔒 PINコード <span class="required">*必須</span></label>
            <p class="pin-desc">旅行を開く際にこの4桁のPINが必要になります。</p>
            <div class="pin-input-row">
              <input
                v-model="form.pin"
                type="tel"
                inputmode="numeric"
                maxlength="4"
                placeholder="4桁のPINを入力"
                class="pin-number-input"
                @input="form.pin = ($event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4)"
                @compositionend="form.pin = ($event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4)"
              />
              <span v-if="form.pin.length === 4" class="pin-ok">✓</span>
              <span v-else class="pin-remain">あと{{ 4 - form.pin.length }}桁</span>
            </div>
          </div>

          <!-- 確認サマリー -->
          <div class="summary">
            <h3>作成内容の確認</h3>
            <div class="summary-row"><span>タイトル</span><strong>{{ form.title }}</strong></div>
            <div class="summary-row"><span>日程</span><strong>{{ form.start_date }} 〜 {{ form.end_date }}（{{ nightCount }}泊{{ nightCount + 1 }}日）</strong></div>
            <div class="summary-row"><span>通貨</span><strong>{{ form.currency }}</strong></div>
            <div class="summary-row"><span>公開設定</span><strong>{{ form.visibility === 'public' ? '公開' : '非公開（PIN保護）' }}</strong></div>
          </div>

          <p v-if="error" class="error">{{ error }}</p>
        </div>

        <!-- ナビゲーションボタン -->
        <div class="nav-buttons">
          <button v-if="step > 1" class="btn-outline" @click="prevStep">← 戻る</button>
          <div class="spacer"></div>
          <button
            v-if="step < 3"
            class="btn-primary"
            :disabled="(step === 1 && !step1Valid) || (step === 2 && !step2Valid)"
            @click="nextStep"
          >
            次へ →
          </button>
          <button
            v-else
            class="btn-primary btn-create"
            :disabled="creating || !step3Valid"
            @click="submit"
          >
            {{ creating ? '作成中...' : '旅行を作成する 🎉' }}
          </button>
        </div>
      </div>

      <!-- ログインしていない場合の案内 -->
      <div v-if="!auth.isLoggedIn" class="guest-note">
        <p>💡 ログインすると旅行データが保存されます。</p>
        <RouterLink to="/login" class="btn-outline-small">ログインする</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.create-page { min-height: 100vh; background: #f5f7fa; }

.header {
  background: #fff;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.back-btn { background: none; border: none; color: #42b983; cursor: pointer; font-size: 0.9rem; padding: 0; }
h1 { margin: 0; font-size: 1.1rem; color: #2c3e50; }

.content { max-width: 560px; margin: 0 auto; padding: 32px 20px; }

/* ステップ */
.steps {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0;
  margin-bottom: 28px;
  position: relative;
}
.step-line {
  position: absolute;
  top: 18px;
  left: calc(50% - 120px);
  width: 240px;
  height: 2px;
  background: #ddd;
  z-index: 0;
}
.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100px;
  z-index: 1;
}
.step-circle {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  color: #aaa;
  font-weight: bold;
  transition: all 0.2s;
}
.step-circle.active { background: #42b983; border-color: #42b983; color: #fff; }
.step-circle.done { background: #369870; border-color: #369870; color: #fff; }
.step-label { font-size: 0.78rem; color: #888; }

/* カード */
.card {
  background: #fff;
  border-radius: 14px;
  padding: 32px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.07);
}
.card h2 { margin: 0 0 8px; font-size: 1.2rem; color: #2c3e50; }
.step-desc { font-size: 0.88rem; color: #888; margin: 0 0 24px; }

/* フォーム */
.field { margin-bottom: 18px; position: relative; }
.field-row { display: flex; gap: 14px; }
.field-row .field { flex: 1; }
label { display: block; font-size: 0.85rem; color: #555; margin-bottom: 5px; font-weight: 500; }
.date-label { cursor: pointer; user-select: none; }
.date-label:hover { color: #42b983; }
input[type="text"], textarea {
  width: 100%;
  padding: 11px 13px;
  border: 1.5px solid #e0e0e0;
  border-radius: 9px;
  font-size: 0.95rem;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
input:focus, textarea:focus { outline: none; border-color: #42b983; }
.date-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.date-icon {
  position: absolute;
  right: 12px;
  color: #42b983;
  pointer-events: none;
  z-index: 1;
}
.date-input {
  width: 100%;
  padding: 11px 13px;
  border: 1.5px solid #e0e0e0;
  border-radius: 9px;
  font-size: 0.95rem;
  box-sizing: border-box;
  cursor: pointer;
  transition: border-color 0.15s;
}
.date-input:focus { outline: none; border-color: #42b983; }
.date-input:hover { border-color: #42b983; }
.date-input::-webkit-calendar-picker-indicator {
  opacity: 0;
  position: absolute;
  right: 0;
  width: 40px;
  height: 100%;
  cursor: pointer;
}
.char-count { position: absolute; right: 10px; bottom: 10px; font-size: 0.75rem; color: #bbb; }
.field-error { color: #e74c3c; font-size: 0.82rem; margin-top: 4px; }
.required { color: #e74c3c; font-size: 0.8rem; font-weight: 600; margin-left: 4px; }

/* PIN入力 */
.pin-field {
  border: 1.5px solid #b8e0cc; border-radius: 10px;
  padding: 14px 16px; background: #f4faf7;
}
.pin-desc { font-size: 0.82rem; color: #888; margin: 4px 0 12px; }
.pin-input-row { display: flex; align-items: center; gap: 10px; }
.pin-number-input {
  width: 140px; padding: 10px 12px;
  border: 1.5px solid #42b983; border-radius: 8px;
  font-size: 1.1rem; letter-spacing: 0.2em; text-align: center;
  box-sizing: border-box;
}
.pin-number-input:focus { outline: none; border-color: #369870; box-shadow: 0 0 0 3px rgba(66,185,131,0.15); }
.pin-ok { color: #42b983; font-size: 1.1rem; font-weight: 700; }
.pin-remain { font-size: 0.8rem; color: #aaa; }

.night-badge {
  display: inline-block;
  background: #e8f5e9;
  color: #42b983;
  font-size: 0.9rem;
  font-weight: bold;
  padding: 6px 16px;
  border-radius: 20px;
  margin-top: 8px;
}

/* 通貨 */
.currency-options { display: flex; gap: 10px; }
.currency-btn {
  flex: 1;
  padding: 14px 8px;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: all 0.15s;
}
.currency-btn.selected { border-color: #42b983; background: #e8f5e9; }
.currency-sym { font-size: 1.4rem; font-weight: bold; color: #2c3e50; }
.currency-code { font-size: 0.8rem; color: #888; }

/* 公開設定 */
.visibility-options { display: flex; flex-direction: column; gap: 10px; }
.visibility-option {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 13px 16px;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}
.visibility-option.selected { border-color: #42b983; background: #f0faf6; }
.vis-icon { font-size: 1.5rem; }
.vis-label { margin: 0; font-size: 0.9rem; font-weight: bold; color: #333; }
.vis-desc { margin: 2px 0 0; font-size: 0.78rem; color: #aaa; }

/* サマリー */
.summary {
  margin-top: 20px;
  background: #f9f9f9;
  border-radius: 10px;
  padding: 16px 18px;
}
.summary h3 { margin: 0 0 12px; font-size: 0.9rem; color: #666; }
.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #efefef;
  font-size: 0.88rem;
}
.summary-row:last-child { border-bottom: none; }
.summary-row span { color: #888; }
.summary-row strong { color: #333; text-align: right; max-width: 60%; }

.error { color: #e74c3c; font-size: 0.85rem; margin: 10px 0 0; }

/* ナビゲーション */
.nav-buttons {
  display: flex;
  align-items: center;
  margin-top: 28px;
  gap: 12px;
}
.spacer { flex: 1; }

/* ゲスト案内 */
.guest-note {
  margin-top: 16px;
  background: #fff8e1;
  border-radius: 10px;
  padding: 14px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.guest-note p { margin: 0; font-size: 0.87rem; color: #666; }
.btn-outline-small {
  background: transparent; color: #42b983; border: 1px solid #42b983;
  padding: 6px 12px; border-radius: 6px; text-decoration: none;
  font-size: 0.82rem; white-space: nowrap;
}

/* ボタン */
.btn-primary {
  background: #42b983; color: #fff; border: none;
  padding: 11px 24px; border-radius: 9px; cursor: pointer;
  font-size: 0.95rem; font-weight: bold;
}
.btn-primary:hover:not(:disabled) { background: #369870; }
.btn-primary:disabled { background: #a0d9bf; cursor: not-allowed; }
.btn-primary.btn-create { padding: 12px 28px; }
.btn-outline {
  background: transparent; color: #555; border: 1.5px solid #ddd;
  padding: 11px 20px; border-radius: 9px; cursor: pointer; font-size: 0.95rem;
}
.btn-outline:hover { border-color: #aaa; }

@media (max-width: 480px) {
  .card { padding: 24px 18px; }
  .field-row { flex-direction: column; gap: 0; }
  .currency-options { gap: 6px; }
  .guest-note { flex-direction: column; align-items: flex-start; }
}
</style>
