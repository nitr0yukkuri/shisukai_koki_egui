# じょぶはん Windows版ダウンロードサイト

Figmaの画面をもとにした静的サイトです。質問カード、リアルタイム文字起こし、練習ログなど、公開版で利用できる機能を案内します。

## ローカルで確認

Node.js 18 以降を使い、このフォルダーで次を実行します。

```sh
npm run dev
```

ブラウザーで http://127.0.0.1:4173 を開きます。追加パッケージは不要です。

## GitHub Pagesへの公開

`.github/workflows/deploy-jobuhan-download-site.yml` が `main` ブランチへの変更を検知し、`jobuhan-download-site` をGitHub Pagesへデプロイします。初回公開前に、リポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定してください。

設定後、`main` へのマージまたは手動実行で公開できます。公開URLは https://nitr0yukkuri.github.io/shisukai_koki_egui/ です。

## インストーラー

ページのダウンロードボタンは、GitHub Releasesの最新 `Jobuhan-Setup.exe` に直接つながります。インストーラーをこのサイトのソースへコピーする必要はありません。新しい配布版を公開すると、ボタンから最新の版を取得できます。

## 主なファイル

- `index.html` — ページ構造と日本語コピー
- `styles.css` — 配色、レスポンシブレイアウト、アニメーション
- `main.js` — フェードイン、モバイルメニュー、FAQ
- `assets/` — Figmaから取得したSVG素材
- `.github/workflows/deploy-jobuhan-download-site.yml` — GitHub Pagesへのデプロイ
