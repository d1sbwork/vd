/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameMode, LobbyStatus } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { X, PlayCircle, ShieldCheck, HelpCircle } from 'lucide-react';

interface CreateLobbyModalProps {
  userId: string;
  userName: string;
  userAvatar: string;
  userStandoffId: string;
  userIsVerified: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const STAN_MAPS = [
  'Prison',
  'Hanami',
  'Rust',
  'Dune',
  'Breeze',
  'Province',
  'Sandstone'
];

export default function CreateLobbyModal({
  userId,
  userName,
  userAvatar,
  userStandoffId,
  userIsVerified,
  onClose,
  onSuccess
}: CreateLobbyModalProps) {
  const [lobbyCode, setLobbyCode] = useState('');
  const [map, setMap] = useState('Sandstone');
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.CLASSIC_DM);
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lobbyCode.trim()) {
      setError('Ссылка на лобби обязательна!');
      return;
    }
    if (lobbyCode.trim().length < 3 || lobbyCode.trim().length > 150) {
      setError('Неправильная длина ссылки лобби (3-150 символов)!');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const path = 'lobbies';
    try {
      const activeLobbyData = {
        creatorId: userId,
        creatorName: userName,
        creatorAvatar: userAvatar || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${userName}`,
        creatorStandoffId: userStandoffId,
        creatorIsVerified: userIsVerified,
        gameMode,
        map,
        lobbyCode: lobbyCode.trim(),
        maxPlayers,
        joinedPlayerCount: 1,
        joinedPlayers: [
          {
            id: userId,
            displayName: userName,
            avatarUrl: userAvatar || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${userName}`,
            standoffId: userStandoffId,
            role: userIsVerified ? 'verified_host' : 'user'
          }
        ],
        description: description.trim() || 'Залетайте в лобби, катаем ДМ / дуэли!',
        status: LobbyStatus.ACTIVE,
      };

      await addDoc(collection(db, path), {
        ...activeLobbyData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Dispatch real-time Telegram notification via backend REST proxy
      fetch('/api/notify/created', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...activeLobbyData,
          appUrl: window.location.origin
        }),
      }).catch((apiErr) => {
        console.warn('Telegram REST notification ping failed:', apiErr);
      });

      onSuccess();
      onClose();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-blue-500/30 bg-slate-900 shadow-2xl shadow-blue-500/10">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/40 p-5">
          <div className="flex items-center gap-2">
            <PlayCircle className="h-6 w-6 text-blue-400" />
            <h3 className="font-sans text-xl font-bold text-white tracking-tight">Создать Лобби Standoff 2</h3>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-3 text-sm text-rose-400">
              {error}
            </div>
          )}

          {/* Lobby Link */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Ссылка на Лобби Standoff 2 <span className="text-blue-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Вставьте ссылку на Лобби (напр. standoff2://lobby/1294819 или веб-ссылку)"
              value={lobbyCode}
              onChange={(e) => setLobbyCode(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 font-sans text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none transition-colors"
            />
            <p className="text-[10px] text-amber-400 font-medium">
              ⚠️ Внимание: Для подключения игроков обязательно нужна рабочая ссылка на лобби из игры Standoff 2! Скопируйте её в игре и вставьте сюда.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Game Mode */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Режим Игры</label>
              <select
                value={gameMode}
                onChange={(e) => setGameMode(e.target.value as GameMode)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
              >
                <option value={GameMode.CLASSIC_DM}>Десматч (DM)</option>
                <option value={GameMode.COMPETITIVE}>Соревновательный (MM)</option>
                <option value={GameMode.ALLIES}>Союзники (2x2)</option>
                <option value={GameMode.CUSTOM_DUEL}>Дуэль (1x1)</option>
                <option value={GameMode.SPRAY_TRAINING}>Паркур/Спрей Клаб</option>
              </select>
            </div>

            {/* Map Selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Выбор Карты</label>
              <select
                value={map}
                onChange={(e) => setMap(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
              >
                {STAN_MAPS.map((mapName) => (
                  <option key={mapName} value={mapName}>{mapName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Max Players */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Макс. Игроков</label>
              <input
                type="number"
                min={2}
                max={20}
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Verification Status info */}
            <div className="flex flex-col justify-center space-y-1 p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Ваш статус хоста</span>
              <div className="flex items-center gap-1.5 text-xs">
                {userIsVerified ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-400 font-medium">Проверенный хост</span>
                  </>
                ) : (
                  <>
                    <HelpCircle className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-400">Обычный статус</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Описание / Требования к участникам</label>
            <textarea
              maxLength={150}
              placeholder="Напр.: Только для скилловых игроков, у кого КД больше 1.5! Discord приветствуется..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-blue-500 hover:to-indigo-500 focus:outline-none transition-colors ${
                isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? 'Публикация...' : 'Запустить лобби'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
