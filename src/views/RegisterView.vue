<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api/trips'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// step: 現在どのステップにいるかを管理する。
// 1 = メール入力・送信、2 = コード入力・認証、3 = ユーザー名・パスワード入力・登録
const step = ref<1 | 2 | 3>(1)

// 各ステップで使うデータ
const email = ref('')
const code = ref('')
const verificationToken = ref('')  // ステップ2認証成功後にサーバーから受け取る
const username = ref('')
const password = ref('')
const passwordConfirm = ref('')

const error = ref('')
const loading = ref(false)
const resendCooldown = ref(0)  // 再送信のクールダウン秒数

// ステップ1: メール送信
async function sendCode() {
  error.value = ''
  loading.value = true
  try {
    await authApi.sendVerification(email.value)
    step.value = 2
    startResendCooldown()
  } catch (e: any) {
    error.value = e.response?.data?.detail || t('auth.sendFailed')
  } finally {
    loading.value = false
  }
}

// ステップ2: コード検証
async function verifyCode() {
  error.value = ''
  loading.value = true
  try {
    const { data } = await authApi.verifyEmail(email.value, code.value)
    verificationToken.value = data.verification_token
    step.value = 3
  } catch (e: any) {
    error.value = e.response?.data?.detail || t('auth.verifyFailed')
    code.value = ''
  } finally {
    loading.value = false
  }
}

// ステップ3: 会員登録
async function handleRegister() {
  error.value = ''
  if (password.value !== passwordConfirm.value) {
    error.value = t('auth.passwordMismatch')
    return
  }
  loading.value = true
  try {
    await auth.register(email.value, username.value, password.value, verificationToken.value)
    const redirect = route.query.redirect as string
    router.push(redirect || '/')
  } catch (e: any) {
    const data = e.response?.data
    if (data && typeof data === 'object') {
      const msg = Object.values(data).flat().join(' / ')
      error.value = msg || t('auth.registerFailed')
    } else {
      error.value = t('auth.registerFailed')
    }
  } finally {
    loading.value = false
  }
}

// 再送信ボタン: 60秒間押せないようにクールダウンを管理する
function startResendCooldown() {
  resendCooldown.value = 60
  const timer = setInterval(() => {
    resendCooldown.value--
    if (resendCooldown.value <= 0) clearInterval(timer)
  }, 1000)
}

async function resendCode() {
  if (resendCooldown.value > 0) return
  error.value = ''
  loading.value = true
  try {
    await authApi.sendVerification(email.value)
    startResendCooldown()
    error.value = ''
  } catch (e: any) {
    error.value = e.response?.data?.detail || t('auth.sendFailed')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">

      <!-- ステップインジケーター -->
      <div class="steps">
        <div class="step" :class="{ active: step >= 1, done: step > 1 }">
          <span class="step-num">{{ step > 1 ? '✓' : '1' }}</span>
          <span class="step-label">メール</span>
        </div>
        <div class="step-line" :class="{ active: step >= 2 }"></div>
        <div class="step" :class="{ active: step >= 2, done: step > 2 }">
          <span class="step-num">{{ step > 2 ? '✓' : '2' }}</span>
          <span class="step-label">認証</span>
        </div>
        <div class="step-line" :class="{ active: step >= 3 }"></div>
        <div class="step" :class="{ active: step >= 3 }">
          <span class="step-num">3</span>
          <span class="step-label">登録</span>
        </div>
      </div>

      <!-- STEP 1: メールアドレス入力 -->
      <div v-if="step === 1">
        <h1>新規登録</h1>
        <p class="step-desc">登録するメールアドレスに認証コードを送ります。</p>
        <form @submit.prevent="sendCode">
          <div class="field">
            <label>メールアドレス</label>
            <input v-model="email" type="email" placeholder="email@example.com" required />
          </div>
          <p v-if="error" class="error">{{ error }}</p>
          <button type="submit" :disabled="loading" class="btn-primary">
            {{ loading ? '送信中...' : '認証コードを送る' }}
          </button>
        </form>
        <p class="link-text">
          すでにアカウントをお持ちの方は
          <RouterLink to="/login">ログイン</RouterLink>
        </p>
      </div>

      <!-- STEP 2: 認証コード入力 -->
      <div v-if="step === 2">
        <h1>認証コードを入力</h1>
        <p class="step-desc">
          <strong>{{ email }}</strong> に送信した<br>
          6桁のコードを入力してください。
        </p>
        <form @submit.prevent="verifyCode">
          <div class="field">
            <label>認証コード（6桁）</label>
            <input
              v-model="code"
              type="tel"
              inputmode="numeric"
              maxlength="6"
              placeholder="123456"
              class="code-input"
              @input="code = code.replace(/\D/g, '').slice(0, 6)"
              required
            />
          </div>
          <p v-if="error" class="error">{{ error }}</p>
          <button type="submit" :disabled="loading || code.length !== 6" class="btn-primary">
            {{ loading ? '確認中...' : '認証する' }}
          </button>
        </form>
        <!-- 再送信ボタン: クールダウン中は秒数を表示する -->
        <p class="resend-area">
          コードが届かない場合は
          <button
            class="btn-resend"
            :disabled="resendCooldown > 0 || loading"
            @click="resendCode"
          >
            {{ resendCooldown > 0 ? `再送信 (${resendCooldown}秒)` : '再送信' }}
          </button>
        </p>
        <p class="back-link" @click="step = 1">← メールアドレスを変更する</p>
      </div>

      <!-- STEP 3: ユーザー情報入力 -->
      <div v-if="step === 3">
        <h1>アカウント情報</h1>
        <p class="step-desc">
          <span class="verified-badge">✓ {{ email }}</span> 認証済み
        </p>
        <form @submit.prevent="handleRegister">
          <div class="field">
            <label>ニックネーム</label>
            <input v-model="username" type="text" placeholder="ニックネーム" required />
          </div>
          <div class="field">
            <label>パスワード（8文字以上）</label>
            <input v-model="password" type="password" placeholder="パスワード" required minlength="8" />
          </div>
          <div class="field">
            <label>パスワード（確認）</label>
            <input v-model="passwordConfirm" type="password" placeholder="パスワードを再入力" required />
          </div>
          <p v-if="error" class="error">{{ error }}</p>
          <button type="submit" :disabled="loading" class="btn-primary">
            {{ loading ? '登録中...' : '登録する' }}
          </button>
        </form>
        <p class="link-text">
          すでにアカウントをお持ちの方は
          <RouterLink to="/login">ログイン</RouterLink>
        </p>
      </div>

    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}
.auth-card {
  background: #fff;
  border-radius: 12px;
  padding: 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

/* ステップインジケーター */
.steps {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 28px;
  gap: 0;
}
.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.step-num {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e0e0e0;
  color: #999;
  font-size: 0.85rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}
.step.active .step-num { background: #42b983; color: #fff; }
.step.done .step-num { background: #42b983; color: #fff; }
.step-label { font-size: 0.72rem; color: #999; }
.step.active .step-label, .step.done .step-label { color: #42b983; }
.step-line {
  flex: 1;
  height: 2px;
  background: #e0e0e0;
  margin: 0 4px;
  margin-bottom: 18px;
  transition: background 0.3s;
}
.step-line.active { background: #42b983; }

h1 {
  font-size: 1.4rem;
  margin-bottom: 8px;
  color: #2c3e50;
  text-align: center;
}
.step-desc {
  text-align: center;
  font-size: 0.88rem;
  color: #777;
  margin-bottom: 24px;
  line-height: 1.6;
}
.verified-badge {
  color: #42b983;
  font-weight: bold;
  font-size: 0.9rem;
}

.field { margin-bottom: 16px; }
label { display: block; font-size: 0.85rem; color: #666; margin-bottom: 4px; }
input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  box-sizing: border-box;
}
input:focus { outline: none; border-color: #42b983; }

.code-input {
  font-size: 1.6rem;
  letter-spacing: 0.5em;
  text-align: center;
  font-weight: bold;
  color: #2c3e50;
}

.error { color: #e74c3c; font-size: 0.85rem; margin-bottom: 8px; }

.btn-primary {
  width: 100%;
  padding: 12px;
  background: #42b983;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 4px;
}
.btn-primary:hover:not(:disabled) { background: #369870; }
.btn-primary:disabled { background: #a0d9bf; cursor: not-allowed; }

.resend-area {
  text-align: center;
  font-size: 0.85rem;
  color: #888;
  margin-top: 16px;
}
.btn-resend {
  background: none;
  border: none;
  color: #42b983;
  cursor: pointer;
  font-size: 0.85rem;
  text-decoration: underline;
  padding: 0;
}
.btn-resend:disabled { color: #aaa; cursor: not-allowed; text-decoration: none; }

.back-link {
  text-align: center;
  font-size: 0.82rem;
  color: #aaa;
  margin-top: 12px;
  cursor: pointer;
}
.back-link:hover { color: #42b983; }

.link-text { text-align: center; margin-top: 16px; font-size: 0.9rem; color: #666; }
.link-text a { color: #42b983; text-decoration: none; }
</style>
