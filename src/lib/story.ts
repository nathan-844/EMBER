/**
 * The site reads as one story in five steps. The navigation, the bar at the top of each page and
 * the "next" card at the bottom are all drawn from this list, so they cannot disagree.
 */
export type StoryRoute = "home" | "lab" | "findings" | "mission" | "credibility" | "data";

export interface StoryStep {
  route: StoryRoute;
  /** Short name used in the navigation. */
  label: string;
  /** What the step is, in a few words, under the label. */
  hint: string;
  /** One sentence in plain words, shown at the top of the page. */
  plain: string;
}

export const STORY: StoryStep[] = [
  { route: "home", label: "The question", hint: "Why this matters", plain: "Crews on the Moon may breathe air much richer in oxygen than on Earth. Fire behaves differently there, so what has NASA actually tested?" },
  { route: "lab", label: "The answer", hint: "Pick a habitat", plain: "Pick a habitat. EMBER shows which NASA fire experiments match its air and gravity, and where the tests stop." },
  { route: "findings", label: "What NASA measured", hint: "Eight results", plain: "Eight results worked out by code from NASA's own test tables. No AI wrote any of them." },
  { route: "mission", label: "Move to the Moon", hint: "Compare two atmospheres", plain: "Take one material from the Space Station's air to a Moon base's air and see which NASA tests still apply." },
  { route: "credibility", label: "Check our work", hint: "How we know", plain: "Every check EMBER runs on itself, how well its AI scored, and what it does not claim." },
];

/** The raw data sits beside the story rather than in it. */
export const DATA_STEP: StoryStep = { route: "data", label: "The raw data", hint: "Every NASA row", plain: "Every NASA test row in one table, each value traced to the cell it came from, with the problems found in NASA's files." };

export interface StoryNext { href: string; eyebrow: string; title: string; action: string }

const NEXT: Record<StoryRoute, StoryNext> = {
  home: { href: "#lab", eyebrow: "Next · step 2 of 5", title: "See what NASA has tested for a Moon habitat.", action: "See the answer" },
  lab: { href: "#findings", eyebrow: "Next · step 3 of 5", title: "See what NASA's measurements show when a fire does start.", action: "What NASA measured" },
  findings: { href: "#mission", eyebrow: "Next · step 4 of 5", title: "Take a cabin material from the Space Station to the Moon.", action: "Move to the Moon" },
  mission: { href: "#credibility", eyebrow: "Next · step 5 of 5", title: "Do not take our word for it. See every check, and every failure.", action: "Check our work" },
  credibility: { href: "#data", eyebrow: "Beyond the story", title: "Browse every NASA test row yourself, and download it.", action: "Open the raw data" },
  data: { href: "#lab", eyebrow: "Back to the story", title: "Try another habitat and see how the evidence changes.", action: "Pick a habitat" },
};

export function storyIndex(route: StoryRoute): number {
  return STORY.findIndex((s) => s.route === route);
}

export function storyStep(route: StoryRoute): StoryStep {
  return route === "data" ? DATA_STEP : STORY[storyIndex(route)];
}

export function storyNext(route: StoryRoute): StoryNext {
  return NEXT[route];
}
