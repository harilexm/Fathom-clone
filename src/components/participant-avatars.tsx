type ParticipantAvatarsProps = {
  people: string[];
  maxVisible?: number;
};

const colors = [
  "bg-[#283d61] text-[#c3d5ff]",
  "bg-[#214656] text-[#b8e7f2]",
  "bg-[#4e3b2d] text-[#f7d5a7]",
  "bg-[#28473b] text-[#b9ead2]"
];

export function ParticipantAvatars({ people, maxVisible = 3 }: ParticipantAvatarsProps) {
  const visible = people.slice(0, maxVisible);
  const remaining = people.length - visible.length;

  return (
    <div role="group" className="flex shrink-0 -space-x-2" aria-label={people.length + " participants"}>
      {visible.map((name, index) => (
        <span
          key={name}
          title={name}
          className={"flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#111a26] text-[9px] font-bold " + colors[index % colors.length]}
        >
          {name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
        </span>
      ))}
      {remaining > 0 && (
        <span
          title={remaining + " more participants"}
          className="flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-[#2a3a4d] px-1 text-[9px] font-bold text-muted"
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}
