import { useLayoutEffect, useRef } from 'react';
import type { TranscriptSegment } from '../../transcription/types';

export function Transcript({ segments, textSize }: { segments: readonly TranscriptSegment[]; textSize: number }) {
  const viewport = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (element && following.current) element.scrollTop = element.scrollHeight;
  }, [segments, textSize]);

  return <div className="transcript-area">
    <div className="transcript" ref={viewport} role="region" aria-label="Live transcript" tabIndex={0}
      style={{ fontSize: `${textSize / 16}rem` }} onScroll={() => {
        const element = viewport.current;
        if (!element) return;
        following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64;
      }}>
      {segments.length === 0 ? <div className="empty-state">
        <p>Tap Listen to start.</p>
      </div> : <div className="transcript-text">
        {segments.map((segment) => <p key={segment.id} className={segment.isFinal ? 'confirmed' : 'interim'}>
          {segment.text}{!segment.isFinal && <span className="sr-only"> Unconfirmed</span>}
        </p>)}
      </div>}
    </div>
  </div>;
}
