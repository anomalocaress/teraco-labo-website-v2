// EmailJS設定ファイル
// 実際の値は EmailJS ダッシュボードから取得してください

const EMAILJS_CONFIG = {
    // EmailJS Public Key (旧User ID)
    PUBLIC_KEY: "YOUR_PUBLIC_KEY_HERE",
    
    // Service ID (Gmail/Outlookなどのメールサービス)
    SERVICE_ID: "YOUR_SERVICE_ID_HERE",
    
    // Template IDs
    ADMIN_TEMPLATE_ID: "YOUR_ADMIN_TEMPLATE_ID_HERE",    // 管理者用
    USER_TEMPLATE_ID: "YOUR_USER_TEMPLATE_ID_HERE",      // ユーザー自動返信用
    
    // 管理者メールアドレス
    ADMIN_EMAIL: "smart.teraco@gmail.com"
};

// 設定手順:
// 1. https://www.emailjs.com でアカウント作成
// 2. メールサービス（Gmail等）を連携
// 3. 上記の値を実際のIDに置き換え
// 4. 各フォームHTMLファイルの YOUR_XXX 部分を置き換え

console.log("EmailJS設定ファイル読み込み完了");
console.log("設定前の確認:", EMAILJS_CONFIG);