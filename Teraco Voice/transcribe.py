import whisper
import sys
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

def transcribe(file_path):
    try:
        # Load model (download on first run)
        # "base" is a good balance. "tiny" is faster but less accurate. "small" is better.
        model = whisper.load_model("base")
        
        # Transcribe
        result = model.transcribe(file_path, language="ja", fp16=False)
        print(result["text"].strip())
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <audio_file_path>")
        sys.exit(1)
        
    audio_file = sys.argv[1]
    transcribe(audio_file)
