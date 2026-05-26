/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Shield, Users, Award, Trash2, Heart, ShieldAlert, Check } from 'lucide-react';

interface AdminPanelProps {
  currentUserId: string;
}

export default function AdminPanel({ currentUserId }: AdminPanelProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [announcement, setAnnouncement] = useState('');
  const [broadcastActive, setBroadcastActive] = useState(false);

  useEffect(() => {
    const usersCol = collection(db, 'users');
    const q = query(usersCol);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((d) => {
          list.push({
            id: d.id,
            ...d.data(),
          } as UserProfile);
        });
        setUsers(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    );

    return () => unsubscribe();
  }, []);

  const handleUpdateRole = async (userId: string, newRole: 'user' | 'verified_host' | 'admin') => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: newRole,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUserId) {
      alert('Вы не можете удалить самого себя!');
      return;
    }
    if (!confirm('Вы точно хотите удалить этого игрока со всей статистикой?')) return;
    try {
      const userRef = doc(db, 'users', userId);
      await deleteDoc(userRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
    }
  };

  const handleToggleBan = async (userId: string, isBanned: boolean) => {
    if (userId === currentUserId) {
      alert('Вы не можете заблокировать самого себя!');
      return;
    }
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isBanned: isBanned,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcement.trim()) return;
    setBroadcastActive(true);
    setTimeout(() => {
      setBroadcastActive(false);
      setAnnouncement('');
    }, 5000);
  };

  return (
    <div className="space-y-6 rounded-2xl border border-red-500/20 bg-slate-900/60 p-6 backdrop-blur-sm">
      
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-500 animate-pulse" />
            <h4 className="font-sans text-lg font-bold text-white tracking-tight">Секретная Панель Управления</h4>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Вы вошли как главный Офицер Арены. Управляйте статусами игроков, выдавайте верификацию лобби и очищайте реестр.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-850">
            <Users className="h-4 w-4 text-blue-400" />
            <span>Бойцов в базе: <strong className="text-white">{users.length}</strong></span>
          </div>
        </div>
      </div>

      {/* Grid of Tools */}
      <div className="grid gap-6 md:grid-cols-12">
        
        {/* Left column: Players management table */}
        <div className="md:col-span-8 space-y-4">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Статусы игроков</h5>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-sans text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-4">Игрок / Ник</th>
                      <th className="p-4">Standoff ID</th>
                      <th className="p-4">Роль</th>
                      <th className="p-4 text-right">Управление ролями</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-slate-900/40 hover:bg-slate-900/10 transition-colors">
                        <td className="p-4 flex items-center gap-2.5">
                          <img 
                            src={u.avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${u.displayName}`} 
                            alt="Avatar" 
                            className="h-8 w-8 rounded-lg border border-slate-850 bg-slate-950"
                          />
                          <div>
                            <span className="font-bold text-white flex items-center gap-1.5">
                              {u.displayName}
                              {u.isBanned && (
                                <span className="rounded bg-rose-500/25 px-1.5 py-0.5 text-[8px] font-black uppercase text-rose-450 tracking-wider animate-pulse">
                                  Бан
                                </span>
                              )}
                            </span>
                            <span className="block text-[9px] text-slate-500">
                              Реакция: {u.aimReactionBest ? `${u.aimReactionBest} ms` : 'нет'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 font-mono font-medium text-slate-400">
                          {u.standoffId || '--'}
                        </td>
                        <td className="p-4">
                          <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            u.isBanned
                              ? 'bg-rose-900/40 text-rose-400 border border-rose-500/20'
                              : u.role === 'admin' 
                                ? 'bg-red-500/15 text-red-400 border border-red-500/10' 
                                : u.role === 'verified_host' 
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/10' 
                                  : 'bg-slate-800 text-slate-400'
                          }`}>
                            {u.isBanned ? 'Забанен' : u.role === 'admin' ? 'Админ' : u.role === 'verified_host' ? 'Хост' : 'Игрок'}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-1.5 font-sans">
                          {/* Host toggle action */}
                          {u.role !== 'verified_host' ? (
                            <button
                              disabled={u.isBanned}
                              onClick={() => handleUpdateRole(u.id, 'verified_host')}
                              className="rounded bg-emerald-600/15 border border-emerald-500/30 hover:border-emerald-400 text-emerald-400 px-2 py-1 text-[10px] font-bold uppercase transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              Дать Хост
                            </button>
                          ) : (
                            <button
                              disabled={u.isBanned}
                              onClick={() => handleUpdateRole(u.id, 'user')}
                              className="rounded bg-slate-800 border border-slate-700 hover:border-blue-500 text-slate-300 px-2 py-1 text-[10px] font-bold uppercase transition-all cursor-pointer disabled:opacity-30"
                            >
                              Снять Хост
                            </button>
                          )}

                          {/* Ban / Unban actions */}
                          {u.id !== currentUserId && (
                            u.isBanned ? (
                              <button
                                onClick={() => handleToggleBan(u.id, false)}
                                className="rounded bg-emerald-950/40 border border-emerald-500/40 text-emerald-405 px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer hover:bg-emerald-950/80"
                              >
                                Разбанить
                              </button>
                            ) : (
                              <button
                                onClick={() => handleToggleBan(u.id, true)}
                                className="rounded bg-rose-950/40 border border-rose-500/40 text-rose-405 px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer hover:bg-rose-950/80"
                              >
                                Бан
                              </button>
                            )
                          )}

                          {u.id !== currentUserId && (
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="rounded p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors inline-block align-middle"
                              title="Удалить бойца"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Publish platform broadcast */}
        <div className="md:col-span-4 space-y-4">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Глобальное Оповещение</h5>
          
          <form onSubmit={handleBroadcast} className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            <p className="text-[11px] text-slate-500 leading-normal">
              Опубликовать экстренное сообщение над списком лобби (визуальный баннер для всех участников).
            </p>

            <textarea
              maxLength={120}
              placeholder="Внимание: Сегодня в 18:00 по МСК стартует фаст-кап 1х1 на Province!"
              value={announcement}
              onChange={(e) => setAnnouncement(e.target.value)}
              rows={3}
              className="w-full rounded bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
            />

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 py-2 text-xs font-bold text-white shadow-lg shadow-red-500/10 transition-colors cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>Транслировать объявление</span>
            </button>
          </form>

          {broadcastActive && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 flex items-center gap-1.5 animate-pulse">
              <Check className="h-3.5 w-3.5" />
              <span>Оповещение успешно отправлено на радары!</span>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
