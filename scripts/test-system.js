/**
 * TERACO.LABO ブログシステム 動作確認スクリプト
 */

const { BlogGenerator } = require('../api/social-integration');

// テスト用のブログデータ
const testBlogData = {
    title: '【テスト】AIを活用した業務効率化の実践方法',
    category: 'ai',
    excerpt: 'AIツールを使って業務効率を劇的に改善する具体的な手法をご紹介します。ChatGPT、Canva AI、Notion AIを組み合わせた実践的なワークフローを解説。',
    content: `# AIを活用した業務効率化の実践方法

近年、AI技術の発展により、私たちの働き方が大きく変化しています。特に**ChatGPT**をはじめとする大規模言語モデルの登場により、文書作成、アイデア発想、データ分析など、様々な業務でAIの活用が可能になりました。

## 1. 文書作成の効率化

### ChatGPTを活用した企画書作成
- **アイデア出し**: まずはChatGPTに企画の概要を相談
- **構成作成**: 論理的な構成を提案してもらう
- **文章校正**: より分かりやすい表現に修正

### 実際の活用例
*「新サービスの企画書を作成したいのですが、ターゲットは30代のビジネスパーソンで、予算は500万円程度です。どのような構成で進めればよいでしょうか？」*

このように具体的に相談することで、効果的なアドバイスを得られます。

## 2. クリエイティブ業務の自動化

### Canva AIによるデザイン生成
- **プレゼンテーション資料**の自動作成
- **SNS投稿用画像**の一括生成
- **ロゴデザイン**の候補作成

## 3. 情報整理・ナレッジ管理

### Notion AIの活用
- **会議録の要約**
- **タスクの自動分類**
- **データベースの整理**

## まとめ

AIツールを適切に組み合わせることで、従来の業務時間を**30-50%短縮**することが可能です。重要なのは、各ツールの特性を理解し、自分の業務フローに合わせてカスタマイズすることです。

TERACO.LABOのAIスクールでは、このような実践的なAI活用方法を体系的に学ぶことができます。`,
    readTime: 7,
    twitterText: `📝 新記事公開！

【テスト】AIを活用した業務効率化の実践方法

ChatGPT、Canva AI、Notion AIを組み合わせた実践的なワークフローで業務時間を30-50%短縮！

詳しくはブログで👇
https://teraco-labo.com/blog/

#TERACOLABO #AI #DX #業務効率化`,
    noteIntro: `TERACO.LABOブログからの転載記事です。

【テスト】AIを活用した業務効率化の実践方法

AIツールを使って業務効率を劇的に改善する具体的な手法をご紹介します。ChatGPT、Canva AI、Notion AIを組み合わせた実践的なワークフローを解説。

---`,
    noteOutro: `---

この記事の続きや関連記事は、TERACO.LABOブログでご覧いただけます。
https://teraco-labo.com/blog/

AIスクール、映像制作、スマホ教室など、最新のデジタルスキル情報を発信中！

#TERACOLABO #ブログ #AI #DX`
};

async function testBlogGeneration() {
    console.log('🧪 ブログ生成システムのテスト開始...\n');

    try {
        // 1. ブログ生成テスト
        console.log('1️⃣ ブログHTML生成テスト');
        const generator = new BlogGenerator(testBlogData);
        
        console.log(`   📝 記事タイトル: ${testBlogData.title}`);
        console.log(`   🏷️  カテゴリ: ${testBlogData.category}`);
        console.log(`   📄 ファイル名: ${generator.filename}`);
        console.log(`   🔗 スラッグ: ${generator.slug}`);

        // 2. HTML生成
        console.log('\n2️⃣ HTML生成テスト');
        const html = await generator.generateHTML();
        console.log(`   ✅ HTML生成完了 (${html.length} 文字)`);

        // 3. ファイル保存テスト（実際には保存しない）
        console.log('\n3️⃣ ファイル保存テスト');
        console.log(`   📁 保存予定パス: blog/${generator.filename}`);
        console.log('   ✅ パス生成完了');

        // 4. SNSテキスト検証
        console.log('\n4️⃣ SNS投稿テキスト検証');
        console.log(`   🐦 Twitter: ${testBlogData.twitterText.length}/280文字`);
        if (testBlogData.twitterText.length > 280) {
            console.log('   ⚠️  Twitterの文字数制限を超過しています');
        } else {
            console.log('   ✅ Twitter文字数OK');
        }

        console.log(`   📝 note導入: ${testBlogData.noteIntro.length}文字`);
        console.log(`   📝 note結論: ${testBlogData.noteOutro.length}文字`);
        console.log('   ✅ note投稿テキスト生成完了');

        // 5. URLとメタデータ検証
        console.log('\n5️⃣ メタデータ検証');
        console.log(`   📊 読了時間: ${testBlogData.readTime}分`);
        console.log(`   📄 概要文字数: ${testBlogData.excerpt.length}文字`);
        console.log(`   📖 本文文字数: ${testBlogData.content.length}文字`);

        console.log('\n🎉 全てのテストが正常に完了しました！');
        console.log('\n📋 次のステップ:');
        console.log('1. npm install で依存関係をインストール');
        console.log('2. .env ファイルでAPI設定');
        console.log('3. npm start でサーバー起動');
        console.log('4. http://localhost:3001/blog-admin.html でブログ管理');

    } catch (error) {
        console.error('❌ テスト中にエラーが発生しました:', error);
        process.exit(1);
    }
}

// メイン実行
if (require.main === module) {
    testBlogGeneration();
}

module.exports = { testBlogGeneration, testBlogData };