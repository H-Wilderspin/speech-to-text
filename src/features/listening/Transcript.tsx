import { assignedSegments, liveSegments } from './streams';
import { useLayoutEffect, useRef } from 'react';
import type { TranscriptSegment } from '../../transcription/types';
import { speakerColour, unknownColour, type SpeakerColourChoices } from '../speakers/colours';

export function Caption({ segment, showName = true, colours = {}, live = false }: { segment: TranscriptSegment; showName?: boolean; colours?: SpeakerColourChoices; live?: boolean }) {
  const known = Boolean(segment.speakerId?.trim() && segment.speakerName?.trim());
  return <div className="caption" style={{ color: known && !live ? speakerColour(segment.speakerId!, colours) : unknownColour }}>
    {showName && <span className="caption-speaker">{known ? `${segment.speakerName}${segment.speakerEstimated ? ' (estimate)' : ''}` : 'Unknown speaker'}</span>}
    <p className={segment.isFinal ? 'confirmed' : 'interim'}>
      {segment.text}{!segment.isFinal && <span className="sr-only"> Unconfirmed</span>}
    </p>
  </div>;
}

export function Transcript({ segments, textSize, assigned = false, colours = {} }: { segments: readonly TranscriptSegment[]; textSize: number; assigned?: boolean; colours?: SpeakerColourChoices }) {
  const viewport = useRef<HTMLDivElement>(null);
  const following = useRef(true);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (element && following.current) element.scrollTop = element.scrollHeight;
  }, [segments, textSize]);

  const visible = assigned ? assignedSegments(segments) : liveSegments(segments);
  return <section className="transcript-area" aria-label={assigned ? 'Who said what' : 'Live captions'}>
    <h2 className="pane-title">{assigned ? 'Who said what' : 'Live'}</h2>
    <div className="transcript" ref={viewport} role="region" aria-label={assigned ? 'Assigned transcript' : 'Live transcript'} tabIndex={0}
      style={{ fontSize: `${textSize / 16}rem` }} onScroll={() => {
        const element = viewport.current;
        if (!element) return;
        following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64;
      }}>
      {visible.length === 0 ? <div className="empty-state">
        {!assigned && <p>Tap Listen to start.</p>}
      </div> : <div className="transcript-text">
        {visible.map((segment, index) => <Caption key={segment.id} segment={segment} colours={colours} live={!assigned}
          showName={assigned && (index === 0 || segment.speakerId !== visible[index - 1]?.speakerId || segment.speakerName !== visible[index - 1]?.speakerName || segment.speakerEstimated !== visible[index - 1]?.speakerEstimated)} />)}
      </div>}
    </div>
  </section>;
}
