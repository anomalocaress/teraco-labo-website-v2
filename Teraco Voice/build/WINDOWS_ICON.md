# Windows用アイコン (.ico) の作成手順

macOS用のアイコン (.icns) は作成済みです。
Windows用のアイコンは、以下のオンラインツールを使用して作成してください。

## 手順

1. **CloudConvertにアクセス**
   https://cloudconvert.com/png-to-ico

2. **ファイルをアップロード**
   `build/icon_source.png` をアップロード

3. **設定**
   - 「Options」をクリック
   - 「Icon Sizes」で以下を選択:
     - 256x256
     - 128x128
     - 64x64
     - 48x48
     - 32x32
     - 16x16

4. **変換**
   - 「Convert」ボタンをクリック
   - 変換完了後、ダウンロード

5. **配置**
   - ダウンロードしたファイルを `build/icon.ico` として保存

## 代替方法（ImageMagickがインストールされている場合）

```bash
# Homebrewでインストール
brew install imagemagick

# アイコン作成
convert build/icon_source.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico
```

## 完了後

両方のアイコンファイルが揃ったら、以下のコマンドでビルドできます:

```bash
# macOS版
npm run build:mac

# Windows版（Windows環境で実行、またはクロスプラットフォームビルド）
npm run build:win
```
