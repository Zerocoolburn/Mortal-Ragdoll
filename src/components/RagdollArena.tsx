import { useRef, useEffect, useCallback, useState } from 'react';
import { createGameState, updateGame } from '@/game/engine';
import { renderGame, renderWinnerScreen } from '@/game/renderer';
import { ARENA_WIDTH, ARENA_HEIGHT, GameState } from '@/game/types';

const WINNER_DISPLAY_FRAMES = 300; // 5 seconds at 60fps

const RagdollArena = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState>(createGameState(1));
  const animRef = useRef<number>(0);
  const winnerTimerRef = useRef<number>(0);

  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = stateRef.current;

    if (state.gameOver) {
      winnerTimerRef.current++;
      // Still render the game underneath
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderGame(ctx, state, canvas);
      if (state.winner) {
        renderWinnerScreen(ctx, state.winner, state, canvas, WINNER_DISPLAY_FRAMES - winnerTimerRef.current);
      }

      if (winnerTimerRef.current >= WINNER_DISPLAY_FRAMES) {
        // Reset
        const nextRound = state.roundNumber + 1;
        stateRef.current = createGameState(nextRound);
        winnerTimerRef.current = 0;
      }
    } else {
      updateGame(state);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      renderGame(ctx, state, canvas);
    }

    animRef.current = requestAnimationFrame(gameLoop);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // High DPI support
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    animRef.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animRef.current);
  }, [gameLoop]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full block"
      style={{ imageRendering: 'auto' }}
    />
  );
};

export default RagdollArena;
