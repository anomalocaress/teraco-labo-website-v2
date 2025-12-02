import whisper
import sys
import warnings
import os
import threading
import queue

# Add current directory to PATH to find local ffmpeg
os.environ["PATH"] += os.pathsep + os.path.dirname(os.path.abspath(__file__))

# Suppress warnings
warnings.filterwarnings("ignore")

class WhisperService:
    def __init__(self):
        self.model = None
        self.queue = queue.Queue()
        self.running = True
        self.thread = threading.Thread(target=self._process_queue, daemon=True)
        self.thread.start()

    def load_model(self):
        try:
            print("Loading Whisper model...", file=sys.stderr)
            # "base" model: best balance of speed and accuracy
            self.model = whisper.load_model("base")
            print("Model loaded successfully", file=sys.stderr)
            print("READY")
            sys.stdout.flush()
        except Exception as e:
            print(f"ERROR:Failed to load model: {e}", file=sys.stderr)
            sys.stdout.flush()

    def _process_queue(self):
        while self.running:
            try:
                file_path = self.queue.get(timeout=1)
                if file_path is None:
                    continue
                
                self._transcribe(file_path)
                self.queue.task_done()
            except queue.Empty:
                continue
            except Exception as e:
                print(f"Queue error: {e}", file=sys.stderr)

    def _transcribe(self, file_path):
        transcription_success = False
        try:
            if not self.model:
                self.load_model()
            
            if not self.model:
                print("ERROR:Model not loaded")
                sys.stdout.flush()
                return

            # Simple, effective prompt for Japanese dictation
            # Just set the language context, nothing fancy
            result = self.model.transcribe(
                file_path, 
                language="ja", 
                fp16=False,
                initial_prompt="こんにちは。",
                beam_size=5,  # Higher for better accuracy
                best_of=5,
                temperature=0.0,  # Deterministic output
                condition_on_previous_text=False,
                no_speech_threshold=0.6,
                logprob_threshold=-1.0,
                compression_ratio_threshold=2.4
            )
            
            text = result["text"].strip()
            
            # Basic hallucination filter
            if not text:
                print("Ignored: empty result", file=sys.stderr)
                return
                
            hallucination_keywords = [
                "ご視聴ありがとうございました",
                "視聴ありがとうございました", 
                "チャンネル登録",
                "高評価",
                "字幕"
            ]
            
            text_lower = text.lower().replace(" ", "").replace("　", "")
            if any(kw in text_lower for kw in hallucination_keywords):
                print(f"Ignored hallucination: {text}", file=sys.stderr)
                return
            
            # Success!
            print(f"RESULT:{text}")
            sys.stdout.flush()
            transcription_success = True
            
        except Exception as e:
            error_msg = str(e)
            print(f"Transcription error: {error_msg}", file=sys.stderr)
            # Always send error status so UI can recover
            print(f"ERROR:{error_msg}")
            sys.stdout.flush()
            
        finally:
            # Always clean up the temp file
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                print(f"Cleanup error: {e}", file=sys.stderr)
            
            # If we didn't send RESULT or ERROR, send an error to unblock UI
            if not transcription_success:
                try:
                    print("ERROR:Transcription failed")
                    sys.stdout.flush()
                except:
                    pass

    def add_task(self, file_path):
        self.queue.put(file_path)

    def stop(self):
        self.running = False
        if self.thread.is_alive():
            self.thread.join(timeout=2)

if __name__ == "__main__":
    service = WhisperService()
    service.load_model()
    
    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
                
            if line.startswith("TRANSCRIBE:"):
                file_path = line[11:]
                if os.path.exists(file_path):
                    service.add_task(file_path)
                else:
                    print(f"ERROR:File not found: {file_path}", file=sys.stderr)
            elif line == "EXIT":
                break
                
    except KeyboardInterrupt:
        print("Interrupted", file=sys.stderr)
    except Exception as e:
        print(f"Main loop error: {e}", file=sys.stderr)
    finally:
        service.stop()
        print("Service stopped", file=sys.stderr)
