import type { Act, ActStep, TimelineEvent } from '../store';

export interface ActStepBlock {
  step: ActStep;
  startTime: number;
  endTime: number;
}

/** Lay out steps with optional absolute startTime; unset startTime packs after previous clip. */
export function buildActStepBlocks(steps: ActStep[]): ActStepBlock[] {
  let packCursor = 0;
  return steps.map((step) => {
    const startTime =
      typeof step.startTime === 'number' && step.startTime >= 0
        ? step.startTime
        : packCursor;
    const endTime = startTime + step.duration;
    packCursor = Math.max(packCursor, endTime);
    return { step, startTime, endTime };
  });
}

export function getActContentEndMs(
  stepBlocks: ActStepBlock[],
  timelineEvents: TimelineEvent[] = []
): number {
  const stepsEnd = stepBlocks.length > 0 ? stepBlocks[stepBlocks.length - 1].endTime : 0;
  const eventsEnd = timelineEvents.reduce((max, e) => Math.max(max, e.time), 0);
  return Math.max(stepsEnd, eventsEnd);
}

export function getActLayoutDurationMs(
  act: Pick<Act, 'totalDuration' | 'steps' | 'timelineEvents'>,
  stepBlocks: ActStepBlock[]
): number {
  const contentEnd = getActContentEndMs(stepBlocks, act.timelineEvents || []);
  return Math.max(act.totalDuration || 0, contentEnd, 1000);
}

export function getActStepAbsoluteStart(stepBlocks: ActStepBlock[], stepIndex: number): number {
  return stepBlocks[stepIndex]?.startTime ?? 0;
}
