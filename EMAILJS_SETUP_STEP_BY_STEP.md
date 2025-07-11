# EmailJS設定手順書 - TERACO.LABO

## ステップ1: アカウント作成
1. https://www.emailjs.com にアクセス
2. 「Sign Up」をクリック
3. Email: smart.teraco@gmail.com
4. パスワードを設定
5. 無料プランを選択

## ステップ2: メールサービス連携
1. ダッシュボードで「Email Services」をクリック
2. 「Add Service」→「Gmail」を選択
3. Googleアカウント（smart.teraco@gmail.com）でログイン
4. 権限を許可
5. Service IDをメモ（例：service_abc123）

## ステップ3: 管理者用テンプレート作成
1. 「Email Templates」→「Create New Template」
2. Template Name: `teraco_admin_notification`
3. 以下の内容を設定：

**Subject（件名）:**
```
【TERACO.LABO】新しいお問い合わせ - {{form_type}}
```

**Content（本文）:**
```
{{name}}様よりお問い合わせがありました。

■基本情報
お名前: {{name}}
メールアドレス: {{email}}
電話番号: {{phone}}
組織・団体名: {{organization}}

■お問い合わせ詳細
種別: {{form_type}}
興味のあるサービス: {{services}}
内容:
{{message}}

24時間以内にご対応をお願いいたします。

---
TERACO.LABO 自動通知システム
```

4. Template IDをメモ（例：template_xyz789）

## ステップ4: ユーザー用自動返信テンプレート作成
1. 「Create New Template」
2. Template Name: `teraco_user_autoreply`
3. 以下の内容を設定：

**Subject（件名）:**
```
【TERACO.LABO】お問い合わせありがとうございます
```

**Content（本文）:**
```
{{name}}様

この度は、TERACO.LABOにお問い合わせいただき、誠にありがとうございます。

以下の内容でお問い合わせを承りました。
24時間以内に担当者よりご連絡いたします。

■お問い合わせ種別: {{form_type}}
■お名前: {{name}}
■メールアドレス: {{email}}

お急ぎの場合は、以下までお気軽にご連絡ください。

TEL: 090-6738-1465
Email: smart.teraco@gmail.com
LINE: https://lin.ee/tkYJ7Cw

今後ともTERACO.LABOをよろしくお願いいたします。

TERACO.LABO
〒881-0037 宮崎県西都市大字三宅9437-9
TEL: 090-6738-1465
Web: https://anomalocaress.github.io/teraco-labo-website-v2/
```

4. Template IDをメモ（例：template_def456）

## ステップ5: Public Key取得
1. ダッシュボードで「Account」→「General」
2. 「Public Key」をコピー（例：user_abc123def456）

## ステップ6: 設定値一覧
以下の値をメモしてください：
- **Public Key**: user_xxxxxxxxx
- **Service ID**: service_xxxxxxxxx  
- **Admin Template ID**: template_xxxxxxxxx
- **User Template ID**: template_xxxxxxxxx

## ステップ7: フォーム設定更新
これらの値を使ってWebサイトのフォームを更新します。

## 注意事項
- 無料プランは月200通制限
- Gmailの1日送信制限（500通）に注意
- テスト送信で動作確認必須