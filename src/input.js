const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'KeyQ', 'KeyZ', 'ShiftLeft', 'ShiftRight', 'Space']);
const ACTION_KEYS = new Map([['KeyE', 'interact'], ['Enter', 'primary'], ['KeyR', 'restart'], ['KeyF', 'torch'], ['KeyM', 'mute'], ['Escape', 'escape']]);

/** One listener set per app. Mouse lock is optional: drag and keyboard look always work. */
export function createInput({ surface = document.getElementById('scene'), onFocusChange = () => {}, onPointerLockChange = () => {}, onGesture = () => {} } = {}) {
  const held = new Set();
  const pending = Object.fromEntries([...ACTION_KEYS.values()].map(key => [key, false]));
  let focused = !document.hidden && document.hasFocus();
  let disposed = false, lookEnabled = false, dragging = false, lookX = 0, lookY = 0;
  const locked = () => Boolean(surface && document.pointerLockElement === surface);
  function clear() { held.clear(); for (const key in pending) pending[key] = false; lookX = lookY = 0; dragging = false; }
  function updateFocus() {
    const next = !document.hidden && document.hasFocus();
    if (!next) clear();
    if (focused !== next) { focused = next; onFocusChange(next); }
  }
  function onBlur() { clear(); if (focused) { focused = false; onFocusChange(false); } }
  function onKeyDown(event) {
    if (!focused || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '')) return;
    if (!MOVE_KEYS.has(event.code) && !ACTION_KEYS.has(event.code)) return;
    event.preventDefault();
    if (event.repeat || held.has(event.code)) return;
    onGesture();
    held.add(event.code);
    const action = ACTION_KEYS.get(event.code);
    if (action) pending[action] = true;
  }
  function onKeyUp(event) { held.delete(event.code); }
  function requestPointerLock() {
    if (disposed || !surface?.requestPointerLock || locked()) return;
    try { const promise = surface.requestPointerLock(); promise?.catch?.(() => onPointerLockChange(false)); }
    catch { onPointerLockChange(false); }
  }
  function releasePointerLock() { if (locked()) document.exitPointerLock?.(); }
  function onMouseDown(event) {
    if (event.button !== 0 || !lookEnabled || !focused) return;
    if (event.target !== surface && !surface?.contains?.(event.target)) return;
    onGesture(); dragging = true; requestPointerLock();
  }
  function onMouseUp() { dragging = false; }
  function onMouseMove(event) {
    if (!focused || !lookEnabled || (!locked() && !dragging)) return;
    lookX += Number.isFinite(event.movementX) ? event.movementX : 0;
    lookY += Number.isFinite(event.movementY) ? event.movementY : 0;
  }
  function onLockChange() { lookX = lookY = 0; dragging = false; onPointerLockChange(locked()); }
  function onLockError() { onPointerLockChange(false); }
  const listeners = [
    [window, 'keydown', onKeyDown], [window, 'keyup', onKeyUp], [window, 'blur', onBlur], [window, 'focus', updateFocus],
    [document, 'visibilitychange', updateFocus], [window, 'mousedown', onMouseDown], [window, 'mouseup', onMouseUp],
    [window, 'mousemove', onMouseMove], [document, 'pointerlockchange', onLockChange], [document, 'pointerlockerror', onLockError],
  ];
  listeners.forEach(([target, type, fn]) => target.addEventListener(type, fn));
  onFocusChange(focused);
  return {
    read() {
      const down = (...keys) => keys.some(key => held.has(key));
      let x = Number(down('KeyD')) - Number(down('KeyA'));
      let z = Number(down('KeyS', 'ArrowDown')) - Number(down('KeyW', 'ArrowUp'));
      const length = Math.hypot(x, z);
      if (length > 1) { x /= length; z /= length; }
      const intent = { sneak: down('ShiftLeft', 'ShiftRight'), peek: down('Space'), movement: { x, z }, look: { x: lookX, y: lookY }, turn: { x: Number(down('ArrowRight')) - Number(down('ArrowLeft')), y: Number(down('KeyQ')) - Number(down('KeyZ')) }, ...pending };
      for (const key in pending) pending[key] = false;
      lookX = lookY = 0;
      return intent;
    },
    clear, requestPointerLock, releasePointerLock, isPointerLocked: locked,
    setLookEnabled(value) { lookEnabled = Boolean(value); if (!lookEnabled) { lookX = lookY = 0; dragging = false; } },
    dispose() {
      if (disposed) return;
      disposed = true; clear();
      listeners.forEach(([target, type, fn]) => target.removeEventListener(type, fn));
      releasePointerLock();
    },
  };
}
