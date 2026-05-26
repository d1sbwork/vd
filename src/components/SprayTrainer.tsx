/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Weapon } from '../types';
import { Award, Zap, Crosshair, ChevronRight, RefreshCw } from 'lucide-react';

const WEAPONS: Weapon[] = [
  {
    name: 'AKR',
    type: 'rifle',
    damage: 38,
    recoilXMultiplier: 1.5,
    recoilYMultiplier: 2.8,
    ammoCapacity: 30,
    sprayPattern: [
      { x: 0, y: 0 },
      { x: 0.1, y: -0.8 },
      { x: -0.1, y: -1.5 },
      { x: 0.2, y: -2.3 },
      { x: 0.5, y: -2.9 },
      { x: 0.8, y: -3.2 },
      { x: 1.1, y: -3.4 },
      { x: 1.3, y: -3.2 },
      { x: 0.9, y: -3.3 },
      { x: 0.4, y: -3.4 },
      { x: -0.3, y: -3.5 },
      { x: -0.9, y: -3.4 },
      { x: -1.3, y: -3.3 },
      { x: -1.5, y: -3.4 },
      { x: -1.1, y: -3.4 },
      { x: -0.4, y: -3.3 },
      { x: 0.3, y: -3.4 },
      { x: 0.8, y: -3.5 },
    ],
  },
  {
    name: 'M4',
    type: 'rifle',
    damage: 30,
    recoilXMultiplier: 0.9,
    recoilYMultiplier: 2.1,
    ammoCapacity: 30,
    sprayPattern: [
      { x: 0, y: 0 },
      { x: 0.05, y: -0.6 },
      { x: -0.05, y: -1.1 },
      { x: -0.1, y: -1.6 },
      { x: 0.1, y: -2.0 },
      { x: 0.3, y: -2.3 },
      { x: 0.5, y: -2.5 },
      { x: 0.5, y: -2.6 },
      { x: 0.2, y: -2.6 },
      { x: -0.2, y: -2.6 },
      { x: -0.5, y: -2.5 },
      { x: -0.6, y: -2.6 },
      { x: -0.3, y: -2.7 },
      { x: 0.1, y: -2.7 },
    ],
  },
  {
    name: 'M40',
    type: 'sniper',
    damage: 75,
    recoilXMultiplier: 0.2,
    recoilYMultiplier: 5.5,
    ammoCapacity: 10,
    sprayPattern: [
      { x: 0, y: 0 },
      { x: 0, y: -4.5 },
    ],
  },
];

interface SprayTrainerProps {
  userId: string;
  currentBestSpray?: number;
  onStatsUpdate: (sprayAcc: number) => void;
}

// Visual sound generator for weapon bullet audio
function playFireSound(freq: number, noiseFactor: number, duration: number) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Create oscillator and bandpass noise for aggressive firearm boom
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + duration);
    
    gain.gain.setValueAtTime(0.20, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // sound safety
  }
}

export default function SprayTrainer({ userId, currentBestSpray, onStatsUpdate }: SprayTrainerProps) {
  const [selectedWeapon, setSelectedWeapon] = useState<Weapon>(WEAPONS[0]);
  const [ammo, setAmmo] = useState(selectedWeapon.ammoCapacity);
  const [isFiring, setIsFiring] = useState(false);
  const [bullets, setBullets] = useState<{ x: number; y: number; isBullseye: boolean; id: number }[]>([]);
  const [recoilOffset, setRecoilOffset] = useState({ x: 0, y: 0 });
  const [accuracyRating, setAccuracyRating] = useState<number | null>(null);

  const firingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentShotIndexRef = useRef<number>(0);
  const targetCanvasRef = useRef<HTMLDivElement>(null);

  // Restart ammo count on weapon change
  useEffect(() => {
    setAmmo(selectedWeapon.ammoCapacity);
    setBullets([]);
    setRecoilOffset({ x: 0, y: 0 });
    setAccuracyRating(null);
    currentShotIndexRef.current = 0;
  }, [selectedWeapon]);

  const handleStartFiring = (e: React.MouseEvent) => {
    e.preventDefault();
    if (ammo <= 0 || isFiring) return;

    setIsFiring(true);
    setAccuracyRating(null);

    const shotInterval = selectedWeapon.type === 'sniper' ? 850 : 130;

    const fireBullet = () => {
      setAmmo((prev) => {
        if (prev <= 1) {
          handleStopFiring();
          return 0;
        }

        const currentShotIndex = currentShotIndexRef.current;
        const pattern = selectedWeapon.sprayPattern;
        // Fetch offsets from spray template, repeating final offsets if pattern completes
        const patternOffset = pattern[Math.min(currentShotIndex, pattern.length - 1)];

        // Compute simulated kick-up
        const driftX = patternOffset.x * selectedWeapon.recoilXMultiplier * 18;
        const driftY = patternOffset.y * selectedWeapon.recoilYMultiplier * 15;

        // Shift standard recoil HUD
        setRecoilOffset({ x: driftX, y: driftY });

        // Place impact bullet holes
        if (targetCanvasRef.current) {
          const rect = targetCanvasRef.current.getBoundingClientRect();
          const targetCenterX = rect.width / 2;
          const targetCenterY = rect.height / 2;

          // Standard deviation offset from fire center
          // Attackers have to drag opposite direction to balance.
          // For simplicity and feedback: bullets are plotted with recoil drift applied.
          // To compensate recoil, the user should be pulling down relative to the crosshair.
          const spreadFactor = 6;
          const noiseX = (Math.random() - 0.5) * spreadFactor;
          const noiseY = (Math.random() - 0.5) * spreadFactor;

          const finalX = targetCenterX + driftX + noiseX;
          const finalY = targetCenterY + driftY + noiseY;

          // Compute absolute distance to central bullseye to register rating
          const dx = finalX - targetCenterX;
          const dy = finalY - targetCenterY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const isBullseye = distance < 35;

          setBullets((prevBullets) => [
            ...prevBullets,
            { x: finalX, y: finalY, isBullseye, id: Math.random() },
          ]);
        }

        // Play synthetic gunshot sound
        playFireSound(selectedWeapon.type === 'sniper' ? 140 : 250, 0.4, 0.12);

        currentShotIndexRef.current = currentShotIndex + 1;
        return prev - 1;
      });
    };

    // First bullet instant
    fireBullet();
    firingTimerRef.current = setInterval(fireBullet, shotInterval);
  };

  const handleStopFiring = () => {
    if (firingTimerRef.current) {
      clearInterval(firingTimerRef.current);
      firingTimerRef.current = null;
    }
    setIsFiring(false);
    setRecoilOffset({ x: 0, y: 0 });
    currentShotIndexRef.current = 0;

    // Calculate accuracy rating of spray
    if (bullets.length > 0) {
      if (targetCanvasRef.current) {
        const rect = targetCanvasRef.current.getBoundingClientRect();
        const targetCenterX = rect.width / 2;
        const targetCenterY = rect.height / 2;

        const correctHits = bullets.filter((b) => {
          const dx = b.x - targetCenterX;
          const dy = b.y - targetCenterY;
          return Math.sqrt(dx * dx + dy * dy) < 65; // Close to center
        }).length;

        const sprayAccuracy = Math.round((correctHits / bullets.length) * 100);
        setAccuracyRating(sprayAccuracy);

        // Save progress if better
        if (!currentBestSpray || sprayAccuracy > currentBestSpray) {
          onStatsUpdate(sprayAccuracy);

          try {
            const userRef = doc(db, 'users', userId);
            updateDoc(userRef, {
              sprayAccuracyBest: sprayAccuracy,
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
          }
        }
      }
    }
  };

  const handleReset = () => {
    setAmmo(selectedWeapon.ammoCapacity);
    setBullets([]);
    setRecoilOffset({ x: 0, y: 0 });
    setAccuracyRating(null);
    currentShotIndexRef.current = 0;
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm">
      
      {/* Target Info */}
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="flex items-center gap-2 font-sans text-lg font-bold text-white">
            <Zap className="h-5 w-5 text-amber-400" />
            <span>Тренировка Спрея и Отдачи (Spray Control)</span>
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Зажмите кнопку мыши по центру мишени. Оружие начнет уводить вверх по схеме отдачи Стендаффа!
          </p>
        </div>

        {/* Weapons Selection */}
        <div className="flex gap-2">
          {WEAPONS.map((weapon) => (
            <button
              key={weapon.name}
              disabled={isFiring}
              onClick={() => setSelectedWeapon(weapon)}
              className={`rounded-lg border px-3 py-1.5 font-sans text-xs font-bold transition-all ${
                selectedWeapon.name === weapon.name
                  ? 'border-blue-500 bg-blue-600/10 text-blue-400'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              {weapon.name}
            </button>
          ))}
        </div>
      </div>

      {/* Stats HUD */}
      <div className="grid grid-cols-3 gap-4 py-4">
        
        {/* Bullets count */}
        <div className="rounded-xl bg-slate-950 p-4 border border-slate-800/80">
          <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-0.5">Патроны</span>
          <span className="font-mono text-xl font-bold text-white">
            {ammo} / {selectedWeapon.ammoCapacity}
          </span>
        </div>

        {/* Accuracy Score */}
        <div className="rounded-xl bg-slate-950 p-4 border border-slate-800/80">
          <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-0.5">Кучность спрея</span>
          <span className="font-mono text-xl font-bold text-amber-500">
            {accuracyRating !== null ? `${accuracyRating}%` : '--'}
          </span>
        </div>

        {/* High Score */}
        <div className="rounded-xl bg-slate-950 p-4 border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
            <Award className="h-4 w-4 text-emerald-400" />
            <span className="text-[10px] uppercase font-bold tracking-widest">Рекорд</span>
          </div>
          <span className="font-mono text-xl font-bold text-emerald-400">
            {currentBestSpray !== undefined ? `${currentBestSpray}%` : '0%'}
          </span>
        </div>

      </div>

      {/* Firing Target Arena layout */}
      <div className="grid gap-6 md:grid-cols-12 items-center">
        
        {/* Left target display layout */}
        <div className="md:col-span-8 flex flex-col items-center">
          <div 
            ref={targetCanvasRef}
            onMouseDown={handleStartFiring}
            onMouseUp={handleStopFiring}
            onMouseLeave={handleStopFiring}
            onTouchStart={handleStartFiring}
            onTouchEnd={handleStopFiring}
            className="relative h-[320px] w-full max-w-[420px] rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden hover:border-slate-700 transition-colors select-none"
          >
            
            {/* Shooter Target Paper circles */}
            <div className="absolute rounded-full border border-slate-800 h-[240px] w-[240px]" />
            <div className="absolute rounded-full border border-slate-800 h-[170px] w-[170px]" />
            <div className="absolute rounded-full border border-slate-700 h-[100px] w-[100px] bg-slate-900/10" />
            <div className="absolute rounded-full border-2 border-red-500/50 h-[35px] w-[35px] bg-red-500/10" />

            {/* Simulated bullet holes */}
            {bullets.map((b) => (
              <div
                key={b.id}
                className={`absolute rounded-full border shadow-sm ${
                  b.isBullseye 
                    ? 'h-2.5 w-2.5 bg-red-400 border-white' 
                    : 'h-2 w-2 bg-slate-200 border-slate-500'
                }`}
                style={{
                  left: `${b.x - 4}px`,
                  top: `${b.y - 4}px`,
                }}
              />
            ))}

            {/* Recoil Sway HUD marker */}
            <div 
              className="absolute pointer-events-none transition-all duration-75"
              style={{
                transform: `translate(${recoilOffset.x}px, ${recoilOffset.y}px)`,
              }}
            >
              <Crosshair className="h-6 w-6 text-red-500 drop-shadow animate-pulse" />
            </div>

            {/* Helper Hint popup */}
            {bullets.length === 0 && (
              <span className="absolute bottom-4 text-[10px] text-slate-500 font-sans text-center px-4 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800">
                Зажмите левую кнопку мыши по центру мишени, чтобы открыть огонь!
              </span>
            )}
          </div>
        </div>

        {/* Right blueprints panel */}
        <div className="md:col-span-4 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3.5">
            <h5 className="text-xs uppercase font-bold tracking-wider text-slate-400">Характеристики {selectedWeapon.name}</h5>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Урон:</span>
                <span className="font-mono text-white">{selectedWeapon.damage} HP</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Емкость магазина:</span>
                <span className="font-mono text-white">{selectedWeapon.ammoCapacity} патр.</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Сложность зажима:</span>
                <span className={`font-semibold ${
                  selectedWeapon.name === 'AKR' ? 'text-red-400' : 'text-blue-400'
                }`}>
                  {selectedWeapon.name === 'AKR' ? 'Высокая (T-образный спрей)' : 'Средняя (Окружность)'}
                </span>
              </div>
            </div>

            {/* Draw recoil guide scheme */}
            <div className="relative h-28 w-full rounded border border-slate-850 bg-slate-900/40 overflow-hidden flex flex-col justify-end p-2.5">
              <span className="absolute top-2 left-2 text-[10px] uppercase font-bold tracking-widest text-slate-600">Рисунок зажима</span>
              
              {/* Recoil line simulation */}
              <div className="absolute inset-x-0 bottom-4 flex justify-center">
                <svg className="h-16 w-32 stroke-blue-500/50 fill-none stroke-2 antialiased">
                  {selectedWeapon.name === 'AKR' ? (
                    <path d="M 64 64 Q 64 30 74 20 T 94 15 T 44 15" />
                  ) : (
                    <path d="M 64 64 Q 64 45 74 35 T 54 28" />
                  )}
                </svg>
              </div>
              <div className="text-[9px] text-center text-slate-500">Ведите мышь в противоположную сторону рисунка отдачи.</div>
            </div>

            <button
              onClick={handleReset}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-900 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Очистить мишень</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
