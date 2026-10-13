import { assignedSegments, liveSegments } from './streams';
import { useId, useLayoutEffect, useRef } from 'react';
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

export function Transcript({ segments, textSize, assigned = false, colours = {}, hiddenSpeakers = [], collapsed = false, onToggle }: { segments: readonly TranscriptSegment[]; textSize: number; assigned?: boolean; colours?: SpeakerColourChoices; hiddenSpeakers?: readonly string[]; collapsed?: boolean; onToggle?: () => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const latestViewport = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const transcriptId = useId();
  const visible = assigned ? assignedSegments(segments, hiddenSpeakers) : liveSegments(segments);
  const latest = assigned ? undefined : visible.at(-1);

  useLayoutEffect(() => {
    if (latestViewport.current) latestViewport.current.scrollTop = 0;
  }, [latest?.id]);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (element && !collapsed && following.current) element.scrollTop = element.scrollHeight;
  }, [segments, textSize, hiddenSpeakers, collapsed]);

  const trackScroll = () => {
    const element = viewport.current;
    if (!element || collapsed) return;
    following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 64;
  };
  return <section className="transcript-area" aria-label={assigned ? 'Who said what' : 'Live captions'}>
    <h2 className={onToggle ? 'pane-title collapsible-title' : 'pane-title'}>{onToggle ? <button className="pane-toggle"
      aria-expanded={!collapsed} aria-controls={transcriptId} onClick={onToggle}>
      {assigned ? 'Who said what' : 'Live'}
      <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24"><path d={collapsed ? 'm9 5 7 7-7 7' : 'm5 9 7 7 7-7'} fill="none" stroke="currentColor" strokeWidth="2" /></svg>
    </button> : assigned ? 'Who said what' : 'Live'}</h2>
    <div id={transcriptId} hidden={collapsed} className={assigned ? 'transcript' : 'transcript live-transcript'} ref={assigned ? viewport : undefined} role="region" aria-label={assigned ? 'Assigned transcript' : 'Live transcript'} tabIndex={assigned ? 0 : undefined}
      style={{ fontSize: `${textSize / 16}rem` }} onScroll={assigned ? trackScroll : undefined}>
      {visible.length === 0 ? <div className="empty-state">
        {!assigned && <p>Tap Listen to start.</p>}
      </div> : !assigned ? <>
        <div className="transcript-text live-history" ref={viewport} role="region" aria-label="Earlier sentences" tabIndex={0} onScroll={trackScroll}>
          {visible.slice(0, -1).map((segment) => <Caption key={segment.id} segment={segment} showName={false} live />)}
        </div>
        <div className="transcript-text latest-caption" ref={latestViewport} role="region" aria-label="Latest sentence" tabIndex={0}>
          {latest && <Caption segment={latest} showName={false} live />}
        </div>
      </> : <div className="transcript-text">
        {visible.map((segment, index) => <Caption key={segment.id} segment={segment} colours={colours} live={!assigned}
          showName={assigned && (index === 0 || segment.speakerId !== visible[index - 1]?.speakerId || segment.speakerName !== visible[index - 1]?.speakerName || segment.speakerEstimated !== visible[index - 1]?.speakerEstimated)} />)}
      </div>}
    </div>
  </section>;
}
