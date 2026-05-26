// Vue アプリケーションのエントリーポイント（起動ファイル）。
// index.html の <div id="app"> をここで Vue が乗っ取って動作する。
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import i18n from './i18n'

import App from './App.vue'
import router from './router'

import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
// i18n: ブラウザ言語を自動検出して日本語/韓国語を切り替える。
app.use(i18n)

// app.mount('#app'): index.html の <div id="app"> に Vue アプリを紐付けて描画を開始する。
app.mount('#app')
