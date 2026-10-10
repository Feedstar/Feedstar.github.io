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
