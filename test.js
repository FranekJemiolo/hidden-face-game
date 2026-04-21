/* =========================
  COPY OF CORE FUNCTIONS
========================= */

function createSeededRandom(seed) {
  let s = seed >>> 0;
  return function rand() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function createSolvedCube() {
  let id = 0;
  return Array.from({ length: 3 }, (_, x) =>
    Array.from({ length: 3 }, (_, y) =>
      Array.from({ length: 3 }, (_, z) => ({
        id: id++,
        color: `hsl(${id * 13}, 70%, 50%)`
      }))
    )
  );
}

function clone(c) {
  return c.map(x => x.map(y => y.map(z => ({ ...z }))));
}

function rotateX(cube, layer, dir) {
  const o = clone(cube), n = clone(cube);
  for (let y = 0; y < 3; y++) {
    for (let z = 0; z < 3; z++) {
      const t = o[layer][y][z];
      let y2, z2;
      if (dir === 1) { y2 = z; z2 = 2 - y; }
      else { y2 = 2 - z; z2 = y; }
      n[layer][y2][z2] = t;
    }
  }
  return n;
}

function rotateY(cube, layer, dir) {
  const o = clone(cube), n = clone(cube);
  for (let x = 0; x < 3; x++) {
    for (let z = 0; z < 3; z++) {
      const t = o[x][layer][z];
      let x2, z2;
      if (dir === 1) { x2 = z; z2 = 2 - x; }
      else { x2 = 2 - z; z2 = x; }
      n[x2][layer][z2] = t;
    }
  }
  return n;
}

const MOVES = [
  { type: "X", layer: 0 },
  { type: "X", layer: 1 },
  { type: "X", layer: 2 },
  { type: "Y", layer: 0 },
  { type: "Y", layer: 1 },
  { type: "Y", layer: 2 }
];

function generateScramble(seed, cube, steps = 20) {
  const rand = createSeededRandom(seed);
  const moves = [];
  let state = cube;

  for (let i = 0; i < steps; i++) {
    const move = MOVES[Math.floor(rand() * MOVES.length)];
    const dir = rand() > 0.5 ? 1 : -1;

    if (move.type === "X") {
      state = rotateX(state, move.layer, dir);
    } else {
      state = rotateY(state, move.layer, dir);
    }

    moves.push({
      type: move.type,
      layer: move.layer,
      dir
    });
  }

  return { state, moves };
}

function encodeGame(seed, moves) {
  const scramble = moves
    .map(m => `${m.type}${m.layer}${m.dir > 0 ? "%2B" : "-"}`)
    .join(",");
  return `#seed=${seed}&scramble=${scramble}`;
}

function decodeGame(hash) {
  const params = new URLSearchParams(hash.replace("#", ""));
  const seed = Number(params.get("seed"));
  const scrambleRaw = params.get("scramble") || "";
  const moves = scrambleRaw
    .split(",")
    .filter(Boolean)
    .map(s => {
      const decoded = s.replace(/%2B/g, "+");
      return {
        type: decoded[0],
        layer: Number(decoded[1]),
        dir: decoded.endsWith("+") ? 1 : -1
      };
    });
  return { seed, moves };
}

function cubeToString(cube) {
  // Handle different array dimensions
  if (!Array.isArray(cube)) {
    // Single object
    return JSON.stringify(cube.id);
  }
  
  if (cube.length === 0) {
    return JSON.stringify([]);
  }
  
  // Check if first element is an array
  if (Array.isArray(cube[0])) {
    // Check if first element of first element is an array (3D)
    if (cube[0].length > 0 && Array.isArray(cube[0][0])) {
      // 3D cube
      return JSON.stringify(cube.map(x => x.map(y => y.map(z => z.id))));
    } else {
      // 2D layer
      return JSON.stringify(cube.map(y => y.map(z => z.id)));
    }
  } else {
    // 1D row
    return JSON.stringify(cube.map(z => z.id));
  }
}

function cubesEqual(a, b) {
  try {
    return cubeToString(a) === cubeToString(b);
  } catch (e) {
    console.error("cubesEqual error:", e);
    console.error("a:", a);
    console.error("b:", b);
    throw e;
  }
}

/* =========================
  TEST SUITE
========================= */

let tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

function runTest(test) {
  try {
    test.fn();
    return true;
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
    return false;
  }
}

/* =========================
  CAMERA SYSTEM (for testing)
========================= */

let camera = { rot: 0, pitch: 0 };

function getVisibleFace(cube) {
  const grid = [];
  for (let r = 0; r < 3; r++) {
    const row = [];
    for (let c = 0; c < 3; c++) {
      let x = c;
      let y = 2 - r;
      let z = 2;
      
      // Apply horizontal rotation (around Y axis)
      for (let i = 0; i < camera.rot; i++) {
        [x, z] = [z, 2 - x];
      }
      
      // Apply vertical rotation (around X axis)
      for (let i = 0; i < camera.pitch; i++) {
        [y, z] = [z, 2 - y];
      }
      
      row.push(cube[x][y][z]);
    }
    grid.push(row);
  }
  return grid;
}

/* =========================
  INTERACTION MAPPING (for testing)
========================= */

function mapInteractionToRotation({ row, col, dx, dy }) {
  const horizontal = Math.abs(dx) > Math.abs(dy);
  if (horizontal) {
    return {
      type: "Y",
      layer: row,
      dir: dx > 0 ? 1 : -1
    };
  }
  return {
    type: "X",
    layer: col,
    dir: dy > 0 ? -1 : 1
  };
}

/* =========================
  TESTS
========================= */

// Test 1: Rotation reversibility - rotating then inverse should return to original
test("rotateX reversibility", () => {
  const cube = createSolvedCube();
  const rotated = rotateX(rotateX(cube, 1, 1), 1, -1);
  assert(cubesEqual(cube, rotated), "rotateX then inverse should return to original");
});

test("rotateY reversibility", () => {
  const cube = createSolvedCube();
  const rotated = rotateY(rotateY(cube, 1, 1), 1, -1);
  assert(cubesEqual(cube, rotated), "rotateY then inverse should return to original");
});

// Test 2: 4 rotations should return to original (360 degrees)
test("rotateX 4x = identity", () => {
  const cube = createSolvedCube();
  let rotated = cube;
  for (let i = 0; i < 4; i++) {
    rotated = rotateX(rotated, 1, 1);
  }
  assert(cubesEqual(cube, rotated), "4 rotateX should return to original");
});

test("rotateY 4x = identity", () => {
  const cube = createSolvedCube();
  let rotated = cube;
  for (let i = 0; i < 4; i++) {
    rotated = rotateY(rotated, 1, 1);
  }
  assert(cubesEqual(cube, rotated), "4 rotateY should return to original");
});

// Test 3: Scramble reversibility - applying inverse moves should solve
test("scramble reversibility", () => {
  const seed = 12345;
  const cube = createSolvedCube();
  const { state, moves } = generateScramble(seed, cube, 10);
  
  // Apply inverse moves
  let solved = state;
  for (let i = moves.length - 1; i >= 0; i--) {
    const move = moves[i];
    if (move.type === "X") {
      solved = rotateX(solved, move.layer, -move.dir);
    } else {
      solved = rotateY(solved, move.layer, -move.dir);
    }
  }
  
  assert(cubesEqual(cube, solved), "Inverse scramble moves should return to solved state");
});

// Test 4: Deterministic seeding - same seed produces same result
test("deterministic seeding", () => {
  const seed = 54321;
  const cube = createSolvedCube();
  
  const result1 = generateScramble(seed, clone(cube), 15);
  const result2 = generateScramble(seed, clone(cube), 15);
  
  assert(
    cubesEqual(result1.state, result2.state) &&
    JSON.stringify(result1.moves) === JSON.stringify(result2.moves),
    "Same seed should produce identical scramble"
  );
});

// Test 5: URL encoding/decoding round-trip
test("URL encoding/decoding", () => {
  const seed = 99999;
  const moves = [
    { type: "X", layer: 0, dir: 1 },
    { type: "Y", layer: 1, dir: -1 },
    { type: "X", layer: 2, dir: 1 }
  ];
  
  const encoded = encodeGame(seed, moves);
  const decoded = decodeGame(encoded);
  
  assert(
    decoded.seed === seed &&
    JSON.stringify(decoded.moves) === JSON.stringify(moves),
    "URL encode/decode should be lossless"
  );
});

// Test 6: Rotation affects correct layer only
test("rotateX affects only target layer", () => {
  const cube = createSolvedCube();
  const rotated = rotateX(cube, 0, 1);
  
  // Layer 0 should be changed
  assert(!cubesEqual(rotated[0], cube[0]), "Target layer should change");
  
  // Layers 1 and 2 should be unchanged
  assert(cubesEqual(rotated[1], cube[1]), "Other layers should be unchanged");
  assert(cubesEqual(rotated[2], cube[2]), "Other layers should be unchanged");
});

test("rotateY affects only target layer", () => {
  const cube = createSolvedCube();
  const rotated = rotateY(cube, 1, 1);
  
  // Layer 1 should be changed
  for (let x = 0; x < 3; x++) {
    assert(!cubesEqual(rotated[x][1], cube[x][1]), "Target layer should change");
  }
  
  // Layers 0 and 2 should be unchanged
  for (let x = 0; x < 3; x++) {
    assert(cubesEqual(rotated[x][0], cube[x][0]), "Other layers should be unchanged");
    assert(cubesEqual(rotated[x][2], cube[x][2]), "Other layers should be unchanged");
  }
});

// Test 7: Rotation preserves piece count
test("rotation preserves piece count", () => {
  const cube = createSolvedCube();
  const rotatedX = rotateX(cube, 1, 1);
  const rotatedY = rotateY(cube, 1, 1);
  
  const countOriginal = cube.flat(2).length;
  const countRotatedX = rotatedX.flat(2).length;
  const countRotatedY = rotatedY.flat(2).length;
  
  assert(
    countOriginal === countRotatedX &&
    countOriginal === countRotatedY,
    "Rotation should preserve piece count"
  );
});

// Test 8: Rotation preserves unique IDs
test("rotation preserves unique IDs", () => {
  const cube = createSolvedCube();
  const rotated = rotateX(rotateY(cube, 1, 1), 0, -1);
  
  const idsOriginal = new Set(cube.flat(2).map(p => p.id));
  const idsRotated = new Set(rotated.flat(2).map(p => p.id));
  
  assert(
    idsOriginal.size === idsRotated.size &&
    [...idsOriginal].every(id => idsRotated.has(id)),
    "Rotation should preserve all unique IDs"
  );
});

// Test 9: Empty scramble returns original
test("empty scramble", () => {
  const cube = createSolvedCube();
  const { state, moves } = generateScramble(12345, cube, 0);
  
  assert(cubesEqual(cube, state) && moves.length === 0, "Empty scramble should return original");
});

// Test 10: Complex sequence reversibility
test("complex sequence reversibility", () => {
  const cube = createSolvedCube();
  
  // Apply a complex sequence
  let state = cube;
  const sequence = [
    { type: "X", layer: 0, dir: 1 },
    { type: "Y", layer: 1, dir: -1 },
    { type: "X", layer: 2, dir: 1 },
    { type: "Y", layer: 0, dir: 1 },
    { type: "X", layer: 1, dir: -1 }
  ];
  
  for (const move of sequence) {
    if (move.type === "X") {
      state = rotateX(state, move.layer, move.dir);
    } else {
      state = rotateY(state, move.layer, move.dir);
    }
  }
  
  // Apply inverse sequence
  for (let i = sequence.length - 1; i >= 0; i--) {
    const move = sequence[i];
    if (move.type === "X") {
      state = rotateX(state, move.layer, -move.dir);
    } else {
      state = rotateY(state, move.layer, -move.dir);
    }
  }
  
  assert(cubesEqual(cube, state), "Complex sequence should be reversible");
});

// Test 11: Camera face mapping - all 4 positions return valid 3x3 grids
test("camera face mapping returns valid grids", () => {
  const cube = createSolvedCube();
  
  for (let rot = 0; rot < 4; rot++) {
    camera.rot = rot;
    const face = getVisibleFace(cube);
    
    assert(face.length === 3, "Face should have 3 rows");
    assert(face[0].length === 3, "Each row should have 3 columns");
    assert(face[1].length === 3, "Each row should have 3 columns");
    assert(face[2].length === 3, "Each row should have 3 columns");
  }
});

// Test 12: Camera rotation changes visible face
test("camera rotation changes visible face", () => {
  const cube = createSolvedCube();
  
  camera.rot = 0;
  const face0 = getVisibleFace(cube);
  
  camera.rot = 1;
  const face1 = getVisibleFace(cube);
  
  // Faces should be different when camera rotates
  assert(!cubesEqual(face0, face1), "Camera rotation should change visible face");
});

// Test 13: Camera 4x rotation returns to original face
test("camera 4x rotation returns to original", () => {
  const cube = createSolvedCube();
  
  camera.rot = 0;
  camera.pitch = 0;
  const face0 = getVisibleFace(cube);
  
  camera.rot = 4;
  camera.pitch = 0;
  const face4 = getVisibleFace(cube);
  
  assert(cubesEqual(face0, face4), "Camera 4x rotation should return to original face");
});

// Test 14: Camera pitch 4x rotation returns to original face
test("camera pitch 4x rotation returns to original", () => {
  const cube = createSolvedCube();
  
  camera.rot = 0;
  camera.pitch = 0;
  const face0 = getVisibleFace(cube);
  
  camera.rot = 0;
  camera.pitch = 4;
  const face4 = getVisibleFace(cube);
  
  assert(cubesEqual(face0, face4), "Camera pitch 4x rotation should return to original face");
});

// Test 15: Camera pitch changes visible face
test("camera pitch changes visible face", () => {
  const cube = createSolvedCube();
  
  camera.rot = 0;
  camera.pitch = 0;
  const face0 = getVisibleFace(cube);
  
  camera.rot = 0;
  camera.pitch = 1;
  const face1 = getVisibleFace(cube);
  
  // Faces should be different when camera pitch changes
  assert(!cubesEqual(face0, face1), "Camera pitch should change visible face");
});

// Test 16: Interaction mapping - horizontal drag maps to Y rotation
test("horizontal drag maps to Y rotation", () => {
  const result = mapInteractionToRotation({ row: 1, col: 1, dx: 50, dy: 10 });
  assert(result.type === "Y", "Horizontal drag should map to Y rotation");
  assert(result.layer === 1, "Should use row as layer");
  assert(result.dir === 1, "Positive dx should give positive direction");
});

// Test 17: Interaction mapping - vertical drag maps to X rotation
test("vertical drag maps to X rotation", () => {
  const result = mapInteractionToRotation({ row: 1, col: 1, dx: 10, dy: 50 });
  assert(result.type === "X", "Vertical drag should map to X rotation");
  assert(result.layer === 1, "Should use col as layer");
  assert(result.dir === -1, "Positive dy should give negative direction");
});

// Test 18: Interaction mapping - negative dx
test("negative dx maps to negative direction", () => {
  const result = mapInteractionToRotation({ row: 0, col: 2, dx: -30, dy: 5 });
  assert(result.type === "Y", "Horizontal drag should map to Y rotation");
  assert(result.dir === -1, "Negative dx should give negative direction");
});

// Test 19: Interaction mapping - negative dy
test("negative dy maps to positive direction", () => {
  const result = mapInteractionToRotation({ row: 2, col: 0, dx: 5, dy: -40 });
  assert(result.type === "X", "Vertical drag should map to X rotation");
  assert(result.dir === 1, "Negative dy should give positive direction");
});

/* =========================
  RUN TESTS
========================= */

console.log("Running Hidden Face Test Suite...\n");

for (const t of tests) {
  const result = runTest(t);
  if (result) {
    passed++;
    console.log(`✓ ${t.name}`);
  } else {
    failed++;
    console.log(`✗ ${t.name}`);
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed out of ${tests.length} tests`);

if (failed === 0) {
  console.log("\n✓ All tests passed!");
  process.exit(0);
} else {
  console.log("\n✗ Some tests failed");
  process.exit(1);
}
