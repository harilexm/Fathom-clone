// Temporary, local UI fixtures. These shapes are designed to be replaced by owned meeting records later.
export type TranscriptTurn = { id: string; speaker: string; initials: string; color: string; time: string; text: string };
export type ActionItem = { id: string; text: string; owner: string; due: string; done: boolean };
export type Highlight = { id: string; title: string; time: string; kind: string };
export type Meeting = {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  attendees: string[];
  category: string;
  status: "Ready" | "Processing" | "Uploaded" | "Pending" | "Transcribing" | "Analyzing" | "Failed" | string;
  accent: string;
  summary: string;
  overview: string[];
  actions: ActionItem[];
  highlights: Highlight[];
  transcript: TranscriptTurn[];
  isDemo?: boolean;
  analysisStatus?: string;
  sonioxJobId?: string;
  summaryAvailable?: boolean;
  summaryVersion?: string;
  shareToken?: string;
};

const longSpeakers = [
  { name: "Olivia Chen", initials: "OC", color: "bg-[#283d61] text-[#c3d5ff]" },
  { name: "Marcus Lee", initials: "ML", color: "bg-[#214656] text-[#b8e7f2]" },
  { name: "Priya Shah", initials: "PS", color: "bg-[#4e3b2d] text-[#f7d5a7]" },
  { name: "Sam Rivera", initials: "SR", color: "bg-[#50372e] text-[#f4c6ae]" },
  { name: "Jordan Miller", initials: "JM", color: "bg-[#263f67] text-[#c2d8ff]" },
  { name: "Sofia Patel", initials: "SP", color: "bg-[#4e3243] text-[#f3c3d7]" },
  { name: "Alex Morgan", initials: "AM", color: "bg-[#214c4b] text-[#b4ebe4]" },
  { name: "Taylor Brooks", initials: "TB", color: "bg-[#39482c] text-[#d9eab5]" }
];

const longTopics = [
  "Let's look at the customer feedback and what it means for the next release. The main request is a clearer path from the first meeting to useful follow-up.",
  "I agree with the direction. The most common friction is finding the right part of a conversation when several teams are involved.",
  "We can simplify the first screen and leave the detailed controls for the workspace. That should make the next action feel obvious.",
  "One thing to keep in mind is how this reads on smaller screens. People often review notes on a laptop while another call is open.",
  "The rollout should start with a small group so we can see where the workflow feels slow before opening it to everyone.",
  "I'll capture the open questions and make sure each one has an owner before the next review."
];

function sampleTimestamp(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return [hours, minutes, remaining].map((part) => String(part).padStart(2, "0")).join(":");
}

const longMeeting: Meeting = {
  id: "quarterly-planning-workshop",
  title: "Quarterly planning workshop: customer experience and launch",
  date: "Thursday, Sep 18",
  time: "1:00 PM",
  duration: "1 hr 24 min",
  attendees: longSpeakers.map((speaker) => speaker.name),
  category: "Planning",
  status: "Ready",
  accent: "violet",
  summary: "Eight teammates reviewed customer feedback, narrowed the next release to a simpler first-run journey, and assigned owners for rollout, measurement, and documentation.",
  overview: [
    "The team agreed to simplify the first-run journey and keep detailed controls inside the workspace.",
    "A small rollout will help identify friction before the wider release.",
    "Owners will return with updated designs, metrics, and documentation at the next review."
  ],
  actions: [
    { id: "la1", text: "Update first-run designs", owner: "Olivia", due: "Sep 29", done: false },
    { id: "la2", text: "Review activation metrics", owner: "Marcus", due: "Sep 30", done: false },
    { id: "la3", text: "Prepare rollout cohort", owner: "Priya", due: "Oct 1", done: false },
    { id: "la4", text: "Audit small-screen layouts", owner: "Sam", due: "Oct 1", done: false },
    { id: "la5", text: "Compile customer questions", owner: "Jordan", due: "Oct 2", done: false },
    { id: "la6", text: "Draft release documentation", owner: "Sofia", due: "Oct 3", done: false },
    { id: "la7", text: "Confirm launch readiness", owner: "Alex", due: "Oct 4", done: false },
    { id: "la8", text: "Schedule next review", owner: "Taylor", due: "Oct 4", done: true }
  ],
  highlights: [
    { id: "lh1", title: "Customer feedback themes", time: "00:08:10", kind: "Customer insight" },
    { id: "lh2", title: "First-run experience decision", time: "00:24:35", kind: "Decision" },
    { id: "lh3", title: "Small-screen design review", time: "00:38:12", kind: "Feedback" },
    { id: "lh4", title: "Rollout cohort", time: "00:52:18", kind: "Plan" },
    { id: "lh5", title: "Launch metrics", time: "01:06:42", kind: "Key moment" },
    { id: "lh6", title: "Owners and next review", time: "01:19:04", kind: "Follow-up" }
  ],
  transcript: Array.from({ length: 72 }, (_, index) => {
    const speaker = longSpeakers[index % longSpeakers.length];
    return {
      id: "long-turn-" + index,
      speaker: speaker.name,
      initials: speaker.initials,
      color: speaker.color,
      time: sampleTimestamp(index * 70 + 12),
      text: longTopics[index % longTopics.length]
    };
  })
};

export const meetings: Meeting[] = [
  {
    id: "product-weekly-sync", title: "Product weekly sync", date: "Today, Sep 24", time: "10:30 AM",
    duration: "42 min", attendees: ["Olivia Chen", "Marcus Lee", "Priya Shah", "You"], category: "Internal",
    status: "Ready", accent: "violet",
    summary: "The team aligned on the October release scope, agreed to simplify onboarding, and set owners for the remaining launch decisions.",
    overview: [
      "The October release will focus on a clearer first-run experience and faster time to first value.",
      "The team agreed to move advanced workspace settings out of the initial onboarding flow.",
      "Design will share an updated prototype before Friday's stakeholder review."
    ],
    actions: [
      { id: "a1", text: "Share revised onboarding prototype with the team", owner: "Olivia", due: "Sep 26", done: false },
      { id: "a2", text: "Confirm launch metrics with analytics", owner: "Marcus", due: "Sep 27", done: false },
      { id: "a3", text: "Draft release notes for stakeholder review", owner: "Priya", due: "Sep 29", done: true }
    ],
    highlights: [
      { id: "h1", title: "Decision: simplify onboarding", time: "08:42", kind: "Decision" },
      { id: "h2", title: "October launch scope", time: "19:14", kind: "Key moment" },
      { id: "h3", title: "Next steps and owners", time: "35:06", kind: "Follow-up" }
    ],
    transcript: [
      { id: "t1", speaker: "Olivia Chen", initials: "OC", color: "bg-[#283d61] text-[#c3d5ff]", time: "00:12", text: "Thanks for joining. I want to use today to get really clear on what needs to be in the October release and what can wait." },
      { id: "t2", speaker: "Marcus Lee", initials: "ML", color: "bg-[#214656] text-[#b8e7f2]", time: "01:24", text: "Looking at the activation data, the biggest opportunity is still that first session. People are getting stuck before they reach their first useful result." },
      { id: "t3", speaker: "Priya Shah", initials: "PS", color: "bg-[#4e3b2d] text-[#f7d5a7]", time: "03:18", text: "That lines up with the interviews. We should show the core value first, then introduce the workspace settings after they've explored a little." },
      { id: "t4", speaker: "Olivia Chen", initials: "OC", color: "bg-[#283d61] text-[#c3d5ff]", time: "08:42", text: "Let's make that the decision: keep onboarding simple and move advanced settings into the workspace. I'll update the prototype for Friday." },
      { id: "t5", speaker: "Marcus Lee", initials: "ML", color: "bg-[#214656] text-[#b8e7f2]", time: "19:14", text: "For the launch, we can measure the percentage of new users who get to a first useful result in their first visit." },
      { id: "t6", speaker: "Priya Shah", initials: "PS", color: "bg-[#4e3b2d] text-[#f7d5a7]", time: "35:06", text: "I'll put together the release notes. Marcus, can you confirm the metrics? That gives us everything for the stakeholder review." }
    ]
  },
  {
    id: "acme-discovery-call", title: "Acme × Discovery call", date: "Yesterday, Sep 23", time: "2:00 PM",
    duration: "36 min", attendees: ["Jordan Miller", "Sofia Patel", "You"], category: "Customer", status: "Ready", accent: "blue",
    summary: "Acme wants a simpler way to share meeting outcomes across teams and asked for a follow-up on security and rollout.",
    overview: ["Acme is evaluating a shared meeting knowledge workflow.", "The next conversation will cover security and rollout requirements."],
    actions: [{ id: "a4", text: "Send security overview to Acme", owner: "You", due: "Sep 26", done: false }],
    highlights: [{ id: "h4", title: "Customer rollout requirements", time: "14:22", kind: "Customer insight" }],
    transcript: [{ id: "t7", speaker: "Jordan Miller", initials: "JM", color: "bg-[#263f67] text-[#c2d8ff]", time: "00:18", text: "We'd like meeting outcomes to be easier for the whole team to find and act on." }]
  },
  {
    id: "design-review", title: "Design review: workspace", date: "Monday, Sep 22", time: "11:00 AM",
    duration: "51 min", attendees: ["Olivia Chen", "Sam Rivera", "You"], category: "Internal", status: "Ready", accent: "peach",
    summary: "The team reviewed the new workspace direction and prioritized clarity in the transcript and summary views.",
    overview: ["The new workspace direction was reviewed.", "Clarity in transcript and summary views is the top design priority."],
    actions: [{ id: "a5", text: "Revise transcript interaction states", owner: "Sam", due: "Sep 29", done: false }],
    highlights: [{ id: "h5", title: "Transcript design feedback", time: "22:10", kind: "Feedback" }],
    transcript: [{ id: "t8", speaker: "Sam Rivera", initials: "SR", color: "bg-[#50372e] text-[#f4c6ae]", time: "00:25", text: "Let's start with how someone finds the most important parts of a long conversation." }]
  },
  {
    id: "q4-planning", title: "Q4 planning kickoff", date: "Friday, Sep 19", time: "9:30 AM",
    duration: "58 min", attendees: ["Marcus Lee", "Priya Shah", "You"], category: "Planning", status: "Ready", accent: "green",
    summary: "The team outlined Q4 priorities and agreed to refine milestones after collecting customer feedback.",
    overview: ["Q4 priorities were outlined.", "Milestones will be refined after customer feedback."],
    actions: [{ id: "a6", text: "Collect customer input for planning", owner: "Priya", due: "Oct 1", done: false }],
    highlights: [{ id: "h6", title: "Q4 priority discussion", time: "28:03", kind: "Key moment" }],
    transcript: [{ id: "t9", speaker: "Marcus Lee", initials: "ML", color: "bg-[#214656] text-[#b8e7f2]", time: "00:08", text: "Let's outline the priorities and leave room to adjust after customer feedback." }]
  },
  longMeeting
];

export const findMeeting = (id: string) => meetings.find((meeting) => meeting.id === id);
