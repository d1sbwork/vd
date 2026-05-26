/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Shield, Sparkles, User, Edit3, Save, Target, ShieldAlert, Award, Crosshair, Upload, Image } from 'lucide-react';
import { motion } from 'motion/react';

const operativeImg = new URL('../assets/images/standoff_operative_1779687504016.png.png', import.meta.url).href;

const AVATARS = [
  'https://api.dicebear.com/7.x/bottts/svg?seed=standoff1',
  'https://api.dicebear.com/7.x/bottts/svg?seed=apollo',
  'https://api.dicebear.com/7.x/bottts/svg?seed=zeus',
  'https://api.dicebear.com/7.x/bottts/svg?seed=laser',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=sol',
  'https://api.dicebear.com/7.x/pixel-art/svg?seed=mars',
];

interface ProfileCardProps {
  profile: UserProfile;
  onProfileUpdated: (updated: UserProfile) => void;
}

export default function ProfileCard({ profile, onProfileUpdated }: ProfileCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [standoffId, setStandoffId] = useState(profile.standoffId || '');
  const [selectedAvatar, setSelectedAvatar] = useState(profile.avatarUrl);
  const [isSaving, setIsSaving] = useState(false);

  // Compute game Rank name based on training achievements
  const getRank = () => {
    const accuracy = profile.aimAccuracyBest || 0;
    const reaction = profile.aimReactionBest || 999;

    if (accuracy >= 80 && reaction <= 260) return { title: 'The Legend', color: 'text-amber-400 border-amber-500/30 bg-amber-500/5' };
    if (accuracy >= 65 && reaction <= 300) return { title: 'Ranger Leader', color: 'text-rose-400 border-rose-500/30 bg-rose-500/5' };
    if (accuracy >= 50 && reaction <= 350) return { title: 'Gold Phoenix', color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/5' };
    if (accuracy >= 35 && reaction <= 450) return { title: 'Silver Veteran', color: 'text-blue-400 border-blue-500/20 bg-blue-500/5' };
    return { title: 'Bronze Recruit', color: 'text-slate-400 border-slate-800 bg-slate-800/10' };
  };

  const rankInfo = getRank();

  const handleSave = async () => {
    if (!displayName.trim() || !standoffId.trim()) return;
    
    setIsSaving(true);
    const path = `users/${profile.id}`;
    
    try {
      const profileRef = doc(db, 'users', profile.id);
      await updateDoc(profileRef, {
        displayName: displayName.trim(),
        standoffId: standoffId.trim(),
        avatarUrl: selectedAvatar,
      });

      onProfileUpdated({
        ...profile,
        displayName: displayName.trim(),
        standoffId: standoffId.trim(),
        avatarUrl: selectedAvatar,
      });
      setIsEditing(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 p-6 shadow-2xl shadow-blue-500/15 backdrop-blur-sm hover:shadow-blue-500/25 transition-all duration-300">
      
      {/* Upper Badge header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div className="flex items-center gap-1.5">
          <h4 className="font-sans text-base font-bold text-white tracking-tight">Твой профиль</h4>
        </div>
        
        {/* Verification Status badge */}
        <div>
          {profile.role === 'admin' ? (
            <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-400 border border-red-500/20">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Администратор</span>
            </span>
          ) : profile.role === 'verified_host' ? (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400 border border-emerald-500/25">
              <Shield className="h-3.5 w-3.5" />
              <span>Проверен Кланхост</span>
            </span>
          ) : (
            <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400 border border-slate-700">
              Боец Арены
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6 pt-5 md:flex-row md:items-start">
        
        {/* Left Side: Avatar & Name Selection */}
        <div className="flex flex-col items-center gap-3.5 md:w-1/3">
          <div className="group relative">
            <img 
              src={selectedAvatar} 
              alt="Profile" 
              className="h-24 w-24 rounded-2xl border-2 border-blue-500/30 bg-slate-950 p-1 object-cover hover:border-blue-400 shadow-2xl shadow-blue-500/20 transition-all duration-300"
            />
            {isEditing && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="text-[10px] font-bold text-white uppercase tracking-wider">Сменить</span>
              </div>
            )}
          </div>

          {!isEditing ? (
            <div className="text-center space-y-0.5">
              <h3 className="font-sans text-lg font-bold text-white leading-tight">{profile.displayName}</h3>
              <p className="font-mono text-xs font-bold text-blue-400">ID: {profile.standoffId || '--'}</p>
            </div>
          ) : (
            <div className="w-full space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Игровой Ник</label>
                <input
                  type="text"
                  maxLength={16}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Standoff 2 ID</label>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="ID в игре"
                  value={standoffId}
                  onChange={(e) => setStandoffId(e.target.value)}
                  className="w-full rounded bg-slate-950 border border-slate-800 px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Action button */}
          <div className="w-full pt-1.5">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/80 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-900 transition-all cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Редактировать</span>
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setDisplayName(profile.displayName);
                    setStandoffId(profile.standoffId || '');
                    setSelectedAvatar(profile.avatarUrl);
                  }}
                  className="w-1/2 rounded-lg bg-slate-800 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-1/2 rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-500 shadow-lg shadow-blue-500/10 transition-colors"
                >
                  {isSaving ? '...' : 'Сохранить'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Training Stats Panels */}
        <div className="flex-1 space-y-4 md:border-l md:border-slate-800/80 md:pl-6">
          
          {/* Avatar Selector row (only visible in edit mode) */}
          {isEditing && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-3.5 space-y-3.5 shadow-xl shadow-black/60">
              <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-400">Выбрать Аватарку</span>
              <div className="flex flex-wrap gap-2.5">
                {AVATARS.map((avUrl) => (
                  <button
                    key={avUrl}
                    type="button"
                    onClick={() => setSelectedAvatar(avUrl)}
                    className={`rounded-lg border overflow-hidden p-0.5 transition-all shadow-md ${
                      selectedAvatar === avUrl ? 'border-blue-500 bg-blue-500/10 scale-105' : 'border-slate-850 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <img src={avUrl} alt="Avatar option" className="h-9 w-9" />
                  </button>
                ))}
              </div>

              {/* Custom Image File Upload Option for Mobile/Desktop */}
              <div className="pt-3 border-t border-slate-900">
                <label className="group flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-800 hover:border-blue-500/50 bg-slate-900/40 hover:bg-slate-900/80 p-3 cursor-pointer transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-blue-500/5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300 group-hover:text-blue-400 transition-colors">
                    <Upload className="h-4 w-4 text-blue-400 animate-pulse group-hover:scale-110 transition-transform" />
                    <span>📥 Загрузить свое фото</span>
                  </div>
                  <span className="text-[9px] text-slate-500 text-center font-mono">Из галереи телефона или файлов ПК</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          if (typeof reader.result === 'string') {
                            const rawData = reader.result;
                            const img = new Image();
                            img.src = rawData;
                            img.onload = () => {
                              const canvas = document.createElement('canvas');
                              const maxDim = 120;
                              let w = img.width;
                              let h = img.height;
                              if (w > h) {
                                if (w > maxDim) {
                                  h = Math.round((h * maxDim) / w);
                                  w = maxDim;
                                }
                              } else {
                                if (h > maxDim) {
                                  w = Math.round((w * maxDim) / h);
                                  h = maxDim;
                                }
                              }
                              canvas.width = w;
                              canvas.height = h;
                              const ctx = canvas.getContext('2d');
                              if (ctx) {
                                ctx.drawImage(img, 0, 0, w, h);
                                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                                setSelectedAvatar(compressedDataUrl);
                              } else {
                                setSelectedAvatar(rawData);
                              }
                            };
                            img.onerror = () => {
                              setSelectedAvatar(rawData);
                            };
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Current Rank Info */}
          <div className="flex items-center gap-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/30 p-4 shadow-lg shadow-black/40">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/10 border border-blue-500/20 shadow-inner">
              <Award className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <span className="block text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-0.5">Звание Арены</span>
              <span className={`rounded-md border px-2 py-0.5 text-xs font-black uppercase tracking-wider shadow-sm ${rankInfo.color}`}>
                {rankInfo.title}
              </span>
            </div>
          </div>

          {/* Training Scores */}
          <div className="w-full">
            
            {/* Target Click Stats */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 space-y-3 shadow-xl shadow-black/50 hover:border-slate-750 transition-all duration-305">
              <div className="flex items-center gap-1.5 border-b border-slate-900 pb-2">
                <Target className="h-4.5 w-4.5 text-indigo-405" />
                <h5 className="text-sm uppercase font-black tracking-wider text-slate-300">Мишени (Аима)</h5>
              </div>

              <div className="space-y-2.5 font-mono text-xs pt-1">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Лучшая реакция (Скорость выстрела):</span>
                  <span className="font-extrabold text-white text-sm">
                    {profile.aimReactionBest ? `${profile.aimReactionBest} ms` : 'Нет рекорда'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Максимальная точность попаданий:</span>
                  <span className="font-extrabold text-emerald-450 text-sm">
                    {profile.aimAccuracyBest ? `${profile.aimAccuracyBest}%` : '0%'}
                  </span>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
