/**
 * speechUtils.ts
 * High-performance, zero-latency Web Speech API controller.
 * 
 * Solves:
 * 1. Audio buffering lag in Chromium/WebKit where speech keeps playing after cancel().
 * 2. V8 garbage collection bug where SpeechSynthesisUtterance is destroyed mid-speech.
 * 3. Instant, deterministic cancellation the exact millisecond the user clicks "Stop".
 */

let activeUtterance: SpeechSynthesisUtterance | null = null;
let stopCleanupTimer: any = null;

// Cross-component speech stop notification event
export const SPEECH_STOP_EVENT = 'isaac:speech_stopped';

/**
 * Stops any active speech synthesis output IMMEDIATELY.
 * Halts sound card buffer via pause() followed by cancel() to ensure
 * zero-latency cutoff without waiting for utterance chunks to drain.
 */
export function stopSpeechImmediately(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  try {
    if (stopCleanupTimer) {
      clearTimeout(stopCleanupTimer);
      stopCleanupTimer = null;
    }

    // Immediately detach callbacks so no trailing onend/onerror events trigger state glitches
    if (activeUtterance) {
      activeUtterance.onend = null;
      activeUtterance.onerror = null;
      activeUtterance.onstart = null;
      activeUtterance.onpause = null;
      activeUtterance.onresume = null;
      activeUtterance = null;
    }
    (window as any).__isaacActiveUtterance = null;

    // In Chrome/Edge/Safari, calling pause() first silences the hardware DAC buffer immediately,
    // whereas cancel() alone can let buffered samples finish playing for 500-1500ms.
    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.pause();
      }
    } catch (_) {}

    window.speechSynthesis.cancel();

    // Notify all UI components listening to synchronize button states instantly
    try {
      window.dispatchEvent(new CustomEvent(SPEECH_STOP_EVENT));
    } catch (_) {}

    // Micro-delay secondary cancel to handle asynchronous engine states in WebKit/Blink
    stopCleanupTimer = setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
            window.speechSynthesis.cancel();
          }
        }
      } catch (_) {}
    }, 15);
  } catch (err) {
    console.warn('Speech cancellation error:', err);
  }
}

/**
 * Checks whether speech synthesis is actively speaking or queued.
 */
export function isSpeechActive(): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }
  return Boolean(window.speechSynthesis.speaking || window.speechSynthesis.pending || activeUtterance !== null);
}

/**
 * Cleans text from Markdown, HTML, and extra whitespace for natural TTS reading.
 */
export function sanitizeTextForSpeech(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\[\^?\d+\]/g, ' ') // Remove citation footnotes like [1], [2]
    .replace(/https?:\/\/\S+/gi, ' ') // Remove raw URLs
    .replace(/[#*_~`>[\]()]/g, ' ') // Remove Markdown formatting symbols
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Speaks text with retained reference to prevent premature garbage collection.
 */
export function playSpeech(
  text: string,
  callbacks?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err?: any) => void;
  }
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  // Ensure any previous speech is halted first
  stopSpeechImmediately();

  const cleanText = sanitizeTextForSpeech(text);
  if (!cleanText) return false;

  try {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Retain references on module variable and window to prevent V8 GC bug
    activeUtterance = utterance;
    (window as any).__isaacActiveUtterance = utterance;

    utterance.onstart = () => {
      callbacks?.onStart?.();
    };

    utterance.onend = () => {
      if (activeUtterance === utterance) {
        activeUtterance = null;
        (window as any).__isaacActiveUtterance = null;
      }
      callbacks?.onEnd?.();
    };

    utterance.onerror = (e) => {
      if (activeUtterance === utterance) {
        activeUtterance = null;
        (window as any).__isaacActiveUtterance = null;
      }
      callbacks?.onError?.(e);
      callbacks?.onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.error('Failed to start speech synthesis:', err);
    activeUtterance = null;
    (window as any).__isaacActiveUtterance = null;
    callbacks?.onError?.(err);
    return false;
  }
}
