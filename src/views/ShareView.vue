<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { tripsApi, type Trip } from '@/api/trips'
import api from '@/api/client'

const route = useRoute()
const hashUrl = route.params.hashUrl as string

const trip = ref<Trip | null>(null)
const pin = ref('')
const pinEnabled = ref(false)
const saving = ref(false)
const copied = ref(false)

const shareUrl = computed(() => `${window.location.origin}/trips/${hashUrl}`)

onMounted(async () => {
  const { data } = await tripsApi.get(hashUrl)
  trip.value = data
  pinEnabled.value = data.pin_enabled
})

async function savePin() {
  saving.value = true
  try {
    await api.patch(`/trips/${hashUrl}/`, {
      pin_enabled: pinEnabled.value,
      pin: pinEnabled.value ? pin.value : '',
    })
  } finally {
    saving.value = false
  }
}

function copyUrl() {
  navigator.clipboard.writeText(shareUrl.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function shareLine() {
  window.open(`https://line.me/R/msg/text/?${encodeURIComponent(shareUrl.value)}`)
}

function shareKakao() {
  alert('KakaoTalk共有にはKakao SDKの設定が必要です。')
}

function shareInstagram() {
  navigator.clipboard.writeText(shareUrl.value)
  alert('URLをコピーしました。InstagramのDMに貼り付けてください。')
}
</script>

<template>
  <div class="share-page">
    <header class="header">
      <RouterLink :to="`/trips/${hashUrl}`" class="back-btn">← 旅行に戻る</RouterLink>
      <h1>共有・設定</h1>
    </header>

    <div class="content" v-if="trip">
      <!-- URLシェア -->
      <section class="card">
        <h2>共有URL</h2>
        <div class="url-box">
          <input :value="shareUrl" readonly class="url-input" />
          <button class="btn-primary" @click="copyUrl">
            {{ copied ? 'コピー済み ✓' : 'コピー' }}
          </button>
        </div>
        <div class="sns-buttons">
          <button class="sns-btn line" @click="shareLine">LINE</button>
          <button class="sns-btn instagram" @click="shareInstagram">Instagram</button>
          <button class="sns-btn kakao" @click="shareKakao">KakaoTalk</button>
        </div>
      </section>

      <!-- PIN設定 -->
      <section class="card">
        <h2>PIN設定（オプション）</h2>
        <p class="hint">PINを設定すると、URLにアクセスした際にPIN入力が必要になります。</p>
        <div class="pin-toggle">
          <label class="toggle-label">
            <input type="checkbox" v-model="pinEnabled" />
            <span>PIN認証を有効にする</span>
          </label>
        </div>
        <div v-if="pinEnabled" class="pin-input-row">
          <input
            v-model="pin"
            type="tel"
            maxlength="4"
            placeholder="4桁のPIN"
            class="pin-field"
            pattern="\d{4}"
          />
          <span class="pin-hint">半角数字4桁</span>
        </div>
        <button class="btn-primary" @click="savePin" :disabled="saving">
          {{ saving ? '保存中...' : '設定を保存' }}
        </button>
      </section>

      <!-- 参加メンバー -->
      <section class="card">
        <h2>参加メンバー（{{ trip.members.length }}人）</h2>
        <div v-if="trip.members.length === 0" class="no-members">まだメンバーがいません。</div>
        <div v-for="member in trip.members" :key="member.id" class="member-row">
          <span class="member-name">{{ member.user_name }}</span>
          <span class="member-role">{{ member.role === 'organizer' ? '幹事' : 'メンバー' }}</span>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.share-page { min-height: 100vh; background: #f5f7fa; }
.header {
  background: #fff;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.back-btn { color: #42b983; text-decoration: none; font-size: 0.9rem; }
h1 { margin: 0; font-size: 1.1rem; color: #2c3e50; }

.content { max-width: 600px; margin: 0 auto; padding: 24px 20px; }

.card { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
.card h2 { margin: 0 0 16px; font-size: 1rem; color: #2c3e50; }

.url-box { display: flex; gap: 8px; margin-bottom: 16px; }
.url-input { flex: 1; padding: 9px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 0.85rem; color: #555; background: #f9f9f9; }

.sns-buttons { display: flex; gap: 10px; flex-wrap: wrap; }
.sns-btn { padding: 9px 20px; border: none; border-radius: 8px; cursor: pointer; font-size: 0.9rem; font-weight: bold; color: #fff; }
.sns-btn.line { background: #06c755; }
.sns-btn.instagram { background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); }
.sns-btn.kakao { background: #fee500; color: #000; }

.hint { font-size: 0.85rem; color: #888; margin-bottom: 12px; }
.pin-toggle { margin-bottom: 12px; }
.toggle-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.9rem; }
.pin-input-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
.pin-field { width: 120px; padding: 9px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 1.1rem; text-align: center; letter-spacing: 4px; }
.pin-hint { font-size: 0.8rem; color: #aaa; }

.no-members { color: #aaa; font-size: 0.9rem; }
.member-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
.member-name { font-size: 0.9rem; color: #333; }
.member-role { font-size: 0.8rem; color: #42b983; }

.btn-primary { background: #42b983; color: #fff; border: none; padding: 9px 20px; border-radius: 8px; cursor: pointer; font-size: 0.9rem; }
.btn-primary:hover { background: #369870; }
.btn-primary:disabled { background: #a0d9bf; cursor: not-allowed; }
</style>
