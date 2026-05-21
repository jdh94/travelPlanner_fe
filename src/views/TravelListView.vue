<script setup lang="ts">
import { ref } from 'vue'

interface Travel {
  id: number
  destination: string
  startDate: string
  endDate: string
  memo: string
}

const travels = ref<Travel[]>([
  { id: 1, destination: '東京', startDate: '2026-06-01', endDate: '2026-06-05', memo: '浅草・渋谷観光' },
  { id: 2, destination: '京都', startDate: '2026-07-10', endDate: '2026-07-13', memo: '金閣寺・嵐山' },
  { id: 3, destination: '沖縄', startDate: '2026-08-20', endDate: '2026-08-25', memo: '海水浴・シュノーケル' },
])
</script>

<template>
  <main class="container">
    <h1>旅行プラン一覧</h1>
    <div class="travel-grid">
      <div v-for="travel in travels" :key="travel.id" class="travel-card">
        <h2>{{ travel.destination }}</h2>
        <p class="dates">{{ travel.startDate }} 〜 {{ travel.endDate }}</p>
        <p class="memo">{{ travel.memo }}</p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 40px auto;
  padding: 0 20px;
}

h1 {
  font-size: 1.8rem;
  margin-bottom: 24px;
  color: #2c3e50;
}

.travel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.travel-card {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.travel-card h2 {
  font-size: 1.3rem;
  margin: 0 0 8px;
  color: #42b983;
}

.dates {
  font-size: 0.85rem;
  color: #888;
  margin: 0 0 8px;
}

.memo {
  font-size: 0.95rem;
  color: #555;
  margin: 0;
}
</style>
