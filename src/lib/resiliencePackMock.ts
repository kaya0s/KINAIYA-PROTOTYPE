import type { ResiliencePackResponse } from "@/lib/kinaiyaApi";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const pick = <T,>(arr: T[], idx: number) => arr[idx % arr.length];

const BUKIDNON_STORIES = [
  {
    day: 1,
    title: "The Higaonon of Mount Kitanglad",
    story: "The Higaonon are the people of the living mountains. They protect the sacred Mount Kitanglad. They believe the trees are home to ancient spirits. Every year, they offer prayers for the forest and the animals.",
  },
  {
    day: 2,
    title: "The Wisdom of the Talaandig",
    story: "The Talaandig keep the traditions of the ancestors alive. They are masters of the soil and music. They teach the young ones how to play the bamboo flute. The sound of the flute travels across the green valleys.",
  },
  {
    day: 3,
    title: "The Manobo and the River Spirit",
    story: "The Manobo people live along the banks of the Pulangi River. They say a giant spirit protects the water. The river gives them fish to eat and water for their crops. They always respect the power of the flowing water.",
  },
  {
    day: 4,
    title: "The Matigsalug Weavers",
    story: "In the Salug River valley, the Matigsalug women weave beautiful mats. They use colorful grass to make patterns of the sun and stars. Each mat tells a story of their family and their land.",
  },
  {
    day: 5,
    title: "The Tigwahanon Watershed",
    story: "The Tigwahanon are the guardians of the watershed. They know that clean water starts in the mountain clouds. They plant new trees to keep the springs cold and fresh for everyone in Bukidnon.",
  },
  {
    day: 6,
    title: "The Bukidnon Tribe Harvest",
    story: "The Bukidnon tribe celebrates the harvest with a great dance. They wear colorful clothes and beat the drums loudly. They thank the earth for the corn and pineapples that grow in the fertile soil.",
  },
  {
    day: 7,
    title: "The Umayamnon Spirits",
    story: "The Umayamnon live near the Umayam River. They listen to the whispers of the wind in the trees. They believe that if we are kind to nature, nature will be kind to us. They are peaceful people of the forest.",
  },
  {
    day: 8,
    title: "The Meaning of Kaamulan",
    story: "Kaamulan is the gathering of the seven tribes. It is a time of unity and friendship. People from all over the world come to Malaybalay to see the beautiful dances and hear the ancient songs of Bukidnon.",
  },
  {
    day: 9,
    title: "The Guardian Eagle",
    story: "High above Mount Kitanglad, the Philippine Eagle flies. It is the king of the birds. It looks out for its family in the tall trees. We must protect the forest so the eagle will always have a home.",
  },
  {
    day: 10,
    title: "The Seven Jars of Peace",
    story: "Legend says the seven tribes once shared seven jars of peace. Inside each jar was a promise to protect the land. Today, the tribes still keep that promise. They work together to keep Bukidnon beautiful.",
  },
  {
    day: 11,
    title: "The Legend of the Pineapple",
    story: "A long time ago, a girl named Pina was very lazy. Her mother wished she had a hundred eyes to find her things. Pina turned into a fruit with many eyes. This is why the pineapple has so many eyes today.",
  },
  {
    day: 12,
    title: "The Young Forest Guardian",
    story: "A young boy from the mountains found a small tree that was dying. He gave it water every day. Years later, the tree grew tall and strong. He showed everyone that even one person can save a forest.",
  },
  {
    day: 13,
    title: "The Bridge of Clouds",
    story: "In Bukidnon, the morning clouds look like a bridge between the mountains. Elders say the spirits walk on these clouds to visit the tribes. It is a reminder that we are always connected to the sky.",
  },
  {
    day: 14,
    title: "The Mastery of the Tribes",
    story: "Now we have learned about all the Seven Tribes of Bukidnon. We are ready to be guardians of our culture. When we read and learn, we honor our ancestors and build a bright future for all.",
  },
];

const buildItems = (days: number, level: ResiliencePackResponse["level"], gap?: string) => {
  const exercises = [
    { exercise_type: "fill_blank" as const, instructions: "Fill in the missing word.", bank: ["tribe", "mountain", "river", "spirit", "peace"] },
    { exercise_type: "word_match" as const, instructions: "Match the word to the meaning.", bank: ["sacred", "ancient", "unity", "harvest", "wisdom"] },
    { exercise_type: "phonics_drill" as const, instructions: "Say the sound, then read the word.", bank: ["tribes", "kitanglad", "flute", "drums", "eagle"] },
    { exercise_type: "reread" as const, instructions: "Re-read the passage with good pacing.", bank: ["Read slowly", "Pause at dots", "Use emotion"] },
  ];

  const baseDifficulty =
    level === "Frustrational" ? 0 :
      level === "Instructional" ? 1 : 2;

  const items: ResiliencePackResponse["items"] = [];
  for (let d = 1; d <= days; d += 1) {
    const storyData = BUKIDNON_STORIES[(d - 1) % BUKIDNON_STORIES.length];
    const ex = pick(exercises, d - 1 + baseDifficulty);
    const title = storyData.title;

    // Level-specific passage adjustment (Simulated difficulty)
    let passage = storyData.story;
    if (level === "Frustrational") {
      // Shorter, simpler sentences
      passage = passage.split(". ").slice(0, 2).join(". ") + ".";
    } else if (level === "Instructional") {
      // Mix of simple and complex
      passage = passage;
    }

    const questions = [
      {
        q: `What is the main topic of today's story?`,
        choices: [storyData.title.split(" ").slice(-1)[0], "A robot", "A car", "A city"],
        answer: 0,
      },
      {
        q: `Where does this story take place?`,
        choices: ["Bukidnon mountains", "The moon", "Under the sea", "The desert"],
        answer: 0,
      },
      {
        q: `What is a good reading habit we learned today?`,
        choices: ["Pause and check meaning", "Skip all words", "Read too fast", "Close your eyes"],
        answer: 0,
      },
    ];

    items.push({
      day: d,
      title,
      passage,
      questions,
      exercise: {
        exercise_type: ex.exercise_type,
        instructions: ex.instructions,
        content: ex.bank.slice(0, 5),
      },
    });
  }
  return items;
};

export const createResiliencePackMock = (args: {
  days: number;
  level: ResiliencePackResponse["level"];
  gap?: string;
}): ResiliencePackResponse => {
  const days = clamp(args.days, 1, 14);
  return {
    days,
    level: args.level,
    items: buildItems(days, args.level, args.gap),
  };
};

