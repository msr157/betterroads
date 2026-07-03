/**
 * Flag of India — three horizontal bands (saffron / white / green)
 * with the navy Ashoka Chakra. 3:2 ratio — use matching w/h classes.
 */
export default function Flag({ className = '', style }: { className?: string, style?: React.CSSProperties }) {
  const cx = 45, cy = 30, r = 8;
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 15 * Math.PI) / 180;
    return { x2: cx + Math.cos(a) * r, y2: cy + Math.sin(a) * r };
  });

  return (
    <svg viewBox="0 0 90 60" className={className} style={style} aria-hidden>
      <rect x="0" y="0" width="90" height="20" fill="#FF9933" />
      <rect x="0" y="20" width="90" height="20" fill="#FFFFFF" />
      <rect x="0" y="40" width="90" height="20" fill="#138808" />
      <g stroke="#000080" strokeWidth="0.7" fill="none">
        <circle cx={cx} cy={cy} r={r} />
        {spokes.map((s, i) => (
          <line key={i} x1={cx} y1={cy} x2={s.x2} y2={s.y2} />
        ))}
      </g>
      <circle cx={cx} cy={cy} r="1.6" fill="#000080" />
      <rect x="0.5" y="0.5" width="89" height="59" fill="none" stroke="rgba(0,0,0,0.14)" strokeWidth="1" />
    </svg>
  );
}
