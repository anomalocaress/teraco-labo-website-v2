# TERACO.LABO - EmailJS設定ガイド

## 概要
各お問い合わせフォームから管理者とユーザー両方にメールが送信されるよう設定します。

## 必要な作業

### 1. EmailJSアカウント設定
1. https://www.emailjs.com にアクセス
2. 無料アカウントを作成
3. メール送信サービス（Gmail推奨）を連携

### 2. メールテンプレート作成

#### 管理者用テンプレート
- **Template Name**: `teraco_admin_template`
- **Template内容**:
```
件名: 【TERACO.LABO】新しいお問い合わせ - {{form_type}}

{{name}}様よりお問い合わせがありました。

■基本情報
お名前: {{name}}
メール: {{email}}
電話番号: {{phone}}
組織名: {{organization}}

■お問い合わせ詳細
種別: {{form_type}}
内容: {{message}}

■その他の情報
{{additional_info}}

48時間以内にご対応をお願いいたします。
```

#### ユーザー用自動返信テンプレート  
- **Template Name**: `teraco_user_template`
- **Template内容**:
```
件名: 【TERACO.LABO】お問い合わせありがとうございます

{{name}}様

この度は、TERACO.LABOにお問い合わせいただき、誠にありがとうございます。

以下の内容でお問い合わせを承りました。
24時間以内に担当者よりご連絡いたします。

■お問い合わせ種別: {{form_type}}
■お名前: {{name}}
■メールアドレス: {{email}}

お急ぎの場合は、お電話でもお問い合わせいただけます。
TEL: 090-6738-1469
Email: smart.teraco@gmail.com

今後ともTERACO.LABOをよろしくお願いいたします。

TERACO.LABO
〒881-0037 宮崎県西都市大字三宅9437-9
```

### 3. HTMLファイルの設定値更新

各フォームHTMLファイルの以下の値を実際のIDに置き換えてください：

```javascript
// 以下をEmailJSダッシュボードの実際の値に置き換え
emailjs.init("YOUR_PUBLIC_KEY");                    // → 実際のPublic Key
emailjs.send('YOUR_SERVICE_ID', ...                 // → 実際のService ID  
'YOUR_ADMIN_TEMPLATE_ID'                            // → 管理者テンプレートID
'YOUR_USER_TEMPLATE_ID'                             // → ユーザーテンプレートID
```

### 4. 対象ファイル一覧
- `rental-contact-form.html` (レンタルスペース予約)
- `ai-contact-form.html` (AIスクール申し込み)
- `instructor-contact-form.html` (外部講師依頼)
- `video-contact-form.html` (映像制作見積もり)
- `general-contact-form.html` (総合お問い合わせ)
- `contact-form.html` (スマホ教室問い合わせ)

### 5. テスト手順
1. 各フォームから実際にメール送信テスト
2. 管理者メール受信確認
3. ユーザー自動返信メール受信確認
4. 送信失敗時のエラー表示確認

### 6. トラブルシューティング
- ブラウザの開発者ツールでコンソールエラーを確認
- EmailJSの送信ログで配信状況を確認
- メールアドレスの形式チェック
- 迷惑メールフォルダの確認

### 7. 料金プラン
- **無料プラン**: 月200通まで
- **有料プラン**: 月$15で月1000通まで

月の送信数が200通を超える場合は有料プランへのアップグレードを検討してください。