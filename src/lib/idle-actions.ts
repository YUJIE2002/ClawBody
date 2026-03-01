/**
 * Idle Action System v2 — output delta maps, never touch bones directly.
 *
 * Each action returns bone deltas + expression deltas for a given progress.
 * The main animation loop combines base animation + action deltas,
 * then sets bones with = (never +=). Zero accumulation possible.
 */

/** Smooth ease-in-out */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Triangle wave: 0→1→0 */
function triangle(t: number): number {
  return t < 0.5 ? easeInOut(t * 2) : easeInOut((1 - t) * 2);
}

// ── Delta types ──

export interface BoneDeltas {
  [boneName: string]: {
    rx?: number;
    ry?: number;
    rz?: number;
    px?: number;
    py?: number;
  };
}

export interface ActionOutput {
  bones: BoneDeltas;
  expressions: Record<string, number>;
}

const EMPTY_OUTPUT: ActionOutput = { bones: {}, expressions: {} };

// ── Action Definition ──

export interface IdleAction {
  name: string;
  duration: number;
  weight: number;
  /** Return deltas for this progress (0-1). Pure function, no side effects. */
  compute(progress: number): ActionOutput;
}

// ── Actions ──

const blink: IdleAction = {
  name: "blink",
  duration: 0.3,
  weight: 10,
  compute(p) {
    const v = p < 0.4 ? easeOut(p / 0.4) : easeOut((1 - p) / 0.6);
    return { bones: {}, expressions: { blink: v } };
  },
};

const doubleBlink: IdleAction = {
  name: "doubleBlink",
  duration: 0.7,
  weight: 3,
  compute(p) {
    let v = 0;
    if (p < 0.35) {
      const l = p / 0.35;
      v = l < 0.4 ? easeOut(l / 0.4) : easeOut((1 - l) / 0.6);
    } else if (p > 0.45 && p < 0.85) {
      const l = (p - 0.45) / 0.4;
      v = l < 0.4 ? easeOut(l / 0.4) : easeOut((1 - l) / 0.6);
    }
    return { bones: {}, expressions: { blink: v } };
  },
};

const lookLeft: IdleAction = {
  name: "lookLeft",
  duration: 2.0,
  weight: 4,
  compute(p) {
    const t = triangle(p);
    return {
      bones: { head: { ry: t * 0.25 } },
      expressions: { lookLeft: t * 0.6 },
    };
  },
};

const lookRight: IdleAction = {
  name: "lookRight",
  duration: 2.0,
  weight: 4,
  compute(p) {
    const t = triangle(p);
    return {
      bones: { head: { ry: t * -0.25 } },
      expressions: { lookRight: t * 0.6 },
    };
  },
};

const headTilt: IdleAction = {
  name: "headTilt",
  duration: 2.5,
  weight: 3,
  compute(p) {
    const t = triangle(p);
    return {
      bones: { head: { rz: t * 0.12, rx: t * -0.05 } },
      expressions: {},
    };
  },
};

const nod: IdleAction = {
  name: "nod",
  duration: 1.2,
  weight: 2,
  compute(p) {
    const cycle = Math.sin(p * Math.PI * 3) * (1 - p);
    return {
      bones: { head: { rx: cycle * 0.08 } },
      expressions: {},
    };
  },
};

const weightShift: IdleAction = {
  name: "weightShift",
  duration: 3.0,
  weight: 5,
  compute(p) {
    const t = triangle(p);
    return {
      bones: {
        hips: { rz: t * 0.03, px: t * 0.01 },
        spine: { rz: t * -0.015 },
      },
      expressions: {},
    };
  },
};

const miniStretch: IdleAction = {
  name: "miniStretch",
  duration: 3.5,
  weight: 2,
  compute(p) {
    const t = triangle(p);
    return {
      bones: {
        leftShoulder: { rz: t * -0.08 },
        rightShoulder: { rz: t * 0.08 },
        neck: { rx: t * -0.06 },
      },
      expressions: {},
    };
  },
};

const sigh: IdleAction = {
  name: "sigh",
  duration: 2.5,
  weight: 1,
  compute(p) {
    const droop = p < 0.4 ? easeInOut(p / 0.4) : easeInOut((1 - p) / 0.6);
    return {
      bones: {
        spine: { rx: droop * 0.04 },
        head: { rx: droop * 0.06 },
      },
      expressions: { blink: droop * 0.3 },
    };
  },
};

const happyBounce: IdleAction = {
  name: "happyBounce",
  duration: 1.5,
  weight: 1,
  compute(p) {
    const bounce = Math.sin(p * Math.PI * 4) * (1 - p) * 0.008;
    return {
      bones: { hips: { py: bounce } },
      expressions: { happy: triangle(p) * 0.4 },
    };
  },
};

const lookUp: IdleAction = {
  name: "lookUp",
  duration: 2.0,
  weight: 2,
  compute(p) {
    const t = triangle(p);
    return {
      bones: { head: { rx: t * -0.12 } },
      expressions: { lookUp: t * 0.5 },
    };
  },
};

export const IDLE_ACTIONS: IdleAction[] = [
  blink, doubleBlink, lookLeft, lookRight, headTilt,
  nod, weightShift, miniStretch, sigh, happyBounce, lookUp,
];

// ── Scheduler ──

export interface IdleSchedulerState {
  current: IdleAction | null;
  startTime: number;
  nextTrigger: number;
  lastAction: string;
}

export function createIdleScheduler(): IdleSchedulerState {
  return {
    current: null,
    startTime: 0,
    nextTrigger: 1.5 + Math.random() * 2,
    lastAction: "",
  };
}

function pickAction(lastAction: string): IdleAction {
  const candidates = IDLE_ACTIONS.filter((a) => a.name !== lastAction);
  const totalWeight = candidates.reduce((sum, a) => sum + a.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const action of candidates) {
    roll -= action.weight;
    if (roll <= 0) return action;
  }
  return candidates[candidates.length - 1];
}

/**
 * Tick the scheduler and return current action deltas (or empty).
 * Pure: does NOT modify any VRM bones.
 */
export function tickIdleScheduler(
  state: IdleSchedulerState,
  elapsed: number,
): ActionOutput {
  if (state.current) {
    const progress = Math.min((elapsed - state.startTime) / state.current.duration, 1);
    if (progress >= 1) {
      state.lastAction = state.current.name;
      state.current = null;
      state.nextTrigger = elapsed + 2 + Math.random() * 4;
      return EMPTY_OUTPUT;
    }
    return state.current.compute(progress);
  }

  if (elapsed >= state.nextTrigger) {
    state.current = pickAction(state.lastAction);
    state.startTime = elapsed;
    return state.current.compute(0);
  }

  return EMPTY_OUTPUT;
}
