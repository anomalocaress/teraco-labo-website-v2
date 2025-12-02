const whisper = require('whisper-node');

(async () => {
    try {
        console.log("Starting transcription test...");
        const transcript = await whisper.whisper("/Users/shuichifujisaki/Teraco Voice/test_audio.wav", {
            modelName: "base",
            language: "ja"
        });
        console.log("Transcript:", transcript);
    } catch (error) {
        console.error("Error:", error);
    }
})();
