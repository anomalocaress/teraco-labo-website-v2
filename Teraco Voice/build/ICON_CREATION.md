# アイコンファイル作成手順

生成されたアイコン画像（teraco_voice_icon.png）を使って、以下の手順でアイコンファイルを作成してください。

## macOS用アイコン (.icns) の作成

### オンラインツールを使う方法（簡単）
1. https://cloudconvert.com/png-to-icns にアクセス
2. 生成されたアイコン画像をアップロード
3. 変換して `icon.icns` としてダウンロード
4. `build/icon.icns` に配置

### コマンドラインで作成する方法
```bash
# iconutilを使用（macOSのみ）
mkdir icon.iconset
sips -z 16 16     teraco_voice_icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     teraco_voice_icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     teraco_voice_icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     teraco_voice_icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   teraco_voice_icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   teraco_voice_icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   teraco_voice_icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   teraco_voice_icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   teraco_voice_icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 teraco_voice_icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o build/icon.icns
```

## Windows用アイコン (.ico) の作成

### オンラインツールを使う方法（簡単）
1. https://cloudconvert.com/png-to-ico にアクセス
2. 生成されたアイコン画像をアップロード
3. 変換して `icon.ico` としてダウンロード
4. `build/icon.ico` に配置

### ImageMagickを使う方法
```bash
# ImageMagickをインストール後
convert teraco_voice_icon.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico
```

## 注意事項
- アイコン画像は正方形で、できるだけ高解像度（1024x1024以上推奨）
- 背景は透明または黒
- シンプルで視認性の高いデザイン
