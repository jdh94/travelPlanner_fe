<script setup lang="ts">
// nextTick: DOM が更新された直後に処理を実行する。
// ref().focus() は DOM 要素が存在してから呼ぶ必要があるため nextTick を使う。
import { ref, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { tripsApi } from '@/api/trips'

const router = useRouter()
const route = useRoute()
const hashUrl = route.params.hashUrl as string

// digits: 4つの入力ボックスの値を配列で管理する。
// ref(['', '', '', '']): 初期値が空文字の4要素の配列。
const digits = ref(['', '', '', ''])
// inputRefs: DOM要素（<input>）への参照を保持する配列。
// テンプレートの :ref="(el) => setRef(el, i)" で各入力ボックスを登録する。
const inputRefs = ref<HTMLInputElement[]>([])
const error = ref('')
const attempts = ref(0)
const locked = ref(false)
const loading = ref(false)

// テンプレートから :ref="(el) => setRef(el, i)" で呼ばれる。
// el が null になるのはコンポーネントがアンマウントされた時。
function setRef(el: HTMLInputElement | null, i: number) {
  if (el) inputRefs.value[i] = el
}

// 指定インデックスの入力ボックスにフォーカスを移動する。
// nextTick() で DOM 更新が終わるのを待ってから focus() を呼ぶ。
function focus(i: number) {
  nextTick(() => inputRefs.value[i]?.focus())
}

// 各入力ボックスへの入力イベントハンドラ。
function onInput(i: number, e: Event) {
  const input = e.target as HTMLInputElement
  // 数字以外を除去して最後の1文字だけ取る（貼り付けや複数入力に対応）。
  const val = input.value.replace(/\D/g, '')
  digits.value[i] = val ? val[val.length - 1] : ''
  // input の value を digits と同期する（Vue の v-model ではなく :value を使っているため手動で同期）。
  input.value = digits.value[i]

  // 入力があれば次のボックスにフォーカスを移動する。
  if (digits.value[i] && i < 3) {
    focus(i + 1)
  }
  // 4桁全部入力されたら自動でPIN検証を実行する。
  if (digits.value.every((d) => d !== '')) {
    verifyPin()
  }
}

// キーボード操作ハンドラ（Backspace で前のボックスに戻る、矢印キーで移動）。
function onKeydown(i: number, e: KeyboardEvent) {
  if (e.key === 'Backspace') {
    if (digits.value[i]) {
      digits.value[i] = ''
    } else if (i > 0) {
      // 現在のボックスが空の場合、前のボックスを消してフォーカスを移す。
      digits.value[i - 1] = ''
      focus(i - 1)
    }
    e.preventDefault()
  } else if (e.key === 'ArrowLeft' && i > 0) {
    focus(i - 1)
  } else if (e.key === 'ArrowRight' && i < 3) {
    focus(i + 1)
  }
}

// フォーカス時に既存の値を選択状態にする（上書き入力しやすくするため）。
function onFocus(i: number) {
  inputRefs.value[i]?.select()
}

async function verifyPin() {
  if (locked.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    // digits.value.join(''): ['1','2','3','4'] → '1234' に変換してAPIに送る。
    const { data } = await tripsApi.verifyPin(hashUrl, digits.value.join(''))
    // PIN認証成功 → トークンを10分の有効期限付きで localStorage に保存する。
    // JSON.stringify: オブジェクトを文字列に変換して localStorage に保存できる形にする。
    // Date.now(): ミリ秒単位の現在時刻。10分 = 10 * 60 * 1000 ミリ秒。
    localStorage.setItem(`pin_token_${hashUrl}`, JSON.stringify({
      token: data.pin_token,
      expires: Date.now() + 10 * 60 * 1000,
    }))
    // replace(): 履歴に PIN ページを残さない（戻るボタンで PIN ページに戻らないようにする）。
    router.replace(`/trips/${hashUrl}`)
  } catch {
    attempts.value++
    digits.value = ['', '', '', '']
    if (attempts.value >= 3) {
      locked.value = true
      error.value = 'PINを3回間違えました。しばらくお待ちください。'
    } else {
      error.value = `PINが正しくありません。（残り${3 - attempts.value}回）`
      focus(0)
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="pin-page">
    <div class="pin-card">
      <h1>PIN入力</h1>
      <p class="subtitle">この旅行にはPINが設定されています</p>

      <div class="pin-inputs">
        <!--
          v-for で4つの input を生成する。
          :ref="(el) => setRef(el, i)": 動的 ref。各要素への参照を配列に保存する。
          :value="digits[i]": v-model の代わりに :value + @input で制御する。
          v-model は内部的に value + input を処理するが、
          ここでは入力値を加工（数字のみ抽出）する必要があるため手動で書いている。
        -->
        <input
          v-for="(_, i) in digits"
          :key="i"
          :ref="(el) => setRef(el as HTMLInputElement, i)"
          class="pin-input"
          :class="{ filled: digits[i] }"
          type="tel"
          inputmode="numeric"
          maxlength="1"
          :value="digits[i]"
          :disabled="locked || loading"
          autocomplete="off"
          @input="onInput(i, $event)"
          @keydown="onKeydown(i, $event)"
          @focus="onFocus(i)"
        />
      </div>

      <p v-if="loading" class="loading-text">確認中...</p>
      <p v-if="error" class="error">{{ error }}</p>

      <RouterLink to="/" class="back-link">トップに戻る</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.pin-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}
.pin-card {
  background: #fff;
  border-radius: 16px;
  padding: 48px 40px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  width: 100%;
  max-width: 360px;
}
h1 { font-size: 1.6rem; color: #2c3e50; margin-bottom: 8px; }
.subtitle { color: #888; font-size: 0.9rem; margin-bottom: 36px; }

.pin-inputs { display: flex; gap: 14px; justify-content: center; margin-bottom: 24px; }
.pin-input {
  width: 64px;
  height: 72px;
  font-size: 2rem;
  font-weight: bold;
  text-align: center;
  border: 2px solid #ddd;
  border-radius: 12px;
  outline: none;
  color: #2c3e50;
  background: #fff;
  transition: border-color 0.15s, box-shadow 0.15s;
  caret-color: transparent;
}
.pin-input:focus {
  border-color: #42b983;
  box-shadow: 0 0 0 3px rgba(66,185,131,0.15);
}
.pin-input.filled { border-color: #42b983; background: #f0faf6; }
.pin-input:disabled { background: #f5f5f5; color: #aaa; }

.loading-text { color: #888; font-size: 0.9rem; margin-bottom: 4px; }
.error { color: #e74c3c; font-size: 0.85rem; margin-bottom: 4px; }
.back-link { display: block; margin-top: 20px; color: #42b983; font-size: 0.9rem; text-decoration: none; }
.back-link:hover { text-decoration: underline; }
</style>
