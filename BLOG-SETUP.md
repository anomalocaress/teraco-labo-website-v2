# TERACO.LABO ブログシステム セットアップガイド

## 🚀 概要

TERACO.LABOブログシステムは、記事投稿とSNS連携を自動化するシステムです。

### 機能
- ✅ ブログ記事の自動HTML生成
- ✅ X (Twitter) 自動投稿
- ✅ note 自動転載
- ✅ RSS/Atom フィード生成
- ✅ Google Analytics 統合
- ✅ アフィリエイト導線組み込み

## 📋 必要な準備

### 1. API キーの取得

#### X (Twitter) API
1. [X Developer Portal](https://developer.twitter.com/) にアクセス
2. 「Create App」で新しいアプリを作成
3. 以下の情報を取得：
   - API Key
   - API Secret Key
   - Access Token
   - Access Token Secret

#### note API
1. [note API](https://note.com/api) にアクセス
2. アカウント連携でAPIトークンを取得
3. 投稿権限があることを確認

### 2. 環境設定

`.env` ファイルを作成：

```env
# X (Twitter) API設定
TWITTER_API_KEY=your_api_key_here
TWITTER_API_SECRET=your_api_secret_here
TWITTER_ACCESS_TOKEN=your_access_token_here
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret_here

# note API設定
NOTE_API_TOKEN=your_note_api_token_here

# サイト設定
WEBSITE_URL=https://teraco-labo.com
DEFAULT_HASHTAGS=#TERACOLABO #AI #DX #映像制作

# サーバー設定
PORT=3001
```

## 🛠️ インストールと起動

### 1. 依存関係のインストール

```bash
npm install
```

### 2. サーバー起動

```bash
# 本番環境
npm start

# 開発環境（自動再起動）
npm run dev
```

### 3. ブログ管理画面にアクセス

```
http://localhost:3001/blog-admin.html
```

## 📝 使用方法

### 1. 記事投稿

1. ブログ管理画面を開く
2. 「新規投稿」タブで記事情報を入力：
   - タイトル
   - カテゴリ
   - 概要
   - 本文
3. SNS連携設定を確認
4. 「記事を投稿して連携実行」をクリック

### 2. SNS投稿の確認

投稿後、以下を確認：
- ✅ ブログ記事ファイルが `blog/` フォルダに生成
- ✅ X に自動投稿
- ✅ note に自動転載
- ✅ ブログ一覧ページに記事追加

### 3. カスタマイズ

#### 記事テンプレートの編集
`api/templates/blog-post-template.html` を編集

#### SNS投稿テキストの調整
ブログ管理画面の「連携設定」で調整

## 🔧 高度な設定

### 自動投稿スケジュール

cron 等を使用した定期投稿：

```bash
# 毎日午前9時に予約投稿実行
0 9 * * * cd /path/to/teraco-labo && npm run blog:publish
```

### Webhook 連携

他のサービスからの自動投稿：

```javascript
// 外部サービスからの投稿例
fetch('http://localhost:3001/api/blog/publish', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        blogData: {
            title: '新記事タイトル',
            content: '記事本文...',
            category: 'ai'
        },
        platforms: {
            twitter: true,
            note: true
        }
    })
});
```

## 📊 分析と改善

### Google Analytics での確認項目

1. **ページビュー数**
   - 最も読まれている記事
   - カテゴリ別の人気度

2. **参照元分析**
   - X からの流入
   - note からの流入
   - 検索エンジンからの流入

3. **ユーザー行動**
   - 滞在時間
   - 回遊率
   - コンバージョン率（お問い合わせ）

### SNS パフォーマンス分析

- **X**: エンゲージメント率、リツイート数
- **note**: スキ数、コメント数、フォロワー増減

## 🔒 セキュリティ

### API キーの管理
- `.env` ファイルは Git に含めない
- 本番環境では環境変数で設定
- 定期的なローテーション

### アクセス制限
```javascript
// IP制限の例
app.use('/api/blog', (req, res, next) => {
    const allowedIPs = ['127.0.0.1', 'your.ip.address'];
    if (!allowedIPs.includes(req.ip)) {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
});
```

## 🆘 トラブルシューティング

### よくある問題

#### 1. X API エラー
```
Error: 429 Too Many Requests
```
**解決策**: API レート制限に達しています。時間をおいて再試行。

#### 2. note API エラー
```
Error: 401 Unauthorized
```
**解決策**: APIトークンが無効です。note で再取得。

#### 3. ファイル生成エラー
```
Error: ENOENT: no such file or directory
```
**解決策**: `blog/` フォルダが存在しない。手動で作成。

### ログの確認

```bash
# リアルタイムログ監視
tail -f logs/blog-system.log

# エラーログのみ
grep "ERROR" logs/blog-system.log
```

## 🚀 運用のベストプラクティス

### 1. 投稿スケジュール
- **頻度**: 週2-3回の定期投稿
- **タイミング**: 平日朝9時、夕方18時が効果的
- **カテゴリバランス**: AI・映像制作・スマホ活用を均等に

### 2. SEO最適化
- **タイトル**: 32文字以内、キーワード含有
- **メタディスクリプション**: 120文字以内
- **内部リンク**: 関連記事への導線

### 3. アフィリエイト戦略
- **自然な導線**: 記事内容に関連するサービスへの誘導
- **CTA配置**: 記事中間と末尾にCall-to-Action
- **成果測定**: Google Analytics のゴール設定

## 📞 サポート

問題が発生した場合は、以下を確認してください：

1. **設定ファイル**: `.env` の内容確認
2. **ログファイル**: エラーメッセージの確認
3. **API状態**: Twitter/note API の稼働状況
4. **依存関係**: `npm install` の再実行

---

## 🎯 今後の拡張予定

- [ ] Instagram 自動投稿
- [ ] LinkedIn 連携
- [ ] 予約投稿機能
- [ ] 記事の自動翻訳
- [ ] AI による記事要約生成
- [ ] 画像自動生成（DALL-E連携）

---

**制作**: TERACO.LABO ブログシステム v1.0
**更新日**: 2024年1月15日