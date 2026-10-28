/** Trunk's small original elephant. Decorative; carries no information. */
export function Mascot({ size = 40 }: { size?: number }) {
  return (
    <svg className="mascot" width={size} height={size * 0.875} viewBox="0 0 64 56" aria-hidden="true" focusable="false">
      <path d="M8 38c0-12 9-20 21-20h8c2.8 0 5 2.2 5 5v17c0 3-2.2 5-5 5h-1v6h-6v-6h-9v6h-6v-6.6C10 42.6 8 40.5 8 38z" fill="#7f9cc6" />
      <circle cx="44" cy="24" r="12" fill="#7f9cc6" />
      <path d="M33.5 15c-6.5 0-10 5.5-10 11.5S27.5 37 33.5 37c3 0 5-2.2 5-5V20c0-2.8-2.2-5-5-5z" fill="#b9cbe6" />
      <path d="M54.5 27c3.4 2.4 4.4 6.6 3.2 10.4-1.1 3.6-4.4 5.4-7.4 4.4" fill="none" stroke="#7f9cc6" strokeWidth="5" strokeLinecap="round" />
      <circle cx="47.5" cy="21" r="1.8" fill="#16332a" />
      <path d="M49.6 41.4c-1.6-2.6-.6-5.6 2.2-6.6.9 2.9-.2 5.6-2.2 6.6z" fill="#3f8a5f" />
    </svg>
  );
}
