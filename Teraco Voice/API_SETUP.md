# Teraco Voice - APIキー設定

## OpenAI APIキーの設定方法

Teraco Voiceは、OpenAIのWhisper APIを使用して高精度な音声認識を行います。
以下の手順でAPIキーを設定してください。

### 1. OpenAI APIキーの取得

1. [OpenAI Platform](https://platform.openai.com/api-keys) にアクセス
2. ログインまたは新規登録
3. 「Create new secret key」をクリックしてAPIキーを生成
4. 生成されたキーをコピー（**一度しか表示されないので注意**）

### 2. APIキーの設定

プロジェクトのルートディレクトリ（`Teraco Voice`フォルダ）に `.env` ファイルを作成し、以下の内容を記述してください。

```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

`sk-proj-xxxxxx...` の部分を、実際に取得したAPIキーに置き換えてください。

### 3. アプリの再起動

`.env` ファイルを保存したら、Teraco Voiceアプリを再起動してください。
APIキーが正しく設定されていれば、音声認識が動作します。

### 注意事項

- `.env` ファイルは `.gitignore` に含まれているため、Gitリポジトリにはコミットされません
- APIキーは絶対に他人と共有しないでください
- OpenAI APIは従量課金制です。Whisper APIの料金は [こちら](https://openai.com/pricing) で確認できます
