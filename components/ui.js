export function Board({ size = 32 }) {
  const segs = 20;
  const r = size / 2;
  const els = [];
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * 2 * Math.PI - Math.PI / 2 - Math.PI / segs;
    const a1 = ((i + 1) / segs) * 2 * Math.PI - Math.PI / 2 - Math.PI / segs;
    const x0 = r + r * Math.cos(a0);
    const y0 = r + r * Math.sin(a0);
    const x1 = r + r * Math.cos(a1);
    const y1 = r + r * Math.sin(a1);
    els.push(
      <path
        key={i}
        d={`M${r},${r} L${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1} Z`}
        fill={i % 2 ? "#1c1c1c" : "#efe9d8"}
      />
    );
    const xm = r + r * 0.74 * Math.cos((a0 + a1) / 2);
    const ym = r + r * 0.74 * Math.sin((a0 + a1) / 2);
    els.push(
      <circle key={"b" + i} cx={xm} cy={ym} r={r * 0.07} fill={i % 2 ? "#e03a3a" : "#0e8c5a"} />
    );
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {els}
      <circle cx={r} cy={r} r={r * 0.16} fill="#0e8c5a" />
      <circle cx={r} cy={r} r={r * 0.07} fill="#e03a3a" />
    </svg>
  );
}

export function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="num">{value}</div>
      <div className="tag" style={{ marginTop: 3 }}>
        {label}
      </div>
    </div>
  );
}

export function Mini({ label, value }) {
  return (
    <div className="mini">
      <div className="num">{value}</div>
      <div className="tag" style={{ marginTop: 2, fontSize: 10 }}>
        {label}
      </div>
    </div>
  );
}

export function BackBar({ back, title }) {
  return (
    <div className="row" style={{ alignItems: "center", marginBottom: 16 }}>
      <button className="btn" style={{ padding: "8px 12px" }} onClick={back}>
        ‹
      </button>
      <div className="display" style={{ fontSize: 19 }}>
        {title}
      </div>
    </div>
  );
}

export function Modal({ children }) {
  return (
    <div className="modal-backdrop">
      <div className="modal fade">{children}</div>
    </div>
  );
}
