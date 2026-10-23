export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="16" r="10" />
      <circle cx="12" cy="16" r="2.6" fill="currentColor" stroke="none" />
      <path d="M8.8 21.54 A6.4 6.4 0 0 1 6.76 12.33" />
      <path d="M18 4h7v7" />
      <path d="M25 4l-8 8" />
    </svg>
  );
}
