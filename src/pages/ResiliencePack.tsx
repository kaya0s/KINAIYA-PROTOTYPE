import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BookOpen, CheckCircle, Lock, Trophy, AlertCircle, Check, Mic } from "lucide-react";
import type { ResiliencePackResponse } from "@/lib/kinaiyaApi";
import { getStudentFriendlyLevel } from "@/lib/kinaiyaApi";
import goodJobImg from "@/assets/good-job.png";

const RESILIENCE_PACK_KEY = "kinaiya_resilience_pack_v1";
const MASTERY_KEY = "kinaiya_offline_mastery_v1";

const getMetricTone = (value: number) => {
  if (value >= 95) return "Excellent";
  if (value >= 85) return "Strong";
  if (value >= 70) return "Developing";
  return "Needs support";
};

const normalizeMasteredDays = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((day) => Number(day))
    .filter((day) => Number.isFinite(day));
};

const getNextAvailableDay = (
  pack: ResiliencePackResponse | null,
  masteredDays: number[],
) => {
  if (!pack?.items?.length) return null;

  const firstUnmastered = pack.items.find((item) => !masteredDays.includes(item.day));
  if (firstUnmastered) return firstUnmastered.day;

  return pack.items[pack.items.length - 1].day;
};

const ResiliencePack = () => {
  const navigate = useNavigate();
  const pack = useMemo(() => {
    try {
      const raw = localStorage.getItem(RESILIENCE_PACK_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { pack?: ResiliencePackResponse };
      return parsed.pack ?? null;
    } catch {
      return null;
    }
  }, []);

  const [masteredDays, setMasteredDays] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(MASTERY_KEY);
      return raw ? normalizeMasteredDays(JSON.parse(raw)) : [];
    } catch {
      return [];
    }
  });

  const [activeDay, setActiveDay] = useState<number | null>(() =>
    getNextAvailableDay(pack, masteredDays),
  );

  const [stage, setStage] = useState<"reading" | "quiz" | "analyzing" | "final_results">("reading");
  const [currentQ, setCurrentQ] = useState(0); // For sequential quiz
  const [showCelebration, setShowCelebration] = useState(false);
  const [showPackComplete, setShowPackComplete] = useState(false);
  const [masteryFeedback, setMasteryFeedback] = useState<"success" | "fail" | null>(null);
  const [readingMetrics, setReadingMetrics] = useState<{ wcpm: number; accuracy: number; comprehensionScore: number } | null>(null);
  const [timer, setTimer] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const dayButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  const current = pack?.items?.find((i) => i.day === activeDay) ?? null;
  const isFinalDay = Boolean(current && pack && current.day >= pack.days);

  // Effects
  useEffect(() => {
    setStage("reading");
    setIsRecording(false);
    setTimer(0);
    setCurrentQ(0);
    setMasteryFeedback(null);
  }, [activeDay]);

  useEffect(() => {
    const nextAvailableDay = getNextAvailableDay(pack, masteredDays);
    if (nextAvailableDay == null) return;
    if (activeDay == null || masteredDays.includes(activeDay)) {
      setActiveDay(nextAvailableDay);
    }
  }, [activeDay, masteredDays, pack]);

  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = window.setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => window.clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    if (activeDay == null) return;
    const target = dayButtonRefs.current[activeDay];
    if (!target) return;

    window.requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    });
  }, [activeDay]);

  const handleFinishReading = () => {
    setIsRecording(false);
    setStage("quiz");
  };

  const handleNextQuestion = () => {
    if (!current) return;
    if (currentQ < current.questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      handleSubmitAssessment();
    }
  };

  const handleSubmitAssessment = () => {
    if (!current) return;
    setStage("analyzing");

    // Fast simulation for demo
    setTimeout(() => {
      const simulatedAccuracy = 98; // Always good result for simulation
      const simulatedWcpm = 115;
      const compScore = 100;

      setReadingMetrics({
        wcpm: simulatedWcpm,
        accuracy: simulatedAccuracy,
        comprehensionScore: compScore
      });

      setMasteryFeedback("success");
      if (!masteredDays.includes(current.day)) {
        const next = [...masteredDays, current.day];
        setMasteredDays(next);
        localStorage.setItem(MASTERY_KEY, JSON.stringify(next));
      }

      setStage("final_results");
    }, 1000); // 1s simulation lag
  };

  // Helpers
  const isMastered = (day: number) => masteredDays.includes(day);
  const isLocked = (day: number) => {
    if (day === 1) return false;
    return !masteredDays.includes(day - 1);
  };

  const handleSuccessContinue = () => {
    if (isFinalDay) {
      setShowPackComplete(true);
      return;
    }

    setShowCelebration(true);
    window.setTimeout(() => {
      setShowCelebration(false);
      if (current && pack && current.day < pack.days) {
        setActiveDay(current.day + 1);
        return;
      }
      navigate("/student");
    }, 1800);
  };

  return (
    <div className="mobile-container bg-background px-3 pb-8 min-h-screen flex flex-col">
      <div className="flex items-center gap-3 pt-6 pb-4">
        <button onClick={() => navigate("/student")} className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div>
          <h1 className="font-display font-bold text-foreground text-lg">Offline Pack</h1>
          <p className="text-xs text-muted-foreground">Practice even without internet</p>
        </div>
      </div>

      {!pack ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-card border border-border p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            No offline pack found. Download a resilience pack from the Student Home screen first.
          </p>
          <button onClick={() => navigate("/student")} className="mt-4 w-full py-4 rounded-2xl bg-gradient-kinaiya text-primary-foreground font-display font-bold text-lg shadow-kinaiya active:scale-[0.98] transition-transform">
            Back to Home
          </button>
        </motion.div>
      ) : (
        <>
          <div className="rounded-2xl bg-card border border-border p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-kinaiya-blue" />
                <p className="text-sm font-bold text-foreground">{pack.days}-day pack</p>
              </div>
              <p className="text-xs text-muted-foreground uppercase font-black">
                {getStudentFriendlyLevel(pack.level)}
              </p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
            {pack.items.map((i) => {
              const locked = isLocked(i.day);
              const mastered = isMastered(i.day);
              return (
                <button
                  key={i.day}
                  ref={(node) => {
                    dayButtonRefs.current[i.day] = node;
                  }}
                  disabled={locked}
                  onClick={() => setActiveDay(i.day)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${activeDay === i.day
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105"
                    : mastered
                      ? "bg-kinaiya-green/10 text-kinaiya-green border border-kinaiya-green/20"
                      : locked
                        ? "bg-muted text-muted-foreground/40 cursor-not-allowed"
                        : "bg-muted text-muted-foreground border border-border"
                    }`}
                >
                  {locked ? <Lock className="w-3 h-3" /> : mastered ? <CheckCircle className="w-3 h-3" /> : null}
                  Day {i.day}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {current && (
              <motion.div
                key={`${current.day}-${stage}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col gap-4"
              >
                {stage === "reading" && (
                  <>
                    <AnimatePresence>
                      {isRecording ? (
                        <motion.div
                          key="focus-mode"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-[60] bg-background flex flex-col pt-6 pb-2"
                        >
                          {/* STICKY TOP BAR */}
                          <div className="px-4 flex justify-between items-center pb-4 border-b border-border/50">
                            <div className="flex items-center gap-2.5 text-kinaiya-red">
                              <div className="w-2.5 h-2.5 rounded-full bg-current animate-pulse" />
                              <span className="text-base font-black tracking-widest font-mono">
                                {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                              </span>
                            </div>
                            <span className="text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground/60">
                              Diagnostic in Progress
                            </span>
                          </div>

                          {/* SCROLLABLE STORY AREA */}
                          <div className="flex-1 overflow-y-auto px-4 py-8 scrollbar-hide">
                            <div className="w-full">
                              <motion.p 
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.1 }}
                                className="text-[10px] font-black uppercase tracking-[0.3em] text-kinaiya-blue mb-4 opacity-60"
                              >
                                {current.title}
                              </motion.p>

                              {/* Word highlighting for simulation */}
                              <motion.p 
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="text-xl text-foreground leading-[1.8] font-medium whitespace-pre-wrap pb-20"
                              >
                                {current.passage.split(" ").map((word, idx) => {
                                  const simulatedProgress = Math.floor(timer * 2.5); // 2.5 words per second
                                  const isRead = idx < simulatedProgress;
                                  const isCurrent = idx === simulatedProgress;
                                  
                                  return (
                                    <span 
                                      key={idx} 
                                      className={`transition-all duration-300 rounded ${
                                        isCurrent 
                                          ? "bg-kinaiya-gold/30 ring-1 ring-kinaiya-gold/50 text-foreground px-0.5" 
                                          : isRead 
                                            ? "text-muted-foreground" 
                                            : "text-foreground"
                                      }`}
                                    >
                                      {word}{" "}
                                    </span>
                                  );
                                })}
                              </motion.p>
                            </div>
                          </div>

                          {/* ACTION AREA (Sticky Bottom) */}
                          <div className="px-6 py-6 border-t border-border/50 bg-gradient-to-t from-background to-background/80">
                            <button
                              onClick={handleFinishReading}
                              className="w-full py-4 rounded-2xl bg-kinaiya-red text-white font-display font-black text-lg shadow-xl shadow-kinaiya-red/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
                            >
                              <Check className="w-6 h-6" />
                              FINISH READING
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="prepare-mode"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex flex-col gap-4"
                        >
                          <div className="rounded-2xl bg-card border border-border p-4">
                            <div className="flex items-center justify-between mb-4">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Reading Passage</p>
                              <BookOpen className="w-4 h-4 text-kinaiya-blue/40" />
                            </div>
                            <p className="font-display font-medium text-foreground mb-3 leading-tight italic opacity-60">Prepare for assessment</p>
                            <div className="py-12 flex flex-col items-center justify-center text-center px-4">
                              <div className="w-16 h-16 rounded-2xl bg-kinaiya-blue-light flex items-center justify-center mb-4">
                                <BookOpen className="w-8 h-8 text-kinaiya-blue" />
                              </div>
                              <p className="text-sm text-foreground font-bold italic leading-relaxed">
                                "Take a deep breath. Focus on the words. Tap the microphone when you are ready to begin."
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-center justify-center py-6">
                            <button
                              onClick={() => setIsRecording(true)}
                              className="w-24 h-24 rounded-full bg-gradient-kinaiya flex items-center justify-center shadow-2xl shadow-primary/30 active:scale-95 transition-all"
                            >
                              <Mic className="w-10 h-10 text-white" />
                            </button>
                            <p className="mt-6 text-sm font-bold text-foreground uppercase tracking-widest text-xs">Start Diagnostic</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}

                {stage === "quiz" && (
                  <>
                    <div className="rounded-2xl bg-card border border-border p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Question {currentQ + 1} of {current.questions.length}</p>
                          <p className="text-xs font-bold text-foreground">Comprehension Check</p>
                        </div>
                        <span className="text-[10px] bg-muted px-2 py-1 rounded-full font-bold">Day {current.day}</span>
                      </div>
                      
                      {/* Sequential Progress Bar */}
                      <div className="flex gap-1 mb-6">
                        {current.questions.map((_, i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full ${i <= currentQ ? "bg-primary" : "bg-muted"}`} />
                        ))}
                      </div>

                      <AnimatePresence mode="wait">
                        <motion.div 
                          key={currentQ}
                          initial={{ opacity: 0, x: 10 }} 
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          className="space-y-6"
                        >
                          <div className="space-y-4">
                            <p className="text-base font-bold text-foreground leading-tight">{current.questions[currentQ].q}</p>
                            <div className="grid grid-cols-1 gap-2">
                              {current.questions[currentQ].choices.map((c, choiceIdx) => {
                                const isCorrect = choiceIdx === current.questions[currentQ].answer;
                                return (
                                  <button
                                    key={choiceIdx}
                                    onClick={handleNextQuestion}
                                    className={`px-4 py-4 rounded-xl border text-left text-sm transition-all flex items-center justify-between ${isCorrect ? "border-primary bg-primary/5 font-bold" : "border-border bg-card"}`}
                                  >
                                    <span>{c}</span>
                                    {isCorrect && <div className="w-3 h-3 rounded-full bg-primary" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </>
                )}

                {stage === "analyzing" && (
                  <div className="flex-1 flex flex-col items-center justify-center py-10">
                    <div className="relative w-32 h-32 mb-8">
                      <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                          <Mic className="w-10 h-10 text-primary" />
                        </motion.div>
                      </div>
                    </div>
                    <h2 className="text-xl font-display font-black text-foreground">AI Evaluating Mastery...</h2>
                    <p className="text-sm text-muted-foreground mt-2 text-center px-6">Synthesizing literacy patterns and comprehension logic</p>
                  </div>
                )}
                {/* 4. FINAL RESULTS STAGE */}
                {stage === "final_results" && readingMetrics && (
                  <>
                    <div className="rounded-2xl bg-card border border-border p-5 space-y-4">
                      <div
                        className={`rounded-2xl border p-4 ${
                          masteryFeedback === "success"
                            ? "bg-kinaiya-green-light border-kinaiya-green/20"
                            : "bg-kinaiya-red-light border-kinaiya-red/20"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/70">
                              Resilience Report
                            </p>
                            <h2 className="mt-1 text-2xl font-display font-black text-foreground">
                              {masteryFeedback === "success" ? "Mastery Achieved" : "Retry Needed"}
                            </h2>
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                              {masteryFeedback === "success"
                                ? `You completed Day ${current.day}. Your offline progress has been saved.`
                                : "Review the passage and try the assessment again."}
                            </p>
                          </div>
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                              masteryFeedback === "success"
                                ? "bg-kinaiya-green text-white"
                                : "bg-kinaiya-red text-white"
                            }`}
                          >
                            {masteryFeedback === "success" ? (
                              <Trophy className="w-5 h-5" />
                            ) : (
                              <AlertCircle className="w-5 h-5" />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-2xl bg-muted/50 border border-border p-4 text-center">
                          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                            Fluency
                          </p>
                          <p className="mt-2 text-2xl font-black text-foreground">{readingMetrics.wcpm}</p>
                          <p className="text-[11px] text-muted-foreground">WCPM</p>
                        </div>
                        <div className="rounded-2xl bg-muted/50 border border-border p-4 text-center">
                          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                            Accuracy
                          </p>
                          <p className="mt-2 text-2xl font-black text-foreground">{readingMetrics.accuracy}%</p>
                          <p className="text-[11px] text-muted-foreground">
                            {getMetricTone(readingMetrics.accuracy)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-muted/50 border border-border p-4 text-center">
                          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                            Comprehension
                          </p>
                          <p className="mt-2 text-2xl font-black text-foreground">
                            {readingMetrics.comprehensionScore}%
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {getMetricTone(readingMetrics.comprehensionScore)}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-muted/50 border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                            Summary
                          </p>
                          <span className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                            Day {current.day}
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {masteryFeedback === "success"
                            ? "Strong reading and correct answers helped you clear this bridge. Continue with the next day."
                            : "Take another pass through the reading and aim for steadier accuracy before moving on."}
                        </p>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-bold text-foreground">{masteredDays.length}/{pack.days} mastered</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-end pb-8">
                      {masteryFeedback === "success" ? (
                        <button
                          onClick={handleSuccessContinue}
                          className="w-full py-5 rounded-2xl bg-gradient-kinaiya text-primary-foreground font-display font-black text-lg shadow-kinaiya active:scale-[0.98] transition-transform"
                        >
                          {isFinalDay ? "Finish Pack" : "Unlock Next Day"}
                        </button>
                      ) : (
                        <button
                          onClick={() => setStage("reading")}
                          className="w-full py-5 rounded-2xl bg-white border-2 border-kinaiya-red text-kinaiya-red font-display font-black text-lg active:scale-[0.98] transition-all shadow-sm"
                        >
                          Try Assessment Again
                        </button>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showCelebration && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
              >
                <motion.div
                  initial={{ opacity: 0, y: 28, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.96 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="w-full max-w-sm overflow-hidden rounded-3xl bg-card border border-border shadow-2xl"
                >
                  <div className="p-5 pb-2">
                    <motion.img
                      src={goodJobImg}
                      alt="Good job"
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.45, delay: 0.1 }}
                      className="mx-auto h-auto w-full max-w-[240px] object-contain"
                    />
                  </div>
                  <div className="px-6 pb-7 pt-2 text-center">
                    <h2 className="text-2xl font-black text-foreground">Good job!</h2>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
                      Day {current?.day} was completed successfully. Preparing your next step now.
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showPackComplete && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6"
              >
                <motion.div
                  initial={{ opacity: 0, y: 28, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 16, scale: 0.96 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="w-full max-w-sm overflow-hidden rounded-3xl bg-card border border-border shadow-2xl"
                >
                  <div className="p-5 pb-2">
                    <motion.img
                      src={goodJobImg}
                      alt="Good job"
                      initial={{ opacity: 0, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.45, delay: 0.1 }}
                      className="mx-auto h-auto w-full max-w-[240px] object-contain"
                    />
                  </div>
                  <div className="px-6 pb-7 pt-2 text-center">
                    <h2 className="text-2xl font-black text-foreground">Pack completed!</h2>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
                      You finished all {pack?.days} days of your resilience pack. Your progress is saved and ready to sync.
                    </p>
                    <button
                      onClick={() => navigate("/student")}
                      className="mt-6 w-full py-4 rounded-2xl bg-gradient-kinaiya text-primary-foreground font-display font-black text-base shadow-kinaiya active:scale-[0.98] transition-transform"
                    >
                      Back to Home
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default ResiliencePack;
