/**
 * Speech-recognition provider, abstracted behind QuranRecitationRecognizer
 * so the Hifz engine never talks to a specific vendor directly (see
 * domain/recitation.ts -- ASR is not the mistake engine, it only supplies
 * a stream of recognized words). The only implementation today wraps
 * `expo-speech-recognition` (on-device/OS speech recognizer on iOS +
 * Android, and the browser Web Speech API on web, via the package's own
 * cross-platform shim) -- swap createExpoQuranRecognizer() for another
 * provider later without touching the alignment engine or any screen.
 */
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionErrorEvent,
} from 'expo-speech-recognition';

/** MSA/Quranic Arabic locale. There is no dedicated "Quranic Arabic"
 * locale in on-device recognizers; ar-SA is the closest widely-supported
 * option and is what most Android/iOS builds ship Arabic models for. */
export const RECITATION_LOCALE = 'ar-SA';

export interface RecognizerResultChunk {
  /** Full transcript-so-far for the current utterance segment (not just
   * the newly added words) -- callers diff against the previous chunk,
   * see domain/recitation.ts#diffTranscriptWords. */
  transcript: string;
  isFinal: boolean;
  confidence: number;
  timestampMs: number;
}

export interface RecognizerErrorInfo {
  code: string;
  message: string;
}

export interface QuranRecitationRecognizer {
  isSupported(): boolean;
  requestPermissions(): Promise<boolean>;
  /** contextWords biases the recognizer toward the Surah's own vocabulary
   * where the platform supports it (iOS contextualStrings / Android
   * EXTRA_BIASING_STRINGS) -- a real, if partial, way to make recognition
   * "Quran-aware" at the ASR layer itself, not just in post-processing. */
  start(options: { contextWords?: string[] }): void;
  stop(): void;
  abort(): void;
  onResult(callback: (chunk: RecognizerResultChunk) => void): () => void;
  onError(callback: (error: RecognizerErrorInfo) => void): () => void;
  onEnd(callback: () => void): () => void;
}

export function createExpoQuranRecognizer(): QuranRecitationRecognizer {
  return {
    isSupported() {
      try {
        return ExpoSpeechRecognitionModule.isRecognitionAvailable();
      } catch {
        return false;
      }
    },
    async requestPermissions() {
      try {
        const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
        return result.granted;
      } catch {
        return false;
      }
    },
    start({ contextWords }) {
      ExpoSpeechRecognitionModule.start({
        lang: RECITATION_LOCALE,
        interimResults: true,
        continuous: true,
        requiresOnDeviceRecognition: false,
        maxAlternatives: 1,
        // Most platforms cap biasing strings well under 1000 entries; a
        // Surah's word list is already small, but stay defensive.
        contextualStrings: contextWords?.slice(0, 500),
      });
    },
    stop() {
      ExpoSpeechRecognitionModule.stop();
    },
    abort() {
      ExpoSpeechRecognitionModule.abort();
    },
    onResult(callback) {
      const subscription = ExpoSpeechRecognitionModule.addListener('result', (event) => {
        const top = event.results[0];
        if (!top) return;
        callback({
          transcript: top.transcript,
          isFinal: event.isFinal,
          confidence: top.confidence,
          timestampMs: Date.now(),
        });
      });
      return () => subscription.remove();
    },
    onError(callback) {
      const subscription = ExpoSpeechRecognitionModule.addListener(
        'error',
        (event: ExpoSpeechRecognitionErrorEvent) => {
          callback({ code: event.error, message: event.message });
        },
      );
      return () => subscription.remove();
    },
    onEnd(callback) {
      const subscription = ExpoSpeechRecognitionModule.addListener('end', () => callback());
      return () => subscription.remove();
    },
  };
}
