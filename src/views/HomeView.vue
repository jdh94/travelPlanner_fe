<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTripsStore } from '@/stores/trips'

const router = useRouter()
const auth = useAuthStore()
const tripsStore = useTripsStore()

onMounted(() => {
  if (auth.isLoggedIn) {
    tripsStore.fetchTrips()
  }
})

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('ja-JP')
}
</script>

<template>
  <div class="home">
    <!-- ヘッダー -->
    <header class="header">
      <div class="header-inner">
        <h1 class="logo">TravelPlaner</h1>
        <nav class="nav">
          <template v-if="auth.isLoggedIn">
            <span class="username">{{ auth.user?.username }}</span>
            <button class="btn-outline" @click="auth.logout">ログアウト</button>
          </template>
          <template v-else>
            <RouterLink to="/login" class="btn-outline">ログイン</RouterLink>
            <RouterLink to="/register" class="btn-primary">新規登録</RouterLink>
          </template>
        </nav>
      </div>
    </header>

    <main class="main">

      <!-- 未ログイン：ヒーロー -->
      <template v-if="!auth.isLoggedIn">
        <div class="hero">
          <h2>旅の計画を、最高の体験に。</h2>
          <p>友達・家族と旅行プランを共同作成・URLシェアできるプラットフォーム</p>
          <div class="hero-actions">
            <RouterLink to="/register" class="btn-primary btn-large">無料で始める</RouterLink>
            <RouterLink to="/login" class="btn-outline btn-large">ログイン</RouterLink>
          </div>
        </div>
      </template>

      <!-- ログイン済み -->
      <template v-else>
        <div class="page-header">
          <h2>マイトリップ</h2>
          <RouterLink to="/trips/new" class="btn-primary">+ 新規旅行</RouterLink>
        </div>

        <div v-if="tripsStore.loading" class="loading">読み込み中...</div>

        <div v-else-if="tripsStore.trips.length === 0" class="empty">
          <p>旅行プランがまだありません。<br>最初の旅行を作成しましょう！</p>
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
              <span class="visibility-badge">
                {{ trip.visibility === 'public' ? '公開' : trip.visibility === 'friends' ? '友達のみ' : '非公開' }}
              </span>
            </div>
            <p class="dates">{{ formatDate(trip.start_date) }} 〜 {{ formatDate(trip.end_date) }}</p>
            <p v-if="trip.description" class="desc">{{ trip.description }}</p>
            <div class="trip-meta">
              <span>{{ trip.spots.length }} スポット</span>
              <span>{{ trip.members.length }} メンバー</span>
            </div>
          </div>
        </div>
      </template>

    </main>
  </div>
</template>

<style scoped>
.home { min-height: 100vh; background: #f5f7fa; }

/* ヘッダー：全幅帯 + 内側をmax-widthで中央揃え */
.header {
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.header-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 24px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.logo { font-size: 1.4rem; color: #42b983; margin: 0; }
.nav { display: flex; align-items: center; gap: 12px; }
.username { font-size: 0.9rem; color: #666; }

/* メイン：ヘッダーと同じ幅で中央揃え */
.main {
  max-width: 960px;
  margin: 0 auto;
  padding: 40px 24px;
}

/* ヒーロー */
.hero {
  text-align: center;
  padding: 80px 20px;
}
.hero h2 {
  font-size: 1.8rem;
  color: #2c3e50;
  margin-bottom: 12px;
}
.hero p {
  font-size: 1.05rem;
  color: #666;
  margin-bottom: 32px;
}
.hero-actions { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }

/* ログイン済みヘッダー */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.page-header h2 { font-size: 1.4rem; color: #2c3e50; margin: 0; }

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
  font-size: 0.9rem; text-decoration: none; display: inline-block;
  font-weight: 500;
}
.btn-primary:hover { background: #369870; }
.btn-primary.btn-large { padding: 14px 36px; font-size: 1rem; border-radius: 10px; }
.btn-outline {
  background: transparent; color: #42b983; border: 1px solid #42b983;
  padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 0.9rem;
  text-decoration: none; display: inline-block;
}
.btn-outline:hover { background: #f0faf6; }
</style>
