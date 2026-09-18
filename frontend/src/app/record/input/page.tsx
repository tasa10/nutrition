"use client";

import { ArrowLeft, Mic, Square } from "lucide-react";
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

  const canAnalyze = !!transcript.trim() && !analyzing;

  return (
    <div className="bg-paper text-ink flex min-h-dvh flex-1 flex-col gap-5 px-[22px] pt-[26px] pb-10">
      <div className="flex items-center justify-between">
        <Link
          href="/record/"
          className="bg-surface text-ink shadow-card flex h-11 w-11 flex-none items-center justify-center rounded-full"
          aria-label="戻る"
        >
          <ArrowLeft size={20} aria-hidden />
        </Link>
        <div className="text-muted text-[13px] font-medium">{SLOT_LABEL[slot]}を記録中</div>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-[18px]">
        <div className="text-green-text font-mono text-xs tracking-[0.14em]">
          {analyzing ? "AI ANALYZING…" : listening ? "LISTENING" : "READY"}
        </div>
        {listening ? (
          <div
            className={`leading-[1.7] text-pretty ${transcript ? "text-ink text-[21px] font-medium" : "text-faint text-base"}`}
          >
            {transcript || "聞いています…"}
          </div>
        ) : (
          // Editable whenever the mic is off, so a recognised sentence can be corrected before analysis.
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={
              speechOK
                ? "マイクを押して話す、またはここに入力（例：豚の生姜焼き定食、ごはん大盛り、味噌汁）"
                : "例：豚の生姜焼き定食、ごはん大盛り、味噌汁"
            }
            rows={4}
            className="border-line bg-surface text-ink shadow-card placeholder:text-dim focus:border-green w-full resize-none rounded-[18px] border p-3.5 text-[17px] leading-[1.6] outline-none"
          />
        )}
        {error && <p className="text-rose-text text-sm">解析に失敗しました（{error}）</p>}
      </div>

      {listening && (
        <div className="flex h-[84px] items-end justify-center gap-[5px]">
          {[40, 72, 100, 56, 86, 44, 74].map((h, i) => (
            <div
              key={i}
              className="anim-wave bg-green w-1.5 rounded-full"
              style={{
                height: `${h}%`,
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
          className={`shadow-cta flex h-[76px] w-[76px] items-center justify-center rounded-full text-white ${listening ? "anim-pulse-ring bg-ink" : "bg-green"}`}
          aria-label={listening ? "停止" : "マイク"}
        >
          {listening ? (
            <Square size={26} className="fill-current" aria-hidden />
          ) : (
            <Mic size={34} aria-hidden />
          )}
        </button>
        <div className="text-faint text-xs">
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
            canAnalyze ? "bg-ink shadow-ink text-white" : "bg-track text-faint"
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
    <Suspense fallback={<div className="bg-paper min-h-dvh" />}>
      <InputPageInner />
    </Suspense>
  );
}
