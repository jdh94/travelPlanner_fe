<script setup lang="ts">
// ref: リアクティブな値を作る Vue の関数。
// .value でアクセス・更新し、変化するとテンプレートが自動再描画される。
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { tripsApi, type Trip } from '@/api/trips'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// route.params: URLの :hashUrl に対応する値が入っている。
const hashUrl = route.params.hashUrl as string

const trip = ref<Trip | null>(null)
const loading = ref(true)
const saving = ref(false)
const saveSuccess = ref(false)

// フォームの状態を1つの ref オブジェクトにまとめる。
// v-model でテンプレートの各入力欄とこのオブジェクトが双方向バインドされる。
const form = ref({
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  currency: 'JPY',
  visibility: 'public',
  pin_enabled: false,
  pin: '',
})
const showPinSaved = ref(false)

// computed: trip と auth.user の両方が揃っていて、かつ creator が一致する場合に true。
// trip や auth.user が変わると自動で再計算される。
const isCreator = computed(() =>
  trip.value && auth.user && trip.value.creator === auth.user.id
)

// onMounted: コンポーネントが画面に表示された直後に実行される。
// 旅行データを取得してフォームの初期値をセットする。
onMounted(async () => {
  try {
    const { data } = await tripsApi.get(hashUrl)
    trip.value = data
    // フォームを API から取得したデータで初期化する。
    form.value = {
      title: data.title,
      description: data.description,
      start_date: data.start_date,
      end_date: data.end_date,
      currency: data.currency,
      visibility: data.visibility,
      pin_enabled: data.pin_enabled,
      pin: '',
    }
  } finally {
    loading.value = false
  }
})

async function saveTrip() {
  saving.value = true
  saveSuccess.value = false
  try {
    // スプレッド構文 {...form.value}: form の全フィールドをコピーした新しいオブジェクトを作る。
    // 直接 form.value を渡すと後の pin 操作で元のオブジェクトが変わってしまう。
    const payload: Record<string, unknown> = { ...form.value }
    if (!form.value.pin_enabled) {
      // PIN無効化の場合は空文字を送ってDBのPINをクリアする。
      payload.pin = ''
    } else if (!form.value.pin) {
      // PINを変更しない場合は pin フィールド自体を送らない。
      // DRF 側で required=False なので省略してもエラーにならない。
      delete payload.pin
    }
    // PATCH リクエスト: 変更したフィールドだけを送る部分更新。
    const { data } = await tripsApi.update(hashUrl, payload)
    trip.value = data
    saveSuccess.value = true
    if (form.value.pin_enabled && form.value.pin) {
      // PIN設定完了トースト通知を4秒間表示する。
      showPinSaved.value = true
      // setTimeout: 指定ミリ秒後に処理を実行する非同期タイマー。
      setTimeout(() => (showPinSaved.value = false), 4000)
    }
    form.value.pin = ''
    setTimeout(() => (saveSuccess.value = false), 3000)
  } finally {
    saving.value = false
  }
}

async function deleteTrip() {
  if (!confirm('この旅行を削除しますか？この操作は元に戻せません。')) return
  try {
    await tripsApi.delete(hashUrl)
    // 削除後はトップページへ遷移する。
    router.push('/')
  } catch (e: any) {
    alert(e.response?.data?.detail || '削除に失敗しました。')
  }
}
</script>

<template>
  <div class="manage-page">
    <header class="header">
      <RouterLink :to="`/trips/${hashUrl}`" class="back-btn">← 旅行に戻る</RouterLink>
      <h1>旅行管理</h1>
    </header>

    <!--
      <transition>: 要素の表示・非表示にアニメーションを付ける Vue の組み込みコンポーネント。
      name="toast" → CSS の .toast-enter-active / .toast-leave-active 等が適用される。
    -->
    <transition name="toast">
      <!-- v-if="showPinSaved": true のとき DOM に追加、false のとき削除。transition が動く。 -->
      <div v-if="showPinSaved" class="toast">
        🔒 PINを設定しました。次回からこのURLを開く時にPIN入力が必要です。
      </div>
    </transition>

    <div v-if="loading" class="loading">読み込み中...</div>

    <div v-else class="content">
      <div class="card">
        <h2>旅行情報を編集</h2>
        <!--
          @submit.prevent: フォームの送信イベントをキャッチして saveTrip() を呼ぶ。
          .prevent: event.preventDefault() と同等。ページリロードを防ぐ。
        -->
        <form @submit.prevent="saveTrip">
          <div class="field">
            <label>旅行タイトル *</label>
            <!-- v-model="form.title": 入力するたびに form.title が更新される（双方向バインド）。 -->
            <input v-model="form.title" type="text" required placeholder="例：京都・大阪旅行" />
          </div>
          <div class="field-row">
            <div class="field">
              <label for="m_start_date" class="date-label" @click.prevent="($refs.mStartDate as HTMLInputElement).showPicker()">出発日 *</label>
              <div class="date-input-wrap">
                <svg class="date-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <input id="m_start_date" ref="mStartDate" v-model="form.start_date" type="date" required @click="($event.target as HTMLInputElement).showPicker()" class="date-input" />
              </div>
            </div>
            <div class="field">
              <label for="m_end_date" class="date-label" @click.prevent="($refs.mEndDate as HTMLInputElement).showPicker()">帰宅日 *</label>
              <div class="date-input-wrap">
                <svg class="date-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                <input id="m_end_date" ref="mEndDate" v-model="form.end_date" type="date" required @click="($event.target as HTMLInputElement).showPicker()" class="date-input" />
              </div>
            </div>
          </div>
          <div class="field">
            <label>説明</label>
            <textarea v-model="form.description" rows="3" placeholder="旅行の概要..."></textarea>
          </div>
          <div class="field">
            <label>通貨</label>
            <div class="btn-group">
              <button type="button" :class="['group-btn', { active: form.currency === 'JPY' }]" @click="form.currency = 'JPY'">JPY（円）</button>
              <button type="button" :class="['group-btn', { active: form.currency === 'KRW' }]" @click="form.currency = 'KRW'">KRW（ウォン）</button>
              <button type="button" :class="['group-btn', { active: form.currency === 'USD' }]" @click="form.currency = 'USD'">USD（ドル）</button>
            </div>
          </div>
          <div class="field">
            <label>公開設定</label>
            <div class="btn-group">
              <button
                type="button"
                :class="['group-btn', { active: form.visibility === 'public' }]"
                @click="form.visibility = 'public'; form.pin_enabled = false"
              >🌐 公開</button>
              <button
                type="button"
                :class="['group-btn', { active: form.visibility === 'private' }]"
                @click="form.visibility = 'private'; form.pin_enabled = true"
              >🔒 非公開（PIN）</button>
            </div>
          </div>

          <!-- 非公開選択時のみPIN入力欄を表示 -->
          <div v-if="form.visibility === 'private'" class="field pin-field">
            <label>🔒 PINコード</label>
            <p class="pin-hint">旅行を開く際にこのPINの入力が必要になります。</p>
            <div class="pin-input-row">
              <input
                v-model="form.pin"
                type="tel"
                inputmode="numeric"
                maxlength="4"
                placeholder="4桁のPINを入力"
                class="pin-number-input"
                @input="form.pin = form.pin.replace(/\D/g, '').slice(0, 4)"
                @compositionend="form.pin = form.pin.replace(/\D/g, '').slice(0, 4)"
              />
              <span class="pin-input-hint">空欄の場合は現在のPINを維持</span>
            </div>
          </div>

          <div class="form-actions">
            <span v-if="saveSuccess" class="save-success">✓ 保存しました</span>
            <!-- :disabled="saving": saving が true のときボタンを無効化して二重送信を防ぐ。 -->
            <button type="submit" class="btn-primary" :disabled="saving">
              {{ saving ? '保存中...' : '変更を保存' }}
            </button>
          </div>
        </form>

        <!-- v-if="isCreator": computed の isCreator が true（作成者本人）のときだけ表示する。 -->
        <div v-if="isCreator" class="danger-zone">
          <h3>危険な操作</h3>
          <p>旅行を削除すると、すべてのスポット・コメントも削除されます。この操作は元に戻せません。</p>
          <button class="btn-danger" @click="deleteTrip">この旅行を削除する</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.manage-page { min-height: 100vh; background: #f5f7fa; }

.header {
  background: #fff;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.back-btn { color: #42b983; text-decoration: none; font-size: 0.9rem; white-space: nowrap; }
h1 { margin: 0; font-size: 1.1rem; color: #2c3e50; }

.loading { text-align: center; padding: 60px; color: #888; }

.content { max-width: 680px; margin: 0 auto; padding: 24px 20px; }

.card {
  background: #fff;
  border-radius: 12px;
  padding: 28px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.card h2 { margin: 0 0 20px; font-size: 1.1rem; color: #2c3e50; }

.field { margin-bottom: 16px; }
label { display: block; font-size: 0.85rem; color: #666; margin-bottom: 6px; }
.btn-group {
  display: flex;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}
.group-btn {
  flex: 1;
  padding: 9px 6px;
  border: none;
  border-right: 1px solid #ddd;
  background: #fff;
  font-size: 0.85rem;
  color: #666;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}
.group-btn:last-child { border-right: none; }
.group-btn:hover { background: #f5f5f5; }
.group-btn.active { background: #42b983; color: #fff; font-weight: 600; }
.date-label { cursor: pointer; user-select: none; }
.date-label:hover { color: #42b983; }
input[type="text"], textarea, select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.95rem;
  box-sizing: border-box;
}
input:focus, textarea:focus, select:focus { outline: none; border-color: #42b983; }

/* 日付入力 カスタムデザイン */
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
  flex-shrink: 0;
}
.date-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 0.95rem;
  box-sizing: border-box;
  cursor: pointer;
  transition: border-color 0.15s;
}
.date-input:focus { outline: none; border-color: #42b983; }
.date-input:hover { border-color: #42b983; }
/* ネイティブのカレンダーアイコンを非表示 */
.date-input::-webkit-calendar-picker-indicator {
  opacity: 0;
  position: absolute;
  right: 0;
  width: 40px;
  height: 100%;
  cursor: pointer;
}

.form-actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 4px; }
.save-success { color: #42b983; font-size: 0.9rem; }

.danger-zone {
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid #ffd0d0;
}
.danger-zone h3 { color: #e74c3c; margin: 0 0 8px; font-size: 0.95rem; }
.danger-zone p { font-size: 0.85rem; color: #888; margin-bottom: 14px; }
.btn-danger {
  background: #fff;
  color: #e74c3c;
  border: 1px solid #e74c3c;
  padding: 9px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.15s;
}
.btn-danger:hover { background: #e74c3c; color: #fff; }

.btn-primary {
  background: #42b983;
  color: #fff;
  border: none;
  padding: 9px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
}
.btn-primary:hover { background: #369870; }
.btn-primary:disabled { background: #a0d9bf; cursor: not-allowed; }

.pin-field {
  border: 1px solid #b8e0cc;
  border-radius: 10px;
  padding: 14px 16px;
  background: #f4faf7;
}
.pin-hint { font-size: 0.82rem; color: #888; margin: 4px 0 12px; }
.pin-input-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.pin-number-input {
  width: 160px;
  padding: 10px 14px;
  border: 1.5px solid #42b983;
  border-radius: 8px;
  font-size: 1.2rem;
  letter-spacing: 0.4em;
  text-align: center;
}
.pin-input-hint { font-size: 0.78rem; color: #aaa; }

/* transition の name="toast" に対応する CSS クラス。
   Vue が自動で付与する: enter-active（表示アニメーション中）、leave-active（消えるアニメーション中）等。 */
.toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #2c3e50;
  color: #fff;
  padding: 14px 24px;
  border-radius: 10px;
  font-size: 0.9rem;
  z-index: 999;
  box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  max-width: 420px;
  text-align: center;
}
.toast-enter-active, .toast-leave-active { transition: all 0.3s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(-16px); }

@media (max-width: 600px) {
  .card { padding: 20px 16px; }
  .group-btn { font-size: 0.8rem; padding: 8px 4px; }
}
</style>
