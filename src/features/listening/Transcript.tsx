import { useLayoutEffect, useRef } from 'react';
import type { TranscriptSegment } from '../../transcription/types';
import { speakerColour, unknownColour } from '../speakers/colours';

export function Caption({ segment, showName = true }: { segment: TranscriptSegment; showName?: boolean }) {
  const known = Boolean(segment.speakerId?.trim() && segment.speakerName?.trim());
  return <div className="caption" style={{ color: known ? speakerColour(segment.speakerId!) : unknownColour }}>
    {showName && <span className="caption-speaker">{known ? `${segment.speakerName}${segment.speakerEstimated ? ' (estimate)' : ''}` : 'Unknown speaker'}</span>}
    <p className={segment.isFinal ? 'confirmed' : 'interim'}>
      {segment.text}{!segment.isFinal && <span className="sr-only"> Unconfirmed</span>}
    </p>
  </div>;
}

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
        {segments.map((segment, index) => <Caption key={segment.id} segment={segment}
          showName={index === 0 || segment.speakerId !== segments[index - 1]?.speakerId || segment.speakerName !== segments[index - 1]?.speakerName} />)}
      </div>}
    </div>
  </div>;
}
