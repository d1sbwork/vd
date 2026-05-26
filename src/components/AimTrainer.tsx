/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Play, RotateCcw, Crosshair, Award, Flame, Timer } from 'lucide-react';

interface AimTrainerProps {
  userId: string;
  currentBestReaction?: number;
  currentBestAccuracy?: number;
  onStatsUpdate: (speed: number, accuracy: number) => void;
}

// Low-overhead synthesizer for shooter audio feedback
function playSynthSound(freq: number, type: OscillatorType, duration: number) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + duration);
    
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // Sound engine block safety
  }
}

export default function AimTrainer({ userId, currentBestReaction, currentBestAccuracy, onStatsUpdate }: AimTrainerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'pro'>('medium');
  const [target, setTarget] = useState<{ x: number; y: number; size: number; id: number } | null>(null);
  
  // Stats
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(30); // 30s match

  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const targetSpawnTimeRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync state values with refs to prevent game intervals from seeing stale state
  const hitsRef = useRef(0);
  const missesRef = useRef(0);
  const reactionTimesRef = useRef<number[]>([]);

  useEffect(() => {
    hitsRef.current = hits;
  }, [hits]);

  useEffect(() => {
    missesRef.current = misses;
  }, [misses]);

  useEffect(() => {
    reactionTimesRef.current = reactionTimes;
  }, [reactionTimes]);

  const getDifficultySettings = () => {
    switch (difficulty) {
      case 'easy': return { targetSize: 45, spawnRate: 1400 };
      case 'pro': return { targetSize: 24, spawnRate: 650 };
      default: return { targetSize: 34, spawnRate: 900 };
    }
  };

  const spawnTarget = () => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    const padding = 40;
    
    const settings = getDifficultySettings();
    const randX = Math.random() * (width - padding * 2) + padding;
    const randY = Math.random() * (height - padding * 2) + padding;

    setTarget({
      x: randX,
      y: randY,
      size: settings.targetSize,
      id: Math.random(),
    });
    
    targetSpawnTimeRef.current = performance.now();
  };

  const startGame = () => {
    setIsPlaying(true);
    setHits(0);
    hitsRef.current = 0;
    setMisses(0);
    missesRef.current = 0;
    setClicks(0);
    setStreak(0);
    setBestStreak(0);
    setReactionTimes([]);
    reactionTimesRef.current = [];
    setTimeLeft(30);
    
    playSynthSound(500, 'square', 0.15);
    setTimeout(() => spawnTarget(), 300);
  };

  const stopGame = async () => {
    setIsPlaying(false);
    setTarget(null);
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);

    const currentHits = hitsRef.current;
    const currentMisses = missesRef.current;
    const currentReactions = reactionTimesRef.current;

    // Calculate final score using fresh states from refs
    const totalClicks = currentHits + currentMisses;
    const finalAccuracy = totalClicks > 0 ? Math.round((currentHits / totalClicks) * 100) : 0;
    const avReaction = currentReactions.length > 0 
      ? Math.round(currentReactions.reduce((a, b) => a + b, 0) / currentReactions.length) 
      : 0;

    if (currentHits > 0) {
      // Audio cue for game complete
      playSynthSound(600, 'triangle', 0.45);

      // Check if we improved record
      const isBetterReaction = !currentBestReaction || (avReaction > 0 && avReaction < currentBestReaction);
      const isBetterAccuracy = !currentBestAccuracy || finalAccuracy > currentBestAccuracy;

      if (isBetterReaction || isBetterAccuracy) {
        onStatsUpdate(
          isBetterReaction ? avReaction : (currentBestReaction || 0),
          isBetterAccuracy ? finalAccuracy : (currentBestAccuracy || 0)
        );

        // Update profile in database
        try {
          const userRef = doc(db, 'users', userId);
          const updates: any = {};
          if (isBetterReaction && avReaction > 0) updates.aimReactionBest = avReaction;
          if (isBetterAccuracy) updates.aimAccuracyBest = finalAccuracy;
          await updateDoc(userRef, updates);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
        }
      }
    }
  };

  // Target spawning loop - responds to hits & misses to immediately present next targets
  useEffect(() => {
    if (isPlaying) {
      const settings = getDifficultySettings();

      // Loop to auto despawn and respawn targets on timeout (miss)
      const spawnLoop = setInterval(() => {
        if (target) {
          // Player failed to hit target in time -> registers as a miss
          setMisses((prev) => prev + 1);
          setStreak(0);
          playSynthSound(120, 'sine', 0.1);
        }
        spawnTarget();
      }, settings.spawnRate);

      playIntervalRef.current = spawnLoop;

      return () => {
        clearInterval(spawnLoop);
      };
    }
    return undefined;
  }, [isPlaying, target, difficulty]);

  // High-precision independent countdown timer (doesn't clear or reset with new targets)
  useEffect(() => {
    if (isPlaying) {
      const countClock = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      gameTimerRef.current = countClock;

      return () => {
        clearInterval(countClock);
      };
    }
    return undefined;
  }, [isPlaying]);

  // End game immediately when timer runs out
  useEffect(() => {
    if (isPlaying && timeLeft === 0) {
      stopGame();
    }
  }, [timeLeft, isPlaying]);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPlaying) return;
    setClicks((prev) => prev + 1);
  };

  const handleTargetHit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Stop trigger of parent container "Click"
    if (!isPlaying || !target) return;

    // Record timing delta
    const hitTime = performance.now();
    const reactTime = hitTime - targetSpawnTimeRef.current;
    
    setReactionTimes((prev) => [...prev, reactTime]);
    setHits((prev) => prev + 1);
    setClicks((prev) => prev + 1);
    
    const newStreak = streak + 1;
    setStreak(newStreak);
    if (newStreak > bestStreak) setBestStreak(newStreak);

    // Bullet firearm sound
    playSynthSound(1000, 'sawtooth', 0.08);

    // Reset target immediately to click next one
    setTarget(null);
    spawnTarget();
  };

  // Accuracy calculation helper
  const accuracy = clicks > 0 ? Math.round((hits / clicks) * 100) : 0;
  const currentAvgReaction = reactionTimes.length > 0 
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length) 
    : 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm">
      
      {/* Title & Stats */}
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="flex items-center gap-2 font-sans text-lg font-bold text-white">
            <Crosshair className="h-5 w-5 text-blue-400" />
            <span>Тренировка реакции и аима (Target Clicker)</span>
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Кликайте по появляющимся мишеням как можно быстрее. Промахи сбивают серию комбо!
          </p>
        </div>

        {/* Difficulty Controls */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {(['easy', 'medium', 'pro'] as const).map((lvl) => (
            <button
              key={lvl}
              disabled={isPlaying}
              onClick={() => setDifficulty(lvl)}
              className={`rounded px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-wider transition-all ${
                difficulty === lvl
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 hover:text-slate-300 disabled:opacity-40'
              }`}
            >
              {lvl === 'easy' ? 'Изи' : lvl === 'medium' ? 'Медиум' : 'Про'}
            </button>
          ))}
        </div>
      </div>

      {/* Real-time stats HUD */}
      <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-5">
        
        {/* Time Left */}
        <div className="rounded-lg bg-slate-950 px-4 py-3 border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
            <Timer className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Время</span>
          </div>
          <span className="font-mono text-xl font-bold text-white">{timeLeft}s</span>
        </div>

        {/* Hits */}
        <div className="rounded-lg bg-slate-950 px-4 py-3 border border-slate-800/80">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Попадания</span>
          <span className="font-mono text-xl font-bold text-emerald-400">{hits}</span>
        </div>

        {/* Accuracy */}
        <div className="rounded-lg bg-slate-950 px-4 py-3 border border-slate-800/80">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Точность</span>
          <span className="font-mono text-xl font-bold text-amber-400">{accuracy}%</span>
        </div>

        {/* Average Reaction */}
        <div className="rounded-lg bg-slate-950 px-4 py-3 border border-slate-800/80">
          <div className="flex items-center gap-1 text-slate-500 mb-0.5">
            <Award className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Реакция</span>
          </div>
          <span className="font-mono text-xl font-bold text-indigo-400">
            {currentAvgReaction > 0 ? `${currentAvgReaction} ms` : '0'}
          </span>
        </div>

        {/* Hot Streak */}
        <div className="rounded-lg bg-slate-950 px-4 py-3 border border-slate-800/80 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1 text-slate-500 mb-0.5">
            <Flame className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Комбо</span>
          </div>
          <span className="font-mono text-xl font-bold text-orange-400">{streak}</span>
        </div>

      </div>

      {/* Target practice screen grid area */}
      <div 
        ref={containerRef}
        onClick={handleContainerClick}
        className={`relative h-[350px] w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 px-4 shadow-inner transition-colors ${
          isPlaying ? 'cursor-crosshair' : ''
        }`}
      >
        {/* Tactical grid graphic */}
        <div className="absolute inset-0 grid grid-cols-12 grid-rows-6 opacity-[0.03] pointer-events-none">
          {Array.from({ length: 72 }).map((_, i) => (
            <div key={i} className="border border-blue-500" />
          ))}
        </div>

        {!isPlaying ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950/40">
            <Crosshair className="h-12 w-12 text-slate-700 animate-pulse mb-3" />
            <p className="text-sm text-slate-400 mb-4 max-w-sm">
              Проверьте свой аим перед соревновательными катками! Рекордные показатели запишутся в ваш профиль.
            </p>
            <button
              onClick={startGame}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 font-sans text-sm font-bold text-white shadow-lg shadow-blue-500/10 hover:from-blue-500 hover:to-indigo-500 transition-all cursor-pointer"
            >
              <Play className="h-4 w-4" />
              <span>Начать тренировку (30 сек)</span>
            </button>
          </div>
        ) : (
          target && (
            <button
              onClick={handleTargetHit}
              className="absolute flex items-center justify-center rounded-full bg-radial from-red-500 via-rose-600 to-rose-950 shadow-lg border-2 border-white/60 active:scale-95 transition-transform"
              style={{
                left: `${target.x - target.size / 2}px`,
                top: `${target.y - target.size / 2}px`,
                width: `${target.size}px`,
                height: `${target.size}px`,
              }}
            >
              {/* Bullseye center indicator */}
              <div className="h-2 w-2 rounded-full bg-white shadow-sm" />
            </button>
          )
        )}
      </div>

      {/* Interactive Finish button during active practice */}
      {isPlaying && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={stopGame}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-950/20 px-4 py-2.5 font-sans text-xs font-bold text-red-400 hover:text-white hover:bg-red-900/30 transition-all cursor-pointer"
          >
            <span>Завершить тренировку</span>
          </button>
        </div>
      )}

      {/* Records Panel */}
      <div className="flex items-center justify-between mt-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/50">
        <span className="text-xs text-slate-500 font-medium">Ваши личные рекорды на платформе:</span>
        <div className="flex gap-4 text-xs font-mono">
          <span className="text-indigo-400 font-medium">Реакция: <strong className="text-white">{currentBestReaction || '--'} ms</strong></span>
          <span className="text-amber-400 font-medium">Точность: <strong className="text-white">{currentBestAccuracy || '--'}%</strong></span>
        </div>
      </div>

    </div>
  );
}
