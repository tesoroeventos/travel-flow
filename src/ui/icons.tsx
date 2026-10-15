const PATHS = {
  plane:
    "M10.5 13.5 3 11l1.5-1.5 7.5 1 4-4.5c1-1 2.6-1.4 3.3-.7s.3 2.3-.7 3.3l-4.5 4 1 7.5L13.6 21l-2.5-7.5M6 17l2.5-1 1 1-1 2.5",
  bus: "M7 3h10a3 3 0 0 1 3 3v12H4V6a3 3 0 0 1 3-3zM4 11h16M8 21v-3M16 21v-3M8 14.5h.01M16 14.5h.01",
  train:
    "M8 3h8a3 3 0 0 1 3 3v11H5V6a3 3 0 0 1 3-3zM5 10h14M9 21l2-4M15 21l-2-4M9 13.5h.01M15 13.5h.01",
  car: "M5 16H3v-4l2-5h11l3 5h2v4h-2M9.5 16.5h5M5 12h14M7.5 18.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16.5 18.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  key: "M8 19a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM11 12l9-9M17 6l3 3M15 8l2 2",
  bed: "M3 19V6M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6M7 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  ticket: "M3 10a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V6H3zM14 8v10",
  upload: "M12 15V4M7 9l5-5 5 5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  alert: "M12 3 2 20h20zM12 10v4M12 17h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
  plus: "M12 5v14M5 12h14",
  check: "m5 12 5 5 9-10",
  arrow: "M5 12h14M13 6l6 6-6 6",
  clock: "M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2M10 2h4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className = "size-5",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
