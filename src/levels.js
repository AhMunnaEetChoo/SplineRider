// Built-in level catalog (plain data, Spline instances created at load time)

export const BUILT_IN_LEVELS = [
  {
    name: 'First Ride',
    startSplineIndex: 0,
    startT: 0,
    goalPosition: { x: 600, y: -200 },
    splines: [
      {
        p0: { x: -500, y: 200 },
        p1: { x: -300, y: 200 },
        p2: { x: -100, y: -300 },
        p3: { x: 0, y: -100 },
      },
      {
        p0: { x: 0, y: -100 },
        p1: { x: 100, y: 50 },
        p2: { x: 200, y: 300 },
        p3: { x: 300, y: 250 },
      },
      {
        p0: { x: 300, y: 250 },
        p1: { x: 400, y: 200 },
        p2: { x: 500, y: -150 },
        p3: { x: 600, y: -200 },
      },
      {
        p0: { x: 450, y: 150 },
        p1: { x: 480, y: 150 },
        p2: { x: 520, y: 150 },
        p3: { x: 550, y: 150 },
      },
      {
        p0: { x: 700, y: -300 },
        p1: { x: 750, y: -350 },
        p2: { x: 850, y: -350 },
        p3: { x: 900, y: -300 },
      },
      {
        p0: { x: 100, y: 350 },
        p1: { x: 150, y: 400 },
        p2: { x: 250, y: 400 },
        p3: { x: 300, y: 350 },
      },
    ],
  },

  {
    name: 'The Gap',
    startSplineIndex: 0,
    startT: 0,
    goalPosition: { x: 700, y: -100 },
    splines: [
      {
        p0: { x: -400, y: 0 },
        p1: { x: -200, y: 0 },
        p2: { x: 0, y: -100 },
        p3: { x: 200, y: -100 },
      },
      {
        p0: { x: 350, y: -100 },
        p1: { x: 400, y: -150 },
        p2: { x: 600, y: -50 },
        p3: { x: 700, y: -100 },
      },
      {
        p0: { x: 0, y: 200 },
        p1: { x: 100, y: 200 },
        p2: { x: 200, y: 200 },
        p3: { x: 300, y: 200 },
      },
    ],
  },

  {
    name: 'Rollercoaster',
    startSplineIndex: 0,
    startT: 0,
    goalPosition: { x: 800, y: -300 },
    splines: [
      {
        p0: { x: -500, y: 100 },
        p1: { x: -350, y: 100 },
        p2: { x: -200, y: -250 },
        p3: { x: 0, y: -250 },
      },
      {
        p0: { x: 0, y: -250 },
        p1: { x: 150, y: -250 },
        p2: { x: 250, y: 200 },
        p3: { x: 400, y: 200 },
      },
      {
        p0: { x: 400, y: 200 },
        p1: { x: 500, y: 200 },
        p2: { x: 600, y: -400 },
        p3: { x: 800, y: -300 },
      },
    ],
  },

  {
    name: 'Pinball',
    startSplineIndex: 0,
    startT: 0,
    goalPosition: { x: 600, y: 200 },
    splines: [
      {
        p0: { x: -300, y: 0 },
        p1: { x: -150, y: -200 },
        p2: { x: 50, y: 100 },
        p3: { x: 200, y: -50 },
      },
      {
        p0: { x: -100, y: 200 },
        p1: { x: 0, y: 150 },
        p2: { x: 100, y: 150 },
        p3: { x: 200, y: 200 },
      },
      {
        p0: { x: 350, y: -80 },
        p1: { x: 400, y: 100 },
        p2: { x: 500, y: 100 },
        p3: { x: 550, y: -80 },
      },
      {
        p0: { x: 400, y: 200 },
        p1: { x: 450, y: 150 },
        p2: { x: 550, y: 150 },
        p3: { x: 600, y: 200 },
      },
      {
        p0: { x: -50, y: -250 },
        p1: { x: 50, y: -200 },
        p2: { x: 150, y: -200 },
        p3: { x: 250, y: -250 },
      },
    ],
  },

  {
    name: 'Gauntlet',
    startSplineIndex: 0,
    startT: 0,
    goalPosition: { x: 800, y: -100 },
    splines: [
      {
        p0: { x: -500, y: 100 },
        p1: { x: -400, y: -100 },
        p2: { x: -200, y: -100 },
        p3: { x: -100, y: 100 },
      },
      {
        p0: { x: 0, y: -50 },
        p1: { x: 50, y: 100 },
        p2: { x: 150, y: 100 },
        p3: { x: 200, y: -50 },
      },
      {
        p0: { x: 300, y: 100 },
        p1: { x: 350, y: -100 },
        p2: { x: 450, y: -100 },
        p3: { x: 500, y: 100 },
      },
      {
        p0: { x: 600, y: -50 },
        p1: { x: 650, y: 100 },
        p2: { x: 750, y: 100 },
        p3: { x: 800, y: -100 },
      },
    ],
  },
];

export const DEFAULT_LEVEL = BUILT_IN_LEVELS[0];
