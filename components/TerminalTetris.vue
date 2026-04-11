<template>
  <div class="font-mono flex flex-col items-center justify-center w-full my-4">
    <div class="w-full max-w-sm border border-terminal-amber/30 bg-terminal-black/50 p-4 relative">
      <!-- Scorecard Box -->
      <div class="border border-terminal-amber/50 text-terminal-amber p-3 mb-4 w-full flex flex-col items-center shadow-md bg-black/60 relative">
        <button @click="$emit('close')" class="absolute top-1 right-2 text-terminal-amber-dim hover:text-red-500 z-20">[x]</button>
        
        <h3 class="text-purple-500 font-bold tracking-[0.4em] uppercase mb-2 border-b border-terminal-amber/30 w-[80%] text-center pb-1">Tetris</h3>
        <div class="w-full flex justify-between text-xs px-2 mt-1">
          <span>SCORE: <span class="text-terminal-blue">{{ String(score).padStart(4, '0') }}</span></span>
          <span class="text-terminal-amber-dim">Arrows to Move / Esc to Quit</span>
        </div>
      </div>

      <div v-if="gameOver" class="absolute inset-0 bg-black/80 flex items-center justify-center z-10 flex-col animate-pulse">
        <span class="text-red-500 font-bold text-xl mb-1">GAME OVER</span>
        <span class="text-terminal-amber text-sm">Press Enter to restart</span>
      </div>

      <!-- Game Board -->
      <div class="border-[3px] border-terminal-amber/40 inline-block bg-[#050505] p-1 mx-auto w-full flex justify-center shadow-inner">
        <!-- Render grid explicitly using grid template to absolutely abolish text vertical spacing bugs -->
        <div class="grid gap-[1px] bg-terminal-amber-dim/20 border border-terminal-amber-dim/50" :style="{ gridTemplateColumns: `repeat(${WIDTH}, minmax(0, 1fr))` }">
          <div v-for="(cell, i) in flattenedBoard" :key="i" :class="cell.bg" class="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
             <!-- Optional inner bevel or style can be added to the cell -->
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
const emit = defineEmits(['close'])

const WIDTH = 10;
const HEIGHT = 20;

// Board will hold index of the shape color, 0 means empty.
const board = ref(Array.from({length: HEIGHT}, () => Array(WIDTH).fill(0)));
const score = ref(0);
const gameOver = ref(false);

const SHAPES = [
  // I (Cyan)
  { blocks: [[1,1,1,1]], class: 'bg-cyan-400' },
  // O (Yellow)
  { blocks: [[1,1],[1,1]], class: 'bg-yellow-400' },
  // T (Purple)
  { blocks: [[0,1,0],[1,1,1]], class: 'bg-purple-500' },
  // L (Orange)
  { blocks: [[0,0,1],[1,1,1]], class: 'bg-orange-500' },
  // J (Blue)
  { blocks: [[1,0,0],[1,1,1]], class: 'bg-blue-500' },
  // S (Green)
  { blocks: [[0,1,1],[1,1,0]], class: 'bg-green-500' },
  // Z (Red)
  { blocks: [[1,1,0],[0,1,1]], class: 'bg-red-500' }
];

let piece = null;
let interval = null;

const newPiece = () => {
  const shapeIdx = Math.floor(Math.random() * SHAPES.length);
  const shape = SHAPES[shapeIdx];
  piece = {
    blocks: shape.blocks,
    class: shape.class,
    val: shapeIdx + 1, // Store 1-based index on board
    x: Math.floor((WIDTH - shape.blocks[0].length) / 2),
    y: 0
  };
  if (collide(piece.x, piece.y, piece.blocks)) {
    gameOver.value = true;
    clearInterval(interval);
  }
};

const collide = (px, py, blocks) => {
  for (let y = 0; y < blocks.length; y++) {
    for (let x = 0; x < blocks[y].length; x++) {
      if (blocks[y][x]) {
        if (px + x < 0 || px + x >= WIDTH || py + y >= HEIGHT || (py + y >= 0 && board.value[py + y][px + x])) {
          return true;
        }
      }
    }
  }
  return false;
};

const merge = () => {
  for (let y = 0; y < piece.blocks.length; y++) {
    for (let x = 0; x < piece.blocks[y].length; x++) {
      if (piece.blocks[y][x] && piece.y + y >= 0) {
        board.value[piece.y + y][piece.x + x] = piece.val;
      }
    }
  }
  
  let linesCleared = 0;
  for (let y = HEIGHT - 1; y >= 0; y--) {
    if (board.value[y].every(c => c > 0)) {
      board.value.splice(y, 1);
      board.value.unshift(Array(WIDTH).fill(0));
      linesCleared++;
      y++; 
    }
  }
  
  if (linesCleared > 0) {
    score.value += linesCleared * 100;
  }
};

const moveDown = () => {
  if (gameOver.value) return;
  if (!collide(piece.x, piece.y + 1, piece.blocks)) {
    piece.y++;
  } else {
    merge();
    newPiece();
  }
  board.value = [...board.value];
};

const onKeyDown = (e) => {
  if (e.key === 'Escape') {
    emit('close');
    return;
  }
  if (gameOver.value && e.key === 'Enter') {
    reset();
    return;
  }
  if (gameOver.value) return;

  if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
    e.preventDefault();
  }

  if (e.key === 'ArrowLeft') {
    if (!collide(piece.x - 1, piece.y, piece.blocks)) piece.x--;
  } else if (e.key === 'ArrowRight') {
    if (!collide(piece.x + 1, piece.y, piece.blocks)) piece.x++;
  } else if (e.key === 'ArrowDown') {
    moveDown();
  } else if (e.key === 'ArrowUp') {
    const blocks = piece.blocks;
    const rotated = blocks[0].map((val, index) => blocks.map(row => row[index]).reverse());
    if (!collide(piece.x, piece.y, rotated)) {
      piece.blocks = rotated;
    }
  }
  board.value = [...board.value];
};

const reset = () => {
  board.value = Array.from({length: HEIGHT}, () => Array(WIDTH).fill(0));
  score.value = 0;
  gameOver.value = false;
  newPiece();
  if (interval) clearInterval(interval);
  interval = setInterval(moveDown, 350);
};

onMounted(() => {
  window.addEventListener('keydown', onKeyDown, { passive: false });
  reset();
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
  if (interval) clearInterval(interval);
});

const flattenedBoard = computed(() => {
  const cells = [];
  
  // Make a temporary copy for rendering the active piece
  let tempBoard = board.value.map(row => [...row]);
  
  if (piece && !gameOver.value) {
    for (let y = 0; y < piece.blocks.length; y++) {
      for (let x = 0; x < piece.blocks[y].length; x++) {
        if (piece.blocks[y][x] && piece.y + y >= 0 && piece.y + y < HEIGHT) {
          tempBoard[piece.y + y][piece.x + x] = piece.val;
        }
      }
    }
  }

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const val = tempBoard[y][x];
      if (val === 0) {
        cells.push({ bg: 'bg-black' });
      } else {
        const bgClass = SHAPES[val - 1].class;
        // Adding a subtle inset shadow makes it pop distinctly like a block
        cells.push({ bg: `${bgClass} shadow-[inset_0_0_4px_rgba(0,0,0,0.4)]` });
      }
    }
  }
  return cells;
});
</script>
