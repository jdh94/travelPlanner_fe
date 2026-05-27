<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useTripsStore } from '@/stores/trips'

const { t, locale } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const tripsStore = useTripsStore()

onMounted(() => {
  if (auth.isLoggedIn) {
    tripsStore.fetchTrips()
  }
})

function formatDate(date: string) {
  const localeMap: Record<string, string> = { ko: 'ko-KR', ja: 'ja-JP', en: 'en-US' }
  return new Date(date).toLocaleDateString(localeMap[locale.value] ?? 'en-US')
}

function visibilityLabel(v: string) {
  if (v === 'public') return t('common.visibility.public')
  return t('common.visibility.private')
}
</script>

<template>
  <div class="home">
    <!-- ヘッダー -->
    <header class="header">
      <div class="header-inner">
        <RouterLink to="/" class="logo">TravelPlanner</RouterLink>
        <nav class="nav">
          <template v-if="auth.isLoggedIn">
            <RouterLink to="/account" class="user-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>{{ auth.user?.username }}</span>
            </RouterLink>
            <button class="btn-logout" @click="auth.logout">{{ t('nav.logout') }}</button>
          </template>
          <template v-else>
            <RouterLink to="/login" class="btn-outline">{{ t('nav.login') }}</RouterLink>
            <RouterLink to="/register" class="btn-primary">{{ t('nav.register') }}</RouterLink>
          </template>
        </nav>
      </div>
    </header>

    <main class="main">

      <!-- 未ログイン：ヒーロー -->
      <template v-if="!auth.isLoggedIn">
        <div class="hero">
          <div class="hero-badge">{{ t('home.heroBadge') }}</div>
          <h2>{{ t('home.tagline') }}</h2>
          <p>{{ t('home.description') }}</p>
          <div class="hero-actions">
            <RouterLink to="/register" class="btn-primary btn-large">{{ t('home.startFree') }}</RouterLink>
          </div>
        </div>

        <div class="features">
          <div class="feature-card">
            <div class="feature-icon">🗺️</div>
            <h3>{{ t('home.feature1Title') }}</h3>
            <p>{{ t('home.feature1Desc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">👥</div>
            <h3>{{ t('home.feature2Title') }}</h3>
            <p>{{ t('home.feature2Desc') }}</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">💰</div>
            <h3>{{ t('home.feature3Title') }}</h3>
            <p>{{ t('home.feature3Desc') }}</p>
          </div>
        </div>
      </template>

      <!-- ログイン済み -->
      <template v-else>
        <div class="trips-section-header">
          <div class="trips-title-row">
            <div>
              <p class="trips-greeting">{{ t('home.greeting', { name: auth.user?.username }) }}</p>
              <h2>{{ t('nav.myTrips') }}</h2>
            </div>
            <RouterLink to="/trips/new" class="btn-new-trip">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {{ t('tripList.newTrip') }}
            </RouterLink>
          </div>
        </div>

        <div v-if="tripsStore.loading" class="loading">{{ t('common.loading') }}</div>

        <div v-else-if="tripsStore.trips.length === 0" class="empty">
          <p style="white-space: pre-line">{{ t('tripList.empty') }}</p>
        </div>

        <div v-else class="trip-grid">
          <div
            v-for="trip in tripsStore.trips"
            :key="trip.id"
            class="trip-card"
            @click="router.push(`/trips/${trip.hash_url}`)"
          >
            <div class="trip-card-header">
              <h3>{{ trip.title }}</h3>
              <span class="visibility-badge">{{ visibilityLabel(trip.visibility) }}</span>
            </div>
            <p class="dates">{{ formatDate(trip.start_date) }} 〜 {{ formatDate(trip.end_date) }}</p>
            <p v-if="trip.description" class="desc">{{ trip.description }}</p>
            <div class="trip-meta">
              <span>{{ trip.spots.length }} {{ t('home.spots') }}</span>
              <span>{{ trip.members.length }} {{ t('home.members') }}</span>
            </div>
          </div>
        </div>
      </template>

    </main>
  </div>
</template>

<style scoped>
.home { min-height: 100vh; background: #f5f7fa; }

/* ヘッダー */
.header {
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  position: sticky; top: 0; z-index: 10;
}
.header-inner {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 16px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}
.logo { font-size: 1.4rem; color: #42b983; margin: 0; text-decoration: none; font-weight: 700; flex-shrink: 0; }
.nav { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.user-chip {
  display: flex; align-items: center; gap: 6px;
  background: #f5f5f5; border-radius: 20px;
  padding: 6px 14px 6px 10px;
  font-size: 0.85rem; color: #444; font-weight: 500;
  text-decoration: none; transition: background 0.15s;
}
.user-chip:hover { background: #e8f5e9; color: #42b983; }
.user-chip svg { color: #42b983; flex-shrink: 0; }
.btn-logout {
  background: none; border: 1px solid #ddd; color: #888;
  padding: 6px 14px; border-radius: 20px; cursor: pointer;
  font-size: 0.85rem; transition: all 0.15s; white-space: nowrap;
}
.btn-logout:hover { border-color: #e74c3c; color: #e74c3c; background: #fff5f5; }

/* ログイン済みトップ */
.trips-section-header {
  padding: 28px 0 20px;
  border-bottom: 1px solid #eee;
  margin-bottom: 24px;
}
.trips-title-row {
  display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;
}
.trips-greeting { font-size: 0.85rem; color: #888; margin: 0 0 4px; }
.trips-greeting strong { color: #42b983; }
.trips-section-header h2 { font-size: 1.5rem; font-weight: 800; color: #1a2332; margin: 0; }
.btn-new-trip {
  display: flex; align-items: center; gap: 6px;
  background: #42b983; color: #fff; border: none;
  padding: 10px 20px; border-radius: 10px; cursor: pointer;
  font-size: 0.9rem; font-weight: 600; text-decoration: none;
  white-space: nowrap; flex-shrink: 0; transition: background 0.15s;
}
.btn-new-trip:hover { background: #369870; }

@media (max-width: 480px) {
  .user-chip span { display: none; }
  .user-chip { padding: 6px 10px; }
  .trips-section-header h2 { font-size: 1.2rem; }
  .trips-greeting { font-size: 0.8rem; }
}

/* メイン */
.main { max-width: 1000px; margin: 0 auto; padding: 0 24px 60px; }

/* ヒーロー */
.hero {
  text-align: center;
  padding: 80px 20px 60px;
  background: linear-gradient(135deg, #e8f5e9 0%, #f0faf6 50%, #e3f2fd 100%);
  margin: 0 -24px;
  padding-left: 24px;
  padding-right: 24px;
}
.hero-badge {
  display: inline-block;
  background: rgba(66,185,131,0.12);
  color: #42b983;
  border: 1px solid rgba(66,185,131,0.3);
  border-radius: 20px;
  padding: 6px 16px;
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 24px;
  letter-spacing: 0.02em;
}
.hero h2 {
  font-size: 2.4rem;
  font-weight: 800;
  color: #1a2332;
  margin-bottom: 16px;
  line-height: 1.3;
  letter-spacing: -0.02em;
}
.hero p {
  font-size: 1.05rem;
  color: #667;
  margin-bottom: 36px;
  max-width: 480px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.7;
}
.hero-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }

/* フィーチャーカード */
.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 48px;
}
.feature-card {
  background: #fff;
  border-radius: 16px;
  padding: 28px 24px;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}
.feature-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
.feature-icon { font-size: 2rem; margin-bottom: 14px; }
.feature-card h3 { font-size: 1rem; font-weight: 700; color: #1a2332; margin: 0 0 8px; }
.feature-card p { font-size: 0.85rem; color: #888; margin: 0; line-height: 1.6; }

@media (max-width: 600px) {
  .hero h2 { font-size: 1.7rem; }
  .features { grid-template-columns: 1fr; gap: 12px; }
  .feature-card { padding: 20px; text-align: left; display: flex; align-items: flex-start; gap: 16px; }
  .feature-icon { font-size: 1.6rem; margin-bottom: 0; flex-shrink: 0; }
}

/* ログイン済みヘッダー */

.loading { text-align: center; padding: 60px 0; color: #888; }

.empty {
  text-align: center;
  padding: 80px 20px;
  color: #999;
  font-size: 0.95rem;
  line-height: 1.7;
}

/* カードグリッド */
.trip-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}
.trip-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: transform 0.15s, box-shadow 0.15s;
}
.trip-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.1); }

.trip-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
.trip-card h3 { margin: 0; font-size: 1.05rem; color: #2c3e50; }
.visibility-badge { font-size: 0.7rem; background: #e8f5e9; color: #42b983; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
.dates { font-size: 0.85rem; color: #888; margin: 0 0 6px; }
.desc { font-size: 0.88rem; color: #555; margin: 0 0 10px; }
.trip-meta { display: flex; gap: 12px; font-size: 0.8rem; color: #aaa; }

/* ボタン */
.btn-primary {
  background: #42b983; color: #fff; border: none;
  padding: 9px 20px; border-radius: 8px; cursor: pointer;
  font-size: 0.9rem; text-decoration: none;
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 500; box-sizing: border-box;
  -webkit-appearance: none; appearance: none;
  line-height: 1.2; white-space: nowrap;
}
.btn-primary:hover { background: #369870; }
.btn-primary.btn-large { padding: 14px 36px; font-size: 1rem; border-radius: 10px; }
.btn-outline {
  background: transparent; color: #42b983; border: 1.5px solid #42b983;
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 0.9rem;
  text-decoration: none;
  display: inline-flex; align-items: center; justify-content: center;
  box-sizing: border-box; -webkit-appearance: none; appearance: none;
  line-height: 1.2; white-space: nowrap;
}
.btn-outline:hover { background: #f0faf6; }
.btn-secondary {
  background: #fff; color: #42b983; border: 2px solid #42b983;
  padding: 9px 20px; border-radius: 10px; cursor: pointer; font-size: 1rem;
  text-decoration: none;
  display: inline-flex; align-items: center; justify-content: center;
  font-weight: 500; box-sizing: border-box;
  -webkit-appearance: none; appearance: none;
  line-height: 1.2; white-space: nowrap;
}
.btn-secondary:hover { background: #42b983; color: #fff; }
.btn-secondary.btn-large { padding: 14px 36px; }
</style>
