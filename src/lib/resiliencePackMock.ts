import type { ResiliencePackResponse } from "@/lib/kinaiyaApi";

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const pick = <T>(arr: T[], idx: number) => arr[idx % arr.length];

const BUKIDNON_STORIES = [
  {
    day: 1,
    title: "The Higaonon of Mount Kitanglad",
    story:
      "The Higaonon people are known as the guardians of Mount Kitanglad. They believe the mountain is sacred and that ancient spirits live among its trees. For generations, they have performed rituals to honor the forest and keep it healthy. Their deep respect for nature shows us that protecting the environment is not just a duty — it is a way of life passed down through their ancestors.",
  },
  {
    day: 2,
    title: "The Wisdom of the Talaandig",
    story:
      "The Talaandig people are skilled farmers and musicians who have preserved their traditions for hundreds of years. They craft beautiful bamboo flutes that produce melodies telling the stories of their community. Their music is passed from parents to children without written notes, relying only on memory and practice. This teaches us that knowledge can be carried in many forms beyond books and classrooms.",
  },
  {
    day: 3,
    title: "The Manobo and the River Spirit",
    story:
      "The Manobo people live along the banks of the Pulangi River in Bukidnon. They believe that a powerful spirit watches over the river and keeps it clean and abundant. In return, the Manobo treat the river with great care, never taking more than what they need. Their relationship with the river teaches an important lesson: when we respect nature, nature takes care of us.",
  },
  {
    day: 4,
    title: "The Matigsalug Weavers",
    story:
      "In the Salug River valley, Matigsalug women are known for their beautiful woven mats and fabrics. Using colorful grasses and threads, they create patterns that tell the story of their family and community. Each design has a meaning that only the weavers fully understand. Their craft is a form of living history — a record of who they are and where they come from.",
  },
  {
    day: 5,
    title: "The Tigwahanon Watershed",
    story:
      "The Tigwahanon people are the protectors of Bukidnon's mountain springs and rivers. They plant trees along the hillsides to prevent soil erosion and keep the water supply clean. Their knowledge of the land has been built over many generations of careful observation. Today, environmental scientists work with the Tigwahanon to learn their methods and apply them to wider conservation efforts.",
  },
  {
    day: 6,
    title: "The Bukidnon Tribe Harvest",
    story:
      "Every harvest season, the Bukidnon tribe celebrates with a grand festival of music, dance, and thanksgiving. They wear colorful traditional costumes and beat large drums to express their gratitude for the bounty of the land. The fertile volcanic soil of Bukidnon produces corn and pineapples that feed thousands of families across the country. To the Bukidnon people, the land is not just property — it is a sacred gift.",
  },
  {
    day: 7,
    title: "The Umayamnon Spirits",
    story:
      "The Umayamnon people live near the Umayam River and are known for their peaceful way of life. They believe the wind carries messages from their ancestors, reminding the living to treat the earth with kindness. Their oral traditions warn against cutting too many trees or polluting the rivers. These stories have served as environmental guidelines long before modern conservation laws were written.",
  },
  {
    day: 8,
    title: "The Meaning of Kaamulan",
    story:
      "Kaamulan is the biggest cultural festival in Bukidnon, bringing all seven indigenous tribes together in celebration. The word means 'gathering of the tribes.' During the festival, people perform traditional dances, sing ancient songs, and display their finest crafts. Visitors from across the Philippines and around the world attend Kaamulan to witness this powerful display of unity, identity, and cultural pride.",
  },
  {
    day: 9,
    title: "The Guardian Eagle",
    story:
      "The Philippine Eagle is the national bird of the Philippines and one of the largest eagles in the world. It makes its home in the forests of Mount Kitanglad in Bukidnon. The eagle depends on healthy, old-growth forests to survive and raise its young. Protecting the eagle means protecting the entire forest ecosystem. Indigenous communities have always been its most dedicated guardians.",
  },
  {
    day: 10,
    title: "The Seven Jars of Peace",
    story:
      "An ancient legend of Bukidnon tells of seven jars of peace shared among the seven tribes. Inside each jar was a solemn promise: to settle disputes through dialogue, share resources fairly, and protect the land together. This story is still retold at tribal gatherings as a reminder that unity is stronger than division. It shows that the wisest leaders choose cooperation over conflict.",
  },
  {
    day: 11,
    title: "The Legend of the Pineapple",
    story:
      "One of the most famous Philippine legends tells of a lazy girl named Pina who refused to help her mother with chores. One day, her frustrated mother wished she had a hundred eyes so she could find things on her own. As a lesson, Pina was transformed into a pineapple — a fruit with many eyes on its surface. This story teaches children the importance of being helpful and responsible at home.",
  },
  {
    day: 12,
    title: "The Young Forest Guardian",
    story:
      "A young boy from the Bukidnon mountains once found a small dying tree near his home. He gave it water every day, protected it from being cut, and cleared the weeds around it. Years later, that tree grew tall and strong, providing shade and fruit for the whole community. His story reminds us that even one person's small, consistent action can make a big difference in the world.",
  },
  {
    day: 13,
    title: "The Bridge of Clouds",
    story:
      "In Bukidnon, clouds often form low bridges between mountain peaks during the early morning hours. The elders of the tribe say these clouds are the paths taken by ancestor spirits when they visit the living. This belief encourages the people to live wisely, knowing that their actions are always being observed. It also reminds them that they are part of a long and continuous chain of generations.",
  },
  {
    day: 14,
    title: "The Mastery of the Tribes",
    story:
      "After two weeks of reading about the seven tribes of Bukidnon, we have learned that culture, nature, and community are deeply connected. Each tribe has its own story, its own gifts, and its own responsibilities. Their traditions remind us that the most important things in life — family, land, and identity — must be protected and passed on. Now it is our turn to carry these lessons forward.",
  },
];

const buildItems = (
  days: number,
  level: ResiliencePackResponse["level"],
  gap?: string,
) => {
  const exercises = [
    {
      exercise_type: "fill_blank" as const,
      instructions: "Fill in the missing word from the passage.",
      bank: ["highlands", "watershed", "tradition", "community", "ancestors"],
    },
    {
      exercise_type: "word_match" as const,
      instructions: "Match the word to its meaning.",
      bank: ["stewardship", "conservation", "indigenous", "fertile", "sacred"],
    },
    {
      exercise_type: "phonics_drill" as const,
      instructions: "Read each word aloud and use it in a sentence.",
      bank: ["highland", "plateau", "harvest", "festival", "guardian"],
    },
    {
      exercise_type: "reread" as const,
      instructions: "Re-read the passage with good pacing and expression.",
      bank: [
        "Pause at commas and periods",
        "Emphasize important words",
        "Read with feeling",
      ],
    },
  ];

  const baseDifficulty =
    level === "Frustrational" ? 0 : level === "Instructional" ? 1 : 2;

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
        choices: [
          "Nature and community in Bukidnon",
          "A robot",
          "A city",
          "A sport",
        ],
        answer: 0,
      },
      {
        q: `What does the story teach us about people and the environment?`,
        choices: [
          "We should care for and protect the environment",
          "We should cut down all trees",
          "Nature is not important",
          "Only scientists can protect nature",
        ],
        answer: 0,
      },
      {
        q: `What is a good reading habit to use when you meet a difficult word?`,
        choices: [
          "Use context clues from the surrounding sentences",
          "Skip the word and keep reading",
          "Stop reading immediately",
          "Guess randomly",
        ],
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
