import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Play, Star, Volume2, Brain } from "lucide-react";
import type {
  AnalyzeResponse,
  Intervention,
  MasteryCheckResponse,
} from "@/lib/kinaiyaApi";
import {
  insertInterventionSessionByCode,
  updateStudentProfileByCode,
} from "@/lib/kinaiyaDb";
import { enqueueSession } from "@/lib/offlineQueue";
import { getMotherTongueBridge, normalizeLevel } from "@/lib/demoModel";

const LAST_ANALYSIS_KEY = "kinaiya_last_analysis_v1";
const CURRENT_INTERVENTION_KEY = "kinaiya_current_intervention_v1";
const STUDENT_SESSION_KEY = "kinaiya_student_session_v1";

const promoteLevel = (level: AnalyzeResponse["level"]) => {
  if ((level as string) === "Frustration" || level === "Frustrational") {
    return "Instructional";
  }
  if (level === "Instructional") return "Independent";
  return "Independent";
};

const masteryCheckHeuristic = (
  questions: string[],
  studentAnswers: string[],
  gap: string,
  targetSkill: string,
): MasteryCheckResponse => {
  const getKeywords = (question: string) => {
    const loweredQuestion = question.toLowerCase();
    const loweredFocus = `${gap} ${targetSkill}`.toLowerCase();
    if (loweredQuestion.includes("main idea")) {
      return ["bukidnon", "community", "communities", "land", "protect"];
    }
    if (
      loweredQuestion.includes("difficult word") ||
      loweredQuestion.includes("means")
    ) {
      return ["care", "protect", "forest", "water", "tradition", "community"];
    }
    if (loweredFocus.includes("fluency")) {
      return ["pause", "smooth", "clear", "expression", "pace"];
    }
    if (
      loweredFocus.includes("phonics") ||
      loweredFocus.includes("decoding") ||
      loweredFocus.includes("vowel")
    ) {
      return ["sound", "blend", "syllable", "vowel", "word"];
    }
    return ["main", "detail", "community", "meaning"];
  };

  const scored = questions.map((question, index) => {
    const answer = studentAnswers[index]?.trim() ?? "";
    const normalized = answer.toLowerCase();
    const isCorrect =
      answer.length >= 4 &&
      getKeywords(question).some((keyword) => normalized.includes(keyword));
    return { answer, isCorrect, question };
  });

  const pct = Math.round(
    (scored.filter((item) => item.isCorrect).length /
      Math.max(1, scored.length)) *
      100,
  );
  const masteryAchieved = pct >= 70;

  return {
    mastery_achieved: masteryAchieved,
    score: `${pct}%`,
    question_results: scored.map((item) => ({
      question: item.question,
      student_answer: item.answer,
      is_correct: item.isCorrect,
      feedback: item.isCorrect
        ? "Good answer. Your response matched the target skill."
        : "Try again with the key idea or target word from the lesson.",
    })),
    overall_feedback: masteryAchieved
      ? "Mastery achieved. KINAIYA can move you to the next reading challenge."
      : "Not yet mastered. KINAIYA will adjust support before the next attempt.",
    next_action: masteryAchieved
      ? "promote"
      : pct >= 40
        ? "repeat_different"
        : "repeat_simpler",
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
    instructions:
      args.nextAction === "repeat_simpler"
        ? "KINAIYA is reducing the difficulty and adding more guided support."
        : "KINAIYA is switching the practice format while keeping the same target skill.",
    content,
    mastery_check_questions: args.previous.mastery_check_questions,
  };
};

const formatExerciseType = (type: Intervention["exercise_type"]) =>
  type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const buildPromotedIntervention = (
  analysis: AnalyzeResponse,
  current: Intervention,
): Intervention => {
  const currentSkill = current.target_skill.toLowerCase();
  const nextTarget = currentSkill.includes("fluency")
    ? "Comprehension: main idea and key details"
    : currentSkill.includes("comprehension")
      ? "Vocabulary: context clues in connected text"
      : "Fluency: oral reading rate and expression";

  const content =
    nextTarget.toLowerCase().includes("comprehension")
      ? [
          "Read the short Bukidnon passage and underline the main idea.",
          "Choose two details that support the main idea.",
          "Write one sentence explaining the author's message.",
        ]
      : nextTarget.toLowerCase().includes("vocabulary")
        ? [
            "Use nearby clues to define watershed, fertile, and steward.",
            "Circle the phrase that helped you infer each meaning.",
            "Write your own sentence using one target word correctly.",
          ]
        : [
            "Read the passage once for accuracy.",
            "Read it again with smoother phrasing and punctuation pauses.",
            "Aim to keep your voice steady from start to finish.",
          ];

  const questions =
    nextTarget.toLowerCase().includes("comprehension")
      ? [
          "What is the main idea of the passage?",
          "What detail best supports the main idea?",
          "What lesson can the reader learn from the text?",
        ]
      : nextTarget.toLowerCase().includes("vocabulary")
        ? [
            "What does the word watershed mean in the passage?",
            "Which clue helped you understand the word fertile?",
            "Why is using context clues helpful before asking for support?",
          ]
        : [
            "What should your voice do when you see a comma?",
            "Why is smooth phrasing important in oral reading?",
            "What fluency habit will you use in your next reread?",
          ];

  return {
    exercise_type:
      nextTarget.toLowerCase().includes("comprehension")
        ? "fill_blank"
        : nextTarget.toLowerCase().includes("vocabulary")
          ? "word_match"
          : "reread",
    target_skill: nextTarget,
    instructions: `If you master the current lesson, KINAIYA will move you forward into ${nextTarget.toLowerCase()}.`,
    content,
    mastery_check_questions: questions,
  };
};

const getLessonGoal = (analysis: AnalyzeResponse) => {
  const wcpm = Math.round(analysis.wcpm);
  const accuracy = Math.round(analysis.accuracy_rate);
  const comprehension = Math.round(analysis.comprehension_score);
  const gap = analysis.gap.toLowerCase();

  if (gap.includes("fluency")) {
    return `Raise oral reading from ${wcpm} WCPM toward grade-level fluency while keeping accuracy steady.`;
  }
  if (
    gap.includes("comprehension") ||
    gap.includes("main idea") ||
    gap.includes("inference")
  ) {
    return `Lift comprehension from ${comprehension}% by answering with clearer text evidence and key details.`;
  }
  if (gap.includes("vocabulary")) {
    return "Use context clues more reliably so unfamiliar words do not interrupt understanding.";
  }
  return `Improve reading accuracy from ${accuracy}% and strengthen the target skill before the next diagnostic cycle.`;
};

type PathwayStep = {
  id: "current" | "next" | "support";
  title: string;
  desc: string;
  status: "active" | "ready" | "waiting";
  progress: number;
  trigger: string;
  intervention: Intervention;
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
  const [activeLesson, setActiveLesson] =
    useState<PathwayStep["id"] | null>("current");
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
  const bridge = getMotherTongueBridge(
    analysis?.gap ?? null,
    normalizeLevel(analysis?.level),
  );

  const adaptiveRationale = useMemo(() => {
    if (!analysis) return null;
    const gap = analysis.gap.toLowerCase();

    if (gap.includes("omission")) {
      return "Your last diagnostic showed word skipping, so the pathway begins with tracking and word recognition support.";
    }
    if (gap.includes("substitution")) {
      return "Your last diagnostic showed decoding errors, so the pathway starts with multisyllabic word recognition.";
    }
    if (gap.includes("vowel") || gap.includes("phonics")) {
      return "Your last diagnostic showed word-pattern gaps, so the pathway starts with phonics and structural analysis.";
    }
    if (gap.includes("fluency") || gap.includes("oral reading")) {
      return "Your last diagnostic showed pace and phrasing issues, so the pathway starts with fluency practice.";
    }
    if (gap.includes("main idea") || gap.includes("comprehension")) {
      return "Your last diagnostic showed comprehension gaps, so the pathway starts with evidence-based reading tasks.";
    }
    if (gap.includes("inference")) {
      return "Your last diagnostic showed inference gaps, so the pathway starts with guided comprehension prompts.";
    }

    return "This pathway is based on your latest Grade 6 reading diagnostic.";
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
    setActiveLesson("current");
  }, [intervention?.mastery_check_questions]);

  const submitMasteryCheck = async () => {
    if (!analysis || !intervention) return;
    setError(null);
    setChecking(true);
    try {
      const res = masteryCheckHeuristic(
        intervention.mastery_check_questions,
        answers,
        analysis.gap,
        intervention.target_skill,
      );

      await new Promise((resolve) => setTimeout(resolve, 1200));
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
    ) {
      return;
    }

    setError(null);
    setIsAdjusting(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));

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
    if (!analysis || !intervention) return [] as PathwayStep[];

    const promoted = buildPromotedIntervention(analysis, intervention);
    const supported = regenerateInterventionMock({
      previous: intervention,
      nextAction: "repeat_simpler",
    });

    return [
      {
        id: "current",
        title: intervention.target_skill,
        desc: `Current focus: ${analysis.gap}`,
        status:
          result?.mastery_achieved || result?.next_action === "repeat_simpler"
            ? "waiting"
            : "active",
        progress: result?.mastery_achieved ? 100 : result ? 65 : 30,
        trigger: "Do this lesson now",
        intervention,
      },
      {
        id: "next",
        title: promoted.target_skill,
        desc: "Unlocks after you master the current lesson.",
        status: result?.mastery_achieved ? "ready" : "waiting",
        progress: result?.mastery_achieved ? 15 : 0,
        trigger: "Available if you pass this mastery check",
        intervention: promoted,
      },
      {
        id: "support",
        title: supported.target_skill,
        desc: "Provides an easier scaffold if you need another pass.",
        status: result?.next_action === "repeat_simpler" ? "ready" : "waiting",
        progress: result?.next_action === "repeat_simpler" ? 15 : 0,
        trigger: "Used if the system detects you need more support",
        intervention: supported,
      },
    ];
  }, [analysis, intervention, result]);

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
            3-step pathway based on your latest diagnostic
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
            className="rounded-2xl bg-card border border-border p-4 mb-5"
          >
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
              Why This Lesson
            </p>
            <h2 className="mt-1 text-base font-display font-bold text-foreground">
              {intervention.target_skill}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Your diagnostic showed {Math.round(analysis.wcpm)} WCPM,{" "}
              {Math.round(analysis.accuracy_rate)}% accuracy, and{" "}
              {Math.round(analysis.comprehension_score)}% comprehension. KINAIYA
              chose this lesson because your biggest current gap is{" "}
              {analysis.gap.toLowerCase()}.
            </p>
            <div className="mt-3 rounded-xl bg-muted/40 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Goal For This Step
              </p>
              <p className="mt-1 text-sm text-foreground leading-relaxed">
                {getLessonGoal(analysis)}
              </p>
            </div>
          </motion.div>

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
                  Pathway Reasoning
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <p className="text-[8px] text-muted-foreground font-bold uppercase">
                  Input
                </p>
                <p className="text-[10px] text-foreground font-medium leading-tight">
                  {analysis.gap.split(":")[0] || "Analysis"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] text-muted-foreground font-bold uppercase">
                  Process
                </p>
                <p className="text-[10px] text-foreground font-medium leading-tight">
                  Skill-specific adaptation
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[8px] text-muted-foreground font-bold uppercase">
                  Output
                </p>
                <p className="text-[10px] text-kinaiya-purple font-bold leading-tight uppercase">
                  {formatExerciseType(intervention.exercise_type)}
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

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl bg-card border border-border p-4 mb-6"
          >
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
              Mother-Tongue Support
            </p>
            <p className="text-sm font-bold text-foreground mt-1">
              {bridge.language} bridge for this lesson
            </p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              {bridge.language === "Bisaya" ? bridge.bisaya : bridge.tagalog}
            </p>
            <p className="text-[11px] text-kinaiya-purple font-bold mt-2">
              Teacher cue: {bridge.teacherNote}
            </p>
          </motion.div>

          <div className="space-y-4">
            {modules.map((mod, i) => {
              const isCurrent = mod.id === "current";
              return (
                <motion.div
                  key={mod.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <button
                    onClick={() =>
                      setActiveLesson(activeLesson === mod.id ? null : mod.id)
                    }
                    className={`w-full text-left rounded-2xl border p-4 transition-all ${
                      mod.status === "waiting"
                        ? "bg-muted/50 border-border"
                        : mod.status === "active"
                          ? "bg-card border-primary shadow-kinaiya"
                          : "bg-kinaiya-green-light border-kinaiya-green/20"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                          mod.id === "current"
                            ? "bg-kinaiya-blue-light text-kinaiya-blue"
                            : mod.id === "next"
                              ? "bg-kinaiya-green-light text-kinaiya-green"
                              : "bg-kinaiya-purple-light text-kinaiya-purple"
                        }`}
                      >
                        {mod.id === "current" ? (
                          <Play className="w-5 h-5" />
                        ) : mod.id === "next" ? (
                          <Star className="w-5 h-5" />
                        ) : (
                          <Brain className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-display font-bold text-foreground text-sm">
                            {mod.title}
                          </p>
                          {mod.status === "waiting" && (
                            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                          {mod.status === "active" && (
                            <span className="px-2 py-0.5 bg-primary text-primary-foreground text-[10px] rounded-full font-bold">
                              CURRENT
                            </span>
                          )}
                          {mod.status === "ready" && (
                            <span className="px-2 py-0.5 bg-kinaiya-green text-white text-[10px] rounded-full font-bold">
                              READY
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {mod.desc}
                        </p>
                        <p className="text-[11px] text-foreground/70 mt-1">
                          {mod.trigger}
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
                      {mod.status === "active" && (
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
                              Lesson Type
                            </p>
                            <p className="text-sm text-foreground mt-1 leading-relaxed">
                              {formatExerciseType(mod.intervention.exercise_type)}
                            </p>
                          </div>

                          <div className="rounded-xl bg-muted/40 p-3">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                              Instructions
                            </p>
                            <p className="text-sm text-foreground mt-1 leading-relaxed">
                              {mod.intervention.instructions}
                            </p>
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                              Practice
                            </p>
                            {mod.intervention.content.map((item, index) => (
                              <div
                                key={`${item}-${index}`}
                                className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
                              >
                                <div className="w-8 h-8 rounded-lg bg-kinaiya-green-light text-kinaiya-green flex items-center justify-center text-xs font-bold">
                                  {index + 1}
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

                            {isCurrent ? (
                              mod.intervention.mastery_check_questions.map(
                                (question, index) => (
                                  <div
                                    key={question}
                                    className="space-y-2 rounded-xl bg-muted/50 p-3"
                                  >
                                    <p className="text-sm font-bold text-foreground">
                                      {question}
                                    </p>
                                    <input
                                      value={answers[index] ?? ""}
                                      onChange={(e) => {
                                        const next = [...answers];
                                        next[index] = e.target.value;
                                        setAnswers(next);
                                      }}
                                      placeholder="Type your answer"
                                      className="w-full px-3 py-3 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                  </div>
                                ),
                              )
                            ) : (
                              <div className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground leading-relaxed">
                                This preview shows what the next branch will look
                                like. Finish the current lesson first to activate
                                this step.
                              </div>
                            )}

                            {isCurrent && error && (
                              <div className="rounded-xl bg-kinaiya-red-light border border-kinaiya-red/20 p-3">
                                <p className="text-sm text-kinaiya-red">
                                  {error}
                                </p>
                              </div>
                            )}

                            {isCurrent && result && (
                              <div
                                className={`rounded-xl border p-3 ${
                                  result.mastery_achieved
                                    ? "bg-kinaiya-green-light border-kinaiya-green/20"
                                    : "bg-kinaiya-blue-light border-kinaiya-blue/20"
                                }`}
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
                                  {result.question_results.map((item) => (
                                    <div
                                      key={item.question}
                                      className="text-xs text-muted-foreground"
                                    >
                                      <span className="font-medium text-foreground">
                                        {item.is_correct
                                          ? "Correct:"
                                          : "Try again:"}
                                      </span>{" "}
                                      {item.feedback}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {isCurrent && (
                              <>
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
                                      ) : result.next_action ===
                                        "repeat_simpler" ? (
                                        "Open Support Lesson"
                                      ) : (
                                        "Try a Different Practice"
                                      )}
                                    </button>
                                  )}
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default Lessons;
