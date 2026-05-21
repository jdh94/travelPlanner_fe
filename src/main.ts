// Vue アプリケーションのエントリーポイント（起動ファイル）。
// index.html の <div id="app"> をここで Vue が乗っ取って動作する。
import { createApp } from 'vue'
// Pinia: Vue の状態管理ライブラリ。
// コンポーネント間で共有するデータ（ログイン中ユーザー、旅行一覧など）を管理する。
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import './assets/main.css'

// createApp(): Vue アプリのインスタンスを作成する。
// App.vue がルートコンポーネント（全てのコンポーネントの親）。
const app = createApp(App)

// app.use(): プラグインをアプリ全体に適用する。
// Pinia: どのコンポーネントからも useXxxStore() でストアにアクセスできるようになる。
app.use(createPinia())
// Router: <RouterLink> や useRouter() が使えるようになる。ページ遷移を管理する。
app.use(router)

// app.mount('#app'): index.html の <div id="app"> に Vue アプリを紐付けて描画を開始する。
app.mount('#app')
