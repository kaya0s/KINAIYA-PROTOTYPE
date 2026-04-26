import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Play, Star, Volume2, Brain } from "lucide-react";
import type {
  AnalyzeResponse,
  Intervention,
  MasteryCheckResponse,
} from "@/lib/kinaiyaApi";
import { insertInterventionSessionByCode } from "@/lib/kinaiyaDb";
import { enqueueSession } from "@/lib/offlineQueue";
import { updateStudentProfileByCode } from "@/lib/kinaiyaDb";

const LAST_ANALYSIS_KEY = "kinaiya_last_analysis_v1";
const CURRENT_INTERVENTION_KEY = "kinaiya_current_intervention_v1";
const STUDENT_SESSION_KEY = "kinaiya_student_session_v1";

const promoteLevel = (level: AnalyzeResponse["level"]) => {
  if ((level as string) === "Frustration" || level === "Frustrational")
    return "Instructional";
  if (level === "Instructional") return "Independent";
  return "Independent";
};

const masteryCheckMock = (
  questions: string[],
  studentAnswers: string[],
): MasteryCheckResponse => {
  const total = Math.max(1, questions.length);
  const trimmed = studentAnswers.map((a) => a.trim());
  const answered = trimmed.filter((a) => a.length >= 2).length;
  const pct = Math.round((answered / total) * 100);

  const masteryAchieved = pct >= 70;
  const nextAction: MasteryCheckResponse["next_action"] = masteryAchieved
    ? "promote"
    : pct >= 40
      ? "repeat_different"
      : "repeat_simpler";

  return {
    mastery_achieved: masteryAchieved,
    score: `${pct}%`,
    question_results: questions.map((q, i) => {
      const a = trimmed[i] ?? "";
      const ok = a.length >= 2;
      return {
        question: q,
        student_answer: a,
        is_correct: ok,
        feedback: ok
          ? "Good effort. Keep going."
          : "Try answering with at least one word or phrase.",
      };
    }),
    overall_feedback: masteryAchieved
      ? "Mastery achieved (prototype demo). Great job—ready for the next level."
      : "Not yet mastered (prototype demo). Let's practice again with a new activity.",
    next_action: nextAction,
  };
};

const regenerateInterventionMock = (args: {
  previous: Intervention;
  nextAction: "repeat_different" | "repeat_simpler";
}): Intervention => {
  const order: Intervention["exercise_type"][] = [
    "fill_blank",
    "word_match",
    "reread",
    "phonics_drill",
  ];
  const idx = Math.max(0, order.indexOf(args.previous.exercise_type));
  const nextType =
    args.nextAction === "repeat_simpler"
      ? "reread"
      : order[(idx + 1) % order.length];

  const base = args.previous.content ?? [];
  const content =
    nextType === "reread"
      ? [
          "Re-read the passage with good pacing",
          "Pause at commas and periods",
          "Emphasize important words",
        ]
      : nextType === "phonics_drill"
        ? ["highland", "fertile", "plateau", "watershed", "ancestor"]
        : nextType === "word_match"
          ? [
              "stewardship",
              "conservation",
              "indigenous",
              "community",
              "tradition",
            ]
          : base.length
            ? base
            : [
                "The communities protect the ___.",
                "Mount Kitanglad is a vital ___.",
                "Indigenous people care for the ___.",
              ];

  return {
    exercise_type: nextType,
    target_skill: args.previous.target_skill,
    instructions: "Try a new activity (prototype demo).",
    content,
    mastery_check_questions: args.previous.mastery_check_questions,
  };
};

const Lessons = () => {
  const navigate = useNavigate();

  const storedAnalysis = useMemo(() => {
    try {
      const raw = localStorage.getItem(LAST_ANALYSIS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { analysis?: AnalyzeResponse };
      return parsed.analysis ?? null;
    } catch {
      return null;
    }
  }, []);

  const [analysis] = useState<AnalyzeResponse | null>(storedAnalysis);
  const [activeLesson, setActiveLesson] = useState<number | null>(1);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [intervention, setIntervention] = useState<Intervention | null>(() => {
    try {
      const raw = localStorage.getItem(CURRENT_INTERVENTION_KEY);
      if (raw) return JSON.parse(raw) as Intervention;
    } catch {
      // ignore
    }
    return storedAnalysis?.intervention ?? null;
  });

  const [answers, setAnswers] = useState<string[]>(
    () => intervention?.mastery_check_questions?.map(() => "") ?? [],
  );
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<MasteryCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Systematic Reading Loop Analysis
  const adaptiveRationale = useMemo(() => {
    if (!analysis) return null;
    const gap = analysis.gap.toLowerCase();

    if (gap.includes("omission"))
      return "AI detected word skipping patterns. Focus: Foundational Tracking.";
    if (gap.includes("substitution"))
      return "AI detected decoding errors. Focus: Multi-syllabic Word Recognition.";
    if (gap.includes("vowel") || gap.includes("phonics"))
      return "AI detected word pattern gaps. Focus: Vowel Teams & Consonant Clusters.";
    if (gap.includes("fluency") || gap.includes("oral reading"))
      return "AI detected pace struggles. Focus: Oral Reading Rate & Expression.";
    if (gap.includes("main idea") || gap.includes("comprehension"))
      return "AI detected comprehension gaps. Focus: Main Idea & Key Details.";
    if (gap.includes("inference"))
      return "AI detected inferencing gaps. Focus: Drawing Conclusions from Text.";

    return "Personalized pathway based on Phil-IRI Grade 6 analysis.";
  }, [analysis]);

  useEffect(() => {
    if (!intervention) return;
    localStorage.setItem(
      CURRENT_INTERVENTION_KEY,
      JSON.stringify(intervention),
    );
  }, [intervention]);

  useEffect(() => {
    setAnswers(intervention?.mastery_check_questions?.map(() => "") ?? []);
    setResult(null);
    setError(null);
  }, [intervention?.mastery_check_questions]);

  const submitMasteryCheck = async () => {
    if (!analysis || !intervention) return;
    setError(null);
    setChecking(true);
    try {
      // Simulate systematic check
      const res = masteryCheckMock(
        intervention.mastery_check_questions,
        answers,
      );

      // Artificial delay to show AI "processing" the loop
      await new Promise((r) => setTimeout(r, 1200));

      setResult(res);

      try {
        const raw = localStorage.getItem(STUDENT_SESSION_KEY);
        const session = raw
          ? (JSON.parse(raw) as { classCode?: string; studentId?: string })
          : null;
        if (session?.classCode && session?.studentId) {
          const payload = {
            code: session.classCode,
            studentId: session.studentId,
            level: analysis.level,
            gap: analysis.gap,
            targetSkill: intervention.target_skill,
            exerciseType: intervention.exercise_type,
            intervention,
            masteryCheck: {
              answers,
              result: res,
              questions: intervention.mastery_check_questions,
            },
            masteryAchieved: res.mastery_achieved,
            nextAction: res.next_action,
          } as const;

          try {
            await insertInterventionSessionByCode(payload);
          } catch {
            enqueueSession(payload);
          }

          if (res.next_action === "promote") {
            const nextLevel = promoteLevel(analysis.level);
            try {
              await updateStudentProfileByCode({
                code: session.classCode,
                studentId: session.studentId,
                currentLevel: nextLevel,
                currentGap: analysis.gap,
              });
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // ignore
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not check mastery. Try again.",
      );
    } finally {
      setChecking(false);
    }
  };

  const regenerate = async () => {
    if (!analysis || !intervention || !result) return;
    if (
      result.next_action !== "repeat_different" &&
      result.next_action !== "repeat_simpler"
    )
      return;

    setError(null);
    setIsAdjusting(true);

    // Demonstrate "Closed-Loop IPO"
    await new Promise((r) => setTimeout(r, 2000));

    try {
      const next = regenerateInterventionMock({
        previous: intervention,
        nextAction: result.next_action,
      });
      setIntervention(next);
      setResult(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not regenerate a new exercise.",
      );
    } finally {
      setIsAdjusting(false);
    }
  };

  const modules = useMemo(() => {
    const title = intervention?.target_skill || "Personalized Lesson";
    const desc = analysis?.gap
      ? `Focus: ${analysis.gap}`
      : "Based on your last diagnostic";
    return [
      {
        id: 1,
        title,
        desc,
        status: "current" as const,
        progress: result?.mastery_achieved ? 100 : 30,
        icon: "📘",
      },
      {
        id: 2,
        title: "Reading Fluency",
        desc: "More practice after mastery",
        status: "locked" as const,
        progress: 0,
        icon: "🔁",
      },
      {
        id: 3,
        title: "Word Games",
        desc: "Build the word (phonics)",
        status: "available" as const,
        progress: 0,
        icon: "🎯",
      },
    ];
  }, [analysis?.gap, intervention?.target_skill, result?.mastery_achieved]);

  return (
    <div className="mobile-container bg-background px-5 pb-8">
      <div className="flex items-center gap-3 pt-6 pb-4">
        <button
          onClick={() => navigate("/student")}
          className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="font-display font-bold text-foreground text-lg">
            My Learning Path
          </h1>
          <p className="text-xs text-muted-foreground">
            Personalized for your reading level
          </p>
        </div>
      </div>

      {!analysis || !intervention ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-card border border-border p-5"
        >
          <p className="text-sm text-muted-foreground leading-relaxed">
            Take a reading diagnostic first to get a personalized lesson plan.
          </p>
          <button
            onClick={() => navigate("/diagnostic")}
            className="mt-4 w-full py-4 rounded-2xl bg-gradient-kinaiya text-primary-foreground font-display font-bold text-lg shadow-kinaiya active:scale-[0.98] transition-transform"
          >
            Start Diagnostic
          </button>
        </motion.div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-kinaiya-purple-light border border-kinaiya-purple/20 p-4 mb-6"
          >
            <div className="flex items-center gap-3 mb-3 pb-2 border-b border-kinaiya-purple/10">
              <div className="w-8 h-8 rounded-full bg-kinaiya-purple text-white flex items-center justify-center">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">
                  Kinaiya AI Insight
                </p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none">
                  Closed-Loop IPO Logic
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <p className="text-[8px] text-muted-foreground font-bold uppercase">
                  Input
                </p>
                <p className="text-[10px] text-foreground font-medium leading-tight">
                  {analysis?.gap.split(":")[0] || "Analysis"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] text-muted-foreground font-bold uppercase">
                  Process
                </p>
                <p className="text-[10px] text-foreground font-medium leading-tight">
                  MSU Adaptation
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] text-muted-foreground font-bold uppercase">
                  Output
                </p>
                <p className="text-[10px] text-kinaiya-purple font-bold leading-tight uppercase">
                  {intervention?.exercise_type.replace("_", " ")}
                </p>
              </div>
            </div>

            <div className="mt-3 p-2 rounded-lg bg-white/50 border border-kinaiya-purple/10">
              <div className="flex items-center gap-2">
                <Volume2 className="w-3.5 h-3.5 text-kinaiya-purple flex-shrink-0" />
                <p className="text-xs text-muted-foreground italic font-medium leading-snug">
                  "{adaptiveRationale}"
                </p>
              </div>
            </div>
          </motion.div>

          <div className="space-y-4">
            {modules.map((mod, i) => (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <button
                  onClick={() => {
                    if (mod.status === "locked") return;
                    if (mod.id === 3) {
                      navigate("/games");
                      return;
                    }
                    setActiveLesson(activeLesson === mod.id ? null : mod.id);
                  }}
                  disabled={mod.status === "locked"}
                  className={`w-full text-left rounded-2xl border p-4 transition-all ${
                    mod.status === "locked"
                      ? "bg-muted/50 border-border opacity-60"
                      : mod.status === "current"
                        ? "bg-card border-primary shadow-kinaiya"
                        : "bg-card border-border"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-3xl">{mod.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-display font-bold text-foreground text-sm">
                          {mod.title}
                        </p>
                        {mod.status === "locked" && (
                          <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        {mod.status === "current" && (
                          <span className="px-2 py-0.5 bg-primary text-primary-foreground text-[10px] rounded-full font-bold">
                            IN PROGRESS
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {mod.desc}
                      </p>
                      {mod.progress > 0 && (
                        <div className="mt-2 bg-muted rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full bg-gradient-kinaiya transition-all"
                            style={{ width: `${mod.progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    {mod.status === "current" && (
                      <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                        <Play className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {activeLesson === mod.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 mt-2 rounded-2xl bg-card border border-border space-y-4">
                        <div className="rounded-xl bg-muted/40 p-3">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            Instructions
                          </p>
                          <p className="text-sm text-foreground mt-1 leading-relaxed">
                            {intervention.instructions}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            Practice
                          </p>
                          {intervention.content.map((item, j) => (
                            <div
                              key={`${item}-${j}`}
                              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
                            >
                              <div className="w-8 h-8 rounded-lg bg-kinaiya-green-light text-kinaiya-green flex items-center justify-center text-xs font-bold">
                                {j + 1}
                              </div>
                              <span className="text-sm text-foreground flex-1">
                                {item}
                              </span>
                              <Star className="w-4 h-4 text-kinaiya-gold" />
                            </div>
                          ))}
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                            Mastery Check
                          </p>
                          {intervention.mastery_check_questions.map(
                            (q, idx) => (
                              <div
                                key={q}
                                className="space-y-2 rounded-xl bg-muted/50 p-3"
                              >
                                <p className="text-sm font-bold text-foreground">
                                  {q}
                                </p>
                                <input
                                  value={answers[idx] ?? ""}
                                  onChange={(e) => {
                                    const next = [...answers];
                                    next[idx] = e.target.value;
                                    setAnswers(next);
                                  }}
                                  placeholder="Type your answer"
                                  className="w-full px-3 py-3 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                              </div>
                            ),
                          )}

                          {error && (
                            <div className="rounded-xl bg-kinaiya-red-light border border-kinaiya-red/20 p-3">
                              <p className="text-sm text-kinaiya-red">
                                {error}
                              </p>
                            </div>
                          )}

                          {result && (
                            <div
                              className={`rounded-xl border p-3 ${result.mastery_achieved ? "bg-kinaiya-green-light border-kinaiya-green/20" : "bg-kinaiya-blue-light border-kinaiya-blue/20"}`}
                            >
                              <p className="text-sm font-bold text-foreground">
                                {result.mastery_achieved
                                  ? "Mastery achieved!"
                                  : "Keep going!"}{" "}
                                <span className="text-xs text-muted-foreground font-normal">
                                  ({result.score})
                                </span>
                              </p>
                              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                                {result.overall_feedback}
                              </p>
                              <div className="mt-3 space-y-2">
                                {result.question_results.map((r) => (
                                  <div
                                    key={r.question}
                                    className="text-xs text-muted-foreground"
                                  >
                                    <span className="font-medium text-foreground">
                                      {r.is_correct ? "Correct:" : "Try again:"}
                                    </span>{" "}
                                    {r.feedback}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={submitMasteryCheck}
                              disabled={
                                checking || answers.some((a) => !a.trim())
                              }
                              className="flex-1 py-3 rounded-2xl bg-gradient-kinaiya text-primary-foreground font-display font-bold text-sm shadow-kinaiya active:scale-[0.98] transition-transform disabled:opacity-60 disabled:pointer-events-none"
                            >
                              {checking
                                ? "Checking..."
                                : "Submit Mastery Check"}
                            </button>
                            <button
                              onClick={() => navigate("/student")}
                              className="py-3 px-4 rounded-2xl bg-card border border-border text-foreground font-display font-bold text-sm active:scale-[0.98] transition-transform"
                            >
                              Done
                            </button>
                          </div>

                          {result &&
                            !result.mastery_achieved &&
                            (result.next_action === "repeat_different" ||
                              result.next_action === "repeat_simpler") && (
                              <button
                                onClick={regenerate}
                                disabled={isAdjusting}
                                className="w-full py-4 rounded-2xl bg-kinaiya-purple text-white font-display font-bold text-sm shadow-lg active:scale-[0.98] transition-all relative overflow-hidden"
                              >
                                {isAdjusting ? (
                                  <motion.div
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{
                                      repeat: Infinity,
                                      duration: 1,
                                    }}
                                    className="flex items-center justify-center gap-2"
                                  >
                                    Kinaiya AI is re-adjusting...
                                  </motion.div>
                                ) : (
                                  "Apply Adaptive Response (Simpler Model)"
                                )}
                              </button>
                            )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Lessons;
