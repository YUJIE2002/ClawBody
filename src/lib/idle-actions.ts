/**
 * Idle Action System — procedural mini-animations for VRM characters.
 *
 * Each action defines bone manipulations over a duration.
 * A scheduler randomly picks and plays them at intervals,
 * making the character feel alive like a QQ pet.
 */

import type { VRM } from "@pixiv/three-vrm";

/** Smooth ease-in-out for natural motion */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/** Ease out (fast start, slow end) */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Triangle wave: 0→1→0 over progress 0→1 */
function triangle(t: number): number {
  return t < 0.5 ? easeInOut(t * 2) : easeInOut((1 - t) * 2);
}

/**
 * Get a bone node, or null. Shorthand to reduce repetition.
 */
function bone(vrm: VRM, name: string) {
  return vrm.humanoid?.getNormalizedBoneNode(name) ?? null;
}

// ── Action Definitions ──────────────────────────────────

export interface IdleAction {
  name: string;
  /** Duration in seconds */
  duration: number;
  /** Weight: higher = more likely to be picked */
  weight: number;
  /**
   * Apply the action at a given progress (0 to 1).
   * Should SET rotation/position deltas (not accumulate).
   * Returns bone names that were modified so the scheduler
   * can reset them after the action ends.
   */
  apply: (vrm: VRM, progress: number) => void;
  /** Reset any bones this action touches */
  reset: (vrm: VRM) => void;
}

/** Blink — quick close-open of eyes */
const blink: IdleAction = {
  name: "blink",
  duration: 0.3,
  weight: 10,
  apply(vrm, p) {
    // Fast close, slow open
    const v = p < 0.4 ? easeOut(p / 0.4) : easeOut((1 - p) / 0.6);
    vrm.expressionManager?.setValue("blink", v);
  },
  reset(vrm) {
    vrm.expressionManager?.setValue("blink", 0);
  },
};

/** Double blink — two quick blinks */
const doubleBlink: IdleAction = {
  name: "doubleBlink",
  duration: 0.7,
  weight: 3,
  apply(vrm, p) {
    // Two blink peaks at p=0.2 and p=0.6
    let v = 0;
    if (p < 0.35) {
      const local = p / 0.35;
      v = local < 0.4 ? easeOut(local / 0.4) : easeOut((1 - local) / 0.6);
    } else if (p > 0.45 && p < 0.85) {
      const local = (p - 0.45) / 0.4;
      v = local < 0.4 ? easeOut(local / 0.4) : easeOut((1 - local) / 0.6);
    }
    vrm.expressionManager?.setValue("blink", v);
  },
  reset(vrm) {
    vrm.expressionManager?.setValue("blink", 0);
  },
};

/** Look left then back */
const lookLeft: IdleAction = {
  name: "lookLeft",
  duration: 2.0,
  weight: 4,
  apply(vrm, p) {
    const head = bone(vrm, "head");
    if (head) {
      head.rotation.y += triangle(p) * 0.25;
    }
    // Eyes follow
    vrm.expressionManager?.setValue("lookLeft", triangle(p) * 0.6);
  },
  reset(vrm) {
    vrm.expressionManager?.setValue("lookLeft", 0);
  },
};

/** Look right then back */
const lookRight: IdleAction = {
  name: "lookRight",
  duration: 2.0,
  weight: 4,
  apply(vrm, p) {
    const head = bone(vrm, "head");
    if (head) {
      head.rotation.y += triangle(p) * -0.25;
    }
    vrm.expressionManager?.setValue("lookRight", triangle(p) * 0.6);
  },
  reset(vrm) {
    vrm.expressionManager?.setValue("lookRight", 0);
  },
};

/** Tilt head curiously */
const headTilt: IdleAction = {
  name: "headTilt",
  duration: 2.5,
  weight: 3,
  apply(vrm, p) {
    const head = bone(vrm, "head");
    if (head) {
      head.rotation.z += triangle(p) * 0.12;
      head.rotation.x += triangle(p) * -0.05;
    }
  },
  reset() {},
};

/** Nod slightly — like acknowledging something */
const nod: IdleAction = {
  name: "nod",
  duration: 1.2,
  weight: 2,
  apply(vrm, p) {
    const head = bone(vrm, "head");
    if (head) {
      // Two small nods
      const cycle = Math.sin(p * Math.PI * 3) * (1 - p);
      head.rotation.x += cycle * 0.08;
    }
  },
  reset() {},
};

/** Shift weight — subtle hip sway */
const weightShift: IdleAction = {
  name: "weightShift",
  duration: 3.0,
  weight: 5,
  apply(vrm, p) {
    const hips = bone(vrm, "hips");
    const spine = bone(vrm, "spine");
    if (hips) {
      hips.rotation.z += triangle(p) * 0.03;
      hips.position.x += triangle(p) * 0.01;
    }
    if (spine) {
      // Counter-rotate spine slightly for natural S-curve
      spine.rotation.z += triangle(p) * -0.015;
    }
  },
  reset(vrm) {
    const hips = bone(vrm, "hips");
    if (hips) hips.position.x = 0;
  },
};

/** Small stretch — raise shoulders slightly */
const miniStretch: IdleAction = {
  name: "miniStretch",
  duration: 3.5,
  weight: 2,
  apply(vrm, p) {
    const leftShoulder = bone(vrm, "leftShoulder");
    const rightShoulder = bone(vrm, "rightShoulder");
    const neck = bone(vrm, "neck");
    const t = triangle(p);
    if (leftShoulder) leftShoulder.rotation.z += t * -0.08;
    if (rightShoulder) rightShoulder.rotation.z += t * 0.08;
    if (neck) neck.rotation.x += t * -0.06;
  },
  reset() {},
};

/** Sigh — slight droop then recovery */
const sigh: IdleAction = {
  name: "sigh",
  duration: 2.5,
  weight: 1,
  apply(vrm, p) {
    const spine = bone(vrm, "spine");
    const head = bone(vrm, "head");
    // Droop down then come back up
    const droop = p < 0.4 ? easeInOut(p / 0.4) : easeInOut((1 - p) / 0.6);
    if (spine) spine.rotation.x += droop * 0.04;
    if (head) head.rotation.x += droop * 0.06;
    // Partial eye close
    vrm.expressionManager?.setValue("blink", droop * 0.3);
  },
  reset(vrm) {
    vrm.expressionManager?.setValue("blink", 0);
  },
};

/** Happy bounce — small vertical bounce */
const happyBounce: IdleAction = {
  name: "happyBounce",
  duration: 1.5,
  weight: 1,
  apply(vrm, p) {
    const hips = bone(vrm, "hips");
    if (hips) {
      const bounce = Math.sin(p * Math.PI * 4) * (1 - p) * 0.008;
      hips.position.y += bounce;
    }
    // Slight smile
    vrm.expressionManager?.setValue("happy", triangle(p) * 0.4);
  },
  reset(vrm) {
    vrm.expressionManager?.setValue("happy", 0);
  },
};

/** Look up briefly — as if thinking */
const lookUp: IdleAction = {
  name: "lookUp",
  duration: 2.0,
  weight: 2,
  apply(vrm, p) {
    const head = bone(vrm, "head");
    if (head) {
      head.rotation.x += triangle(p) * -0.12;
    }
    vrm.expressionManager?.setValue("lookUp", triangle(p) * 0.5);
  },
  reset(vrm) {
    vrm.expressionManager?.setValue("lookUp", 0);
  },
};

// ── All available actions ──

export const IDLE_ACTIONS: IdleAction[] = [
  blink,
  doubleBlink,
  lookLeft,
  lookRight,
  headTilt,
  nod,
  weightShift,
  miniStretch,
  sigh,
  happyBounce,
  lookUp,
];

// ── Scheduler ───────────────────────────────────

export interface IdleSchedulerState {
  /** Currently playing action, or null */
  current: IdleAction | null;
  /** When the current action started (elapsed time) */
  startTime: number;
  /** When the next action should trigger */
  nextTrigger: number;
  /** Last action name (avoid immediate repeat) */
  lastAction: string;
}

export function createIdleScheduler(): IdleSchedulerState {
  return {
    current: null,
    startTime: 0,
    nextTrigger: 1.5 + Math.random() * 2, // First action after 1.5-3.5s
    lastAction: "",
  };
}

/**
 * Pick a weighted random action, avoiding immediate repeats.
 */
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
 * Update the idle scheduler. Call every frame.
 * Returns true if an action is currently playing.
 */
export function updateIdleScheduler(
  state: IdleSchedulerState,
  vrm: VRM,
  elapsed: number,
): boolean {
  // If an action is playing, update it
  if (state.current) {
    const actionElapsed = elapsed - state.startTime;
    const progress = Math.min(actionElapsed / state.current.duration, 1);

    if (progress >= 1) {
      // Action finished
      state.current.reset(vrm);
      state.lastAction = state.current.name;
      state.current = null;
      // Schedule next action: 2-6 seconds from now
      state.nextTrigger = elapsed + 2 + Math.random() * 4;
      return false;
    }

    state.current.apply(vrm, progress);
    return true;
  }

  // No action playing — check if it's time for the next one
  if (elapsed >= state.nextTrigger) {
    const action = pickAction(state.lastAction);
    state.current = action;
    state.startTime = elapsed;
    return true;
  }

  return false;
}
