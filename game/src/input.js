// Keyboard and mouse, folded into one plain input object the simulation
// reads each tick. The screenshot autopilot writes into the same object, so
// staged scenes and real play share every code path.

export function createInput(canvas) {
  const input = {
    up: false, down: false, left: false, right: false,
    pressedUp: false,
    sprint: false,
    handbrake: false,
    mouseX: 0, mouseY: 0,
    mouseDown: false,
    mouseClicked: false,
    keys: new Set(),
    justPressed: new Set(),
  };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'handbrake',
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    const mapped = KEYMAP[e.code];
    if (mapped) input[mapped] = true;
    if (e.code === 'KeyW' || e.code === 'ArrowUp') input.pressedUp = true;
    if (!e.repeat) input.justPressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    const mapped = KEYMAP[e.code];
    if (mapped) input[mapped] = false;
    if (e.code === 'KeyW' || e.code === 'ArrowUp') input.pressedUp = false;
    input.keys.delete(e.code);
  });
  window.addEventListener('blur', () => {
    input.up = input.down = input.left = input.right = false;
    input.pressedUp = false;
    input.sprint = false;
    input.handbrake = false;
    input.mouseDown = false;
    input.keys.clear();
  });

  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    input.mouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;
  }
  canvas.addEventListener('mousemove', toCanvas);
  canvas.addEventListener('mousedown', (e) => {
    toCanvas(e);
    input.mouseDown = true;
    input.mouseClicked = true;
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return input;
}

/** Called once per tick after the simulation has read the input. */
export function clearTransient(input) {
  input.justPressed.clear();
  input.mouseClicked = false;
}

export function wasPressed(input, code) {
  return input.justPressed.has(code);
}

/** A blank input the screenshot autopilot can steer with. */
export function scriptedInput() {
  return {
    up: false, down: false, left: false, right: false,
    pressedUp: false,
    sprint: false,
    handbrake: false,
    mouseX: 0, mouseY: 0,
    mouseDown: false,
    mouseClicked: false,
    keys: new Set(),
    justPressed: new Set(),
  };
}
