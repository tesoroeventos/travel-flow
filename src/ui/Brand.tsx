import Link from "next/link";

/** Marca: punto · tramo punteado · punto, y el nombre. */
export function Brand({ className = "", size = "md" }: { className?: string; size?: "md" | "lg" }) {
  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 font-display font-extrabold tracking-tight text-ink ${size === "lg" ? "text-4xl" : "text-xl"} ${className}`}
    >
      <span className="flex items-center gap-[3px] text-route" aria-hidden>
        <i className="block size-[7px] rounded-full bg-current" />
        <b className="block h-[2px] w-4 bg-[repeating-linear-gradient(90deg,currentColor_0_4px,transparent_4px_7px)]" />
        <i className="block size-[7px] rounded-full bg-current" />
      </span>
      TravelFlow
    </Link>
  );
}
