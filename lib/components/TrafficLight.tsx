'use client';

type TrafficColor = 'red' | 'yellow' | 'green';
type TrafficSize = 'sm' | 'md';

type Props = {
  color: TrafficColor;
  label?: string;
  size?: TrafficSize;
};

export function TrafficLight({ color, label, size = 'md' }: Props) {
  return (
    <span className={`traffic-light ${color} ${size}`} role="status">
      <span className="dot" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}
