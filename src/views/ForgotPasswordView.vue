<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { accountApi, authApi } from '@/api/trips'

const router = useRouter()

type Step = 'email' | 'code' | 'password' | 'done'
const step = ref<Step>('email')

const email = ref('')
const code = ref('')
const verificationToken = ref('')
const newPassword = ref('')
const newPasswordConfirm = ref('')

const loading = ref(false)
const error = ref('')
const msg = ref('')

// STEP1: メール送信
async function sendCode() {
  error.value = ''
  loading.value = true
  try {
    await accountApi.sendReset(email.value.trim())
    step.value = 'code'
    msg.value = '認証コードを送信しました。メールをご確認ください。'
  } catch (e: any) {
    error.value = e.response?.data?.detail ?? 'メール送信に失敗しました。'
  } finally {
    loading.value = false
  }
}

// STEP2: コード検証
async function verifyCode() {
  error.value = ''
  loading.value = true
  try {
    const { data } = await authApi.verifyEmail(email.value.trim(), code.value.trim())
    verificationToken.value = data.verification_token
    step.value = 'password'
    msg.value = ''
  } catch (e: any) {
    error.value = e.response?.data?.detail ?? 'コードが正しくありません。'
  } finally {
    loading.value = false
  }
}

// STEP3: 新しいパスワード設定
async function resetPassword() {
  error.value = ''
  if (newPassword.value !== newPasswordConfirm.value) {
    error.value = 'パスワードが一致しません。'
    return
  }
  if (newPassword.value.length < 8) {
    error.value = 'パスワードは8文字以上で設定してください。'
    return
  }
  loading.value = true
  try {
    await accountApi.verifyAndReset(email.value.trim(), verificationToken.value, newPassword.value)
    step.value = 'done'
  } catch (e: any) {
    error.value = e.response?.data?.detail ?? 'エラーが発生しました。'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="forgot-page">
    <div class="card">

      <button class="back-btn" @click="router.push('/login')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        ログインに戻る
      </button>

      <h1>パスワードを再設定</h1>

      <!-- STEP1: メール入力 -->
      <template v-if="step === 'email'">
        <p class="desc">登録したメールアドレスに認証コードを送ります</p>
        <div class="field">
          <label>メールアドレス</label>
          <input v-model="email" type="email" placeholder="email@example.com" @keyup.enter="sendCode" />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="btn-primary" :disabled="loading || !email" @click="sendCode">
          {{ loading ? '送信中...' : '認証コードを送る' }}
        </button>
      </template>

      <!-- STEP2: コード入力 -->
      <template v-else-if="step === 'code'">
        <p class="desc-success">{{ msg }}</p>
        <p class="desc">{{ email }} に届いた6桁のコードを入力してください</p>
        <div class="field">
          <label>認証コード</label>
          <input
            v-model="code"
            type="text"
            inputmode="numeric"
            maxlength="6"
            placeholder="000000"
            class="code-input"
            @keyup.enter="verifyCode"
          />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="btn-primary" :disabled="loading || code.length < 6" @click="verifyCode">
          {{ loading ? '確認中...' : 'コードを確認する' }}
        </button>
        <button class="btn-resend" @click="step = 'email'">メールアドレスを変更</button>
      </template>

      <!-- STEP3: 新しいパスワード -->
      <template v-else-if="step === 'password'">
        <p class="desc">新しいパスワードを設定してください（8文字以上）</p>
        <div class="field">
          <label>新しいパスワード</label>
          <input v-model="newPassword" type="password" placeholder="新しいパスワード" />
        </div>
        <div class="field">
          <label>新しいパスワード（確認）</label>
          <input v-model="newPasswordConfirm" type="password" placeholder="もう一度入力" @keyup.enter="resetPassword" />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button class="btn-primary" :disabled="loading || !newPassword || !newPasswordConfirm" @click="resetPassword">
          {{ loading ? '設定中...' : 'パスワードを設定する' }}
        </button>
      </template>

      <!-- 完了 -->
      <template v-else>
        <div class="done">
          <div class="done-icon">✅</div>
          <h2>パスワードを再設定しました</h2>
          <p>新しいパスワードでログインしてください。</p>
          <button class="btn-primary" @click="router.push('/login')">ログインへ</button>
        </div>
      </template>

      <!-- ステップ表示 -->
      <div v-if="step !== 'done'" class="steps">
        <span :class="{ active: step === 'email', done: step !== 'email' }">1</span>
        <span :class="{ active: step === 'code', done: step === 'password' }">2</span>
        <span :class="{ active: step === 'password' }">3</span>
      </div>

    </div>
  </div>
</template>

<style scoped>
.forgot-page {
  min-height: 100vh; background: #f5f7fa;
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.card {
  background: #fff; border-radius: 16px; padding: 36px 32px;
  width: 100%; max-width: 420px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}
.back-btn {
  display: flex; align-items: center; gap: 4px;
  background: none; border: none; cursor: pointer;
  color: #42b983; font-size: 0.85rem; padding: 0; margin-bottom: 20px;
}
h1 { font-size: 1.4rem; font-weight: 800; color: #1a2332; margin: 0 0 8px; }
.desc { font-size: 0.88rem; color: #888; margin: 0 0 20px; line-height: 1.5; }
.desc-success { font-size: 0.88rem; color: #42b983; margin: 0 0 8px; font-weight: 500; }

.field { margin-bottom: 14px; }
label { display: block; font-size: 0.82rem; color: #666; margin-bottom: 5px; font-weight: 500; }
input {
  width: 100%; padding: 11px 14px; border: 1px solid #ddd;
  border-radius: 10px; font-size: 0.95rem; box-sizing: border-box; outline: none;
}
input:focus { border-color: #42b983; }
.code-input { font-size: 1.4rem; letter-spacing: 0.3em; text-align: center; }

.error { color: #e74c3c; font-size: 0.85rem; margin: 0 0 12px; }

.btn-primary {
  width: 100%; padding: 12px; background: #42b983; color: #fff;
  border: none; border-radius: 10px; font-size: 0.95rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s; margin-top: 4px;
}
.btn-primary:hover:not(:disabled) { background: #369870; }
.btn-primary:disabled { background: #a0d9bf; cursor: not-allowed; }

.btn-resend {
  width: 100%; padding: 10px; background: none; border: none;
  color: #aaa; font-size: 0.85rem; cursor: pointer; margin-top: 8px;
}
.btn-resend:hover { color: #42b983; }

/* 完了 */
.done { text-align: center; padding: 16px 0; }
.done-icon { font-size: 3rem; margin-bottom: 16px; }
.done h2 { font-size: 1.1rem; color: #1a2332; margin: 0 0 8px; }
.done p { font-size: 0.88rem; color: #888; margin: 0 0 24px; }

/* ステップ */
.steps {
  display: flex; justify-content: center; gap: 8px; margin-top: 28px;
}
.steps span {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.78rem; font-weight: 700;
  background: #eee; color: #bbb;
}
.steps span.active { background: #42b983; color: #fff; }
.steps span.done { background: #e8f5e9; color: #42b983; }
</style>
