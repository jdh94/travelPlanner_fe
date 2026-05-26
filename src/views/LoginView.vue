<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    const redirect = route.query.redirect as string
    router.push(redirect || '/')
  } catch (e: any) {
    const detail = e.response?.data?.detail
    error.value = detail || t('auth.loginError')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1>{{ t('auth.loginTitle') }}</h1>
      <form @submit.prevent="handleLogin">
        <div class="field">
          <label>{{ t('auth.email') }}</label>
          <input v-model="email" type="email" placeholder="email@example.com" required />
        </div>
        <div class="field">
          <label>{{ t('auth.password') }}</label>
          <input v-model="password" type="password" :placeholder="t('auth.password')" required />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" :disabled="loading" class="btn-primary">
          {{ loading ? t('auth.loggingIn') : t('auth.loginBtn') }}
        </button>
      </form>
      <p class="link-text">
        {{ t('auth.noAccount') }}
        <RouterLink to="/register">{{ t('nav.register') }}</RouterLink>
      </p>
      <p class="link-text">
        <RouterLink to="/forgot-password">{{ t('auth.forgotPassword') }}</RouterLink>
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
  width: 100%; padding: 10px 12px; border: 1px solid #ddd;
  border-radius: 8px; font-size: 1rem; box-sizing: border-box;
}
input:focus { outline: none; border-color: #42b983; }
.error { color: #e74c3c; font-size: 0.85rem; margin-bottom: 8px; }
.btn-primary {
  width: 100%; padding: 12px; background: #42b983; color: #fff;
  border: none; border-radius: 8px; font-size: 1rem; cursor: pointer; transition: background 0.2s;
}
.btn-primary:hover:not(:disabled) { background: #369870; }
.btn-primary:disabled { background: #a0d9bf; cursor: not-allowed; }
.link-text { text-align: center; margin-top: 16px; font-size: 0.9rem; color: #666; }
.link-text a { color: #42b983; text-decoration: none; }
</style>
