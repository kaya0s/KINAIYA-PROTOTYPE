import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  BookOpen,
  Award,
  Target,
  Brain,
  BarChart3,
  ExternalLink,
  X,
  Activity,
} from "lucide-react";
import { insertAssessment } from "@/lib/kinaiyaDb";
import type { AnalyzeResponse } from "@/lib/kinaiyaApi";
import { getStudentFriendlyLevel } from "@/lib/kinaiyaApi";
import { enqueueAssessment } from "@/lib/offlineQueue";

const STUDENT_SESSION_KEY = "kinaiya_student_session_v1";
const LAST_ANALYSIS_KEY = "kinaiya_last_analysis_v1";

const Results = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as {
    analysis?: AnalyzeResponse;
    diagnostic?: {
      wordCount: number;
      secondsTaken: number;
      comprehensionScore: number;
      passageId?: string;
    };
    comprehensionScore?: number;
    wpm?: number;
    accuracy?: number;
  } | null;

  const analysis = state?.analysis ?? null;
  const [standardModalVisible, setStandardModalVisible] = useState(false);
  const [selectedStandard, setSelectedStandard] = useState<{
    code: string;
    desc: string;
  } | null>(null);

  const getStandardDetail = (code: string) => {
    const details: Record<string, string> = {
      "MATATAG L1.PHO.04":
        "Phonological Awareness: Ability to track and produce individual sounds. Crucial for early decoding mastery.",
      "MATATAG L1.PHO.05":
        "Phonological Awareness: Focuses on complex sound blending, specifically consonant clusters.",
      "MATATAG L1.DEC.02":
        "Decoding Skills: Ability to blend phonemes into recognizable words at a Grade 1 level.",
      "MATATAG L2.DEC.01":
        "Complex Decoding: Recognition of high-frequency and multi-syllabic words for Grade 2.",
      "MATATAG L1.FLU.01":
        "Fluency: Reading with emerging speed and accuracy. Target: 40-60 WCPM.",
      "MATATAG L1.PRO.03":
        "Prosody: Using expression and punctuation cues to guide oral reading voice.",
    };
    return (
      details[code] ||
      "Official MATATAG Curriculum Standard for foundational literacy development."
    );
  };

  const wpm = analysis ? Math.round(analysis.wcpm) : (state?.wpm ?? 68);
  const accuracy = analysis
    ? Math.round(analysis.accuracy_rate)
    : (state?.accuracy ?? 82);
  const comprehension = analysis
    ? Math.round(analysis.comprehension_score)
    : (state?.comprehensionScore ?? 70);

  const rawLevel = analysis?.level;
  const readingLevel = rawLevel
    ? (rawLevel as string) === "Frustration"
      ? "Frustrational"
      : rawLevel
    : accuracy >= 95
      ? "Independent"
      : accuracy >= 90
        ? "Instructional"
        : "Frustrational";

  const levelConfig = {
    Frustrational: {
      label: "Exploring",
      badge: "🧭",
      gradient: "from-[#F83A3A] to-[#C1272D]",
      shadow: "shadow-[0_20px_50px_rgba(193,39,45,0.3)]",
      glow: "bg-red-400/20",
    },
    Instructional: {
      label: "Growing",
      badge: "🌱",
      gradient: "from-[#FBB03B] to-[#D9822B]",
      shadow: "shadow-[0_20px_50px_rgba(217,130,43,0.3)]",
      glow: "bg-orange-400/20",
    },
    Independent: {
      label: "Fluent",
      badge: "🏆",
      gradient: "from-[#22C55E] to-[#15803D]",
      shadow: "shadow-[0_20px_50px_rgba(21,128,61,0.3)]",
      glow: "bg-green-400/20",
    },
  };

  useEffect(() => {
    const run = async () => {
      try {
        const raw = localStorage.getItem(STUDENT_SESSION_KEY);
        if (analysis) {
          localStorage.setItem(
            LAST_ANALYSIS_KEY,
            JSON.stringify({ analysis, createdAt: new Date().toISOString() }),
          );
        }

        if (!raw) return;
        const session = JSON.parse(raw) as {
          classCode?: string;
          studentId?: string;
        };
        if (!session.classCode || !session.studentId) return;

        await insertAssessment({
          code: session.classCode,
          studentId: session.studentId,
          wcpm: wpm,
          accuracyRate: accuracy,
          comprehensionScore: comprehension,
          level: readingLevel,
          gap: analysis?.gap ?? gaps[0]?.issue ?? "General reading support",
          raw: analysis ?? { source: "client", wpm, accuracy, comprehension },
        });
      } catch {
        try {
          const raw = localStorage.getItem(STUDENT_SESSION_KEY);
          if (!raw) return;
          const session = JSON.parse(raw) as {
            classCode?: string;
            studentId?: string;
          };
          if (!session.classCode || !session.studentId) return;

          enqueueAssessment({
            code: session.classCode,
            studentId: session.studentId,
            wcpm: wpm,
            accuracyRate: accuracy,
            comprehensionScore: comprehension,
            level: readingLevel,
            gap: analysis?.gap ?? gaps[0]?.issue ?? "General reading support",
            raw: analysis ?? { source: "client", wpm, accuracy, comprehension },
          });
        } catch {
          // ignore for workshop MVP
        }
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metrics = [
    {
      label: "Words per Minute",
      value: `${wpm}`,
      target: "90",
      pct: Math.min(100, Math.round((wpm / 90) * 100)),
      icon: TrendingUp,
      color: "text-kinaiya-blue",
    },
    {
      label: "Accuracy",
      value: `${accuracy}%`,
      target: "95%",
      pct: Math.round((accuracy / 95) * 100),
      icon: Target,
      color: "text-kinaiya-green",
    },
    {
      label: "Comprehension",
      value: `${comprehension}%`,
      target: "85%",
      pct: Math.round((comprehension / 85) * 100),
      icon: Brain,
      color: "text-kinaiya-purple",
    },
  ];

  const gaps =
    wpm < 80
      ? analysis?.areas_for_improvement?.length
        ? analysis.areas_for_improvement.map((a) => ({
            issue: a.issue,
            severity: a.severity,
          }))
        : [
            { issue: "Reading speed practice", severity: "high" as const },
            {
              issue: "Practicing long vowel sounds",
              severity: accuracy < 85 ? ("high" as const) : ("medium" as const),
            },
            {
              issue: "Blending word sounds together",
              severity: "medium" as const,
            },
            {
              issue: "Smoothing out sentence flow",
              severity:
                comprehension < 70 ? ("high" as const) : ("low" as const),
            },
          ]
      : analysis?.areas_for_improvement?.length
        ? analysis.areas_for_improvement.map((a) => ({
            issue: a.issue,
            severity: a.severity,
          }))
        : [
            {
              issue: "Sentence intonation patterns",
              severity: "medium" as const,
            },
            { issue: "Complex word decoding", severity: "low" as const },
          ];

  const strengths = (
    analysis?.strengths?.length
      ? analysis.strengths
      : [
          comprehension >= 70 && "Good passage comprehension",
          accuracy >= 80 && "Consistent word recognition",
          wpm >= 60 && "Adequate reading pace",
        ].filter(Boolean)
  ) as string[];

  const severityStyle = {
    high: {
      bg: "bg-kinaiya-red-light",
      border: "border-kinaiya-red/20",
      text: "text-kinaiya-red",
    },
    medium: {
      bg: "bg-kinaiya-blue-light",
      border: "border-kinaiya-blue/20",
      text: "text-kinaiya-blue",
    },
    low: {
      bg: "bg-kinaiya-green-light",
      border: "border-kinaiya-green/20",
      text: "text-kinaiya-green",
    },
  };

  return (
    <div className="mobile-container bg-background px-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between pt-6 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/student")}
            className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="font-display font-bold text-foreground text-lg">
              Diagnostic Results
            </h1>
          </div>
        </div>
      </div>

      {/* Level Card */}
      {/* Compact Unified Level Dashboard */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`rounded-[2rem] p-6 text-primary-foreground mb-6 relative overflow-hidden text-center bg-gradient-to-br ${levelConfig[readingLevel].gradient} ${levelConfig[readingLevel].shadow}`}
      >
        {/* Abstract High-Tech Background Elements */}
        <div
          className={`absolute top-0 right-0 w-48 h-48 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/3 opacity-30 ${levelConfig[readingLevel].glow}`}
        />
        <div
          className={`absolute bottom-0 left-0 w-48 h-48 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/3 opacity-30 ${levelConfig[readingLevel].glow}`}
        />

        <div className="relative z-10">
          <motion.div
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-5xl mb-2 drop-shadow-2xl"
          >
            {levelConfig[readingLevel].badge}
          </motion.div>

          <p className="text-[9px] uppercase tracking-[0.3em] font-black text-white/60 mb-1">
            Current Status
          </p>

          <h2 className="text-3xl font-display font-black tracking-tight mb-4 text-white drop-shadow-sm">
            {readingLevel}
          </h2>

          <div className="flex justify-center items-center gap-1.5">
            {(["Frustrational", "Instructional", "Independent"] as const).map(
              (level, idx) => (
                <div key={level} className="flex items-center">
                  <div
                    className={`h-1.2 w-1.2 rounded-full transition-all duration-700 ${
                      level === readingLevel
                        ? "bg-white w-8 h-1 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                        : "bg-white/20 w-1.5 h-1.5 rounded-full"
                    }`}
                  />
                </div>
              ),
            )}
          </div>
        </div>
      </motion.div>

      {/* Modern Metrics Progress */}
      <div className="space-y-4 mb-8">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.08 }}
            className="group"
          >
            <div className="flex justify-between items-end mb-1.5 px-1">
              <div className="flex items-center gap-2">
                <m.icon className={`w-3.5 h-3.5 ${m.color}`} />
                <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </span>
              </div>
              <span className="font-display font-black text-foreground text-sm">
                {m.value}
                <span className="text-[10px] text-muted-foreground font-normal ml-1 italic">
                  target: {m.target}
                </span>
              </span>
            </div>
            <div className="bg-muted/50 rounded-full h-1.5 overflow-hidden border border-border/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(m.pct, 100)}%` }}
                transition={{
                  duration: 1,
                  ease: "easeOut",
                  delay: 0.3 + i * 0.1,
                }}
                className={`h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(0,0,0,0.1)] ${
                  m.pct >= 85
                    ? "bg-primary"
                    : m.pct >= 60
                      ? "bg-kinaiya-gold"
                      : "bg-destructive"
                }`}
                style={{
                  boxShadow:
                    m.pct >= 85 ? "0 0 12px rgba(var(--primary), 0.3)" : "none",
                }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Student-Friendly Reading Habits Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-6"
      >
        <h2 className="font-display font-bold text-foreground mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-kinaiya-blue" />
          Your Reading Habits
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              label: "Skips",
              type: "omission",
              color: "bg-destructive/10 text-destructive border-destructive/20",
            },
            {
              label: "Swaps",
              type: "substitution",
              color:
                "bg-kinaiya-gold/10 text-kinaiya-gold-dark border-kinaiya-gold/20",
            },
            {
              label: "Sounds",
              type: "mispronunciation",
              color:
                "bg-kinaiya-blue/10 text-kinaiya-blue border-kinaiya-blue/20",
            },
          ].map((cat) => {
            const count = (analysis?.miscues || []).filter(
              (m) => m.type === cat.type,
            ).length;
            return (
              <div
                key={cat.label}
                className={`p-3 rounded-2xl border ${cat.color} flex flex-col items-center gap-1`}
              >
                <span className="text-xl font-black">{count}</span>
                <span className="text-[9px] font-black uppercase tracking-wider opacity-80">
                  {cat.label}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-3 italic leading-relaxed">
          * KINAIYA listens to how you read to help you grow faster!
        </p>
      </motion.div>

      {/* Strengths */}
      {strengths.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mb-6"
        >
          <h2 className="font-display font-bold text-foreground mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-kinaiya-gold" />
            Strengths
          </h2>
          <div className="space-y-2">
            {strengths.map((s) => (
              <div
                key={s}
                className="flex items-center gap-3 p-3 rounded-xl bg-kinaiya-green-light border border-kinaiya-green/20"
              >
                <CheckCircle className="w-4 h-4 text-kinaiya-green" />
                <span className="text-sm text-foreground">{s}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Gap Identification */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mb-6"
      >
        <h2 className="font-display font-bold text-foreground mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-kinaiya-orange" />
          Areas for Improvement
        </h2>
        <div className="space-y-2">
          {gaps.map((g) => {
            const style = severityStyle[g.severity];
            return (
              <div
                key={g.issue}
                className={`flex flex-col gap-1 p-3 rounded-xl border ${style.bg} ${style.border}`}
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className={`w-4 h-4 ${style.text}`} />
                  <span className="text-sm text-foreground flex-1 font-bold">
                    {g.issue}
                  </span>
                </div>
                <div className="flex items-center gap-2 pl-7">
                  <span
                    className={`text-[9px] font-black uppercase tracking-widest ${style.text} opacity-60`}
                  >
                    Focus: {g.severity}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Recommendation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="rounded-2xl bg-kinaiya-purple-light border border-kinaiya-purple/20 p-4 mb-6"
      >
        <h3 className="font-display font-bold text-foreground text-sm flex items-center gap-2">
          <Brain className="w-4 h-4 text-kinaiya-purple" />
          AI Recommendation
        </h3>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          {analysis?.pattern_summary
            ? analysis.pattern_summary
            : readingLevel === "Frustrational"
              ? "Focus on phonics and basic word recognition exercises. Practice short English passages with guided support."
              : readingLevel === "Instructional"
                ? "Continue with graded reading passages. Improve reading speed while maintaining accuracy. Practice comprehension strategies."
                : "Keep challenging yourself with longer texts and new vocabulary across different genres."}
        </p>
      </motion.div>

      {/* CTAs */}
      <div className="space-y-3">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          onClick={() => navigate("/lessons")}
          className="w-full py-4 rounded-2xl bg-gradient-kinaiya text-primary-foreground font-display font-bold text-lg shadow-kinaiya flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <BookOpen className="w-5 h-5" />
          Start Personalized Lessons
        </motion.button>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          onClick={() => navigate("/diagnostic")}
          className="w-full py-3 rounded-2xl bg-card border border-border text-foreground font-display font-bold text-sm active:scale-[0.98] transition-transform"
        >
          Retake Diagnostic
        </motion.button>
      </div>

      {/* Curriculum Standard Modal */}
      <AnimatePresence>
        {standardModalVisible && selectedStandard && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl bg-card border border-border p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-kinaiya-blue-light text-kinaiya-blue flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <button
                  onClick={() => setStandardModalVisible(false)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <h3 className="text-xs font-black text-kinaiya-blue uppercase tracking-widest">
                Official DepEd Standard
              </h3>
              <h2 className="text-xl font-display font-black text-foreground mt-1 mb-3">
                {selectedStandard.code}
              </h2>

              <div className="p-4 rounded-2xl bg-muted/40 border border-border mb-4">
                <p className="text-sm text-foreground leading-relaxed">
                  {selectedStandard.desc}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-kinaiya-green" />
                  <p className="text-xs text-muted-foreground">
                    Competency mapped by KINAIYA SLM
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-kinaiya-blue" />
                  <p className="text-xs text-muted-foreground">
                    Aligned with DepEd Memo #42-2023
                  </p>
                </div>
              </div>

              <button
                onClick={() => setStandardModalVisible(false)}
                className="mt-6 w-full py-4 rounded-2xl bg-foreground text-background font-display font-bold active:scale-95 transition-transform"
              >
                Close Standards View
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Results;
