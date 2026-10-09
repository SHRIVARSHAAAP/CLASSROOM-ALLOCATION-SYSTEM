import { Building2 } from "lucide-react";
export function Logo() {
  return (
    <span className="project-logo" aria-label="Smart Campus project mark">
      <Building2 size={30} strokeWidth={1.7} />
    </span>
  );
}
export function CampusArt() {
  return (
    <svg
      className="campus-art"
      viewBox="0 0 640 410"
      role="img"
      aria-label="Illustrative college buildings on a blue ellipse"
    >
      <defs>
        <linearGradient id="ellipse" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#1B3A82" />
          <stop offset="1" stopColor="#4A6A9E" />
        </linearGradient>
      </defs>
      <ellipse cx="320" cy="290" rx="299" ry="114" fill="url(#ellipse)" />
      <path d="M65 292L320 175L584 295L323 390z" fill="#b7d0f0" />
      <path d="M176 210l146-71 152 70-147 73z" fill="#fff" />
      <path d="M176 210v65l151 74v-67z" fill="#dce7f8" />
      <path d="M327 282l147-73v66l-147 74z" fill="#9cbce5" />
      <path d="M239 157V92l82-41 86 41v65l-86 42z" fill="#e8f0fc" />
      <path d="M239 92l82 42 86-42-86-41z" fill="#7c9fcf" />
      <path d="M321 134v65l86-42V92z" fill="#afc8e9" />
      <g fill="#1B3A82">
        {[0, 1, 2, 3].map((i) => (
          <path
            key={"l" + i}
            d={`M${194 + i * 34} ${229 + i * 17}l17 8v23l-17-8z`}
          />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <path
            key={"r" + i}
            d={`M${345 + i * 31} ${286 - i * 15}l17-8v23l-17 8z`}
          />
        ))}
        <path d="M261 112l16 8v20l-16-8zM290 127l16 8v20l-16-8zM343 144l16-8v20l-16 8zM374 129l16-8v20l-16 8z" />
      </g>
      <path d="M321 51V16" stroke="#4A6A9E" strokeWidth="3" />
      <path d="M323 17h36l-9 9 9 9h-36z" fill="#0E7C7B" />
      <g fill="#0e7c7b">
        <ellipse cx="129" cy="240" rx="17" ry="28" />
        <ellipse cx="501" cy="213" rx="20" ry="31" />
        <ellipse cx="549" cy="260" rx="16" ry="26" />
      </g>
      <g stroke="#466995" strokeWidth="5">
        <path d="M129 254v30M501 230v33M549 276v22" />
      </g>
    </svg>
  );
}
