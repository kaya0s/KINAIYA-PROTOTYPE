import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Mic,
  Trophy,
  TrendingUp,
  Cloud,
  Gamepad2,
  Download,
  CloudLightning,
  CheckCircle2,
  LogOut,
} from "lucide-react";
import WeatherWidget from "@/components/WeatherWidget";
import heroImg from "@/assets/hero-illustration.png";
import type { AnalyzeResponse, ResiliencePackResponse } from "@/lib/kinaiyaApi";
import { getStudentFriendlyLevel } from "@/lib/kinaiyaApi";
import {
  getMotherTongueBridge,
  normalizeLevel,
  TARGETS,
} from "@/lib/demoModel";
import {
  getStudentProfileByCode,
  listAssignedMaterialsByCode,
} from "@/lib/kinaiyaDb";
import { createResiliencePackMock } from "@/lib/resiliencePackMock";

const STUDENT_SESSION_KEY = "kinaiya_student_session_v1";
const LAST_ANALYSIS_KEY = "kinaiya_last_analysis_v1";
const RESILIENCE_PACK_KEY = "kinaiya_resilience_pack_v2";

const StudentHome = () => {
  const navigate = useNavigate();
  const [downloadingPack, setDownloadingPack] = useState(false);
  const [stormAlertActive, setStormAlertActive] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);
  const [assignedMaterials, setAssignedMaterials] = useState<
    Array<{ title: string; body: string | null }>
  >([]);
  const [online, setOnline] = useState<boolean>(() => navigator.onLine);
  const [profileLevel, setProfileLevel] = useState<string | null>(null);
  const [session, setSession] = useState<{
    name?: string;
    classCode?: string;
    studentId?: string;
  } | null>(() => {
    try {
      const raw = localStorage.getItem(STUDENT_SESSION_KEY);
      return raw
        ? (JSON.parse(raw) as {
            name?: string;
            classCode?: string;
            studentId?: string;
          })
        : null;
    } catch {
      return null;
    }
  });

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

  const [resiliencePack, setResiliencePack] = useState<{
    pack: ResiliencePackResponse;
    createdAt: string | null;
  } | null>(() => {
    try {
      const raw = localStorage.getItem(RESILIENCE_PACK_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        pack?: ResiliencePackResponse;
        createdAt?: string;
      };
      return parsed.pack
        ? { pack: parsed.pack, createdAt: parsed.createdAt ?? null }
        : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (!session) navigate("/student/join");
  }, [navigate, session]);

  useEffect(() => {
    if (!session?.classCode || !session?.studentId) return;

    listAssignedMaterialsByCode(session.classCode, session.studentId)
      .then((rows) =>
        setAssignedMaterials(rows.map((r) => ({ title: r.title }))),
      )
      .catch(() => setAssignedMaterials([]));

    getStudentProfileByCode(session.classCode, session.studentId)
      .then((p) => setProfileLevel(p?.currentLevel ?? null))
      .catch(() => setProfileLevel(null));
  }, [session?.classCode, session?.studentId]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const bridge = getMotherTongueBridge(
    analysis?.gap ?? null,
    normalizeLevel(profileLevel ?? analysis?.level),
  );

  // Proactive Resilience Logic: Two-step sync
  useEffect(() => {
    let t: number | undefined;

    if (stormAlertActive) {
      if (!downloadingPack && !showSyncSuccess) {
        setPackError(null);
        setDownloadingPack(true);
        t = window.setTimeout(() => {
          try {
            const pack = createResiliencePackMock({
              days: 14,
              level: normalizeLevel(
                profileLevel || analysis?.level || "Instructional",
              ),
              gap: analysis?.gap || "General reading support",
            });
            localStorage.setItem(
              RESILIENCE_PACK_KEY,
              JSON.stringify({ pack, createdAt: new Date().toISOString() }),
            );
            setResiliencePack({ pack, createdAt: new Date().toISOString() });
            setDownloadingPack(false);
            setShowSyncSuccess(true);

            // Auto-vanish success popup after 4 seconds
            window.setTimeout(() => {
              setShowSyncSuccess(false);
            }, 4000);
          } catch (e) {
            setPackError(
              e instanceof Error
                ? e.message
                : "Could not prepare the offline resilience pack.",
            );
            setDownloadingPack(false);
          }
        }, 1500);
      }
    } else {
      setDownloadingPack(false);
      setShowSyncSuccess(false);
    }

    return () => {
      if (t) window.clearTimeout(t);
    };
  }, [analysis, profileLevel, stormAlertActive]);

  const features = [
    {
      icon: Mic,
      label: "Reading Test",
      desc: "Take a diagnostic",
      color: "bg-kinaiya-green-light text-kinaiya-green",
      action: () => navigate("/diagnostic"),
    },
    {
      icon: BookOpen,
      label: "My Lessons",
      desc: "Continue learning",
      color: "bg-kinaiya-blue-light text-kinaiya-blue",
      action: () => navigate("/lessons"),
    },
    {
      icon: Gamepad2,
      label: "Word Games",
      desc: "Learn with fun",
      color: "bg-kinaiya-purple-light text-kinaiya-purple",
      action: () => navigate("/games"),
    },
    {
      icon: Trophy,
      label: "My Progress",
      desc: "See your growth",
      color: "bg-kinaiya-red-light text-kinaiya-orange",
      action: () => navigate("/results"),
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem(STUDENT_SESSION_KEY);
    navigate("/student/join");
  };

  return (
    <div className="mobile-container bg-background px-5 pb-8">
      {/* Header */}
      <div className="pt-8 pb-6 flex items-center justify-between">
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-muted-foreground text-sm"
          >
            Good morning!
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-extrabold text-foreground mt-1"
          >
            Hello{session?.name ? `, ${session.name}` : ", Learner"}!
          </motion.h1>
        </div>
        <button
          onClick={handleLogout}
          className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:bg-kinaiya-red-light hover:text-kinaiya-red active:scale-95 transition-all border border-border shadow-sm"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Weather Widget */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-5 relative"
      >
        <WeatherWidget isAlert={stormAlertActive} city="Malaybalay, Bukidnon" />

        {/* Simulator Toggle (Float on top, for demo purposes) */}
        <button
          onClick={() => setStormAlertActive(!stormAlertActive)}
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center hover:bg-foreground/20 transition-colors group"
          title="Simulate climate Alert"
        >
          <CloudLightning
            className={`w-3 h-3 ${stormAlertActive ? "text-kinaiya-red" : "text-muted-foreground"}`}
          />
        </button>
      </motion.div>
      <AnimatePresence>
        {downloadingPack && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[60] p-4"
          >
            <div className="mx-auto max-w-[320px] rounded-[20px] bg-kinaiya-red p-4 shadow-[0_20px_50px_rgba(239,68,68,0.3)] text-white border border-white/20 overflow-hidden relative">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <CloudLightning className="w-5 h-5 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">
                      PAGASA
                    </span>
                    <div className="w-1 h-1 rounded-full bg-white/30" />
                    <span className="text-[10px] font-black text-white uppercase tracking-wider">
                      Signal #2
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-white truncate">
                    Syncing Offline Lessons...
                  </h2>
                </div>
              </div>

              {/* Ultra-thin bottom progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10">
                <motion.div
                  key={stormAlertActive ? "active" : "inactive"}
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.5, ease: "linear" }}
                  className="h-full bg-white shadow-[0_-2px_10px_rgba(255,255,255,0.8)]"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showSyncSuccess && !downloadingPack && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 p-4"
          >
            <div className="mx-auto max-w-[320px] rounded-[20px] bg-kinaiya-blue p-4 shadow-2xl text-white border border-white/20">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-white/70">
                    Secure
                  </h3>
                  <p className="text-sm font-bold text-white leading-tight">
                    14-day offline pack ready
                  </p>
                </div>
                <button
                  onClick={() => navigate("/offline-pack")}
                  className="px-4 py-2.5 rounded-xl bg-white text-kinaiya-blue text-[11px] font-black shadow-lg active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  OPEN
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-3xl bg-gradient-kinaiya p-5 text-primary-foreground mb-6 shadow-kinaiya"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">Current Reading Level</p>
            <p className="text-2xl font-extrabold mt-1">
              {getStudentFriendlyLevel(
                profileLevel ?? analysis?.level ?? "Instructional",
              )}
            </p>
            <div className="flex items-center gap-1 mt-2 text-sm opacity-90">
              <TrendingUp className="w-4 h-4" />
              <span>
                {analysis
                  ? `${Math.round(analysis.wcpm)} WCPM · ${Math.round(analysis.accuracy_rate)}% accuracy`
                  : "Take a diagnostic to see your progress"}
              </span>
            </div>
            {analysis && (
              <p className="text-[11px] mt-2 opacity-80">
                Targets: {TARGETS.wcpm} WCPM, {TARGETS.accuracy}% accuracy,{" "}
                {TARGETS.comprehension}% comprehension
              </p>
            )}
          </div>
          <div className="w-16 h-16 rounded-2xl bg-primary-foreground/20 flex items-center justify-center">
            <BookOpen className="w-8 h-8" />
          </div>
        </div>
        <div className="mt-4 bg-primary-foreground/20 rounded-full h-2">
          <div className="bg-primary-foreground h-2 rounded-full w-3/5 transition-all" />
        </div>
        <p className="text-xs mt-2 opacity-70">
          {analysis?.gap
            ? `Focus skill: ${analysis.gap}`
            : "Complete a diagnostic to personalize your path"}
        </p>
      </motion.div>

      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="rounded-2xl bg-kinaiya-purple-light border border-kinaiya-purple/20 p-4 mb-5"
        >
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">
            Mother-Tongue Bridge
          </p>
          <p className="text-sm font-bold text-foreground mt-1">
            {bridge.language} support for your current gap
          </p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {bridge.language === "Bisaya" ? bridge.bisaya : bridge.tagalog}
          </p>
          <p className="text-[11px] text-kinaiya-purple font-bold mt-2">
            Coach cue: {bridge.cue}
          </p>
        </motion.div>
      )}

      {!online && (
        <div className="rounded-2xl bg-muted border border-border p-3 mb-5">
          <p className="text-xs text-muted-foreground">
            You are offline. You can still use the Offline Pack and keep
            practicing. We will sync saved progress when you are back online.
          </p>
        </div>
      )}

      {/* Offline indicator (Visible after sync) */}
      {resiliencePack?.pack && !downloadingPack && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-2 mb-8 px-3 py-2 rounded-xl bg-kinaiya-blue-light border border-kinaiya-blue/10 overflow-hidden"
        >
          <Cloud className="w-4 h-4 text-kinaiya-blue" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold text-kinaiya-blue block truncate">
              {resiliencePack?.pack
                ? "Offline Ready - Resilience Pack cached"
                : "Offline Pack not downloaded yet"}
            </span>
          </div>
          {!!resiliencePack?.pack && (
            <button
              onClick={() => navigate("/offline-pack")}
              className="px-4 py-2 rounded-xl bg-kinaiya-blue text-white text-xs font-bold active:scale-[0.98] transition-transform shadow-sm"
            >
              Open Offline Lessons
            </button>
          )}
        </motion.div>
      )}

      {packError && (
        <div className="rounded-xl bg-kinaiya-red-light border border-kinaiya-red/20 p-3 mb-5">
          <p className="text-sm text-kinaiya-red">{packError}</p>
        </div>
      )}

      {assignedMaterials.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-card border border-border p-5 mb-5"
        >
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Assigned Readings
          </p>
          <div className="space-y-2 mt-3">
            {assignedMaterials.slice(0, 5).map((m) => (
              <div
                key={m.title}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
              >
                <BookOpen className="w-4 h-4 text-kinaiya-blue" />
                <div className="min-w-0">
                  <span className="text-sm text-foreground block">{m.title}</span>
                  {m.body && (
                    <span className="text-[11px] text-muted-foreground line-clamp-2 block mt-0.5">
                      {m.body}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Feature Grid */}
      <div className="grid grid-cols-2 gap-4">
        {features.map((f, i) => (
          <motion.button
            key={f.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.08 }}
            onClick={f.action}
            className="flex flex-col items-start gap-3 p-5 rounded-2xl bg-card border border-border active:scale-[0.97] transition-transform text-left"
          >
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${f.color}`}
            >
              <f.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-display font-bold text-foreground text-sm">
                {f.label}
              </p>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Today's Story */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`mt-6 rounded-2xl border p-5 shadow-sm transition-all duration-500 ${
          stormAlertActive
            ? "bg-gradient-to-br from-kinaiya-red-light to-card border-kinaiya-red/30"
            : "bg-card border-border"
        }`}
      >
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Today's Story
        </p>
        <p className="font-display font-bold text-foreground mt-2">
          "The Highlands of Bukidnon"
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Learn about the indigenous communities of Bukidnon who protect the
          land, the forests, and their cultural traditions for future
          generations.
        </p>
        <button
          onClick={() => navigate("/diagnostic")}
          className="mt-4 w-full py-3 rounded-xl bg-kinaiya-green-light text-kinaiya-green font-display font-bold text-sm active:scale-[0.98] transition-transform"
        >
          Start Reading
        </button>
      </motion.div>
    </div>
  );
};

export default StudentHome;
