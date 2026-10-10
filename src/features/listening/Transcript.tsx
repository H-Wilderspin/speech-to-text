import { useLayoutEffect, useRef, useState } from 'react';
import type { TranscriptSegment } from '../../transcription/types';

export function Transcript({ segments, textSize }: { segments: readonly TranscriptSegment[]; textSize: number }) {
  const viewport = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [showNewest, setShowNewest] = useState(false);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (element && following.current) element.scrollTop = element.scrollHeight;
  }, [segments, textSize]);

  const goToNewest = () => {
    const element = viewport.current;
    if (element) element.scrollTop = element.scrollHeight;
    following.current = true;
    setShowNewest(false);
    element?.focus({ preventScroll: true });
  };

  return <div className="transcript-area">
    <div className="transcript" ref={viewport} role="region" aria-label="Live transcript" tabIndex={0}
      style={{ fontSize: `${textSize / 16}rem` }} onScroll={() => {
        const element = viewport.current;
        if (!element) return;
        following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64;
        setShowNewest(!following.current);
      }}>
      {segments.length === 0 ? <div className="empty-state">
        <span className="eyebrow">A little closer to the conversation</span>
        <h2>Let’s hear it.</h2>
        <p>Tap Listen and the words<br className="wide-only" /> will appear here.</p>
      </div> : <div className="transcript-text">
        <span className="speaker-label">Unknown speaker · anonymous listening</span>
        {segments.map((segment) => <p key={segment.id} className={segment.isFinal ? 'confirmed' : 'interim'}>
          {segment.text}{!segment.isFinal && <span className="provisional"> Unconfirmed</span>}
        </p>)}
      </div>}
    </div>
    {showNewest && <button className="newest" onClick={goToNewest}>↓ Newest speech</button>}
  </div>;
}
