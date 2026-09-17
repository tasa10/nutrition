"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { saveDraft } from "@/lib/draft";
import { type Slot, SLOT_LABEL, analyzeMeal, isSlot } from "@/lib/nutrition";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};
// Assume support while prerendering so the static HTML matches most browsers; corrected on hydration.
const useSpeechSupported = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => getSpeechRecognition() !== null,
    () => true,
  );

function InputScreen({ slot }: { slot: Slot }) {
  const router = useRouter();
  const speechSupported = useSpeechSupported();
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [speechFailed, setSpeechFailed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedVoice, setUsedVoice] = useState(false);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const speechOK = speechSupported && !speechFailed;

  useEffect(() => {
    const SR = getSpeechRecognition();
    if (!SR) return;
    const r = new SR();
    r.lang = "ja-JP";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setTranscript(t);
    };
    r.onerror = () => {
      setListening(false);
      setSpeechFailed(true);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    return () => {
      try {
        r.stop();
      } catch {
        // already stopped
      }
    };
  }, []);

  function toggleMic() {
    const r = rec.current;
    if (!r) {
      setSpeechFailed(true);
      return;
    }
    if (listening) {
      try {
        r.stop();
      } catch {
        // ignore
      }
      setListening(false);
      return;
    }
    setTranscript("");
    setListening(true);
    setUsedVoice(true);
    try {
      r.start();
    } catch {
      setListening(false);
      setSpeechFailed(true);
    }
  }

  async function analyze() {
    const text = transcript.trim();
    if (!text || analyzing) return;
    if (listening) {
      try {
        rec.current?.stop();
      } catch {
        // ignore
      }
      setListening(false);
    }
    setAnalyzing(true);
    setError(null);
    try {
      const analysis = await analyzeMeal(text);
      saveDraft({ slot, text, source: usedVoice ? "voice" : "text", analysis });
      router.push("/record/review/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
      setAnalyzing(false);
    }
  }

  const needsTyping = !speechOK || (!listening && !transcript);
  const canAnalyze = !!transcript.trim() && !analyzing;

  return (
    <div className="bg-night flex min-h-dvh flex-1 flex-col gap-5 px-[22px] pt-[26px] pb-10 text-white">
      <div className="flex items-center justify-between">
        <Link
          href="/record/"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-white/20 bg-white/10 text-[17px] text-white"
        >
          ←
        </Link>
        <div className="text-[13px] font-medium text-white/80">{SLOT_LABEL[slot]}を記録中</div>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-[18px]">
        <div
          className="font-mono text-xs tracking-[0.14em]"
          style={{ color: "oklch(0.72 0.14 152)" }}
        >
          {analyzing ? "AI ANALYZING…" : listening ? "LISTENING" : "READY"}
        </div>
        <div
          className={`leading-[1.7] ${transcript ? "text-[21px] font-medium text-white" : "text-base text-white/40"}`}
        >
          {transcript || (listening ? "聞いています…" : "マイクを押して話す、または下に入力")}
        </div>
        {needsTyping && (
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="例：豚の生姜焼き定食、ごはん大盛り、味噌汁"
            className="min-h-24 w-full resize-none rounded-[18px] border border-white/20 bg-white/[0.07] p-3.5 text-[15px] leading-[1.6] text-white outline-none placeholder:text-white/30"
          />
        )}
        {error && (
          <p className="text-sm text-[oklch(0.8_0.12_30)]">解析に失敗しました（{error}）</p>
        )}
      </div>

      {listening && (
        <div className="flex h-[84px] items-end justify-center gap-[5px]">
          {[40, 72, 100, 56, 86, 44, 74].map((h, i) => (
            <div
              key={i}
              className="anim-wave w-1.5 rounded-full"
              style={{
                height: `${h}%`,
                background: "oklch(0.72 0.14 152)",
                animationDelay: `${(i % 4) * 0.1}s`,
                animationDuration: `${0.9 + (i % 5) * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={toggleMic}
          className={`flex h-[76px] w-[76px] items-center justify-center rounded-full ${listening ? "anim-pulse-ring bg-white" : "bg-green"}`}
          aria-label={listening ? "停止" : "マイク"}
        >
          {listening ? (
            <div className="bg-night h-[22px] w-[22px] rounded-[5px]" />
          ) : (
            <div className="h-7 w-[18px] rounded-full bg-white" />
          )}
        </button>
        <div className="text-xs text-white/45">
          {speechOK
            ? listening
              ? "もう一度押すと停止"
              : "マイクを押して話す"
            : "このブラウザは音声認識が使えません。入力欄をご利用ください"}
        </div>
        <button
          type="button"
          onClick={analyze}
          disabled={!canAnalyze}
          className={`flex min-h-[50px] w-full items-center justify-center rounded-full text-[15px] font-bold ${
            canAnalyze ? "text-night bg-white" : "bg-white/[0.12] text-white/45"
          }`}
        >
          {analyzing ? "AIが解析中…" : "AIで解析する"}
        </button>
      </div>
    </div>
  );
}

function InputPageInner() {
  const params = useSearchParams();
  const slotParam = params.get("slot");
  const slot: Slot = isSlot(slotParam) ? slotParam : "dinner";
  return <InputScreen slot={slot} />;
}

export default function InputPage() {
  return (
    <Suspense fallback={<div className="bg-night min-h-dvh" />}>
      <InputPageInner />
    </Suspense>
  );
}
