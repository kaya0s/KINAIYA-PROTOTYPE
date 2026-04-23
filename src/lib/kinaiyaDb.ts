import { generateClassCode } from "@/lib/classCode";

export type TeacherClass = {
  id: string;
  code: string;
  name: string;
  section: string | null;
};

export type StudentListItem = {
  id: string;
  name: string;
};

export type AssessmentRow = {
  id: string;
  studentId: string;
  wcpm: number | null;
  accuracyRate: number | null;
  comprehensionScore: number | null;
  level: "Frustrational" | "Instructional" | "Independent" | null;
  gap: string | null;
  createdAt: string;
};

export type MaterialRow = { id: string; title: string };

export type InterventionSessionRow = {
  id: string;
  studentId: string;
  masteryAchieved: boolean | null;
  createdAt: string;
};

type DbStudent = { id: string; classId: string; name: string; createdAt: string };
type DbAssessment = {
  id: string;
  classId: string;
  studentId: string;
  wcpm: number;
  accuracyRate: number;
  comprehensionScore: number;
  level: "Frustrational" | "Instructional" | "Independent";
  gap: string;
  raw: unknown | null;
  createdAt: string;
  isSynced?: boolean;
};
type DbMaterial = { id: string; classId: string; title: string; body: string | null; createdAt: string };
type DbStudentMaterial = { studentId: string; materialId: string; createdAt: string };
type DbStudentProfile = { classId: string; studentId: string; currentLevel: string | null; currentGap: string | null; updatedAt: string };
type DbInterventionSession = { id: string; classId: string; studentId: string; masteryAchieved: boolean | null; createdAt: string; isSynced?: boolean };

type DbState = {
  version: 1;
  teacherClass: TeacherClass;
  students: DbStudent[];
  assessments: DbAssessment[];
  materials: DbMaterial[];
  studentMaterials: DbStudentMaterial[];
  studentProfiles: DbStudentProfile[];
  interventionSessions: DbInterventionSession[];
};

const DB_KEY = "kinaiya_mock_db_v2";

const nowIso = () => new Date().toISOString();

const uuid = () => {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now()}`;
};

const loadDb = (): DbState => {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DbState;
      if (parsed && parsed.version === 1) return parsed;
    }
  } catch {
  }

  const classId = uuid();
  const teacherClass: TeacherClass = {
    id: classId,
    code: generateClassCode(),
    name: "Grade 3",
    section: "Mabini",
  };

  const seedStudents: DbStudent[] = [
    { id: uuid(), classId, name: "Aira D.", createdAt: nowIso() },
    { id: uuid(), classId, name: "Jun-Jun B.", createdAt: nowIso() },
    { id: uuid(), classId, name: "Datu L.", createdAt: nowIso() },
    { id: uuid(), classId, name: "Jessa Mae R.", createdAt: nowIso() },
    { id: uuid(), classId, name: "Rico S.", createdAt: nowIso() },
  ];

  const materials: DbMaterial[] = [
    { id: uuid(), classId, title: "Short vowel practice", body: null, createdAt: nowIso() },
    { id: uuid(), classId, title: "Timed re-read (1 min)", body: null, createdAt: nowIso() },
    { id: uuid(), classId, title: "Extension story: Nature", body: null, createdAt: nowIso() },
  ];

  const [aira, junjun, datu, jessa, rico] = seedStudents;
  const assessments: DbAssessment[] = [
    {
      id: uuid(),
      classId,
      studentId: aira.id,
      wcpm: 62,
      accuracyRate: 74,
      comprehensionScore: 46,
      level: "Frustrational",
      gap: "Decoding: long vowel sounds (a, e, i)",
      raw: { source: "seed" },
      createdAt: nowIso(),
      isSynced: true,
    },
    {
      id: uuid(),
      classId,
      studentId: junjun.id,
      wcpm: 78,
      accuracyRate: 91,
      comprehensionScore: 68,
      level: "Instructional",
      gap: "Phonemic Awareness: Consonant Blends",
      raw: { source: "seed" },
      createdAt: nowIso(),
      isSynced: true,
    },
    {
      id: uuid(),
      classId,
      studentId: datu.id,
      wcpm: 124,
      accuracyRate: 98,
      comprehensionScore: 92,
      level: "Independent",
      gap: "General reading support",
      raw: { source: "seed" },
      createdAt: nowIso(),
      isSynced: true,
    },
    {
      id: uuid(),
      classId,
      studentId: jessa.id,
      wcpm: 115,
      accuracyRate: 96,
      comprehensionScore: 88,
      level: "Independent",
      gap: "General reading support",
      raw: { source: "seed" },
      createdAt: nowIso(),
      isSynced: true,
    },
    {
      id: uuid(),
      classId,
      studentId: rico.id,
      wcpm: 82,
      accuracyRate: 88,
      comprehensionScore: 70,
      level: "Instructional",
      gap: "Fluency: Pacing and Expression",
      raw: { source: "seed" },
      createdAt: nowIso(),
      isSynced: true,
    },
  ];

  const studentMaterials: DbStudentMaterial[] = [
    { studentId: aira.id, materialId: materials[0].id, createdAt: nowIso() },
    { studentId: rico.id, materialId: materials[1].id, createdAt: nowIso() },
    { studentId: datu.id, materialId: materials[2].id, createdAt: nowIso() },
  ];

  const studentProfiles: DbStudentProfile[] = [
    { classId, studentId: aira.id, currentLevel: "Frustrational", currentGap: assessments[0].gap, updatedAt: nowIso() },
    { classId, studentId: junjun.id, currentLevel: "Instructional", currentGap: assessments[1].gap, updatedAt: nowIso() },
    { classId, studentId: datu.id, currentLevel: "Independent", currentGap: assessments[2].gap, updatedAt: nowIso() },
    { classId, studentId: jessa.id, currentLevel: "Independent", currentGap: assessments[3].gap, updatedAt: nowIso() },
    { classId, studentId: rico.id, currentLevel: "Instructional", currentGap: assessments[4].gap, updatedAt: nowIso() },
  ];

  const db: DbState = {
    version: 1,
    teacherClass,
    students: seedStudents,
    assessments,
    materials,
    studentMaterials,
    studentProfiles,
    interventionSessions: [],
  };

  localStorage.setItem(DB_KEY, JSON.stringify(db));
  return db;
};

const saveDb = (db: DbState) => {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
};

export const ensureTeacherClass = async (_teacherId: string) => {
  const db = loadDb();
  return db.teacherClass;
};

export const updateClassCode = async (classId: string) => {
  const db = loadDb();
  if (db.teacherClass.id !== classId) throw new Error("Class not found");
  db.teacherClass = { ...db.teacherClass, code: generateClassCode() };
  saveDb(db);
  return db.teacherClass;
};

export const listTeacherStudents = async (classId: string) => {
  const db = loadDb();
  return db.students
    .filter((s) => s.classId === classId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((s) => ({ id: s.id, name: s.name })) as StudentListItem[];
};

export const addStudent = async (classId: string, name: string) => {
  const db = loadDb();
  const student: DbStudent = { id: uuid(), classId, name, createdAt: nowIso() };
  db.students.push(student);
  saveDb(db);
  return { id: student.id, name: student.name } as StudentListItem;
};

export const getClassByCode = async (code: string) => {
  const db = loadDb();
  if (db.teacherClass.code.toUpperCase() !== code.toUpperCase()) return null;
  return { class_id: db.teacherClass.id, name: db.teacherClass.name, section: db.teacherClass.section, code: db.teacherClass.code };
};

export const listStudentsByCode = async (code: string) => {
  const db = loadDb();
  if (db.teacherClass.code.toUpperCase() !== code.toUpperCase()) return [] as StudentListItem[];
  return db.students
    .filter((s) => s.classId === db.teacherClass.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((s) => ({ id: s.id, name: s.name })) as StudentListItem[];
};

export const insertAssessment = async (args: {
  code: string;
  studentId: string;
  wcpm: number;
  accuracyRate: number;
  comprehensionScore: number;
  level: "Frustrational" | "Instructional" | "Independent";
  gap: string;
  raw?: unknown;
}) => {
  const db = loadDb();
  if (db.teacherClass.code.toUpperCase() !== args.code.toUpperCase()) throw new Error("Invalid class code");

  const row: DbAssessment = {
    id: uuid(),
    classId: db.teacherClass.id,
    studentId: args.studentId,
    wcpm: args.wcpm,
    accuracyRate: args.accuracyRate,
    comprehensionScore: args.comprehensionScore,
    level: args.level,
    gap: args.gap,
    raw: args.raw ?? null,
    createdAt: nowIso(),
    isSynced: false,
  };
  db.assessments.unshift(row);
  saveDb(db);
  return row.id;
};

export const listAssessmentsForClass = async (classId: string, onlySynced = true) => {
  const db = loadDb();
  return db.assessments
    .filter((a) => a.classId === classId && (!onlySynced || a.isSynced))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((a) => ({
      id: a.id,
      studentId: a.studentId,
      wcpm: a.wcpm ?? null,
      accuracyRate: a.accuracyRate ?? null,
      comprehensionScore: a.comprehensionScore ?? null,
      level: a.level ?? null,
      gap: a.gap ?? null,
      createdAt: a.createdAt,
    })) as AssessmentRow[];
};

export const listMaterialsForClass = async (classId: string) => {
  const db = loadDb();
  return db.materials
    .filter((m) => m.classId === classId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((m) => ({ id: m.id, title: m.title })) as MaterialRow[];
};

export const createMaterial = async (classId: string, _teacherId: string, title: string) => {
  const db = loadDb();
  const row: DbMaterial = { id: uuid(), classId, title, body: null, createdAt: nowIso() };
  db.materials.unshift(row);
  saveDb(db);
  return { id: row.id, title: row.title } as MaterialRow;
};

export const assignMaterialToStudent = async (studentId: string, materialId: string) => {
  const db = loadDb();
  const exists = db.studentMaterials.some((x) => x.studentId === studentId && x.materialId === materialId);
  if (!exists) db.studentMaterials.push({ studentId, materialId, createdAt: nowIso() });
  saveDb(db);
  return uuid();
};

export const unassignMaterialFromStudent = async (studentId: string, materialId: string) => {
  const db = loadDb();
  db.studentMaterials = db.studentMaterials.filter((x) => !(x.studentId === studentId && x.materialId === materialId));
  saveDb(db);
};

export const listAssignedMaterialsForStudent = async (studentId: string) => {
  const db = loadDb();
  const materialById = new Map(db.materials.map((m) => [m.id, m]));
  return db.studentMaterials
    .filter((x) => x.studentId === studentId)
    .map((x) => {
      const m = materialById.get(x.materialId);
      return m ? { materialId: x.materialId, title: m.title } : null;
    })
    .filter(Boolean) as Array<{ materialId: string; title: string }>;
};

export const listAssignedMaterialsByCode = async (code: string, studentId: string) => {
  const db = loadDb();
  if (db.teacherClass.code.toUpperCase() !== code.toUpperCase()) return [];
  const materialById = new Map(db.materials.map((m) => [m.id, m]));
  return db.studentMaterials
    .filter((x) => x.studentId === studentId)
    .map((x) => {
      const m = materialById.get(x.materialId);
      return m ? { materialId: x.materialId, title: m.title, body: m.body ?? null } : null;
    })
    .filter(Boolean) as Array<{ materialId: string; title: string; body: string | null }>;
};

export const getStudentProfileByCode = async (code: string, studentId: string) => {
  const db = loadDb();
  if (db.teacherClass.code.toUpperCase() !== code.toUpperCase()) return null;
  const row = db.studentProfiles.find((p) => p.studentId === studentId && p.classId === db.teacherClass.id) ?? null;
  return row ? { studentId: row.studentId, currentLevel: row.currentLevel, currentGap: row.currentGap } : null;
};

export const updateStudentProfileByCode = async (args: {
  code: string;
  studentId: string;
  currentLevel?: "Frustrational" | "Instructional" | "Independent";
  currentGap?: string | null;
}) => {
  const db = loadDb();
  if (db.teacherClass.code.toUpperCase() !== args.code.toUpperCase()) throw new Error("Invalid class code");

  const existing = db.studentProfiles.find((p) => p.studentId === args.studentId && p.classId === db.teacherClass.id);
  if (existing) {
    existing.currentLevel = args.currentLevel ?? existing.currentLevel;
    existing.currentGap = args.currentGap ?? existing.currentGap;
    existing.updatedAt = nowIso();
  } else {
    db.studentProfiles.push({
      classId: db.teacherClass.id,
      studentId: args.studentId,
      currentLevel: args.currentLevel ?? null,
      currentGap: args.currentGap ?? null,
      updatedAt: nowIso(),
    });
  }
  saveDb(db);
};

export const listInterventionSessionsForClass = async (classId: string, onlySynced = true) => {
  const db = loadDb();
  return db.interventionSessions
    .filter((s) => s.classId === classId && (!onlySynced || s.isSynced))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((s) => ({ id: s.id, studentId: s.studentId, masteryAchieved: s.masteryAchieved, createdAt: s.createdAt })) as InterventionSessionRow[];
};

export const insertInterventionSessionByCode = async (args: {
  code: string;
  studentId: string;
  level: "Frustrational" | "Instructional" | "Independent";
  gap: string;
  targetSkill: string;
  exerciseType: string;
  intervention?: unknown;
  masteryCheck?: unknown;
  masteryAchieved?: boolean | null;
  nextAction?: string | null;
}) => {
  const db = loadDb();
  if (db.teacherClass.code.toUpperCase() !== args.code.toUpperCase()) throw new Error("Invalid class code");

  const row: DbInterventionSession = {
    id: uuid(),
    classId: db.teacherClass.id,
    studentId: args.studentId,
    masteryAchieved: args.masteryAchieved ?? null,
    createdAt: nowIso(),
    isSynced: false,
  };
  db.interventionSessions.unshift(row);
  saveDb(db);
  return row.id;
};

export const commitHandshake = async (classId: string) => {
  const db = loadDb();
  db.assessments = db.assessments.map(a => a.classId === classId ? { ...a, isSynced: true } : a);
  db.interventionSessions = db.interventionSessions.map(s => s.classId === classId ? { ...s, isSynced: true } : s);
  saveDb(db);
};
