# TERACO.LABO デザイン設定バックアップ

## 現在の背景設定（保存用）

### body要素の背景CSS
```css
body {
    font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
}
```

### カラーコード
- **#667eea**: ライトパープルブルー（開始色）
- **#764ba2**: ディープパープル（終了色）

### グラデーション設定
- **方向**: 135deg (左上から右下)
- **タイプ**: linear-gradient

---

## 新しい背景設定（適用予定）

### 新しいカラーコード
- **#1e293b**: ミッドナイトブルー
- **#0ea5e9**: エレクトリックブルー  
- **#ec4899**: マゼンタ

### 新しいCSS
```css
body {
    font-family: 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif;
    line-height: 1.6;
    color: #333;
    background: linear-gradient(to bottom right, #1e293b 0%, #0ea5e9 50%, #ec4899 100%);
    min-height: 100vh;
    background-attachment: fixed;
}
```

---

## 復元方法
元のデザインに戻すには、contact.htmlのbody CSSを上記「現在の背景設定」に変更してください。

作成日時: 2025-07-13