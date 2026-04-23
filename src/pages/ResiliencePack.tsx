import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BookOpen, CheckCircle, Lock, Trophy, AlertCircle, Check, Mic, Download, Brain } from "lucide-react";
import type { ResiliencePackResponse } from "@/lib/kinaiyaApi";
import { getStudentFriendlyLevel } from "@/lib/kinaiyaApi";

const RESILIENCE_PACK_KEY = "kinaiya_resilience_pack_v1";
const MASTERY_KEY = "kinaiya_offline_mastery_v1";

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
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [activeDay, setActiveDay] = useState<number | null>(() => {
    if (!pack?.items) return null;
    try {
      const rawMastery = localStorage.getItem(MASTERY_KEY);
      const mastered = rawMastery ? JSON.parse(rawMastery) as number[] : [];
      const firstUnmastered = pack.items.find((i) => !mastered.includes(i.day));
      return firstUnmastered ? firstUnmastered.day : pack.items[0].day;
    } catch {
      return pack.items[0].day;
    }
  });

  const [stage, setStage] = useState<"reading" | "quiz" | "analyzing" | "final_results">("reading");
  const [currentQ, setCurrentQ] = useState(0); // For sequential quiz
  const [answers, setAnswers] = useState<Record<number, number[]>>({});
  const [showCelebration, setShowCelebration] = useState(false);
  const [masteryFeedback, setMasteryFeedback] = useState<"success" | "fail" | null>(null);
  const [readingMetrics, setReadingMetrics] = useState<{ wcpm: number; accuracy: number; comprehensionScore: number } | null>(null);
  const [timer, setTimer] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  const current = pack?.items?.find((i) => i.day === activeDay) ?? null;

  // Effects
  useEffect(() => {
    setStage("reading");
    setIsRecording(false);
    setTimer(0);
    setCurrentQ(0);
    setMasteryFeedback(null);
  }, [activeDay]);

  useEffect(() => {
    let interval: number;
    if (isRecording) {
      interval = window.setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => window.clearInterval(interval);
  }, [isRecording]);

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
                    <div className={`rounded-[32px] p-8 shadow-sm border-2 ${masteryFeedback === "success"
                        ? "bg-kinaiya-green-light border-kinaiya-green/20 text-kinaiya-green-dark"
                        : "bg-kinaiya-red-light border-kinaiya-red/20 text-kinaiya-red-dark"
                      }`}>
                      <div className="flex justify-between items-start mb-8">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Diagnostic Report</p>
                          <h2 className="text-3xl font-black">
                            {masteryFeedback === "success" ? "Mastery!" : "Retry Needed"}
                          </h2>
                        </div>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${masteryFeedback === "success" ? "bg-kinaiya-green text-white" : "bg-kinaiya-red text-white"
                          }`}>
                          {masteryFeedback === "success" ? <Trophy className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-current/10">
                          <span className="text-xs font-bold opacity-70">FLUENCY (WCPM)</span>
                          <span className="text-xl font-black">{readingMetrics.wcpm}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-current/10">
                          <span className="text-xs font-bold opacity-70">ACCURACY</span>
                          <span className="text-xl font-black">{readingMetrics.accuracy}%</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-xs font-bold opacity-70">COMPREHENSION</span>
                          <span className="text-xl font-black">{readingMetrics.comprehensionScore}%</span>
                        </div>
                      </div>

                      <div className="mt-8 pt-6 border-t border-current/10 text-xs font-medium leading-relaxed italic opacity-80">
                        {masteryFeedback === "success"
                          ? "Congratulations! You have completed the Day " + current.day + " bridge."
                          : "We recommend reviewing the Higaonon passage to improve accuracy."}
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-end pb-8">
                      {masteryFeedback === "success" ? (
                        <button
                          onClick={() => {
                            setShowCelebration(true);
                            setTimeout(() => {
                              setShowCelebration(false);
                              if (current.day < pack.days) {
                                setActiveDay(current.day + 1);
                              } else {
                                navigate("/student");
                              }
                            }, 1500);
                          }}
                          className="w-full py-5 rounded-2xl bg-kinaiya-blue text-white font-display font-black text-lg shadow-lg active:scale-[0.98] transition-all"
                        >
                          Unlock Next Day
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-10">
                <motion.div initial={{ scale: 0.5, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} className="bg-white rounded-3xl p-8 shadow-2xl text-center max-w-sm">
                  <div className="w-20 h-20 bg-kinaiya-green rounded-full flex items-center justify-center mx-auto mb-4 text-white shadow-lg">
                    <Trophy className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-black text-foreground mb-2">Mastery Achieved!</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6 font-medium">Your diagnostic results have been saved locally for offline sync.</p>
                  <button onClick={() => setShowCelebration(false)} className="w-full py-4 rounded-2xl bg-kinaiya-green text-white font-bold">Keep Going</button>
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

