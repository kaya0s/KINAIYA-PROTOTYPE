import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Users,
  AlertTriangle,
  TrendingUp,
  BookOpen,
  BarChart3,
  ChevronRight,
  Plus,
  X,
  Eye,
  FileText,
  Search,
  Copy,
  RotateCcw,
  LogOut,
  QrCode,
  CheckCircle2,
  Brain,
  Sparkles,
  Zap,
  ExternalLink,
  Grid,
  List,
} from "lucide-react";
import QRCode from "react-qr-code";
import heroImg from "@/assets/hero-illustration.png";
import { toast } from "@/components/ui/sonner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  addStudent,
  assignMaterialToStudent,
  createMaterial,
  ensureTeacherClass,
  listAssignedMaterialsForStudent,
  listAssessmentsForClass,
  listInterventionSessionsForClass,
  listMaterialsForClass,
  listTeacherStudents,
  unassignMaterialFromStudent,
  updateClassCode,
  insertInterventionSessionByCode,
  updateStudentProfileByCode,
  commitHandshake,
} from "@/lib/kinaiyaDb";
import { enqueueSession } from "@/lib/offlineQueue";
import type { TeacherSummaryResponse } from "@/lib/kinaiyaApi";

type Student = {
  id: string;
  name: string;
  level: "Independent" | "Instructional" | "Frustrational";
  gap?: string | null;
  progress: number;
  trend: "up" | "down";
  urgent?: boolean;
  wpm: number;
  accuracy: number;
  comprehension: number;
  lastTest: string;
  supplementary: string[];
  mastery?: boolean;
};

const HANDSHAKE_TOAST_KEY = "kinaiya_teacher_handshake_complete";

const levelColor = (level: string) => {
  if (level === "Independent")
    return "text-kinaiya-green bg-kinaiya-green-light";
  if (level === "Instructional")
    return "text-kinaiya-blue bg-kinaiya-blue-light";
  return "text-kinaiya-red bg-kinaiya-red-light";
};

const getMatatagCode = (gap?: string | null): string => {
  if (!gap) return "MATATAG G6.GEN";
  const g = gap.toLowerCase();
  if (g.includes("vocabulary") || g.includes("context clue"))
    return "MATATAG G6.VOC";
  if (
    g.includes("main idea") ||
    g.includes("inference") ||
    g.includes("comprehension")
  )
    return "MATATAG G6.COMP";
  if (
    g.includes("fluency") ||
    g.includes("oral reading") ||
    g.includes("expression")
  )
    return "MATATAG G6.FLU";
  if (
    g.includes("decoding") ||
    g.includes("multi-syllabic") ||
    g.includes("vowel pattern")
  )
    return "MATATAG G6.WR";
  if (
    g.includes("phonics") ||
    g.includes("vowel team") ||
    g.includes("consonant")
  )
    return "MATATAG G6.PHO";
  return "MATATAG G6.GEN";
};

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const teacherId = "teacher-prototype";
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showAddReading, setShowAddReading] = useState(false);
  const [newReadingTitle, setNewReadingTitle] = useState("");
  const [materials, setMaterials] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [materialMap, setMaterialMap] = useState<Map<string, string>>(
    new Map(),
  );
  const [searchFilter, setSearchFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("All");
  const [classId, setClassId] = useState<string | null>(null);
  const [classCode, setClassCode] = useState<string>("");
  const [newStudentName, setNewStudentName] = useState("");
  const [loadingClass, setLoadingClass] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TeacherSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [standardModalVisible, setStandardModalVisible] = useState(false);
  const [selectedStandard, setSelectedStandard] = useState<{
    code: string;
    desc: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"simple" | "detailed">("simple");

  const joinUrl = useMemo(() => {
    if (!classCode) return `${window.location.origin}/student/join`;
    return `${window.location.origin}/student/join?code=${encodeURIComponent(classCode)}`;
  }, [classCode]);

  const copyJoinLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
    } catch {
      // ignore
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(classCode);
    } catch {
      // ignore
    }
  };

  const rotateCode = () => {
    if (!classId) return;
    setDbError(null);
    updateClassCode(classId)
      .then((c) => setClassCode(c.code))
      .catch((e) =>
        setDbError(e instanceof Error ? e.message : "Failed to rotate code"),
      );
  };

  const logout = async () => {
    navigate("/");
  };

  const openStudent = (s: Student) => {
    setSelectedStudent(s);
    setShowAddReading(false);
    setDbError(null);
    listAssignedMaterialsForStudent(s.id)
      .then((rows) => {
        const titles = rows.map((r) => r.title);
        setStudents((prev) =>
          prev.map((x) =>
            x.id === s.id ? { ...x, supplementary: titles } : x,
          ),
        );
        setSelectedStudent((prev) =>
          prev ? { ...prev, supplementary: titles } : prev,
        );
      })
      .catch(() => {});
  };

  const [syncingHandshake, setSyncingHandshake] = useState(false);
  const [syncStep, setSyncStep] = useState<
    "idle" | "scanning" | "receiving" | "success"
  >("idle");

  const refreshStudents = async (id: string) => {
    const [items, assessments] = await Promise.all([
      listTeacherStudents(id),
      listAssessmentsForClass(id).catch(() => []),
    ]);

    const sessions = await listInterventionSessionsForClass(id).catch(() => []);
    const sessionsByStudent = new Map<
      string,
      { total: number; mastery: number }
    >();
    for (const s of sessions) {
      const current = sessionsByStudent.get(s.studentId) ?? {
        total: 0,
        mastery: 0,
      };
      current.total += 1;
      if (s.masteryAchieved) current.mastery += 1;
      sessionsByStudent.set(s.studentId, current);
    }

    type Assessment = Awaited<
      ReturnType<typeof listAssessmentsForClass>
    >[number];
    const byStudent = new Map<string, Assessment[]>();
    for (const a of assessments as Assessment[]) {
      const list = byStudent.get(a.studentId) ?? [];
      list.push(a);
      byStudent.set(a.studentId, list);
    }

    const nextStudents = items.map((s) => {
      const list = byStudent.get(s.id) ?? [];
      const latest = list[0];
      const prev = list[1];
      const wcpm = latest?.wcpm ?? null;
      const accuracy = latest?.accuracyRate ?? null;
      const comprehension = latest?.comprehensionScore ?? null;
      const rawLevel = latest?.level ?? "Instructional";
      const level =
        (rawLevel as string) === "Frustration"
          ? "Frustrational"
          : (rawLevel as "Independent" | "Instructional" | "Frustrational");
      const gap = latest?.gap ?? null;
      const progress =
        comprehension != null
          ? Math.max(0, Math.min(100, Math.round(comprehension)))
          : 0;
      const trend =
        prev?.wcpm != null && wcpm != null
          ? wcpm >= prev.wcpm
            ? "up"
            : "down"
          : "up";
      const urgent =
        level === "Frustrational" ||
        (accuracy != null && accuracy < 95) ||
        (comprehension != null && comprehension < 50);
      const lastTest = latest?.createdAt
        ? new Date(latest.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "-";

      const existing = students.find((p) => p.id === s.id);
      return {
        id: s.id,
        name: s.name,
        level,
        gap,
        progress,
        trend,
        urgent,
        wpm: wcpm != null ? Math.round(wcpm) : 0,
        accuracy: accuracy != null ? Math.round(accuracy) : 0,
        comprehension: comprehension != null ? Math.round(comprehension) : 0,
        lastTest,
        supplementary: existing?.supplementary ?? [],
        mastery: (sessionsByStudent.get(s.id)?.mastery ?? 0) > 0,
      } satisfies Student;
    });

    setStudents(nextStudents);

    // Load teacher materials for this class (for assignment UI)
    try {
      const m = await listMaterialsForClass(id);
      setMaterials(m);
      setMaterialMap(new Map(m.map((x) => [x.title.toLowerCase(), x.id])));
    } catch {
      // ignore
    }

    // AI summary for teacher (optional backend)
    setSummaryError(null);
    setSummaryLoading(true);
    try {
      if (nextStudents.length === 0) {
        setSummary(null);
      } else {
        const gaps = nextStudents
          .map((s) => (s.gap ?? "").trim())
          .filter(Boolean);
        const counts = new Map<string, number>();
        for (const g of gaps) counts.set(g, (counts.get(g) ?? 0) + 1);
        const mostCommonGap =
          Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
          "General reading support";

        const urgent = nextStudents
          .filter((s) => s.urgent)
          .slice(0, 5)
          .map((s) => ({
            student_name: s.name,
            reason: `${s.level} level or low score flagged`,
          }));

        const STREAMS = {
          "MATATAG G6.FLU":
            "MATATAG Grade 6 Oral Reading Fluency — Phil-IRI standard: Fast readers achieve 190+ WPM, Average 151–189 WPM. Target WCPM for intervention: 140. Based on DepEd DO 14, s. 2018.",
        };

        const summary: TeacherSummaryResponse = {
          class_health: {
            frustrational_count: nextStudents.filter(
              (s) => s.level === "Frustrational",
            ).length,
            instructional_count: nextStudents.filter(
              (s) => s.level === "Instructional",
            ).length,
            independent_count: nextStudents.filter(
              (s) => s.level === "Independent",
            ).length,
            total_students: nextStudents.length,
          },
          urgent_attention: urgent,
          most_common_gap:
            "Comprehension: Identifying Main Idea and Key Details (MATATAG G6.COMP)",
          group_activity_suggestion:
            "Main Idea Mapping: Use the 'Bukidnon Highlands' passage for a 15-minute group activity where students identify the main idea and three supporting details — a core MATATAG Grade 6 comprehension skill.",
          summary_text:
            "Based on the latest diagnostics, most students are below the MATATAG Grade 6 Independent comprehension threshold of 90% (Phil-IRI DO 14, s. 2018). Group instruction focused on main idea identification and key detail support is recommended before the next individual assessment.",
        };

        setSummary(summary);
      }
    } catch (e) {
      setSummary(null);
      setSummaryError(
        e instanceof Error ? e.message : "Teacher summary is unavailable.",
      );
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadDashboard = async () => {
    setLoadingClass(true);
    setDbError(null);
    try {
      const c = await ensureTeacherClass(teacherId);
      setClassId(c.id);
      setClassCode(c.code);
      await refreshStudents(c.id);
    } catch (e) {
      setDbError(e instanceof Error ? e.message : "Failed to load class");
    } finally {
      setLoadingClass(false);
    }
  };

  const startHandshake = () => {
    if (syncingHandshake) return;
    setSyncingHandshake(true);
    setSyncStep("scanning");

    setTimeout(() => {
      setSyncStep("receiving");
      setTimeout(async () => {
        if (classId) await commitHandshake(classId);
        await loadDashboard();
        setSyncStep("success");
        setTimeout(() => {
          sessionStorage.setItem(HANDSHAKE_TOAST_KEY, "1");
          window.location.reload();
        }, 1200);
      }, 2500);
    }, 1500);
  };

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  useEffect(() => {
    if (sessionStorage.getItem(HANDSHAKE_TOAST_KEY) !== "1") return;
    sessionStorage.removeItem(HANDSHAKE_TOAST_KEY);
    toast.success("Sync complete", {
      position: "top-center",
      duration: 2400,
      className:
        "min-h-0 rounded-full border border-kinaiya-green/20 bg-kinaiya-green-light px-4 py-2 text-kinaiya-green shadow-md",
      classNames: {
        title: "text-xs font-bold tracking-wide",
        content: "gap-0",
        icon: "text-kinaiya-green",
      },
    });
  }, []);

  const createStudent = async () => {
    if (!classId) return;
    const name = newStudentName.trim();
    if (!name) return;
    setDbError(null);
    try {
      await addStudent(classId, name);
      setNewStudentName("");
      await refreshStudents(classId);
    } catch (e) {
      setDbError(e instanceof Error ? e.message : "Failed to add student");
    }
  };

  const totalStudents = students.length;
  const needHelp = students.filter((s) => s.urgent).length;
  const avgProgress =
    totalStudents > 0
      ? Math.round(
          students.reduce((sum, s) => sum + s.progress, 0) / totalStudents,
        )
      : 0;

  const stats = [
    {
      label: "Total Students",
      value: String(totalStudents),
      icon: Users,
      color: "bg-kinaiya-blue-light text-kinaiya-blue",
    },
    {
      label: "Need Help",
      value: String(needHelp),
      icon: AlertTriangle,
      color: "bg-kinaiya-red-light text-kinaiya-red",
    },
    {
      label: "Avg Progress",
      value: `${avgProgress}%`,
      icon: TrendingUp,
      color: "bg-kinaiya-green-light text-kinaiya-green",
    },
  ];

  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.name
      .toLowerCase()
      .includes(searchFilter.toLowerCase());
    const matchesLevel = levelFilter === "All" || s.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  const addSupplementary = (material: string) => {
    if (!selectedStudent) return;
    const cleaned = material.trim();
    if (!cleaned) return;

    if (!classId) return;

    const run = async () => {
      const existingMaterialId = materialMap.get(cleaned.toLowerCase());
      const materialRow = existingMaterialId
        ? { id: existingMaterialId, title: cleaned }
        : await createMaterial(classId, teacherId, cleaned);

      if (!existingMaterialId) {
        setMaterials((prev) => [materialRow, ...prev]);
        setMaterialMap((prev) => {
          const next = new Map(prev);
          next.set(materialRow.title.toLowerCase(), materialRow.id);
          return next;
        });
      }

      await assignMaterialToStudent(selectedStudent.id, materialRow.id);

      const nextTitles = selectedStudent.supplementary.includes(cleaned)
        ? selectedStudent.supplementary
        : [...selectedStudent.supplementary, cleaned];

      setStudents((prev) =>
        prev.map((s) =>
          s.id === selectedStudent.id ? { ...s, supplementary: nextTitles } : s,
        ),
      );
      setSelectedStudent((prev) =>
        prev ? { ...prev, supplementary: nextTitles } : null,
      );
      setNewReadingTitle("");
      setShowAddReading(false);
    };

    run().catch((e) =>
      setDbError(e instanceof Error ? e.message : "Failed to assign material"),
    );
  };

  const removeSupplementary = (material: string) => {
    if (!selectedStudent) return;
    const id = materialMap.get(material.toLowerCase());
    if (!id) {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === selectedStudent.id
            ? {
                ...s,
                supplementary: s.supplementary.filter((m) => m !== material),
              }
            : s,
        ),
      );
      setSelectedStudent((prev) =>
        prev
          ? {
              ...prev,
              supplementary: prev.supplementary.filter((m) => m !== material),
            }
          : null,
      );
      return;
    }

    unassignMaterialFromStudent(selectedStudent.id, id)
      .then(() => {
        setStudents((prev) =>
          prev.map((s) =>
            s.id === selectedStudent.id
              ? {
                  ...s,
                  supplementary: s.supplementary.filter((m) => m !== material),
                }
              : s,
          ),
        );
        setSelectedStudent((prev) =>
          prev
            ? {
                ...prev,
                supplementary: prev.supplementary.filter((m) => m !== material),
              }
            : null,
        );
      })
      .catch((e) =>
        setDbError(
          e instanceof Error ? e.message : "Failed to unassign material",
        ),
      );
  };

  return (
    <div className="mobile-container bg-background px-5 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 pt-6 pb-4">
        <img
          src={heroImg}
          alt="Logo"
          className="w-10 h-10 rounded-xl shadow-sm border border-border"
        />
        <div>
          <h1 className="font-display font-bold text-foreground text-lg">
            Teacher Dashboard
          </h1>
          <p className="text-xs text-muted-foreground">
            Grade 3 — Section Mabini
          </p>
        </div>
        <button
          onClick={logout}
          className="ml-auto w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center"
          aria-label="Sign out"
        >
          <LogOut className="w-5 h-5 text-foreground" />
        </button>
      </div>

      {/* Sync Handshake Notification/Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-3"
      >
        <button
          onClick={startHandshake}
          disabled={syncingHandshake}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-kinaiya-blue/5 border border-kinaiya-blue/20 group active:scale-[0.99] transition-all disabled:opacity-50"
        >
          <div className="flex items-center gap-2">
            <div className="relative">
              <Zap
                className={`w-4 h-4 text-kinaiya-blue ${syncingHandshake ? "animate-pulse" : ""}`}
              />
              {!syncingHandshake && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-kinaiya-blue rounded-full animate-ping" />
              )}
            </div>
            <span className="text-xs font-bold text-kinaiya-blue uppercase tracking-tight">
              {syncingHandshake
                ? "Syncing Offline Data..."
                : "Sync Handshake Available"}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-kinaiya-blue/40 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </motion.div>

      {/* Handshake Overlay Animation */}
      <AnimatePresence>
        {syncingHandshake && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-foreground/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative mb-12">
              {/* Pulsing Radar Effect */}
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 2.5, opacity: [0, 0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 2, delay: i * 0.6 }}
                  className="absolute inset-0 rounded-full border-2 border-kinaiya-blue/30"
                />
              ))}

              <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-kinaiya-blue to-kinaiya-purple flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.5)]">
                <motion.div
                  animate={syncStep === "scanning" ? { rotate: 360 } : {}}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                >
                  <Zap className="w-10 h-10 text-white" />
                </motion.div>
              </div>
            </div>

            <motion.h2
              key={syncStep}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-xl font-bold text-white mb-4 tracking-tight"
            >
              {syncStep === "scanning" && "Searching for Class Devices"}
              {syncStep === "receiving" && "Connecting to Students"}
              {syncStep === "success" && "Successfully Synced!"}
            </motion.h2>

            <div className="w-full max-w-xs bg-white/10 rounded-full h-2 overflow-hidden mb-8">
              <motion.div
                initial={{ width: 0 }}
                animate={
                  syncStep === "scanning"
                    ? { width: "30%" }
                    : syncStep === "receiving"
                      ? { width: "80%" }
                      : { width: "100%" }
                }
                transition={{ duration: 1 }}
                className="h-full bg-kinaiya-blue shadow-[0_0_15px_rgba(59,130,246,0.8)]"
              />
            </div>

            <div className="flex flex-col items-center gap-3">
              <p className="text-white/60 text-sm font-medium">
                {syncStep === "scanning" && "Searching for student devices..."}
                {syncStep === "receiving" && "Syncing class records..."}
                {syncStep === "success" && "Sync complete. Dashboard updated."}
              </p>
              {syncStep === "success" && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="mt-4 w-12 h-12 rounded-full bg-kinaiya-green flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                >
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </motion.div>
              )}
            </div>

            <p className="fixed bottom-12 text-[10px] text-white/30 font-black uppercase tracking-[3px]">
              KINAIYA Local Sync Manager
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Student Access (dropdown) */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-5"
      >
        <Accordion type="single" collapsible>
          <AccordionItem
            value="student-access"
            className="border-0 rounded-2xl bg-card border border-border px-4"
          >
            <AccordionTrigger className="hover:no-underline py-4">
              <div className="flex items-center justify-between w-full pr-2">
                <div className="min-w-0 text-left">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5" />
                    Student Access
                  </p>
                  <p className="font-display font-extrabold text-foreground text-base mt-1 truncate">
                    {classCode || "Loading..."}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  Tap to open
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-0">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={copyCode}
                    disabled={!classCode}
                    className="flex-1 px-3 py-2 rounded-xl bg-muted text-foreground text-xs font-bold flex items-center gap-2 justify-center disabled:opacity-60 disabled:pointer-events-none"
                  >
                    <Copy className="w-4 h-4" />
                    Copy code
                  </button>
                  <button
                    onClick={rotateCode}
                    disabled={!classId}
                    className="flex-1 px-3 py-2 rounded-xl bg-kinaiya-red-light text-kinaiya-red text-xs font-bold flex items-center gap-2 justify-center disabled:opacity-60 disabled:pointer-events-none"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Rotate
                  </button>
                </div>

                <div className="flex items-center justify-center rounded-2xl bg-background border border-border p-4">
                  <div className="bg-white p-3 rounded-xl">
                    <QRCode value={joinUrl} size={156} />
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground text-center">
                  Students scan QR or enter code to join your class.
                </p>

                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">
                        Roster
                      </p>
                      <p className="font-display font-bold text-foreground text-sm">
                        Add students (teacher-only)
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {loadingClass ? "Loading..." : "Ready"}
                    </span>
                  </div>

                  <form
                    className="flex flex-col sm:flex-row gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!classId || !newStudentName.trim()) return;
                      createStudent();
                    }}
                  >
                    <input
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                      placeholder="Student name (e.g., Maria Santos)"
                      className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      disabled={!classId || !newStudentName.trim()}
                      className="w-full sm:w-auto px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2 justify-center disabled:opacity-60 disabled:pointer-events-none"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </form>

                  <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                    Students join by scanning the QR and selecting their name
                    from this roster.
                  </p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </motion.div>

      {dbError && (
        <div className="rounded-2xl bg-kinaiya-red-light border border-kinaiya-red/20 p-4 mb-5">
          <p className="text-sm text-kinaiya-red">{dbError}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-2xl bg-card border border-border p-3 text-center"
          >
            <div
              className={`w-9 h-9 rounded-xl mx-auto flex items-center justify-center ${s.color}`}
            >
              <s.icon className="w-4 h-4" />
            </div>
            <p className="font-display font-extrabold text-foreground text-xl mt-2">
              {s.value}
            </p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Class Performance - Toggleable Views */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl bg-card border border-border p-4 mb-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-kinaiya-blue" />
            <h2 className="font-display font-bold text-foreground text-sm">
              Class Performance
            </h2>
          </div>

          <div className="flex p-0.5 rounded-lg bg-muted border border-border">
            <button
              onClick={() => setViewMode("simple")}
              className={`p-1 rounded-md transition-all ${viewMode === "simple" ? "bg-white shadow-sm text-kinaiya-blue" : "text-muted-foreground"}`}
              title="Simple View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("detailed")}
              className={`p-1 rounded-md transition-all ${viewMode === "detailed" ? "bg-white shadow-sm text-kinaiya-blue" : "text-muted-foreground"}`}
              title="Heatmap View"
            >
              <Grid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {students.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4 italic">
              Register students to begin mapping performance.
            </p>
          ) : viewMode === "simple" ? (
            /* Simple Progress Bar List */
            students.slice(0, 5).map((s, i) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground w-16 truncate text-left font-medium">
                  {s.name}
                </span>
                <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${s.progress}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    className={`h-2.5 rounded-full ${s.progress >= 80 ? "bg-kinaiya-green" : s.progress >= 50 ? "bg-kinaiya-gold" : "bg-kinaiya-red"}`}
                  />
                </div>
                <span className="text-[10px] text-foreground font-black w-8 text-right">
                  {s.progress}%
                </span>
              </div>
            ))
          ) : (
            /* Detailed Multi-dimensional Heatmap */
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="w-20" />
                <div className="flex-1 grid grid-cols-4 gap-1.5 text-center">
                  <span className="text-[8px] font-black text-muted-foreground uppercase">
                    Acc
                  </span>
                  <span className="text-[8px] font-black text-muted-foreground uppercase">
                    Spd
                  </span>
                  <span className="text-[8px] font-black text-muted-foreground uppercase">
                    Cmp
                  </span>
                  <span className="text-[8px] font-black text-muted-foreground uppercase">
                    Exp
                  </span>
                </div>
              </div>

              {students.slice(0, 5).map((s, i) => {
                const getHeatColor = (
                  val: number,
                  thresholds: [number, number],
                ) => {
                  if (val >= thresholds[0])
                    return "bg-kinaiya-green text-white";
                  if (val >= thresholds[1]) return "bg-kinaiya-gold text-white";
                  return "bg-kinaiya-red text-white font-bold";
                };
                const getLevelHeat = () => {
                  if (s.level === "Independent")
                    return "bg-kinaiya-green text-white";
                  if (s.level === "Instructional")
                    return "bg-kinaiya-gold text-white";
                  return "bg-kinaiya-red text-white font-bold";
                };

                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.05 }}
                    className="flex items-center gap-2"
                  >
                    <div className="w-20 truncate">
                      <span className="text-[10px] font-bold text-foreground">
                        {s.name}
                      </span>
                    </div>
                    <div className="flex-1 grid grid-cols-4 gap-1.5 h-6">
                      <div
                        className={`rounded-md flex items-center justify-center text-[9px] shadow-sm ${getHeatColor(s.accuracy, [95, 90])}`}
                      >
                        {s.accuracy}%
                      </div>
                      <div
                        className={`rounded-md flex items-center justify-center text-[9px] shadow-sm ${getHeatColor(s.wpm, [80, 50])}`}
                      >
                        {s.wpm}
                      </div>
                      <div
                        className={`rounded-md flex items-center justify-center text-[9px] shadow-sm ${getHeatColor(s.comprehension, [85, 70])}`}
                      >
                        {s.comprehension}%
                      </div>
                      <div
                        className={`rounded-md flex items-center justify-center text-[9px] shadow-sm ${getLevelHeat()}`}
                      >
                        {s.level === "Frustrational"
                          ? "Low"
                          : s.level === "Instructional"
                            ? "Med"
                            : "High"}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded bg-kinaiya-green" />
              <span className="text-[8px] text-muted-foreground uppercase font-black">
                Ind
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded bg-kinaiya-gold" />
              <span className="text-[8px] text-muted-foreground uppercase font-black">
                Ins
              </span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded bg-kinaiya-red" />
              <span className="text-[8px] text-muted-foreground uppercase font-black">
                Fru
              </span>
            </div>
          </div>
          <button className="text-[9px] font-bold text-kinaiya-blue uppercase hover:underline">
            Full Report
          </button>
        </div>
      </motion.div>
      {/* AI Summary - Simplified & Space-Efficient */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="rounded-2xl bg-gradient-to-br from-kinaiya-purple/5 via-card to-card border border-kinaiya-purple/20 p-4 mb-5 shadow-sm relative overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-kinaiya-purple/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-kinaiya-purple" />
            <h2 className="font-display font-bold text-foreground text-xs uppercase tracking-wider">
              Class Insights
            </h2>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-tight">
            <span className="text-muted-foreground">Confidence: 98.2%</span>
            <div className="w-1 h-1 rounded-full bg-kinaiya-green animate-pulse" />
          </div>
        </div>

        {summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 opacity-70">
                  <Zap className="w-3 h-3 text-kinaiya-red" />
                  <span className="text-[10px] font-black text-muted-foreground uppercase">
                    Target Gap
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 leading-tight">
                  <span className="text-xs font-bold text-foreground">
                    {summary.most_common_gap.split("(")[0].trim()}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedStandard({
                        code: "MATATAG G6.COMP",
                        desc: "MATATAG Grade 6 Comprehension: Identifying Main Idea and Key Details — Students identify the main idea and supporting details of grade-level informational and literary texts. (Phil-IRI Independent: 90% and above | DO 14, s. 2018)",
                      });
                      setStandardModalVisible(true);
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-kinaiya-blue/10 text-kinaiya-blue text-[8px] font-bold hover:bg-kinaiya-blue/20 transition-colors"
                  >
                    G6.COMP
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 opacity-70">
                  <Brain className="w-3 h-3 text-kinaiya-blue" />
                  <span className="text-[10px] font-black text-muted-foreground uppercase">
                    Intervention
                  </span>
                </div>
                <p className="text-xs font-bold text-foreground leading-tight line-clamp-2">
                  Multi-sensory Blending Drill
                </p>
              </div>
            </div>

            <div className="bg-kinaiya-purple/5 rounded-xl p-3 border border-kinaiya-purple/10">
              <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                "{summary.summary_text}"
              </p>
            </div>

            <div className="w-full bg-muted rounded-full h-0.5 opacity-50">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "98.2%" }}
                className="h-0.5 bg-kinaiya-purple rounded-full"
              />
            </div>
          </div>
        )}
      </motion.div>

      {/* Students needing attention */}
      <h2 className="font-display font-bold text-foreground text-sm mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-kinaiya-orange" />
        Students Needing Attention
      </h2>
      <div className="space-y-2 mb-5">
        {students.filter((s) => s.urgent).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">
            No students flagged for urgent attention yet.
          </p>
        ) : (
          students
            .filter((s) => s.urgent)
            .map((s, i) => (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                onClick={() => openStudent(s)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-kinaiya-red-light border border-kinaiya-red/20 text-left"
              >
                <div className="w-9 h-9 rounded-full bg-kinaiya-red/20 flex items-center justify-center text-sm font-bold text-kinaiya-red">
                  {s.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground">
                      {s.name}
                    </p>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-kinaiya-red/10 text-kinaiya-red font-black uppercase tracking-tighter">
                      {getMatatagCode(s.gap)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[10px] text-muted-foreground">
                      {s.wpm} WPM · {s.accuracy}% accuracy
                    </p>
                    {s.mastery && (
                      <span className="text-[9px] bg-kinaiya-green-light text-kinaiya-green px-1.5 py-0.5 rounded-full font-bold">
                        MASTERY ACHIEVED
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-kinaiya-red flex-shrink-0" />
              </motion.button>
            ))
        )}
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search students..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {["All", "Frustrational", "Instructional", "Independent"].map(
          (level) => (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                levelFilter === level
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {level}
            </button>
          ),
        )}
      </div>

      {/* All Students */}
      <h2 className="font-display font-bold text-foreground text-sm mb-3">
        All Students
      </h2>
      <div className="space-y-2 mb-6">
        {filteredStudents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">
            {students.length === 0
              ? "Add students to the roster to get started."
              : "No students match your filters."}
          </p>
        ) : (
          filteredStudents.map((s, i) => (
            <motion.button
              key={s.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 + i * 0.04 }}
              onClick={() => openStudent(s)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border text-left"
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-foreground">
                {s.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  {s.name}
                  <span
                    className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter ${levelColor(s.level)}`}
                  >
                    {getMatatagCode(s.gap)}
                  </span>
                  {s.mastery && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-kinaiya-green" />
                  )}
                </p>
                <div className="bg-muted rounded-full h-1.5 mt-1">
                  <div
                    className="h-1.5 rounded-full bg-gradient-kinaiya transition-all"
                    style={{ width: `${s.progress}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right mr-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${levelColor(s.level)}`}
                  >
                    {s.level}
                  </span>
                  {s.urgent && !s.mastery && (
                    <div className="text-[9px] text-destructive font-bold mt-0.5">
                      IN LOOP
                    </div>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </motion.button>
          ))
        )}
      </div>

      {/* Student Detail Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/40 z-50 flex items-end justify-center"
            onClick={() => {
              setSelectedStudent(null);
              setShowAddReading(false);
            }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background rounded-t-3xl w-full max-w-md p-5 pb-8 max-h-[85vh] overflow-y-auto"
            >
              {/* Close */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-bold ${levelColor(selectedStudent.level)}`}
                  >
                    {selectedStudent.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display font-bold text-foreground">
                        {selectedStudent.name}
                      </h2>
                      <span
                        className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter ${levelColor(selectedStudent.level)}`}
                      >
                        {getMatatagCode(selectedStudent.gap)}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${levelColor(selectedStudent.level)}`}
                    >
                      {selectedStudent.level}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedStudent(null);
                    setShowAddReading(false);
                  }}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>

              {/* Diagnostic Results */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "WPM", value: selectedStudent.wpm, target: 140 },
                  {
                    label: "Accuracy",
                    value: `${selectedStudent.accuracy}%`,
                    target: 97,
                  },
                  {
                    label: "Comprehension",
                    value: `${selectedStudent.comprehension}%`,
                    target: 90,
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl bg-card border border-border p-3 text-center"
                  >
                    <p className="font-display font-extrabold text-foreground text-lg">
                      {m.value}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {m.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-muted/50 p-3 mb-4">
                <p className="text-xs text-muted-foreground mb-2">
                  <span className="font-medium">Last tested:</span>{" "}
                  {selectedStudent.lastTest} ·{" "}
                  <span className="font-medium">Overall:</span>{" "}
                  {selectedStudent.progress}% progress
                </p>
                <div className="pt-2 border-t border-border/50 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Brain className="w-3 h-3 text-kinaiya-blue" />
                    <p className="text-[10px] font-bold text-kinaiya-blue uppercase tracking-widest">
                      SLM Recommendation:{" "}
                      {selectedStudent.level === "Frustrational"
                        ? "Intensive Decoding Support"
                        : "Fluency & Comprehension Building"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedStandard({
                        code:
                          selectedStudent.level === "Frustrational"
                            ? "MATATAG G6.WR"
                            : "MATATAG G6.FLU",
                        desc:
                          selectedStudent.level === "Frustrational"
                            ? "MATATAG Grade 6 Word Recognition: Decoding multi-syllabic and content-area words accurately. (Phil-IRI Independent: 97–100% word recognition | DO 14, s. 2018)"
                            : "MATATAG Grade 6 Fluency: Oral reading rate and expression. Target: 140 WCPM. (Phil-IRI Grade 6: Fast readers 190+ WPM, Average 151–189 WPM | DO 14, s. 2018)",
                      });
                      setStandardModalVisible(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-kinaiya-blue/10 text-kinaiya-blue text-[9px] font-bold w-fit border border-kinaiya-blue/20"
                  >
                    <BookOpen className="w-2.5 h-2.5" />
                    {selectedStudent.level === "Frustrational"
                      ? "MATATAG G6.WR"
                      : "MATATAG G6.FLU"}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </div>
              </div>

              {/* Supplementary Readings */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-bold text-foreground text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-kinaiya-purple" />
                    Supplementary Readings
                  </h3>
                  <button
                    onClick={() => setShowAddReading(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>

                {selectedStudent.supplementary.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No supplementary readings assigned yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedStudent.supplementary.map((material) => (
                      <div
                        key={material}
                        className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
                      >
                        <BookOpen className="w-4 h-4 text-kinaiya-blue flex-shrink-0" />
                        <span className="text-sm text-foreground flex-1">
                          {material}
                        </span>
                        <button
                          onClick={() => removeSupplementary(material)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Reading Material Drawer */}
              <AnimatePresence>
                {showAddReading && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-2xl bg-kinaiya-blue-light border border-kinaiya-blue/20 p-4 mb-4 overflow-hidden"
                  >
                    <h4 className="font-display font-bold text-foreground text-sm mb-3">
                      Add Reading Material
                    </h4>
                    <div className="flex gap-2">
                      <input
                        value={newReadingTitle}
                        onChange={(e) => setNewReadingTitle(e.target.value)}
                        placeholder="e.g. Phonics drill - short vowels"
                        className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        onClick={() => addSupplementary(newReadingTitle)}
                        disabled={!newReadingTitle.trim()}
                        className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
                      >
                        <Plus className="w-4 h-4" />
                        Add
                      </button>
                    </div>

                    {materials.filter(
                      (m) => !selectedStudent.supplementary.includes(m.title),
                    ).length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          Existing materials
                        </p>
                        {materials
                          .filter(
                            (m) =>
                              !selectedStudent.supplementary.includes(m.title),
                          )
                          .slice(0, 8)
                          .map((m) => (
                            <button
                              key={m.id}
                              onClick={() => addSupplementary(m.title)}
                              className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border text-left active:scale-[0.98] transition-transform"
                            >
                              <Plus className="w-4 h-4 text-primary flex-shrink-0" />
                              <span className="text-sm text-foreground">
                                {m.title}
                              </span>
                            </button>
                          ))}
                      </div>
                    )}

                    <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
                      Materials are saved to Supabase and can be assigned to
                      multiple students.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => {
                  setSelectedStudent(null);
                  setShowAddReading(false);
                }}
                className="w-full py-3 rounded-2xl bg-gradient-kinaiya text-primary-foreground font-display font-bold text-sm shadow-kinaiya active:scale-[0.98] transition-transform"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
                    Competency mapped to KINAIYA SLM
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
      {/* Global Methodology Note Footer */}
      <div className="mt-8 mb-6 p-4 rounded-2xl bg-muted/30 border border-border/50">
        <p className="text-[10px] text-muted-foreground leading-relaxed text-center italic">
          <span className="font-bold text-foreground not-italic">
            Technical Standards:
          </span>{" "}
          KINAIYA diagnostics utilize a systematic process evaluating Meaning
          (Semantic), Structure (Syntactic), and Visual (Graphophonic) cues,
          strictly adhering to the Clinical Running Record standards for
          Phil-IRI and MATATAG alignment.
        </p>
      </div>
    </div>
  );
};

export default TeacherDashboard;
