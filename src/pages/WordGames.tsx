import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Delete,
  Gamepad2,
  RefreshCcw,
  XCircle,
} from "lucide-react";
import type { AnalyzeResponse } from "@/lib/kinaiyaApi";
import {
  insertInterventionSessionByCode,
  updateStudentProfileByCode,
} from "@/lib/kinaiyaDb";
import { enqueueSession } from "@/lib/offlineQueue";

const LAST_ANALYSIS_KEY = "kinaiya_last_analysis_v1";
const STUDENT_SESSION_KEY = "kinaiya_student_session_v1";

type WordRound = {
  word: string;
  hint: string;
  category:
    | "context_vocab"
    | "multisyllabic"
    | "content_words"
    | "academic_vocab";
};

type RoundResult = {
  word: string;
  built: string;
  correct: boolean;
  attempts: number;
  timeMs: number;
};

const pickCategoryFromGap = (gap: string): WordRound["category"] => {
  const g = gap.toLowerCase();
  if (/(vocabulary|context clue|main idea)/.test(g)) return "context_vocab";
  if (/(decoding|multi.syllabic|vowel pattern)/.test(g)) return "multisyllabic";
  if (/(comprehension|inference|detail)/.test(g)) return "academic_vocab";
  if (/(fluency|oral reading|expression|phonics|consonant|vowel team)/.test(g))
    return "content_words";
  return "content_words";
};

const shuffle = <T,>(items: T[]) => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const uniq = (s: string[]) => Array.from(new Set(s));

const buildTiles = (word: string) => {
  const letters = word.toLowerCase().split("");
  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
  const distractorCount = Math.min(6, Math.max(2, 10 - letters.length));
  const distractors = shuffle(
    alphabet.filter((c) => !letters.includes(c)),
  ).slice(0, distractorCount);
  return shuffle(uniq([...letters, ...distractors]));
};

const WordGames = () => {
  const navigate = useNavigate();

  const analysis = useMemo(() => {
    try {
      const raw = localStorage.getItem(LAST_ANALYSIS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { analysis?: AnalyzeResponse };
      return parsed.analysis ?? null;
    } catch {
      return null;
    }
  }, []);

  const rounds = useMemo<WordRound[]>(() => {
    const gap = analysis?.gap || "";
    const category = pickCategoryFromGap(gap);

    const contextVocab: Array<{ word: string; hint: string }> = [
      {
        word: "fertile",
        hint: "Land that is rich and good for growing crops.",
      },
      {
        word: "harvest",
        hint: "The time when crops are gathered from the fields.",
      },
      {
        word: "plateau",
        hint: "A flat area of land that is higher than the land around it.",
      },
      {
        word: "sacred",
        hint: "Something that is holy or very important to a group of people.",
      },
      { word: "ancient", hint: "Very old; from a time long ago." },
      {
        word: "culture",
        hint: "The traditions, beliefs, and way of life of a group of people.",
      },
      { word: "forest", hint: "A large area of land covered with trees." },
      { word: "region", hint: "A large area of land with similar features." },
    ];

    const multisyllabic: Array<{ word: string; hint: string }> = [
      {
        word: "highland",
        hint: "An area of land that is high above sea level.",
      },
      {
        word: "watershed",
        hint: "An area of land that drains water into a river or lake.",
      },
      {
        word: "tradition",
        hint: "A custom or belief passed down from generation to generation.",
      },
      {
        word: "community",
        hint: "A group of people who live in the same area.",
      },
      { word: "ancestor", hint: "A family member who lived a long time ago." },
    ];

    const contentWords: Array<{ word: string; hint: string }> = [
      { word: "mountain", hint: "A very high and steep hill." },
      {
        word: "village",
        hint: "A small community of people in the countryside.",
      },
      {
        word: "bamboo",
        hint: "A tall, fast-growing plant used for building and making things.",
      },
      {
        word: "spring",
        hint: "A place where water naturally flows out of the ground.",
      },
      {
        word: "harvest",
        hint: "The process of gathering ripe crops from the fields.",
      },
    ];

    const academicVocab: Array<{ word: string; hint: string }> = [
      {
        word: "explain",
        hint: "To make something clear so others can understand it.",
      },
      {
        word: "describe",
        hint: "To tell what something looks like or what happened.",
      },
      {
        word: "compare",
        hint: "To look at how two things are alike or different.",
      },
      { word: "predict", hint: "To say what you think will happen next." },
      { word: "identify", hint: "To find and name something specific." },
    ];

    const bankByCategory: Record<
      WordRound["category"],
      Array<{ word: string; hint: string }>
    > = {
      context_vocab: contextVocab,
      multisyllabic: multisyllabic,
      content_words: contentWords,
      academic_vocab: academicVocab,
    };

    const base = bankByCategory[category];
    const support = contextVocab;
    const pool =
      (analysis?.level as string) === "Frustration" ||
      analysis?.level === "Frustrational"
        ? [...base, ...support]
        : analysis?.level === "Instructional"
          ? [...base, ...contentWords, ...support]
          : [...base, ...contentWords, ...multisyllabic, ...support];

    return shuffle(pool)
      .slice(0, 10)
      .map((x) => ({ ...x, category }));
  }, [analysis]);

  const [roundIndex, setRoundIndex] = useState(0);
  const [built, setBuilt] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [feedback, setFeedback] = useState<{
    kind: "correct" | "wrong";
    text: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const roundStartRef = useRef<number>(Date.now());

  const current = rounds[roundIndex] ?? null;

  const tiles = useMemo(() => {
    if (!current) return [];
    return buildTiles(current.word);
  }, [current]);

  const isComplete = built.length > 0 && built.every(Boolean);

  const resetRoundState = (w: string) => {
    setBuilt(Array.from({ length: w.length }).map(() => ""));
    setRevealed(Array.from({ length: w.length }).map(() => false));
    setAttempts(0);
    setFeedback(null);
    roundStartRef.current = Date.now();
  };

  useEffect(() => {
    if (!current) return;
    resetRoundState(current.word);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.word]);

  const addLetter = (letter: string) => {
    setBuilt((prev) => {
      const next = [...prev];
      const idx = next.findIndex((x, i) => !x && !revealed[i]);
      if (idx === -1) return prev;
      next[idx] = letter;
      return next;
    });
    setFeedback(null);
  };

  const backspace = () => {
    setBuilt((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (revealed[i]) continue;
        if (next[i]) {
          next[i] = "";
          break;
        }
      }
      return next;
    });
    setFeedback(null);
  };

  const clear = () => {
    setBuilt((prev) => prev.map((c, i) => (revealed[i] ? c : "")));
    setFeedback(null);
  };

  const revealHelp = () => {
    if (!current) return;
    setRevealed((prev) => {
      const next = [...prev];
      next[0] = true;
      return next;
    });
    setBuilt((prev) => {
      const next = [...prev];
      next[0] = current.word[0].toLowerCase();
      return next;
    });
  };

  const check = () => {
    if (!current) return;
    if (!isComplete) return;

    const builtWord = built.join("").toLowerCase();
    const correct = builtWord === current.word.toLowerCase();
    const nextAttempts = attempts + 1;
    const timeMs = Date.now() - roundStartRef.current;

    if (correct) {
      setFeedback({ kind: "correct", text: "Correct! Nice work." });
      setResults((prev) => [
        ...prev,
        {
          word: current.word,
          built: builtWord,
          correct: true,
          attempts: nextAttempts,
          timeMs,
        },
      ]);
      setTimeout(() => setRoundIndex((i) => i + 1), 550);
      return;
    }

    setAttempts(nextAttempts);
    setFeedback({ kind: "wrong", text: "Not quite. Try again." });
    if (nextAttempts >= 2) revealHelp();
    setResults((prev) => {
      const existing = prev.find((r) => r.word === current.word);
      if (existing) return prev;
      return [
        ...prev,
        {
          word: current.word,
          built: builtWord,
          correct: false,
          attempts: nextAttempts,
          timeMs,
        },
      ];
    });
  };

  const summary = useMemo(() => {
    const total = rounds.length || 0;
    if (total === 0) return null;
    const unique = new Map<string, RoundResult>();
    for (const r of results) unique.set(r.word, r);
    const items = Array.from(unique.values());
    const correctCount = items.filter((r) => r.correct).length;
    const avgTimeMs = items.length
      ? Math.round(items.reduce((sum, r) => sum + r.timeMs, 0) / items.length)
      : 0;
    return {
      total,
      completed: items.length,
      correctCount,
      accuracy: total ? Math.round((correctCount / total) * 100) : 0,
      avgTimeMs,
      items,
    };
  }, [results, rounds.length]);

  const saveSession = async () => {
    if (!analysis || !summary) return;
    const raw = localStorage.getItem(STUDENT_SESSION_KEY);
    const session = raw
      ? (JSON.parse(raw) as { classCode?: string; studentId?: string })
      : null;
    if (!session?.classCode || !session?.studentId) return;

    setSaving(true);
    const masteryAchieved = summary.accuracy >= 75;
    const gap = analysis.gap || "Phonics practice";

    const payload = {
      code: session.classCode,
      studentId: session.studentId,
      level: analysis.level,
      gap,
      targetSkill: "Phonics - Build the Word",
      exerciseType: "build_word",
      intervention: {
        game: "build_word",
        category: pickCategoryFromGap(gap),
        rounds: rounds.map((r) => ({ word: r.word, hint: r.hint })),
      },
      masteryCheck: {
        accuracy: summary.accuracy,
        correctCount: summary.correctCount,
        total: summary.total,
        avgTimeMs: summary.avgTimeMs,
        results: summary.items,
      },
      masteryAchieved,
      nextAction: masteryAchieved ? "promote" : "repeat_simpler",
    } as const;

    try {
      await insertInterventionSessionByCode(payload);
      if (masteryAchieved) {
        // Promote student after high accuracy in English games
        const currentLevel =
          (analysis.level as string) === "Frustration"
            ? "Frustrational"
            : analysis.level;
        const nextLevel =
          currentLevel === "Frustrational" ? "Instructional" : "Independent";
        await updateStudentProfileByCode({
          code: session.classCode,
          studentId: session.studentId,
          currentLevel: nextLevel,
          currentGap: "Mastered category: " + pickCategoryFromGap(gap),
        });
      }
    } catch {
      enqueueSession(payload);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!analysis || !summary) return;
    if (summary.completed !== summary.total) return;
    void saveSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary?.completed, summary?.total]);

  return (
    <div className="mobile-container bg-background px-5 pb-8 min-h-screen flex flex-col">
      <div className="flex items-center gap-3 pt-6 pb-4">
        <button
          onClick={() => navigate("/student")}
          className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="font-display font-bold text-foreground text-lg">
            Word Games
          </h1>
          <p className="text-xs text-muted-foreground">
            Build the word (English phonics)
          </p>
        </div>
      </div>

      {rounds.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card border border-border p-5"
        >
          <p className="text-sm text-muted-foreground leading-relaxed">
            Loading game...
          </p>
        </motion.div>
      ) : (
        <>
          {!analysis && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-kinaiya-blue-light border border-kinaiya-blue/20 p-4 mb-4"
            >
              <p className="text-sm text-foreground font-bold">
                No diagnostic found
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Using a baseline English phonics set. Take a diagnostic later to
                personalize.
              </p>
            </motion.div>
          )}
          {!current || (summary && summary.completed >= summary.total) ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-card border border-border p-5"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-kinaiya-green" />
                <p className="text-sm font-bold text-foreground">
                  Session Complete
                </p>
              </div>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Accuracy:{" "}
                <span className="text-foreground font-bold">
                  {summary?.accuracy ?? 0}%
                </span>{" "}
                <span className="text-muted-foreground">
                  ({summary?.correctCount ?? 0}/{summary?.total ?? 0})
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Avg time:{" "}
                {summary ? `${Math.round(summary.avgTimeMs / 1000)}s` : "0s"}{" "}
                {analysis && saving ? "• saving..." : ""}
              </p>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  onClick={() => {
                    setResults([]);
                    setRoundIndex(0);
                  }}
                  className="py-4 rounded-2xl bg-card border border-border text-foreground font-display font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                  <RefreshCcw className="w-4 h-4" />
                  Play again
                </button>
                <button
                  onClick={() => navigate("/lessons")}
                  className="py-4 rounded-2xl bg-gradient-kinaiya text-primary-foreground font-display font-bold text-sm shadow-kinaiya active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                  <Gamepad2 className="w-4 h-4" />
                  Back to lessons
                </button>
              </div>

              <button
                onClick={() => navigate("/student")}
                className="mt-3 w-full py-3 rounded-2xl bg-muted text-foreground font-display font-bold text-sm active:scale-[0.98] transition-transform"
              >
                Done
              </button>
            </motion.div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-card border border-border p-5 mb-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="w-4 h-4 text-kinaiya-purple" />
                    <p className="text-sm font-bold text-foreground">
                      Build the Word
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Round {Math.min(roundIndex + 1, rounds.length)}/
                    {rounds.length}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Hint:{" "}
                  <span className="text-foreground font-medium">
                    {current.hint}
                  </span>
                </p>
              </motion.div>

              <div className="rounded-2xl bg-card border border-border p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Your answer
                </p>
                <div className="flex items-center justify-center gap-2 mt-3">
                  {built.map((c, i) => (
                    <button
                      key={`${i}-${current.word}`}
                      onClick={() => {
                        if (revealed[i]) return;
                        setBuilt((prev) => {
                          const next = [...prev];
                          next[i] = "";
                          return next;
                        });
                      }}
                      className={`w-10 h-12 rounded-xl border text-lg font-extrabold font-display flex items-center justify-center ${
                        revealed[i]
                          ? "bg-kinaiya-blue-light border-kinaiya-blue/30 text-kinaiya-blue"
                          : "bg-background border-border text-foreground"
                      }`}
                      aria-label={`slot-${i + 1}`}
                    >
                      {(c || "").toUpperCase()}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={backspace}
                    className="flex-1 py-3 rounded-2xl bg-muted text-foreground font-display font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                  >
                    <Delete className="w-4 h-4" />
                    Backspace
                  </button>
                  <button
                    onClick={clear}
                    className="py-3 px-4 rounded-2xl bg-card border border-border text-foreground font-display font-bold text-sm active:scale-[0.98] transition-transform"
                  >
                    Clear
                  </button>
                </div>

                <div className="grid grid-cols-6 gap-2 mt-4">
                  {tiles.map((t) => (
                    <button
                      key={t}
                      onClick={() => addLetter(t)}
                      className="py-3 rounded-2xl bg-card border border-border text-foreground font-display font-extrabold text-sm active:scale-[0.98] transition-transform"
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>

                {feedback && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`mt-4 rounded-2xl border p-4 ${
                      feedback.kind === "correct"
                        ? "bg-kinaiya-green-light border-kinaiya-green/20"
                        : "bg-kinaiya-red-light border-kinaiya-red/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {feedback.kind === "correct" ? (
                        <CheckCircle2 className="w-4 h-4 text-kinaiya-green" />
                      ) : (
                        <XCircle className="w-4 h-4 text-kinaiya-red" />
                      )}
                      <p className="text-sm font-bold text-foreground">
                        {feedback.text}
                      </p>
                    </div>
                    {attempts >= 2 && feedback.kind === "wrong" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Tip: the first letter is{" "}
                        <span className="text-foreground font-bold">
                          {current.word[0].toUpperCase()}
                        </span>
                        .
                      </p>
                    )}
                  </motion.div>
                )}

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={check}
                    disabled={!isComplete}
                    className="flex-1 py-4 rounded-2xl bg-gradient-kinaiya text-primary-foreground font-display font-bold text-lg shadow-kinaiya active:scale-[0.98] transition-transform disabled:opacity-60 disabled:pointer-events-none"
                  >
                    Check
                  </button>
                  <button
                    onClick={() => navigate("/student")}
                    className="py-4 px-4 rounded-2xl bg-card border border-border text-foreground font-display font-bold text-lg active:scale-[0.98] transition-transform"
                    aria-label="exit"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default WordGames;
