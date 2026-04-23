import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Mic, ArrowLeft, Volume2, CheckCircle, Circle, BookOpen } from "lucide-react";
import micImg from "@/assets/mic-illustration.png";
import type { AnalyzeResponse } from "@/lib/kinaiyaApi";

type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionErrorEventLike = { error?: string; message?: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};
type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

type PassagePart =
  | { kind: "word"; text: string; wordIndex: number }
  | { kind: "sep"; text: string };

const tokenize = (text: string) =>
  (text.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? []).filter(Boolean);

const computeReadingProgress = (expectedWords: string[], spokenWords: string[]) => {
  if (expectedWords.length === 0 || spokenWords.length === 0) return { progress: 0, errors: [] };

  let expectedIndex = 0;
  let spokenIndex = 0;
  const errors: number[] = [];

  while (expectedIndex < expectedWords.length && spokenIndex < spokenWords.length) {
    if (expectedWords[expectedIndex] === spokenWords[spokenIndex]) {
      expectedIndex += 1;
      spokenIndex += 1;
      continue;
    }

    // Insertion: student said an extra word; skip it.
    if (
      spokenIndex + 1 < spokenWords.length &&
      expectedWords[expectedIndex] === spokenWords[spokenIndex + 1]
    ) {
      spokenIndex += 1;
      continue;
    }

    // Omission: student skipped an expected word; advance expected.
    if (
      expectedIndex + 1 < expectedWords.length &&
      expectedWords[expectedIndex + 1] === spokenWords[spokenIndex]
    ) {
      errors.push(expectedIndex);
      expectedIndex += 1;
      continue;
    }

    // Substitution: advance both so the "current word" keeps moving forward.
    errors.push(expectedIndex);
    expectedIndex += 1;
    spokenIndex += 1;
  }

  return { progress: Math.min(expectedIndex, expectedWords.length), errors };
};

const buildPassageParts = (text: string): PassagePart[] => {
  const parts = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?|[^A-Za-z]+/g) ?? [text];
  let wordIndex = 0;

  return parts.map((part) => {
    const isWord = /^[A-Za-z]+(?:'[A-Za-z]+)?$/.test(part);
    if (!isWord) return { kind: "sep", text: part };

    const idx = wordIndex;
    wordIndex += 1;
    return { kind: "word", text: part, wordIndex: idx };
  });
};

const sttErrorMessage = (code?: string) => {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission blocked. In Chrome: click the lock icon → Site settings → allow Microphone, then reload.";
    case "audio-capture":
      return "No microphone found or it’s in use by another app. Check your input device and try again.";
    case "no-speech":
      return "No speech detected. Keep reading clearly (or move closer to the mic).";
    case "network":
      return "Speech recognition network error. Continue without a transcript for this prototype demo.";
    case "language-not-supported":
      return "Speech recognition language not supported on this device/browser.";
    case "aborted":
      return "Speech recognition stopped.";
    default:
      return "Speech recognition error. You can still continue without a transcript.";
  }
};

const passage = {
  id: "bukidnon-seven-tribes",
  lang: "English",
  title: "The Seven Tribes of Bukidnon",
  text: `Bukidnon is home to seven unique tribes. They are the Higaonon, Talaandig, Manobo, Matigsalug, Tigwahanon, Bukidnon, and Umayamnon. Each tribe has its own tradition and language. They live in harmony with nature and protect the sacred mountains. During Kaamulan, the tribes come together to dance and sing. It is a time to thank the Great Spirit for a good harvest. These tribes are the true guardians of the land’s history and culture.`,
  questions: [
    {
      q: "How many unique tribes live in Bukidnon?",
      choices: ["Three", "Five", "Seven", "Ten"],
      answer: 2,
    },
    {
      q: "Which word describes how the tribes live with nature?",
      choices: ["Harmony", "Fear", "Conflict", "Distance"],
      answer: 0,
    },
    {
      q: "What is the name of the festival where the tribes come together?",
      choices: ["Sinulog", "Kaamulan", "Panagbenga", "Kadayawan"],
      answer: 1,
    },
    {
      q: "Why do the tribes dance and sing during the festival?",
      choices: ["To compete with others", "To thank the Great Spirit for harvest", "To exercise", "To welcome visitors"],
      answer: 1,
    },
    {
      q: "What are the tribes considered to be?",
      choices: ["Visitors of the land", "Guardians of history and culture", "Farmers of the plains", "Builders of the city"],
      answer: 1,
    },
  ],
};

const severityFromScore = (score: number): "low" | "medium" | "high" =>
  score >= 85 ? "low" : score >= 65 ? "medium" : "high";

const pickGap = (args: { accuracyRate: number; comprehensionScore: number; wcpm: number; miscueCount: number }) => {
  if (args.comprehensionScore < 55) return "Comprehension: identifying key details";
  if (args.accuracyRate < 80) return "Decoding: long vowel sounds (a, e, i)";
  if (args.wcpm < 75) return "Fluency: pacing and phrasing";
  if (args.miscueCount > 6) return "Phonics: blending consonant clusters";
  return "General reading support";
};

const promoteByRules = (args: { accuracyRate: number; comprehensionScore: number; wcpm: number }): AnalyzeResponse["level"] => {
  const accuracyLevel =
    args.accuracyRate >= 95 ? "Independent" :
      args.accuracyRate >= 90 ? "Instructional" : "Frustrational";

  const wcpmLevel =
    args.wcpm >= 110 ? "Independent" :
      args.wcpm >= 80 ? "Instructional" : "Frustrational";

  const compLevel =
    args.comprehensionScore >= 80 ? "Independent" :
      args.comprehensionScore >= 55 ? "Instructional" : "Frustrational";

  const order = ["Frustrational", "Instructional", "Independent"] as const;
  const min = (a: AnalyzeResponse["level"], b: AnalyzeResponse["level"]) =>
    order[Math.min(order.indexOf(a), order.indexOf(b))];

  return min(min(accuracyLevel, wcpmLevel), compLevel);
};

const mockAnalyze = (args: {
  originalText: string;
  studentTranscript: string;
  miscueCount: number;
  wordCount: number;
  secondsTaken: number;
  comprehensionScore: number;
}): AnalyzeResponse => {
  const wcpm = Math.round((Math.max(1, args.wordCount) / Math.max(1, args.secondsTaken)) * 60);
  const accuracyRate = Math.max(55, Math.min(100, Math.round(((args.wordCount - args.miscueCount) / Math.max(1, args.wordCount)) * 100)));
  const level = promoteByRules({ accuracyRate, comprehensionScore: args.comprehensionScore, wcpm });
  const gap = pickGap({ accuracyRate, comprehensionScore: args.comprehensionScore, wcpm, miscueCount: args.miscueCount });

  const strengths = [
    level === "Independent" ? "Confident reading pace" : "Willingness to keep trying",
    args.comprehensionScore >= 70 ? "Understands main idea" : "Answers some questions correctly",
  ];

  const areas = [
    { issue: "Accuracy while decoding unfamiliar words", severity: severityFromScore(accuracyRate) },
    { issue: "Reading fluency (pacing and phrasing)", severity: severityFromScore(Math.min(100, Math.round((wcpm / 110) * 100))) },
    { issue: gap, severity: "medium" as const },
  ];

  const exerciseType =
    /vowel|phonics|decoding/i.test(gap) ? "phonics_drill" :
      /fluency|pacing/i.test(gap) ? "reread" :
        args.comprehensionScore < 60 ? "fill_blank" : "word_match";

  const interventionContent =
    exerciseType === "phonics_drill"
      ? ["cake", "bike", "home", "rain", "seed"]
      : exerciseType === "reread"
        ? ["Read the passage again", "Pause at commas", "Use expression"]
        : exerciseType === "word_match"
          ? ["garden", "sprout", "fence", "sunflower", "patience"]
          : ["Maria ___ her plants.", "A tiny ___ grew.", "The sprout became a ___ ."];

  const mockMiscueObjects: AnalyzeResponse["miscues"] = Array.from({ length: args.miscueCount }).map((_, i) => {
    const types: AnalyzeResponse["miscues"][number]["type"][] = ["omission", "substitution", "mispronunciation"];
    const patterns: AnalyzeResponse["miscues"][number]["pattern"][] = ["phonetic", "visual", "semantic"];
    return {
      original_word: "word_" + i,
      student_said: i % 2 === 0 ? "..." : "mistake",
      type: types[i % 3],
      pattern: patterns[i % 3],
    };
  });

  return {
    wcpm,
    accuracy_rate: accuracyRate,
    comprehension_score: args.comprehensionScore,
    level,
    level_by_accuracy: accuracyRate >= 95 ? "Independent" : accuracyRate >= 90 ? "Instructional" : "Frustrational",
    level_by_wcpm: wcpm >= 110 ? "Independent" : wcpm >= 80 ? "Instructional" : "Frustrational",
    data_quality: {
      transcript_present: Boolean(args.studentTranscript.trim()),
      miscues_present: args.miscueCount > 0,
      notes: "UI-only prototype: analysis is mocked from visible inputs.",
    },
    miscues: mockMiscueObjects,
    gap,
    pattern_summary: "Prototype demo: highlights common decoding + fluency patterns.",
    strengths,
    areas_for_improvement: areas,
    intervention: {
      exercise_type: exerciseType,
      target_skill: gap,
      instructions: "Complete the activity below, then answer the mastery check questions.",
      content: interventionContent,
      mastery_check_questions: [
        "What is one thing you will improve next time you read?",
        "Write one keyword from the story (e.g., garden, sprout).",
      ],
    },
  };
};

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const randomAnalyze = (args: { comprehensionScore: number }): AnalyzeResponse => {
  const comp = clamp(args.comprehensionScore, 0, 100);

  const wcpm =
    comp >= 80 ? randInt(105, 145)
      : comp >= 55 ? randInt(78, 112)
        : randInt(45, 88);

  const accuracyRate =
    comp >= 80 ? randInt(92, 99)
      : comp >= 55 ? randInt(80, 95)
        : randInt(65, 86);

  const level = promoteByRules({ accuracyRate, comprehensionScore: comp, wcpm });
  const miscueCount = level === "Independent" ? randInt(0, 2) : level === "Instructional" ? randInt(1, 5) : randInt(3, 10);
  const gap = pickGap({ accuracyRate, comprehensionScore: comp, wcpm, miscueCount });

  const strengths = [
    level === "Independent" ? "Confident reading pace" : "Willingness to keep trying",
    comp >= 70 ? "Understands main idea" : "Answers some questions correctly",
  ];

  const areas = [
    { issue: "Accuracy while decoding unfamiliar words", severity: severityFromScore(accuracyRate) },
    { issue: "Reading fluency (pacing and phrasing)", severity: severityFromScore(Math.min(100, Math.round((wcpm / 110) * 100))) },
    { issue: gap, severity: "medium" as const },
  ];

  const exerciseType =
    /vowel|phonics|decoding/i.test(gap) ? "phonics_drill" :
      /fluency|pacing/i.test(gap) ? "reread" :
        comp < 60 ? "fill_blank" : "word_match";

  const interventionContent =
    exerciseType === "phonics_drill"
      ? ["tribe", "dance", "mount", "sacred", "land"]
      : exerciseType === "reread"
        ? ["Read the tribal names clearly", "Focus on the word 'harmony'", "Read with a steady rhythm like a drum"]
        : exerciseType === "word_match"
          ? ["tradition", "culture", "guardian", "harmony", "sacred"]
          : ["There are ___ unique tribes.", "They live in ___ with nature.", "The ___ mountains are protected."];

  return {
    wcpm,
    accuracy_rate: accuracyRate,
    comprehension_score: comp,
    level,
    level_by_accuracy: accuracyRate >= 95 ? "Independent" : accuracyRate >= 90 ? "Instructional" : "Frustrational",
    level_by_wcpm: wcpm >= 110 ? "Independent" : wcpm >= 80 ? "Instructional" : "Frustrational",
    data_quality: {
      transcript_present: false,
      miscues_present: miscueCount > 0,
      notes: "Prototype demo: speech-to-text unavailable/empty transcript, so results are estimated.",
    },
    miscues: [],
    gap,
    pattern_summary: "Prototype demo: results estimated without a transcript.",
    strengths,
    areas_for_improvement: areas,
    intervention: {
      exercise_type: exerciseType,
      target_skill: gap,
      instructions: "Complete the activity below, then answer the mastery check questions.",
      content: interventionContent,
      mastery_check_questions: [
        "What is one thing you will improve next time you read?",
        "Write one keyword from the story (e.g., garden, sprout).",
      ],
    },
  };
};

const Diagnostic = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<"intro" | "reading" | "recording" | "comprehension" | "analyzing">("intro");
  const phaseRef = useRef(phase);
  const [timer, setTimer] = useState(0);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [transcript, setTranscript] = useState("");
  const transcriptRef = useRef("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const interimTranscriptRef = useRef("");
  const [miscueList, setMiscueList] = useState("");
  const [miscueCount, setMiscueCount] = useState(0);
  const [sttError, setSttError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const sttStoppingRef = useRef(false);
  const sttRetryCountRef = useRef(0);
  const sttRetryTimeoutRef = useRef<number | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);

  const sttSupported = useMemo(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructorLike;
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
    };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    setAnswers(new Array(passage.questions.length).fill(null));
  }, []);



  useEffect(() => {
    return () => {
      if (sttRetryTimeoutRef.current !== null) {
        window.clearTimeout(sttRetryTimeoutRef.current);
        sttRetryTimeoutRef.current = null;
      }
      if (recordingIntervalRef.current !== null) {
        window.clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      stopSpeech();
    };
  }, []);
  useEffect(() => {
    phaseRef.current = phase;
    if (phase !== "recording") {
      sttRetryCountRef.current = 0;
      if (sttRetryTimeoutRef.current !== null) {
        window.clearTimeout(sttRetryTimeoutRef.current);
        sttRetryTimeoutRef.current = null;
      }
    }
  }, [phase]);
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    interimTranscriptRef.current = interimTranscript;
  }, [interimTranscript]);
  const buildMiscueList = (expectedText: string, actualText: string) => {
    const expected = tokenize(expectedText);
    const actual = tokenize(actualText);
    if (actual.length === 0) return { list: "", count: 0 };

    let i = 0;
    let j = 0;
    const lines: string[] = [];
    let count = 0;

    while (i < expected.length && j < actual.length) {
      if (expected[i] === actual[j]) {
        i += 1;
        j += 1;
        continue;
      }

      // 1. Omission: student skipped an expected word
      if (i + 1 < expected.length && actual[j] === expected[i + 1]) {
        count += 1;
        if (lines.length < 12) lines.push(`- Word #${i + 1}: '${expected[i]}' (omission)`);
        i += 1;
        continue;
      }

      // 2. Insertion: student added a word not in text
      if (j + 1 < actual.length && actual[j + 1] === expected[i]) {
        count += 1;
        if (lines.length < 12) lines.push(`- Extra: student said '${actual[j]}' (insertion)`);
        j += 1;
        continue;
      }

      // 3. Substitution: student replaced the word
      count += 1;
      if (lines.length < 12) lines.push(`- Word #${i + 1}: Expected '${expected[i]}' -> '${actual[j]}' (substitution)`);
      i += 1;
      j += 1;
    }

    // Remaining expected words are omissions
    while (i < expected.length && lines.length < 12) {
      count += 1;
      lines.push(`- Word #${i + 1}: '${expected[i]}' (omission)`);
      i += 1;
    }

    return { list: lines.join("\n"), count };
  };

  const startSpeech = () => {
    if (!sttSupported) return;

    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructorLike;
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
    };
    const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSttError("Speech recognition is not available in this browser.");
      return;
    }

    sttStoppingRef.current = false;

    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event: SpeechRecognitionEventLike) => {
      let nextFinal = transcriptRef.current;
      let interim = "";
      for (let k = event.resultIndex; k < event.results.length; k += 1) {
        const result = event.results[k];
        const text = result?.[0]?.transcript ?? "";
        if (!text) continue;
        if (result.isFinal) nextFinal = `${nextFinal}${text} `;
        else interim = `${interim}${text} `;
      }
      const nextFinalTrimmed = nextFinal.trim();
      if (nextFinalTrimmed !== transcriptRef.current) setTranscript(nextFinalTrimmed);
      setInterimTranscript(interim.trim());

      // Successful stream => clear retry counter + any prior error banner.
      sttRetryCountRef.current = 0;
      setSttError(null);
    };

    rec.onerror = (event: unknown) => {
      const e = event as SpeechRecognitionErrorEventLike | undefined;
      const code = e?.error;

      if (sttStoppingRef.current && (code === "aborted" || code === "no-speech")) return;

      if (code === "network" && phaseRef.current === "recording" && sttRetryCountRef.current < 2) {
        sttRetryCountRef.current += 1;
        const attempt = sttRetryCountRef.current;
        setSttError(`Speech recognition network error. Reconnecting… (${attempt}/2)`);
        stopSpeech();
        if (sttRetryTimeoutRef.current !== null) window.clearTimeout(sttRetryTimeoutRef.current);
        sttRetryTimeoutRef.current = window.setTimeout(() => {
          sttRetryTimeoutRef.current = null;
          startSpeech();
        }, 800 * attempt);
        return;
      }

      setSttError(sttErrorMessage(code));
    };

    rec.onend = () => {
      recognitionRef.current = null;
      setInterimTranscript("");
      sttStoppingRef.current = false;
    };

    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      setSttError("Speech recognition failed to start. You can still continue without a transcript.");
      recognitionRef.current = null;
    }
  };

  const stopSpeech = () => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        sttStoppingRef.current = true;
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch {
        // ignore
      }
    }
    recognitionRef.current = null;
    setInterimTranscript("");
    window.setTimeout(() => {
      sttStoppingRef.current = false;
    }, 1500);
  };

  const finishRecording = () => {
    if (recordingIntervalRef.current !== null) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    stopSpeech();
    const fullTranscript = `${transcriptRef.current} ${interimTranscriptRef.current}`.trim();
    const built = buildMiscueList(passage.text, fullTranscript);
    setMiscueList(built.list);
    setMiscueCount(built.count);
    setPhase("comprehension");
  };

  const startRecording = () => {
    setPhase("recording");
    setTimer(0);
    setTranscript("");
    setInterimTranscript("");
    setMiscueList("");
    setMiscueCount(0);
    setSttError(null);
    sttRetryCountRef.current = 0;
    if (sttRetryTimeoutRef.current !== null) {
      window.clearTimeout(sttRetryTimeoutRef.current);
      sttRetryTimeoutRef.current = null;
    }

    if (sttSupported) {
      stopSpeech();
      startSpeech();
    }

    if (recordingIntervalRef.current !== null) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    const interval = window.setInterval(() => {
      setTimer((t) => {
        if (t >= 300) {
          window.clearInterval(interval);
          recordingIntervalRef.current = null;
          finishRecording();
          return t;
        }
        return t + 1;
      });
    }, 1000);

    recordingIntervalRef.current = interval;
  };

  const handleAnswer = (choiceIdx: number) => {
    setSelectedAnswer(choiceIdx);
  };

  const nextQuestion = () => {
    const newAnswers = [...answers];
    newAnswers[currentQ] = selectedAnswer;
    setAnswers(newAnswers);
    setSelectedAnswer(null);

    if (currentQ < passage.questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      const correctCount = newAnswers.filter(
        (a, i) => a === passage.questions[i].answer
      ).length;
      const score = Math.round((correctCount / passage.questions.length) * 100);
      setPhase("analyzing");

      const secondsTaken = Math.max(1, timer || 30);
      const readWordCount = Math.max(1, Math.min(wordsReadCount || 0, expectedWords.length || 1));
      const fullTranscript = `${transcriptRef.current} ${interimTranscriptRef.current}`.trim();
      const hasTranscript = Boolean(fullTranscript);

      const analysis = hasTranscript
        ? mockAnalyze({
          originalText: passage.text,
          studentTranscript: fullTranscript,
          miscueCount,
          wordCount: readWordCount,
          secondsTaken,
          comprehensionScore: score,
        })
        : randomAnalyze({ comprehensionScore: score });

      navigate("/results", {
        state: {
          analysis,
          diagnostic: { wordCount: readWordCount, secondsTaken, comprehensionScore: score, passageId: passage.id },
        },
      });
    }
  };

  const handleSimulate = () => {
    if (recordingIntervalRef.current !== null) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    stopSpeech();

    const compScore = randInt(65, 95);
    const accuracyRate = randInt(80, 98);
    const wcpm = randInt(85, 125);
    const secondsTaken = randInt(40, 60);
    const wordCount = expectedWords.length;

    setPhase("analyzing");

    const analysis = randomAnalyze({ comprehensionScore: compScore });
    analysis.accuracy_rate = accuracyRate;
    analysis.wcpm = wcpm;
    analysis.level = promoteByRules({ accuracyRate, comprehensionScore: compScore, wcpm });

    setTimeout(() => {
      navigate("/results", {
        state: {
          analysis,
          diagnostic: {
            wordCount,
            secondsTaken,
            comprehensionScore: compScore,
            passageId: passage.id,
          },
        },
      });
    }, 1200);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const passageParts = useMemo(() => buildPassageParts(passage.text), []);
  const expectedWords = useMemo(() => tokenize(passage.text), []);
  const liveTranscript = useMemo(
    () => `${transcript} ${interimTranscript}`.trim(),
    [transcript, interimTranscript],
  );
  const spokenWords = useMemo(() => tokenize(liveTranscript), [liveTranscript]);
  const readingStats = useMemo(
    () => computeReadingProgress(expectedWords, spokenWords),
    [expectedWords, spokenWords],
  );
  const wordsReadCount = readingStats.progress;
  const errorIndices = readingStats.errors;
  const currentWordIndex = Math.min(wordsReadCount, Math.max(0, expectedWords.length - 1));
  const isDoneReading = expectedWords.length > 0 && wordsReadCount >= expectedWords.length;
  useEffect(() => {
    if (phase === "recording" && isDoneReading) {
      finishRecording();
    }
  }, [isDoneReading, phase]);

  return (
    <div className="mobile-container bg-background px-3 pb-8 h-screen overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 pt-6 pb-2 px-2">
        <button onClick={() => navigate("/student")} className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="font-display font-bold text-foreground text-lg">Reading Diagnostic</h1>
          {phase === "comprehension" && (
            <p className="text-xs text-muted-foreground">Comprehension — Question {currentQ + 1}/{passage.questions.length}</p>
          )}
        </div>
      </div>

      {/* Progress bar for comprehension */}
      {phase === "comprehension" && (
        <div className="flex gap-1.5 mb-4">
          {passage.questions.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${i < currentQ ? "bg-primary" : i === currentQ ? "bg-kinaiya-gold" : "bg-muted"
                }`}
            />
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {phase === "intro" && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-4"
          >
            <img src={micImg} alt="Microphone" className="w-24 h-24" />
            <div className="max-w-[280px]">
              <h2 className="font-display text-lg font-bold text-foreground">AI Voice Diagnostic</h2>
              <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
                Read the passage aloud. Our Edge-AI will analyze your speed, accuracy, and understanding entirely offline.
              </p>
            </div>
            <button
              onClick={() => setPhase("reading")}
              className="w-full py-3.5 rounded-2xl bg-gradient-kinaiya text-primary-foreground font-display font-bold text-base shadow-kinaiya active:scale-[0.98] transition-transform mt-4"
            >
              Begin Assessment
            </button>
          </motion.div>
        )}

        {phase === "reading" && (
          <motion.div
            key="reading"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col gap-4"
          >
            <div className="rounded-2xl bg-card border border-border p-4">
              <div className="flex items-center gap-2 mb-2 px-1">
                <Volume2 className="w-4 h-4 text-kinaiya-blue" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Read this passage aloud
                </span>
              </div>
              <p className="font-display font-bold text-foreground text-sm mb-3">{passage.title}</p>
              <p className="font-body text-base text-foreground leading-relaxed">
                {passage.text}
              </p>
            </div>

            <p className="text-center text-muted-foreground text-sm">
              When you're ready, tap the microphone to start recording.
            </p>

            <div className="flex-1 flex items-center justify-center">
              <button
                onClick={startRecording}
                className="relative w-24 h-24 rounded-full bg-gradient-kinaiya text-primary-foreground flex items-center justify-center shadow-kinaiya active:scale-95 transition-transform"
              >
                <Mic className="w-10 h-10" />
              </button>
            </div>
          </motion.div>
        )}

        {phase === "recording" && (
          <motion.div
            key="recording"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-6"
          >
            <div className="rounded-2xl bg-card border border-border p-4 w-full flex flex-col max-h-[48vh]">
              <div className="overflow-y-auto pr-1 flex-1 custom-scrollbar">
                <div className="font-display text-lg text-foreground leading-relaxed">
                  {passageParts.map((part, idx) => {
                    if (part.kind === "sep") return <span key={idx}>{part.text}</span>;

                    const isRead = part.wordIndex < wordsReadCount;
                    const isCurrent = part.wordIndex === currentWordIndex && !isDoneReading;
                    const isError = errorIndices.includes(part.wordIndex);

                    return (
                      <span
                        key={idx}
                        className={
                          isCurrent
                            ? "rounded px-1 bg-kinaiya-gold/25 ring-1 ring-kinaiya-gold/40"
                            : isError
                              ? "text-destructive underline decoration-dotted underline-offset-4"
                              : isRead
                                ? "text-muted-foreground"
                                : "text-foreground"
                        }
                      >
                        {part.text}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                <span>
                  Words: {Math.min(wordsReadCount, expectedWords.length)}/{expectedWords.length}
                </span>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 rounded-full bg-kinaiya-blue animate-pulse" />
                  <span>{sttSupported ? "Live" : "Est"}</span>
                </div>
              </div>
            </div>

            {/* Live Transcript Box - Smaller */}
            {sttSupported && (
              <div className="w-full rounded-xl bg-kinaiya-blue/[0.03] border border-kinaiya-blue/10 p-3 min-h-[60px] flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="w-2.5 h-2.5 text-kinaiya-blue/50" />
                  <span className="text-[9px] font-black text-kinaiya-blue/50 uppercase tracking-widest">Voice Log</span>
                </div>
                <p className="text-[11px] text-foreground/70 leading-normal italic line-clamp-2">
                  {liveTranscript ? liveTranscript : "Waiting..."}
                </p>
              </div>
            )}

            <div className="flex-1 flex flex-col items-center justify-center gap-3 py-1">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-kinaiya-red/20 animate-ping" />
                <div className="relative w-14 h-14 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg shadow-destructive/10">
                  <Mic className="w-6 h-6" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-display text-3xl font-bold text-foreground tabular-nums leading-none">
                  {formatTime(timer)}
                </p>
              </div>

              {/* Simulated waveform - Smaller */}
              <div className="flex items-end gap-0.5 h-6 opacity-60">
                {Array.from({ length: 20 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-1 rounded-full bg-primary/60"
                    animate={{
                      height: [4, Math.random() * 20 + 4, 4],
                    }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.05,
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {phase === "comprehension" && (
          <motion.div
            key="comprehension"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col gap-5"
          >
            <div className="rounded-2xl bg-card border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-kinaiya-purple" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Comprehension Check
                </span>
              </div>
              <p className="font-display font-bold text-foreground text-base leading-relaxed">
                {passage.questions[currentQ].q}
              </p>
            </div>

            <div className="space-y-3 flex-1">
              {passage.questions[currentQ].choices.map((choice, idx) => (
                <motion.button
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => handleAnswer(idx)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${selectedAnswer === idx
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-muted-foreground/30"
                    }`}
                >
                  {selectedAnswer === idx ? (
                    <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-sm text-foreground">{choice}</span>
                </motion.button>
              ))}
            </div>

            <button
              onClick={nextQuestion}
              disabled={selectedAnswer === null}
              className={`w-full py-4 rounded-2xl font-display font-bold text-lg transition-all ${selectedAnswer !== null
                ? "bg-gradient-kinaiya text-primary-foreground shadow-kinaiya active:scale-[0.98]"
                : "bg-muted text-muted-foreground"
                }`}
            >
              {currentQ < passage.questions.length - 1 ? "Next Question" : "Submit & View Results"}
            </button>
          </motion.div>
        )}

        {phase === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center gap-6"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 border-4 border-muted border-t-primary rounded-full"
            />
            <div className="text-center">
              <h2 className="font-display text-xl font-bold text-foreground">Analyzing Your Results</h2>
              <p className="text-muted-foreground text-sm mt-2">
                Evaluating reading fluency and comprehension...
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {(phase === "recording" || phase === "comprehension") && (
        <button
          onClick={handleSimulate}
          className="mt-auto self-center text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors py-2 px-4 italic"
        >
          [Demo] Skip to Simulated Results
        </button>
      )}
    </div>
  );
};

export default Diagnostic;
