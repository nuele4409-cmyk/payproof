import Link from "next/link";

const VARIANTS = {
  primary: "bg-bottle text-paper hover:bg-bottle-dark",
  secondary: "border border-ink/15 bg-transparent text-ink hover:bg-ink/5",
  destructive: "bg-rust text-paper hover:bg-rust/90",
  ghost: "text-bottle hover:bg-bottle/10",
};

const SIZES = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-12 px-6 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  href,
  className = "",
  children,
  ...props
}) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}
