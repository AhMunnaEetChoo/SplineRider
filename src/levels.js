// Built-in level catalog (plain data, Spline instances created at load time)

export const BUILT_IN_LEVELS = [
  {
    name: 'First Ride',
    startSplineIndex: 0,
    startT: 0,
    startPosition: { x: -500, y: 260 },
    goalPosition: { x: 600, y: -200 },
    splines: [
      {
        points: [
          { x: -500, y: 200 },
          { x: -300, y: 100 },
          { x: -100, y: -200 },
          { x: 0, y: -100 },
          { x: 100, y: 80 },
          { x: 200, y: 280 },
          { x: 300, y: 250 },
          { x: 450, y: 0 },
          { x: 600, y: -200 },
        ],
      },
      {
        points: [
          { x: 450, y: 150 },
          { x: 550, y: 150 },
        ],
      },
      {
        points: [
          { x: 700, y: -300 },
          { x: 800, y: -380 },
          { x: 900, y: -300 },
        ],
      },
      {
        points: [
          { x: 100, y: 350 },
          { x: 200, y: 380 },
          { x: 300, y: 350 },
        ],
      },
    ],
  },

  {
    name: 'The Gap',
    startSplineIndex: 0,
    startT: 0,
    startPosition: { x: -400, y: 60 },
    goalPosition: { x: 700, y: -100 },
    splines: [
      {
        points: [
          { x: -400, y: 0 },
          { x: -200, y: 0 },
          { x: 0, y: -60 },
          { x: 200, y: -100 },
        ],
      },
      {
        points: [
          { x: 350, y: -100 },
          { x: 450, y: -140 },
          { x: 600, y: -80 },
          { x: 700, y: -100 },
        ],
      },
      {
        points: [
          { x: 0, y: 200 },
          { x: 150, y: 220 },
          { x: 300, y: 200 },
        ],
      },
    ],
  },

  {
    name: 'Rollercoaster',
    startSplineIndex: 0,
    startT: 0,
    startPosition: { x: -500, y: 160 },
    goalPosition: { x: 800, y: -300 },
    splines: [
      {
        points: [
          { x: -500, y: 100 },
          { x: -350, y: 100 },
          { x: -200, y: -200 },
          { x: 0, y: -250 },
          { x: 150, y: -180 },
          { x: 300, y: 100 },
          { x: 400, y: 200 },
          { x: 550, y: -100 },
          { x: 700, y: -350 },
          { x: 800, y: -300 },
        ],
      },
    ],
  },

  {
    name: 'Pinball',
    startSplineIndex: 0,
    startT: 0,
    startPosition: { x: -300, y: 60 },
    goalPosition: { x: 600, y: 200 },
    splines: [
      {
        points: [
          { x: -300, y: 0 },
          { x: -180, y: -120 },
          { x: 0, y: 50 },
          { x: 200, y: -50 },
        ],
      },
      {
        points: [
          { x: -100, y: 200 },
          { x: 50, y: 180 },
          { x: 150, y: 180 },
          { x: 200, y: 200 },
        ],
      },
      {
        points: [
          { x: 350, y: -80 },
          { x: 450, y: 40 },
          { x: 550, y: -80 },
        ],
      },
      {
        points: [
          { x: 400, y: 200 },
          { x: 500, y: 200 },
          { x: 600, y: 200 },
        ],
      },
      {
        points: [
          { x: -50, y: -250 },
          { x: 100, y: -200 },
          { x: 250, y: -250 },
        ],
      },
    ],
  },

  {
    name: 'Gauntlet',
    startSplineIndex: 0,
    startT: 0,
    startPosition: { x: -500, y: 160 },
    goalPosition: { x: 800, y: -100 },
    splines: [
      {
        points: [
          { x: -500, y: 100 },
          { x: -430, y: -30 },
          { x: -270, y: -30 },
          { x: -100, y: 100 },
        ],
      },
      {
        points: [
          { x: 0, y: -50 },
          { x: 70, y: 50 },
          { x: 130, y: 50 },
          { x: 200, y: -50 },
        ],
      },
      {
        points: [
          { x: 300, y: 100 },
          { x: 370, y: -30 },
          { x: 470, y: -30 },
          { x: 500, y: 100 },
        ],
      },
      {
        points: [
          { x: 600, y: -50 },
          { x: 670, y: 50 },
          { x: 730, y: 50 },
          { x: 800, y: -100 },
        ],
      },
    ],
  },
];

export const DEFAULT_LEVEL = BUILT_IN_LEVELS[0];
