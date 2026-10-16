/* A deterministic, DOM-free tray controller. Angles are in radians.
 * axis +1 means the player supports the right side: it applies negative roll.
 * turn +1 applies positive roll. A caller advances its route only while moving,
 * multiplying its walking pace by speed; this controller never changes a route.
 */
(function(root) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const finiteAxis = value => Number.isFinite(value) ? clamp(value, -1, 1) : 0;
  const safeAdd = (value, amount) => Math.min(Number.MAX_SAFE_INTEGER, value + amount);

  function create() {
    let roll, pitch, slip, velocity, elapsed, walkingElapsed, startup;
    let swayPhase, gaitPhase, unsafeTime, recovering, catches, resting, assisted;

    function pace() {
      const t = startup / 2.5;
      return .4 + .6 * t * t * (3 - 2 * t);
    }

    function snapshot() {
      const moving = !resting && !recovering;
      return {roll, pitch, slip, moving, recovering, catches, elapsed,
        speed: moving ? pace() : 0, walkingElapsed};
    }

    function reset() {
      roll = pitch = slip = velocity = elapsed = walkingElapsed = startup = 0;
      swayPhase = -.4;
      gaitPhase = unsafeTime = catches = 0;
      recovering = resting = assisted = false;
      return snapshot();
    }

    function step(dt, input) {
      input = input || {};
      const axis = finiteAxis(input.axis);
      const turn = finiteAxis(input.turn);
      resting = input.resting === true;
      assisted = input.assisted === true;
      // Assistance may be enabled during a catch, and must release the route.
      if (assisted) { recovering = false; unsafeTime = 0; }

      // A returning browser tab cannot skip the journey or kick the tray over.
      let remaining = Number.isFinite(dt) ? clamp(dt, 0, .1) : 0;
      while (remaining > 1e-10) {
        const h = Math.min(remaining, 1 / 120);
        remaining -= h;
        elapsed = safeAdd(elapsed, h);
        startup = Math.min(2.5, startup + h);
        const moving = !resting && !recovering;
        const speed = moving ? pace() : 0;
        if (moving) {
          walkingElapsed = safeAdd(walkingElapsed, h);
          swayPhase = (swayPhase + .26 * speed * h) % TAU;
          gaitPhase = (gaitPhase + 4.8 * speed * h) % TAU;
        }

        let acceleration;
        if (assisted) {
          acceleration = -7.5 * roll - 4.4 * velocity;
        } else if (resting || recovering) {
          // Holding still or catching the tray dampens momentum and supports it.
          acceleration = -3.4 * roll - 3.8 * velocity;
        } else {
          const t = startup / 2.5;
          const easeIn = t * t * (3 - 2 * t);
          const disturbance = .05 * Math.cos(swayPhase) + .015 * Math.sin(gaitPhase) + .08 * turn;
          // Walking has no centering spring. Letting go leaves a slow readable
          // lean that eventually needs the player's support or a gentle catch.
          acceleration = disturbance * easeIn + .1 * roll - 1.25 * velocity - .28 * axis;
        }
        velocity = clamp(velocity + acceleration * h, -.35, .35);
        const limit = startup < 2.5 ? .08 + .16 * startup / 2.5 : .3;
        roll = clamp(roll + velocity * h, -limit, limit);
        if ((roll >= limit && velocity > 0) || (roll <= -limit && velocity < 0)) velocity = 0;

        if (!assisted && !resting && !recovering && startup >= 2.5) {
          unsafeTime = Math.abs(roll) > .24 ? unsafeTime + h : 0;
          if (unsafeTime >= .6) {
            recovering = true;
            catches = safeAdd(catches, 1);
            unsafeTime = 0;
          }
        } else {
          unsafeTime = 0;
        }
        if (recovering && Math.abs(roll) < .05 && Math.abs(velocity) < .07) recovering = false;

        const targetPitch = moving ? (-.018 + .009 * Math.sin(gaitPhase + .7) - .018 * Math.abs(turn)) * speed : 0;
        pitch += (targetPitch - pitch) * (1 - Math.exp(-6 * h));
        // Positive Z rotation lifts local +X, so contents slide toward -X.
        const targetSlip = clamp(-roll / .3 * .038, -.04, .04);
        slip += (targetSlip - slip) * (1 - Math.exp(-7 * h));
      }
      return snapshot();
    }

    reset();
    return {step, reset, snapshot};
  }

  const api = {create};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GiftBalance = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
