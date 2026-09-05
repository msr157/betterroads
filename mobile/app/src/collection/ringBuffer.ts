export type Timed = { t: number };

/** Small time-bounded ring buffer used for pre-trigger sensor history. */
export class TimeRingBuffer<T extends Timed> {
  private values: T[] = [];

  constructor(private readonly retentionMs: number) {
    if (!Number.isFinite(retentionMs) || retentionMs <= 0) throw new Error('retentionMs must be positive');
  }

  push(value: T): boolean {
    const last = this.values[this.values.length - 1];
    if (!Number.isFinite(value.t) || (last && value.t <= last.t)) return false;
    this.values.push(value);
    this.trim(value.t);
    return true;
  }

  between(startMs: number, endMs: number): T[] {
    return this.values.filter((value) => value.t >= startMs && value.t <= endMs);
  }

  latest(): T | undefined {
    return this.values[this.values.length - 1];
  }

  get length(): number {
    return this.values.length;
  }

  clear(): void {
    this.values = [];
  }

  private trim(nowMs: number): void {
    const cutoff = nowMs - this.retentionMs;
    while (this.values.length > 0 && this.values[0]!.t < cutoff) this.values.shift();
  }
}

export type CandidateEncounter = {
  startedAt: number;
  triggerAt: number;
  endsAt: number;
  triggerReasons: string[];
};

/** Opens and merges neutral candidate encounters; it never assigns a road class. */
export class EncounterWindowManager {
  private current: CandidateEncounter | null = null;

  constructor(
    private readonly preTriggerMs = 1_500,
    private readonly postTriggerMs = 2_000,
    private readonly mergeGapMs = 1_000,
  ) {}

  trigger(at: number, reasons: string[]): CandidateEncounter {
    const uniqueReasons = [...new Set(reasons)].sort();
    if (this.current && at <= this.current.endsAt + this.mergeGapMs) {
      this.current.triggerAt = at;
      this.current.endsAt = at + this.postTriggerMs;
      this.current.triggerReasons = [...new Set([...this.current.triggerReasons, ...uniqueReasons])].sort();
      return { ...this.current, triggerReasons: [...this.current.triggerReasons] };
    }
    this.current = {
      startedAt: at - this.preTriggerMs,
      triggerAt: at,
      endsAt: at + this.postTriggerMs,
      triggerReasons: uniqueReasons,
    };
    return { ...this.current, triggerReasons: [...this.current.triggerReasons] };
  }

  complete(now: number): CandidateEncounter | null {
    if (!this.current || now < this.current.endsAt) return null;
    const completed = this.current;
    this.current = null;
    return { ...completed, triggerReasons: [...completed.triggerReasons] };
  }

  forceComplete(now: number): CandidateEncounter | null {
    if (!this.current || now <= this.current.triggerAt) return null;
    const completed = { ...this.current, endsAt: Math.min(this.current.endsAt, now), triggerReasons: [...this.current.triggerReasons] };
    this.current = null;
    return completed;
  }
}
