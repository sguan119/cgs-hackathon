'use client';

type Props = {
  text: string;
  partial: boolean;
};

export function FellowVoiceColumn({ text, partial }: Props) {
  return (
    <aside className={`recall-fellow-voice${partial ? ' partial' : ''} fade-in`}>
      <div className="recall-fellow-label">Fellow voice</div>
      <div className="recall-fellow-body">{text}</div>
    </aside>
  );
}
