<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { accountApi } from '@/api/trips'

const router = useRouter()
const auth = useAuthStore()

// --- ニックネーム変更 ---
const editingNickname = ref(false)
const newUsername = ref('')
const usernameLoading = ref(false)
const usernameMsg = ref('')
const usernameError = ref('')

async function changeUsername() {
  usernameMsg.value = ''
  usernameError.value = ''
  if (!newUsername.value.trim()) {
    usernameError.value = 'ユーザー名を入力してください。'
    return
  }
  usernameLoading.value = true
  try {
    const { data } = await accountApi.changeUsername(newUsername.value.trim())
    if (auth.user) auth.user.username = data.username
    usernameMsg.value = 'ニックネームを変更しました。'
    newUsername.value = ''
    setTimeout(() => { editingNickname.value = false; usernameMsg.value = '' }, 1200)
  } catch (e: any) {
    usernameError.value = e.response?.data?.detail ?? 'エラーが発生しました。'
  } finally {
    usernameLoading.value = false
  }
}

// --- パスワード変更 ---
const currentPassword = ref('')
const newPassword = ref('')
const newPasswordConfirm = ref('')
const passwordLoading = ref(false)
const passwordMsg = ref('')
const passwordError = ref('')

async function changePassword() {
  passwordMsg.value = ''
  passwordError.value = ''
  if (newPassword.value !== newPasswordConfirm.value) {
    passwordError.value = '新しいパスワードが一致しません。'
    return
  }
  if (newPassword.value.length < 8) {
    passwordError.value = 'パスワードは8文字以上で設定してください。'
    return
  }
  passwordLoading.value = true
  const email = auth.user?.email ?? ''
  const nextPassword = newPassword.value
  try {
    await accountApi.changePassword(currentPassword.value, nextPassword)
    // 新しいパスワードで自動再ログイン → ログアウトせずに続けて使える
    await auth.login(email, nextPassword)
    passwordMsg.value = 'パスワードを変更しました。'
    currentPassword.value = ''
    newPassword.value = ''
    newPasswordConfirm.value = ''
  } catch (e: any) {
    passwordError.value = e.response?.data?.detail ?? 'エラーが発生しました。'
  } finally {
    passwordLoading.value = false
  }
}

// --- 会員脱退 ---
const showDeactivateConfirm = ref(false)
const deactivating = ref(false)

async function deactivateAccount() {
  deactivating.value = true
  try {
    await accountApi.deactivate()
    auth.logout()
    router.push('/')
  } finally {
    deactivating.value = false
  }
}
</script>

<template>
  <div class="account-page">
    <header class="header">
      <button class="back-btn" @click="router.push('/')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <h1>アカウント設定</h1>
    </header>

    <div class="content">

      <!-- アカウント情報 -->
      <section class="card">
        <h2>アカウント情報</h2>
        <div class="info-row">
          <div class="info-avatar">{{ auth.user?.username?.charAt(0).toUpperCase() }}</div>
          <div class="info-detail">
            <div class="info-name-row">
              <p class="info-name">{{ auth.user?.username }}</p>
              <button class="btn-nickname-edit" @click="editingNickname = !editingNickname; newUsername = auth.user?.username ?? ''">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                編集
              </button>
            </div>
            <p class="info-email">{{ auth.user?.email }}</p>
          </div>
        </div>

        <!-- インライン ニックネーム編集 -->
        <div v-if="editingNickname" class="nickname-edit-area">
          <div class="nickname-input-row">
            <input
              v-model="newUsername"
              type="text"
              placeholder="新しいニックネーム"
              maxlength="30"
              class="nickname-input"
              autocomplete="nickname"
              @keyup.enter="changeUsername"
            />
            <button class="btn-nickname-save" :disabled="usernameLoading || !newUsername.trim()" @click="changeUsername">
              {{ usernameLoading ? '…' : '保存' }}
            </button>
            <button class="btn-nickname-cancel" @click="editingNickname = false; newUsername = auth.user?.username ?? ''">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <p v-if="usernameError" class="msg-error">{{ usernameError }}</p>
          <p v-if="usernameMsg" class="msg-success">{{ usernameMsg }}</p>
        </div>
      </section>

      <!-- パスワード変更 -->
      <section class="card">
        <h2>パスワード変更</h2>
        <p class="section-desc">現在のパスワードと新しいパスワードを入力してください。</p>

        <div class="field">
          <label>現在のパスワード</label>
          <input v-model="currentPassword" type="password" placeholder="現在のパスワード" />
        </div>
        <div class="field">
          <label>新しいパスワード <span class="hint">（8文字以上）</span></label>
          <input v-model="newPassword" type="password" placeholder="新しいパスワード" />
        </div>
        <div class="field">
          <label>新しいパスワード（確認）</label>
          <input v-model="newPasswordConfirm" type="password" placeholder="もう一度入力" />
        </div>

        <p v-if="passwordError" class="msg-error">{{ passwordError }}</p>
        <p v-if="passwordMsg" class="msg-success">{{ passwordMsg }}</p>

        <button
          class="btn-primary"
          :disabled="passwordLoading || !currentPassword || !newPassword || !newPasswordConfirm"
          @click="changePassword"
        >
          {{ passwordLoading ? '変更中...' : 'パスワードを変更する' }}
        </button>
      </section>

      <!-- 危険な操作 -->
      <section class="card danger-card">
        <h2>会員脱退</h2>
        <p class="section-desc">
          アカウントを無効化します。<br>
          これまでの旅行データは保持されますが、ログインできなくなります。
        </p>

        <div v-if="!showDeactivateConfirm">
          <button class="btn-danger" @click="showDeactivateConfirm = true">退会する</button>
        </div>

        <div v-else class="confirm-box">
          <p class="confirm-text">⚠️ 本当に退会しますか？この操作は取り消せません。</p>
          <div class="confirm-actions">
            <button class="btn-cancel" @click="showDeactivateConfirm = false">キャンセル</button>
            <button class="btn-danger" :disabled="deactivating" @click="deactivateAccount">
              {{ deactivating ? '処理中...' : '退会を確定する' }}
            </button>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>

<style scoped>
.account-page { min-height: 100vh; background: #f5f7fa; }

.header {
  background: #fff;
  display: flex; align-items: center; gap: 12px;
  padding: 0 16px; height: 56px;
  box-shadow: 0 1px 0 rgba(0,0,0,0.07);
  position: sticky; top: 0; z-index: 10;
}
.back-btn {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; background: none; border: none;
  cursor: pointer; color: #42b983; border-radius: 8px;
}
.back-btn:hover { background: #f0faf6; }
h1 { margin: 0; font-size: 1rem; font-weight: 700; color: #1a2332; }

.content { max-width: 540px; margin: 0 auto; padding: 24px 16px; display: flex; flex-direction: column; gap: 16px; }

.card { background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.card h2 { margin: 0 0 6px; font-size: 1rem; font-weight: 700; color: #1a2332; }
.section-desc { font-size: 0.83rem; color: #999; margin: 0 0 18px; line-height: 1.5; }

/* アカウント情報 */
.info-row { display: flex; align-items: center; gap: 14px; margin-top: 16px; }
.info-avatar {
  width: 52px; height: 52px; border-radius: 50%;
  background: #42b983; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.3rem; font-weight: 700; flex-shrink: 0;
}
.info-detail { flex: 1; min-width: 0; }
.info-name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
.info-name { margin: 0; font-size: 1rem; font-weight: 600; color: #1a2332; }
.info-email { margin: 0; font-size: 0.85rem; color: #666; }
.btn-nickname-edit {
  display: inline-flex; align-items: center; gap: 4px;
  background: #f4f9ff; border: 1px solid #b8d4f0; color: #4a90d9;
  font-size: 0.72rem; font-weight: 500; padding: 2px 8px;
  border-radius: 20px; cursor: pointer;
  transition: background 0.15s, color 0.15s; white-space: nowrap; flex-shrink: 0;
}
.btn-nickname-edit:hover { background: #4a90d9; border-color: #4a90d9; color: #fff; }

/* ニックネーム インライン編集 */
.nickname-edit-area { margin-top: 14px; padding-top: 14px; border-top: 1px solid #f0f0f0; }
.nickname-input-row { display: flex; gap: 8px; align-items: center; }
.nickname-input {
  flex: 1; padding: 9px 12px; border: 1px solid #ddd;
  border-radius: 10px; font-size: 0.9rem; outline: none;
  box-sizing: border-box; transition: border-color 0.15s;
}
.nickname-input:focus { border-color: #42b983; }
.btn-nickname-save {
  padding: 9px 16px; background: #42b983; color: #fff;
  border: none; border-radius: 10px; font-size: 0.88rem; font-weight: 600;
  cursor: pointer; white-space: nowrap; transition: background 0.15s; flex-shrink: 0;
}
.btn-nickname-save:hover:not(:disabled) { background: #369870; }
.btn-nickname-save:disabled { background: #a0d9bf; cursor: not-allowed; }
.btn-nickname-cancel {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; background: #f5f5f5; border: none;
  border-radius: 8px; cursor: pointer; color: #999; flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}
.btn-nickname-cancel:hover { background: #eee; color: #555; }

/* フォーム */
.field { margin-bottom: 14px; }
label { display: block; font-size: 0.82rem; color: #666; margin-bottom: 5px; font-weight: 500; }
.hint { color: #aaa; font-weight: 400; }
input[type="password"] {
  width: 100%; padding: 10px 14px; border: 1px solid #ddd;
  border-radius: 10px; font-size: 0.9rem; box-sizing: border-box; outline: none;
}
input:focus { border-color: #42b983; }

.msg-error { color: #e74c3c; font-size: 0.85rem; margin: 0 0 12px; }
.msg-success { color: #42b983; font-size: 0.85rem; margin: 0 0 12px; }

.btn-primary {
  width: 100%; padding: 11px; background: #42b983; color: #fff;
  border: none; border-radius: 10px; font-size: 0.9rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s;
}
.btn-primary:hover:not(:disabled) { background: #369870; }
.btn-primary:disabled { background: #a0d9bf; cursor: not-allowed; }

/* 危険ゾーン */
.danger-card { border: 1px solid #ffd0d0; }
.btn-danger {
  background: #fff; color: #e74c3c; border: 1px solid #e74c3c;
  padding: 10px 22px; border-radius: 8px; cursor: pointer;
  font-size: 0.9rem; transition: all 0.15s;
}
.btn-danger:hover:not(:disabled) { background: #e74c3c; color: #fff; }
.btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
.confirm-box { background: #fff5f5; border-radius: 10px; padding: 16px; margin-top: 12px; }
.confirm-text { font-size: 0.88rem; color: #e74c3c; margin: 0 0 14px; }
.confirm-actions { display: flex; gap: 10px; }
.btn-cancel {
  background: #f5f5f5; color: #666; border: none;
  padding: 9px 20px; border-radius: 8px; cursor: pointer; font-size: 0.9rem;
}
.btn-cancel:hover { background: #eee; }
</style>
