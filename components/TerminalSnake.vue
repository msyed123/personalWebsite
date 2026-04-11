<template>
  <div class="font-mono flex flex-col items-center justify-center w-full my-4">
    <div class="w-full max-w-sm border border-terminal-amber/30 bg-terminal-black/50 p-4 relative">
      <!-- Scorecard Box -->
      <div class="border border-terminal-amber/50 text-terminal-amber p-3 mb-4 w-full flex flex-col items-center shadow-md bg-black/60 relative">
        <button @click="$emit('close')" class="absolute top-1 right-2 text-terminal-amber-dim hover:text-red-500 z-20">[x]</button>
        
        <h3 class="text-green-500 font-bold tracking-[0.4em] uppercase mb-2 border-b border-terminal-amber/30 w-[80%] text-center pb-1">Snake</h3>
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
        <div class="grid gap-[1px] bg-terminal-amber-dim/20 border border-terminal-amber-dim/50" :style="{ gridTemplateColumns: `repeat(${WIDTH}, minmax(0, 1fr))` }">
          <div v-for="(cell, i) in flattenedBoard" :key="i" :class="cell.bg" class="w-3 h-3 sm:w-[1.125rem] sm:h-[1.125rem]"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'

const emit = defineEmits(['close'])

const WIDTH = 20;
const HEIGHT = 14;
const score = ref(0);
const gameOver = ref(false);

const snake = ref([{x: 5, y: 5}]);
const food = ref({x: 10, y: 5});
let dx = 1;
let dy = 0;
let nextDx = 1;
let nextDy = 0;

let interval = null;

const spawnFood = () => {
  let newFood;
  while(true) {
    newFood = { x: Math.floor(Math.random() * WIDTH), y: Math.floor(Math.random() * HEIGHT) };
    if (!snake.value.some(s => s.x === newFood.x && s.y === newFood.y)) break;
  }
  food.value = newFood;
};

const tick = () => {
  if (gameOver.value) return;
  dx = nextDx;
  dy = nextDy;
  
  const head = snake.value[0];
  const newHead = { x: head.x + dx, y: head.y + dy };
  
  if (newHead.x < 0 || newHead.x >= WIDTH || newHead.y < 0 || newHead.y >= HEIGHT || snake.value.some(s => s.x === newHead.x && s.y === newHead.y)) {
    gameOver.value = true;
    clearInterval(interval);
    return;
  }
  
  snake.value.unshift(newHead);
  if (newHead.x === food.value.x && newHead.y === food.value.y) {
    score.value += 10;
    spawnFood();
  } else {
    snake.value.pop();
  }
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
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
  }
  if (e.key === 'ArrowUp' && dy !== 1) { nextDx = 0; nextDy = -1; }
  if (e.key === 'ArrowDown' && dy !== -1) { nextDx = 0; nextDy = 1; }
  if (e.key === 'ArrowLeft' && dx !== 1) { nextDx = -1; nextDy = 0; }
  if (e.key === 'ArrowRight' && dx !== -1) { nextDx = 1; nextDy = 0; }
};

const reset = () => {
  snake.value = [{x: 5, y: 5}];
  dx = 1; dy = 0; nextDx = 1; nextDy = 0;
  score.value = 0;
  gameOver.value = false;
  spawnFood();
  if(interval) clearInterval(interval);
  interval = setInterval(tick, 100);
}

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
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (food.value.x === x && food.value.y === y) {
        cells.push({ bg: 'bg-red-500 shadow-[inset_0_0_2px_rgba(0,0,0,0.5)]' });
      } else {
        const snakePart = snake.value.findIndex(s => s.x === x && s.y === y);
        if (snakePart !== -1) {
          cells.push({ bg: snakePart === 0 ? 'bg-green-400' : 'bg-green-600' });
        } else {
          cells.push({ bg: 'bg-black' });
        }
      }
    }
  }
  return cells;
});
</script>
