export const GRADE_BAND = "Grade 6";
export const CLASS_SECTION = "Mabini";

export const TARGETS = {
  wcpm: 140,
  accuracy: 97,
  comprehension: 90,
} as const;

export type ReadingLevel = "Frustrational" | "Instructional" | "Independent";

export const normalizeLevel = (level: string | null | undefined): ReadingLevel => {
  if (level === "Independent" || level === "Instructional") return level;
  return "Frustrational";
};

const STANDARD_DETAILS: Record<string, string> = {
  "MATATAG G6.VOC":
    "Vocabulary and context clues for Grade 6 readers. Learners infer word meaning using surrounding text, syntax, and morphology in literary and informational passages.",
  "MATATAG G6.COMP":
    "Comprehension for Grade 6 readers. Learners identify main ideas, supporting details, and logical inferences from grade-level literary and informational texts.",
  "MATATAG G6.WR":
    "Word recognition for Grade 6 readers. Learners decode multisyllabic and content-area words accurately and automatically during oral reading.",
  "MATATAG G6.PHO":
    "Phonics and structural analysis for Grade 6 readers. Learners apply vowel teams, affixes, syllabication, and consonant clusters while reading connected text.",
  "MATATAG G6.FLU":
    "Fluency for Grade 6 readers. Learners read grade-level passages at 140 WCPM with accuracy, phrasing, and expression.",
  "MATATAG G6.GEN":
    "General literacy support aligned to Grade 6 MATATAG and Phil-IRI oral reading checks.",
};

export const getStandardCode = (gap?: string | null): string => {
  if (!gap) return "MATATAG G6.GEN";
  const value = gap.toLowerCase();
  if (/(vocabulary|context clue|meaning)/.test(value)) return "MATATAG G6.VOC";
  if (/(main idea|inference|comprehension|detail)/.test(value))
    return "MATATAG G6.COMP";
  if (/(fluency|oral reading|expression|pace|speed)/.test(value))
    return "MATATAG G6.FLU";
  if (/(decoding|multi-syllabic|word recognition)/.test(value))
    return "MATATAG G6.WR";
  if (/(phonics|vowel|consonant|blend|cluster|syllab)/.test(value))
    return "MATATAG G6.PHO";
  return "MATATAG G6.GEN";
};

export const getStandardDetail = (code: string) =>
  STANDARD_DETAILS[code] ?? STANDARD_DETAILS["MATATAG G6.GEN"];

export const getGapFocusLabel = (gap?: string | null) => {
  if (!gap) return "General reading support";
  return gap.split(":")[0]?.trim() || gap;
};

export const getFocusSkill = (gap?: string | null) => {
  if (!gap) return "Reading confidence and comprehension";
  const lowered = gap.toLowerCase();
  if (lowered.includes("fluency")) return "Oral reading rate and expression";
  if (lowered.includes("decoding")) return "Decoding multisyllabic words";
  if (lowered.includes("phonics")) return "Vowel teams and consonant clusters";
  if (lowered.includes("comprehension")) return "Main idea and key details";
  if (lowered.includes("inference")) return "Drawing conclusions from clues";
  return gap;
};

export const getMotherTongueBridge = (
  gap: string | null | undefined,
  level: ReadingLevel,
) => {
  const value = (gap ?? "").toLowerCase();
  const language = level === "Frustrational" ? "Bisaya" : "Tagalog";

  if (value.includes("fluency")) {
    return {
      language,
      cue: "Read, pause, then say it smoothly.",
      bisaya:
        "Hinay-hinaya sa pagbasa. Hunong sa kuwit ug tuldok, dayon ipadayon nga klaro ang tingog.",
      tagalog:
        "Dahan-dahan sa pagbasa. Huminto sa kuwit at tuldok, tapos ituloy nang malinaw ang boses.",
      teacherNote: "Coach pacing and phrasing before asking for speed.",
    };
  }

  if (value.includes("decoding") || value.includes("phonics") || value.includes("vowel")) {
    return {
      language,
      cue: "Break the word into sound parts before blending.",
      bisaya:
        "Bahina ang pulong sa gagmay nga tingog una, dayon iusa pag-usab aron mabasa og tarong.",
      tagalog:
        "Hatiin muna ang salita sa maliliit na tunog, saka pagsamahin para mabasa nang tama.",
      teacherNote: "Prompt syllable-by-syllable blending with a familiar example.",
    };
  }

  return {
    language,
    cue: "Think about who, what, and why before answering.",
    bisaya:
      "Hunahunaa kinsa, unsa, ug nganong nahitabo sa istorya una ka motubag.",
    tagalog:
      "Isipin muna kung sino, ano, at bakit nangyari sa kuwento bago sumagot.",
    teacherNote: "Prompt retelling before inference questions.",
  };
};

export type SummaryStudent = {
  level: ReadingLevel;
  gap?: string | null;
  urgent?: boolean;
  wpm: number;
  accuracy: number;
  comprehension: number;
  name: string;
};

export const buildTeacherSummary = (students: SummaryStudent[]) => {
  const gapCounts = new Map<string, number>();
  for (const student of students) {
    const key = student.gap?.trim() || "General reading support";
    gapCounts.set(key, (gapCounts.get(key) ?? 0) + 1);
  }

  const mostCommonGap =
    Array.from(gapCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "General reading support";

  const standardCode = getStandardCode(mostCommonGap);
  const urgentAttention = students
    .filter((student) => student.urgent)
    .slice(0, 5)
    .map((student) => ({
      student_name: student.name,
      reason: `${student.level} profile with ${student.comprehension}% comprehension and ${student.accuracy}% accuracy`,
    }));

  const classHealth = {
    frustrational_count: students.filter((student) => student.level === "Frustrational").length,
    instructional_count: students.filter((student) => student.level === "Instructional").length,
    independent_count: students.filter((student) => student.level === "Independent").length,
    total_students: students.length,
  };

  const averageComprehension =
    students.length > 0
      ? Math.round(
          students.reduce((sum, student) => sum + student.comprehension, 0) /
            students.length,
        )
      : 0;

  return {
    class_health: classHealth,
    urgent_attention: urgentAttention,
    most_common_gap: `${mostCommonGap} (${standardCode})`,
    group_activity_suggestion:
      standardCode === "MATATAG G6.COMP"
        ? "Run a short retell circle using the Bukidnon passage. Ask learners to name the main idea, then two supporting details before independent answers."
        : standardCode === "MATATAG G6.FLU"
          ? "Run echo reading in pairs, focusing on punctuation pauses, smooth phrasing, and one timed reread."
          : "Model the target pattern first, then let learners practice in short guided rounds before independent work.",
    summary_text: `Class average comprehension is ${averageComprehension}%. The current bottleneck is ${getFocusSkill(
      mostCommonGap,
    ).toLowerCase()}, so the next teacher move should reinforce that skill before the next diagnostic cycle.`,
    standard_code: standardCode,
  };
};
