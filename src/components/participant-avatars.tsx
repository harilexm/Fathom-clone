type ParticipantAvatarsProps = {
  people: string[];
  maxVisible?: number;
};

const colors = [
  "bg-[#0e1a2b] text-[#93c5fd]",
  "bg-[#0c2229] text-[#7dd3fc]",
  "bg-[#141b26] text-[#cbd5e1]",
  "bg-[#0e2118] text-[#86efac]"
];

export function ParticipantAvatars({ people, maxVisible = 3 }: ParticipantAvatarsProps) {
  const visible = people.slice(0, maxVisible);
  const remaining = people.length - visible.length;

  return (
    <div role="group" className="flex shrink-0 -space-x-1.5" aria-label={people.length + " participants"}>
      {visible.map((name, index) => (
        <span
          key={name}
          title={name}
          className={"flex h-6 w-6 items-center justify-center rounded-full border border-[#070a10] text-[8.5px] font-bold " + colors[index % colors.length]}
        >
          {name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
        </span>
      ))}
      {remaining > 0 && (
        <span
          title={remaining + " more participants"}
          className="flex h-6 min-w-6 items-center justify-center rounded-full border border-[#070a10] bg-[#111824] px-1 text-[8.5px] font-bold text-[#8fa0b5]"
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}
