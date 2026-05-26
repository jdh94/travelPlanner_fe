// Vue Router: URL とコンポーネントを対応させる仕組み（SPA のページ遷移）。
// サーバーへのリクエストは発生せず、URLが変わるとレンダリングするコンポーネントが切り替わる。
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  // createWebHistory: ブラウザの履歴API（pushState）を使う。
  // URLが /trips/abc のような普通の形になる（ハッシュ #/trips/abc にならない）。
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      // HomeView は最初から読み込む（他のビューは遅延読み込み）。
      component: HomeView,
      meta: { public: true },
    },
    {
      path: '/login',
      name: 'login',
      // () => import(...): 動的インポート（遅延読み込み）。
      // このルートにアクセスされた時だけファイルをダウンロードする。初期表示を速くする効果がある。
      component: () => import('../views/LoginView.vue'),
      // meta: ルートに独自のメタデータを付加できる。
      // ナビゲーションガードで meta.public を参照して認証チェックをスキップする。
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { public: true },
    },
    {
      path: '/trips/new',
      name: 'trip-create',
      component: () => import('../views/TripCreateView.vue'),
    },
    {
      path: '/trips/:hashUrl',
      name: 'trip-detail',
      // :hashUrl: URLパラメータ。/trips/abc123 なら hashUrl = 'abc123' になる。
      // コンポーネント内で useRoute().params.hashUrl で取得する。
      component: () => import('../views/TripDetailView.vue'),
    },
    {
      path: '/trips/:hashUrl/pin',
      name: 'trip-pin',
      component: () => import('../views/PinView.vue'),
    },
    {
      path: '/trips/:hashUrl/share',
      name: 'trip-share',
      component: () => import('../views/ShareView.vue'),
    },
    {
      path: '/trips/:hashUrl/manage',
      name: 'trip-manage',
      component: () => import('../views/TripManageView.vue'),
    },
    {
      path: '/trips/:hashUrl/expenses',
      name: 'trip-expenses',
      component: () => import('../views/ExpenseView.vue'),
    },
    {
      path: '/travels',
      name: 'travels',
      component: () => import('../views/TravelListView.vue'),
    },
    {
      path: '/account',
      name: 'account',
      component: () => import('../views/AccountView.vue'),
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('../views/ForgotPasswordView.vue'),
      meta: { public: true },
    },
  ],
})

// beforeEach: ページ遷移が発生するたびに呼ばれるナビゲーションガード。
// return true → 遷移を許可、return { name: 'login' } → ログインページにリダイレクト。
router.beforeEach((to) => {
  // meta.public が true なルートは認証チェックをスキップする（ログイン・登録ページ）。
  if (to.meta.public) return true

  // localStorage にアクセストークンがなければ未ログインとみなしてリダイレクト。
  // query: { redirect: to.fullPath } → ログイン後に元のページに戻れるようにURLを記憶する。
  const token = localStorage.getItem('access_token')
  if (!token) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router
