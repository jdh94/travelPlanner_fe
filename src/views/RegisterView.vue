<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const username = ref('')
const password = ref('')
const passwordConfirm = ref('')
const error = ref('')
const loading = ref(false)

async function handleRegister() {
  error.value = ''
  if (password.value !== passwordConfirm.value) {
    error.value = 'パスワードが一致しません。'
    return
  }
  loading.value = true
  try {
    await auth.register(email.value, username.value, password.value)
    const redirect = route.query.redirect as string
    router.push(redirect || '/')
  } catch (e: any) {
    const data = e.response?.data
    if (data && typeof data === 'object') {
      const msg = Object.values(data).flat().join(' / ')
      error.value = msg || '登録に失敗しました。'
    } else {
      error.value = '登録に失敗しました。'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1>新規登録</h1>
      <form @submit.prevent="handleRegister">
        <div class="field">
          <label>ユーザー名</label>
          <input v-model="username" type="text" placeholder="ユーザー名" required />
        </div>
        <div class="field">
          <label>メールアドレス</label>
          <input v-model="email" type="email" placeholder="email@example.com" required />
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
  max-width: 400px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}
h1 {
  font-size: 1.6rem;
  margin-bottom: 24px;
  color: #2c3e50;
  text-align: center;
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
}
.btn-primary:hover:not(:disabled) { background: #369870; }
.btn-primary:disabled { background: #a0d9bf; cursor: not-allowed; }
.link-text { text-align: center; margin-top: 16px; font-size: 0.9rem; color: #666; }
.link-text a { color: #42b983; text-decoration: none; }
</style>
