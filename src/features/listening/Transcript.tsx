import { useLayoutEffect, useMemo, useRef } from 'react';
import { formatCaptionSegments } from './caption-format';
import type { TranscriptSegment } from '../../transcription/types';

export function Transcript({ segments, textSize, language = 'en-GB' }: {
  segments: readonly TranscriptSegment[]; textSize: number; language?: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  useLayoutEffect(() => {
    if (segments.length === 0) following.current = true;
    const element = viewport.current;
    if (element && following.current) element.scrollTop = element.scrollHeight;
  }, [segments, textSize]);

  const formatted = useMemo(() => formatCaptionSegments(segments, language), [segments, language]);
  return <section className="transcript-area" aria-label="Live captions">
    <h2 className="pane-title">Live</h2>
    <div className="transcript" ref={viewport} role="region" aria-label="Live transcript" tabIndex={0}
      style={{ fontSize: `${textSize / 16}rem` }} onScroll={() => {
        const element = viewport.current;
        if (element) following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64;
      }}>
      {formatted.length === 0 ? <div className="empty-state"><p>Tap Listen to start.</p></div>
        : <div className="transcript-text">{formatted.map((segment) =>
          <div className="caption" key={segment.id} data-session={segment.sessionId} data-revision={segment.revision}>
            <p className={segment.isFinal ? 'confirmed' : 'interim'}>
              {segment.text}{!segment.isFinal && <span className="sr-only"> Unconfirmed</span>}
            </p>
          </div>)}
        </div>}
    </div>
  </section>;
}
