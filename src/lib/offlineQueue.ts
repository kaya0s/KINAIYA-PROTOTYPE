import { insertAssessment, insertInterventionSessionByCode } from "@/lib/kinaiyaDb";

const QUEUE_KEY = "kinaiya_offline_queue_v1";

type QueueItem =
  | {
      type: "assessment";
      payload: Parameters<typeof insertAssessment>[0];
    }
  | {
      type: "session";
      payload: Parameters<typeof insertInterventionSessionByCode>[0];
    };

const readQueue = (): QueueItem[] => {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (items: QueueItem[]) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
};

export const enqueueAssessment = (payload: Parameters<typeof insertAssessment>[0]) => {
  const items = readQueue();
  items.push({ type: "assessment", payload });
  writeQueue(items);
};

export const enqueueSession = (payload: Parameters<typeof insertInterventionSessionByCode>[0]) => {
  const items = readQueue();
  items.push({ type: "session", payload });
  writeQueue(items);
};

export const flushOfflineQueue = async () => {
  const items = readQueue();
  if (items.length === 0) return { flushed: 0, remaining: 0 };

  const remaining: QueueItem[] = [];
  let flushed = 0;

  for (const item of items) {
    try {
      if (item.type === "assessment") {
        await insertAssessment(item.payload);
      } else {
        await insertInterventionSessionByCode(item.payload);
      }
      flushed += 1;
    } catch {
      remaining.push(item);
    }
  }

  writeQueue(remaining);
  return { flushed, remaining: remaining.length };
};
