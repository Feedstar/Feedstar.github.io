// Exact critically damped spring: new input inherits the current velocity.
// response is the natural period in seconds, not a frame-dependent lerp factor.
export function settle(value, velocity, target, dt, response = 0.3) {
  const omega = (2 * Math.PI) / response;
  const offset = value - target;
  const impulse = velocity + omega * offset;
  const decay = Math.exp(-omega * Math.max(0, dt));
  return {
    value: target + (offset + impulse * dt) * decay,
    velocity: (velocity - omega * impulse * dt) * decay,
  };
}

// Underdamped hover spring: mass 1, stiffness 100, damping 10. The exact
// solution preserves velocity when the pointer reverses or leaves a title.
export function titleSpring(value, velocity, target, dt) {
  const damping = 5,
    omega = Math.sqrt(75);
  const offset = value - target;
  const impulse = (velocity + damping * offset) / omega;
  const t = Math.max(0, dt),
    decay = Math.exp(-damping * t);
  const cos = Math.cos(omega * t),
    sin = Math.sin(omega * t);
  return {
    value: target + decay * (offset * cos + impulse * sin),
    velocity:
      decay *
      ((impulse * omega - damping * offset) * cos -
        (offset * omega + damping * impulse) * sin),
  };
}
