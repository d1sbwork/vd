/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Lobby, GameMode, UserProfile } from '../types';
import { 
  Copy, 
  ShieldCheck, 
  Plus, 
  UserCheck, 
  Trash2, 
  Filter, 
  Play, 
  ArrowLeft, 
  Users, 
  UserX,
  Check,
  Lock
} from 'lucide-react';

import prisonImg from '../assets/images/prison_background_1779696347156.png';
import hanamiImg from '../assets/images/hanami_background_1779696367556.png';
import rustImg from '../assets/images/rust_background_1779696382479.png';
import duneImg from '../assets/images/dune_background_1779696399120.png';
import breezeImg from '../assets/images/breeze_background_1779696418120.png';
import provinceImg from '../assets/images/province_background_1779696434105.png';
import sandstoneImg from '../assets/images/sandstone_background_1779696447956.png';

interface LobbyListProps {
  currentUserId: string;
  userProfile?: UserProfile | null;
  isAdmin: boolean;
  onOpenCreateModal: () => void;
}

const MAP_IMAGES: { [key: string]: string } = {
  Prison: prisonImg,
  Hanami: hanamiImg,
  Rust: rustImg,
  Dune: duneImg,
  Breeze: breezeImg,
  Province: provinceImg,
  Sandstone: sandstoneImg,
};

const getMapImage = (mapName: string) => {
  return MAP_IMAGES[mapName] || 'https://images.unsplash.com/photo-1612287230202-1bf1d85d1bdf?auto=format&fit=crop&w=600&q=80';
};

const getShortModeName = (mode: GameMode) => {
  switch (mode) {
    case GameMode.CLASSIC_DM: return 'DM';
    case GameMode.COMPETITIVE: return 'MM';
    case GameMode.ALLIES: return '2x2';
    case GameMode.CUSTOM_DUEL: return '1x1';
    case GameMode.SPRAY_TRAINING: return 'SPRAY';
    default: return 'LOBBY';
  }
};

export default function LobbyList({ currentUserId, userProfile, isAdmin, onOpenCreateModal }: LobbyListProps) {
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMap, setSelectedMap] = useState<string>('All');
  const [selectedMode, setSelectedMode] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedLobby, setSelectedLobby] = useState<Lobby | null>(null);
  const [showAccessErrorModal, setShowAccessErrorModal] = useState(false);
  const [infoToast, setInfoToast] = useState<string | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);

  const showToast = (message: string) => {
    setInfoToast(message);
  };

  useEffect(() => {
    if (infoToast) {
      const timer = setTimeout(() => {
        setInfoToast(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [infoToast]);

  const handleCreateClick = () => {
    const isPro = userProfile?.role === 'verified_host' || userProfile?.role === 'admin';
    if (!isPro) {
      setShowAccessErrorModal(true);
    } else {
      onOpenCreateModal();
    }
  };

  // Proactively reset filters to "All" when user creates/publishes a new lobby, assuring it is not filtered out
  const prevLobbiesCountRef = useRef(lobbies.length);
  useEffect(() => {
    if (lobbies.length > prevLobbiesCountRef.current) {
      // Check if any lobby is newly added and owned by current user
      const hasMyNewLobby = lobbies.some(l => l.creatorId === currentUserId && !l.createdAt);
      if (hasMyNewLobby) {
        setSelectedMap('All');
        setSelectedMode('All');
      }
    }
    prevLobbiesCountRef.current = lobbies.length;
  }, [lobbies, currentUserId]);

  useEffect(() => {
    const lobbiesCol = collection(db, 'lobbies');
    // Using simple query without server-side orderBy preserves local optimistic updates (where serverTimestamp is still null) and prevents blinking/disappearing.
    const q = query(lobbiesCol);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Lobby[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            ...data,
          } as Lobby);
        });

        // Robust client-side sort by createdAt descending, handles nested Timestamp, seconds, strings, and null/undefined values safely
        list.sort((a, b) => {
          const getMsec = (lobby: Lobby) => {
            const val = lobby.createdAt;
            if (!val) return Date.now();
            if (typeof (val as any).toMillis === 'function') {
              try {
                return (val as any).toMillis();
              } catch (_) {}
            }
            if ((val as any).seconds !== undefined) {
              return (val as any).seconds * 1000;
            }
            const parsed = new Date(val as any).getTime();
            return isNaN(parsed) ? Date.now() : parsed;
          };
          return getMsec(b) - getMsec(a);
        });

        setLobbies(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'lobbies');
      }
    );

    return () => unsubscribe();
  }, []);

  const copyToClipboard = (lobbyId: string, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(lobbyId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDeleteLobby = async (lobbyId: string) => {
    if (deleteConfirmationId !== lobbyId) {
      setDeleteConfirmationId(lobbyId);
      showToast('Нажмите "Удалить" еще раз для подтверждения!');
      setTimeout(() => {
        setDeleteConfirmationId((current) => (current === lobbyId ? null : current));
      }, 4000);
      return;
    }

    try {
      setDeleteConfirmationId(null);
      const lobbyRef = doc(db, 'lobbies', lobbyId);
      await deleteDoc(lobbyRef);
      showToast('Лобби успешно удалено!');
      if (selectedLobby?.id === lobbyId) {
        setSelectedLobby(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `lobbies/${lobbyId}`);
    }
  };

  const getModeLabel = (mode: GameMode) => {
    switch (mode) {
      case GameMode.CLASSIC_DM:
        return 'Deathmatch (DM)';
      case GameMode.COMPETITIVE:
        return 'Competitive (MM)';
      case GameMode.ALLIES:
        return 'Allies (2x2)';
      case GameMode.CUSTOM_DUEL:
        return 'Duel (1x1)';
      case GameMode.SPRAY_TRAINING:
        return 'Spray Club';
      default:
        return 'Lobby Room';
    }
  };

  // Sync the currently selected lobby data with the live snapshot stream
  const liveSelectedLobby = selectedLobby 
    ? lobbies.find(l => l.id === selectedLobby.id) || null
    : null;

  const allMaps = ['All', 'Prison', 'Hanami', 'Rust', 'Dune', 'Breeze', 'Province', 'Sandstone'];
  const allModes = ['All', GameMode.CLASSIC_DM, GameMode.COMPETITIVE, GameMode.ALLIES, GameMode.CUSTOM_DUEL, GameMode.SPRAY_TRAINING];

  // Filtering live active lobbies
  const filteredLobbies = lobbies.filter((lobby) => {
    const matchesMap = selectedMap === 'All' || lobby.map === selectedMap;
    const matchesMode = selectedMode === 'All' || lobby.gameMode === selectedMode;
    // Keep started lobbies too so players can see they are locked
    const isActive = lobby.status !== 'closed';
    return matchesMap && matchesMode && isActive;
  });

  // Render Lobby Room Details View
  if (liveSelectedLobby) {
    const lobby = liveSelectedLobby;
    const isCreator = lobby.creatorId === currentUserId;
    const isJoined = lobby.joinedPlayers?.some(p => p.id === currentUserId) || lobby.creatorId === currentUserId;
    
    // Fallback creators profile if joinedPlayers array is not populated yet
    const displayPlayers = lobby.joinedPlayers || [
      {
        id: lobby.creatorId,
        displayName: lobby.creatorName,
        avatarUrl: lobby.creatorAvatar,
        standoffId: lobby.creatorStandoffId,
        role: lobby.creatorIsVerified ? 'verified_host' : 'user'
      }
    ];

    const handleJoinLobbyRoom = async () => {
      if (lobby.status === 'started') {
        showToast('Данный матч уже запущен! Вход заблокирован.');
        return;
      }
      if (displayPlayers.length >= lobby.maxPlayers) {
        showToast('Данное лобби уже заполнено!');
        return;
      }

      // Check if user is already in displayPlayers to prevent duplicates
      if (displayPlayers.some(p => p.id === currentUserId)) {
        return;
      }
      
      const pData = {
        id: currentUserId,
        displayName: userProfile?.displayName || 'Игрок',
        avatarUrl: userProfile?.avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUserId}`,
        standoffId: userProfile?.standoffId || '12345678',
        role: userProfile?.role || 'user'
      };

      try {
        const lobbyRef = doc(db, 'lobbies', lobby.id);
        const updatedPlayersList = [...displayPlayers, pData];
        await updateDoc(lobbyRef, {
          joinedPlayers: updatedPlayersList,
          joinedPlayerCount: updatedPlayersList.length,
          updatedAt: new Date()
        });
        showToast('Вы успешно вошли на тренировочный слот!');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `lobbies/${lobby.id}`);
      }
    };

    const handleLeaveLobbyRoom = async () => {
      if (isCreator) {
        showToast('Хост не может покинуть лобби! Вы можете удалить лобби.');
        return;
      }

      const pToRemove = displayPlayers.find(p => p.id === currentUserId);
      if (!pToRemove) return;

      try {
        const lobbyRef = doc(db, 'lobbies', lobby.id);
        const updatedPlayersList = displayPlayers.filter(p => p.id !== currentUserId);
        await updateDoc(lobbyRef, {
          joinedPlayers: updatedPlayersList,
          joinedPlayerCount: Math.max(1, updatedPlayersList.length),
          updatedAt: new Date()
        });
        showToast('Вы покинули игровой слот.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `lobbies/${lobby.id}`);
      }
    };

    const handleLaunchLobbyRoom = async () => {
      try {
        const lobbyRef = doc(db, 'lobbies', lobby.id);
        await updateDoc(lobbyRef, {
          status: 'started',
          updatedAt: new Date()
        });

        // Trigger real-time Telegram notifications via backend REST endpoint
        fetch('/api/notify/started', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            creatorName: lobby.creatorName,
            creatorIsVerified: lobby.creatorIsVerified,
            gameMode: lobby.gameMode,
            map: lobby.map,
            lobbyCode: lobby.lobbyCode,
            joinedPlayerCount: displayPlayers.length,
            description: lobby.description || '',
            appUrl: window.location.origin
          }),
        }).catch((apiErr) => {
          console.warn('Telegram match started request failed:', apiErr);
        });

        showToast('Матч запущен! Лобби переведено в приватный статус игры.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `lobbies/${lobby.id}`);
      }
    };

    return (
      <div className="space-y-6">
        
        {/* Back navigation */}
        <button
          onClick={() => setSelectedLobby(null)}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-slate-350 hover:text-white transition-all cursor-pointer select-none shadow-md hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-0.5 active:translate-y-0"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-blue-400" />
          <span>Назад к списку лобби</span>
        </button>

        {/* Dynamic Lobby Room Panel */}
        <div className="grid gap-6 md:grid-cols-12">
          
          {/* Column A: Server info & Host controls */}
          <div className="md:col-span-7 space-y-5">
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl shadow-black/90">
              
              {/* Map background image slice */}
              <div 
                className="absolute inset-0 z-0 bg-cover bg-center opacity-20"
                style={{ backgroundImage: `url(${getMapImage(lobby.map)})` }}
              />
              <div className="absolute inset-0 z-0 bg-gradient-to-t from-slate-950 via-slate-950/95 to-slate-950/70" />

              <div className="relative z-10 space-y-5">
                {/* Status banner */}
                <div className="flex items-center justify-between border-b border-slate-900 pb-4">
                  <div className="space-y-1">
                    <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white">
                      {getModeLabel(lobby.gameMode)}
                    </h2>
                  </div>
                  <div>
                    {lobby.status === 'started' ? (
                      <span className="rounded bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-black uppercase tracking-wider text-amber-400 shadow-sm">
                        Матч запущен
                      </span>
                    ) : (
                      <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-400 animate-pulse shadow-sm">
                        Идет сбор
                      </span>
                    )}
                  </div>
                </div>

                {/* Main properties layout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Beautiful Dark Map Display Card */}
                  <div className="relative overflow-hidden rounded-xl border border-slate-900 bg-slate-950 p-4 h-24 flex flex-col justify-end shadow-md group">
                    <div 
                      className="absolute inset-0 z-0 bg-cover bg-center opacity-30 transition-transform duration-500 group-hover:scale-105"
                      style={{ backgroundImage: `url(${getMapImage(lobby.map)})` }}
                    />
                    <div className="absolute inset-0 z-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-transparent" />
                    <div className="relative z-10">
                      <span className="block text-[9px] uppercase font-bold tracking-wider text-slate-400 mb-0.5">Выбранная Карта</span>
                      <span className="text-base font-black text-white uppercase tracking-wider font-mono">{lobby.map}</span>
                    </div>
                  </div>

                  {/* Participants Slot Card */}
                  <div className="rounded-xl border border-slate-900 bg-slate-900/20 p-4 flex flex-col justify-end h-24 shadow-inner">
                    <div>
                      <span className="block text-[9px] uppercase font-bold tracking-wider text-slate-500 mb-1">Участники Сражения</span>
                      <span className="text-xl font-black text-white font-mono">{displayPlayers.length} / {lobby.maxPlayers}</span>
                    </div>
                  </div>
                </div>

                {/* Host Details panel */}
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-850 bg-slate-900/10 p-4 shadow-sm">
                  <img
                    src={lobby.creatorAvatar}
                    alt="Host"
                    className="h-10 w-10 rounded-lg border border-slate-800 object-cover bg-slate-950 shadow-md"
                  />
                  <div>
                    <span className="block text-[9px] uppercase font-bold tracking-widest text-blue-400 font-mono">Создатель лобби</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs sm:text-sm font-bold text-white leading-none">{lobby.creatorName}</span>
                      {lobby.creatorIsVerified && (
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono leading-none mt-1 block">ID: {lobby.creatorStandoffId}</span>
                  </div>
                </div>

                {/* Link info warn */}
                <div className="rounded-xl border border-slate-900 bg-slate-900/30 p-4 text-xs space-y-1.5 shadow-md">
                  <div className="flex items-center gap-1.5 font-bold text-slate-300">
                    <span>🔗 Ссылка для подключения к Лобби:</span>
                  </div>
                  <div className="rounded bg-slate-950 border border-slate-900 p-3 text-xs font-mono text-white select-all break-all shadow-inner">
                    {lobby.lobbyCode}
                  </div>
                </div>

                {/* Action connect buttons deep links */}
                <div className="pt-3 border-t border-slate-900 space-y-3">
                  
                  {/* Big redirect play button pinned nicely at the bottom */}
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        const trimmed = lobby.lobbyCode.trim();
                        if (/^\d+$/.test(trimmed)) {
                          window.open(`standoff2://lobby/${trimmed}`, '_blank');
                        } else {
                          if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('standoff2://')) {
                            window.open(`https://${trimmed}`, '_blank');
                          } else {
                            window.open(trimmed, '_blank');
                          }
                        }
                      }}
                      className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-6 py-4 text-xs sm:text-sm uppercase font-black tracking-widest text-white shadow-xl shadow-blue-500/15 hover:shadow-blue-500/25 transition-all cursor-pointer transform hover:-translate-y-0.5"
                    >
                      <Play className="h-4.5 w-4.5 text-white fill-white animate-pulse" />
                      <span>Подключиться к лобби</span>
                    </button>
                    <p className="text-[9px] text-slate-500 text-center font-sans tracking-wide">
                      Запустит мобильное приложение Standoff 2 и перенаправит напрямую в игровую комнату.
                    </p>
                  </div>

                  {/* Creator specific match host commands */}
                  {isCreator && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {/* Launch game match */}
                      <button
                        onClick={handleLaunchLobbyRoom}
                        disabled={lobby.status === 'started'}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/40 px-4 py-3 text-[11px] font-black uppercase tracking-wider transition-all shadow-md ${
                          lobby.status === 'started' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        <Check className="h-4 w-4" />
                        <span>Запустить Лобби</span>
                      </button>

                      {/* Destructive deletion */}
                      <button
                        onClick={() => handleDeleteLobby(lobby.id)}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-4 py-3 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md ${
                          deleteConfirmationId === lobby.id
                            ? 'bg-rose-600 border-rose-500 text-white animate-pulse'
                            : 'border-rose-500/20 bg-rose-950/10 text-rose-450 hover:bg-rose-950/25'
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>{deleteConfirmationId === lobby.id ? 'Подтвердить?' : 'Удалить Лобби'}</span>
                      </button>
                    </div>
                  )}

                  {/* Ordinary participant toggles */}
                  {!isCreator && (
                    <div className="pt-1">
                      {isJoined ? (
                        <button
                          onClick={handleLeaveLobbyRoom}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:text-white text-slate-300 px-4 py-3.5 text-xs font-bold uppercase transition-all cursor-pointer shadow-md"
                        >
                          <UserX className="h-4 w-4 text-rose-400" />
                          <span>Покинуть Слот</span>
                        </button>
                      ) : lobby.status === 'started' ? (
                        <div className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 px-4 py-3.5 text-xs font-black uppercase tracking-wider select-none">
                          <Lock className="h-4 w-4 text-amber-400" />
                          <span>Матч уже запущен</span>
                        </div>
                      ) : (
                        <button
                          onClick={handleJoinLobbyRoom}
                          disabled={displayPlayers.length >= lobby.maxPlayers}
                          className={`w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3.5 text-xs font-black uppercase tracking-wider transition-all shadow-md ${
                            displayPlayers.length >= lobby.maxPlayers
                              ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-lg shadow-emerald-500/10'
                          }`}
                        >
                          <UserCheck className="h-4 w-4" />
                          <span>{displayPlayers.length >= lobby.maxPlayers ? 'Свободных мест нет' : 'Присоединиться к лобби'}</span>
                        </button>
                      )}
                    </div>
                  )}

                </div>

              </div>
            </div>
          </div>

          {/* Column B: Live Lobby Participants list */}
          <div className="md:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl shadow-black/80 space-y-4 min-h-[300px]">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4.5 w-4.5 text-blue-400" />
                  <h4 className="font-sans text-xs uppercase font-extrabold tracking-wider text-slate-350">Участники Лобби</h4>
                </div>
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-900 text-slate-400 rounded-md">
                  {displayPlayers.length} / {lobby.maxPlayers}
                </span>
              </div>

              {/* Loop and rendering */}
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {displayPlayers.map((player) => {
                  const isPlayerHost = player.id === lobby.creatorId;
                  return (
                    <div 
                      key={player.id}
                      className="flex items-center justify-between rounded-xl border border-slate-900/80 bg-slate-900/10 p-3 hover:border-slate-800 transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={player.avatarUrl || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${player.id}`}
                          alt="Pilot"
                          className="h-9 w-9 rounded-lg border border-slate-800 object-cover bg-slate-950 shadow-inner"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white leading-tight">{player.displayName}</span>
                            {player.id === currentUserId && (
                              <span className="text-[8px] px-1 bg-blue-500/15 border border-blue-500/30 text-blue-400 rounded font-black uppercase">Вы</span>
                            )}
                          </div>
                          <span className="block text-[10px] text-slate-500 font-mono mt-0.5">ID: {player.standoffId}</span>
                        </div>
                      </div>

                      {/* Display Host identifier */}
                      <div>
                        {isPlayerHost ? (
                          <span className="rounded bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-400 shadow-sm">
                            Хост
                          </span>
                        ) : (
                          <span className="rounded bg-slate-850 border border-slate-800 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-400">
                            Игрок
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

        </div>

      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      
      {/* Filtering Header controls */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-slate-850 bg-slate-900/15 p-3.5 sm:p-4 md:flex-row md:items-center md:justify-between backdrop-blur-xs shadow-md">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <Filter className="h-3 w-3 text-blue-400" />
            <span>Фильтр:</span>
          </div>
          
          {/* Map Select */}
          <select
            value={selectedMap}
            onChange={(e) => setSelectedMap(e.target.value)}
            className="rounded bg-slate-950 border border-slate-800 px-2.5 py-1 font-sans text-[11px] text-slate-350 focus:border-blue-500 focus:outline-none cursor-pointer"
          >
            <option value="All">Все карты (Standoff)</option>
            {allMaps.filter(m => m !== 'All').map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Mode Select */}
          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value)}
            className="rounded bg-slate-950 border border-slate-800 px-2.5 py-1 font-sans text-[11px] text-slate-350 focus:border-blue-500 focus:outline-none cursor-pointer"
          >
            <option value="All">Все режимы</option>
            {allModes.filter(mo => mo !== 'All').map(mo => (
              <option key={mo} value={mo}>{getModeLabel(mo as GameMode)}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCreateClick}
          className="inline-flex items-center justify-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 font-sans text-[11px] font-bold text-white shadow-lg hover:bg-blue-500 transition-all cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Создать лобби</span>
        </button>
      </div>

      {/* Live Host Broadcast Alerts */}
      {(() => {
        const activeHostLobbies = lobbies.filter((l) => l.creatorIsVerified && l.status !== 'started' && l.status !== 'closed');
        const myActiveLobby = lobbies.find((l) => l.creatorId === currentUserId && l.status !== 'started' && l.status !== 'closed');

        if (activeHostLobbies.length === 0 && !myActiveLobby) return null;

        return (
          <div className="space-y-2 animate-fade-in">
            {myActiveLobby && (
              <div className="relative overflow-hidden rounded-xl border border-blue-500/20 bg-blue-950/15 p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md backdrop-blur-xs">
                <div className="flex items-center gap-2.5">
                  <div className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider font-mono">Ваше Лобби Активно</span>
                    <h5 className="text-[11px] font-medium text-white leading-normal">
                      Лобби <span className="text-blue-400 uppercase font-mono">#{myActiveLobby.id.slice(0, 4).toUpperCase()}</span> на карте <span className="text-slate-200">{myActiveLobby.map}</span> активно и ожидает участников!
                    </h5>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedLobby(myActiveLobby)}
                    className="rounded bg-blue-600 hover:bg-blue-500 px-3 py-1 text-[10px] font-bold uppercase text-white transition-all cursor-pointer"
                  >
                    Управление
                  </button>
                </div>
              </div>
            )}

            {activeHostLobbies.map((hLobby) => {
              // Only render if it's not the user's own to prevent duplicates
              if (hLobby.creatorId === currentUserId) return null;
              const modeText = getModeLabel(hLobby.gameMode);
              
              return (
                <div key={hLobby.id} className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-emerald-950/5 p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md backdrop-blur-xs">
                  <div className="absolute inset-0 z-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
                  
                  <div className="relative z-10 flex items-center gap-2.5">
                    <img 
                      src={hLobby.creatorAvatar} 
                      alt="Host" 
                      className="h-8 w-8 rounded border border-emerald-500/20 object-cover bg-slate-950 shadow-sm" 
                    />
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest font-mono">Трансляция Организатора</span>
                        <ShieldCheck className="h-3 w-3 text-emerald-400 animate-pulse" />
                      </div>
                      <h5 className="text-[11px] font-medium text-white leading-normal">
                        Хост <strong className="text-emerald-350">{hLobby.creatorName}</strong>: <span className="text-slate-100 font-mono font-bold uppercase">{modeText} на {hLobby.map}</span>! Быстрее залетайте.
                      </h5>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedLobby(hLobby)}
                    className="relative z-10 rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-[10px] font-bold uppercase text-white transition-all cursor-pointer shadow-md"
                  >
                    Войти
                  </button>
                </div>
              );
            })}
          </div>
        );
      })()}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 space-y-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-xs text-slate-400">Синхронизация лобби...</p>
        </div>
      ) : filteredLobbies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/5 py-12 px-3 text-center pb-14 animate-fade-in">
          <div className="rounded-full bg-blue-500/5 p-3 border border-blue-500/10 mb-3 animate-pulse">
            <Plus className="h-7 w-7 text-blue-400" />
          </div>
          <h4 className="text-sm font-bold text-white mb-1 font-sans uppercase tracking-wider">Активных лобби не найдено</h4>
          <p className="max-w-xs text-[11px] text-slate-400 mb-4 font-sans leading-normal">
            Опубликовать лобби со своей ссылкой матча могут только кланхосты и сертифицированные игроки.
          </p>
          <button
            onClick={handleCreateClick}
            className="rounded bg-slate-800 border border-slate-700 hover:border-blue-500 px-4 py-2 text-[10px] font-bold text-slate-200 hover:text-white transition-all cursor-pointer"
          >
            Создать лобби (Хосты/Киберспортсмены)
          </button>
        </div>
      ) : (
        <div className="grid gap-4.5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredLobbies.map((lobby, idx) => {
            const isVerified = lobby.creatorIsVerified;
            const currentPlayersCount = lobby.joinedPlayers ? lobby.joinedPlayers.length : (lobby.joinedPlayerCount || 1);
            const isStarted = lobby.status === 'started';
            const isParticipant = lobby.creatorId === currentUserId || lobby.joinedPlayers?.some(p => p.id === currentUserId);

            return (
              <div 
                key={lobby.id}
                onClick={() => {
                  if (isStarted && !isParticipant) {
                    showToast('Данный матч уже запущен! Вход заблокирован.');
                  } else {
                    setSelectedLobby(lobby);
                  }
                }}
                className={`group relative flex items-center justify-between overflow-hidden rounded-xl border p-4 shadow-lg shadow-black/80 transition-all duration-300 w-full ${
                  isStarted
                    ? 'border-slate-850 bg-slate-950/90 hover:border-amber-500/30'
                    : 'border-slate-900 bg-slate-950 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10'
                } cursor-pointer active:scale-[0.985]`}
              >
                {/* Visual Cybershoke-style background image underlay */}
                <div 
                  className={`absolute inset-0 z-0 bg-cover bg-center opacity-30 transition-transform duration-700 group-hover:scale-105 ${
                    isStarted ? 'desaturate contrast-125' : ''
                  }`} 
                  style={{ backgroundImage: `url(${getMapImage(lobby.map)})` }} 
                />
                
                {/* Visual overlay mask for readability */}
                <div className="absolute inset-0 z-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/45" />

                {/* Left indicators side view */}
                <div className="relative z-10 flex h-full items-center gap-3">
                  {/* Main lobby meta tag text block */}
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 animate-fadeIn">
                      <span className="font-sans text-sm sm:text-base font-black uppercase tracking-wider text-white drop-shadow-md">
                        {getShortModeName(lobby.gameMode)}
                      </span>
                      {isVerified && (
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 select-none">
                      {/* Red/Amber status highlight chip */}
                      <div className={`h-3.5 w-[3px] rounded-full ${isStarted ? 'bg-amber-500' : 'bg-rose-500'}`} />
                      <span className="font-mono text-xs font-semibold text-slate-300 drop-shadow">
                        {currentPlayersCount} / {lobby.maxPlayers} | <span className="text-slate-400 uppercase font-extrabold text-[9px]">{lobby.map}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right button action elements */}
                <div className="relative z-10 flex items-center gap-2">
                  {/* Quick link copying if not started */}
                  {!isStarted && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        showToast("Чтобы скопировать ссылку, необходимо войти в лобби!");
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white transition-all cursor-pointer hover:border-slate-700"
                      title="Копировать код подключения"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Play Launch button or Padlock lock indication */}
                  {isStarted ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isParticipant) {
                          showToast('Данный матч уже запущен! Вход заблокирован.');
                        } else {
                          setSelectedLobby(lobby);
                        }
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer shadow-md"
                      title="Матч запущен (Просмотр)"
                    >
                      <Lock className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLobby(lobby);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md cursor-pointer hover:from-blue-500 hover:to-indigo-500 transform hover:scale-105 active:scale-90 transition-all"
                      title="Войти в комнату"
                    >
                      <Play className="h-3.5 w-3.5 fill-white" />
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Esports Access Restriction Modal Dialog */}
      {showAccessErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in animate-duration-200">
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-rose-500/30 bg-slate-950 p-6 shadow-2xl shadow-rose-950/10 animate-fade-in">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="rounded-full bg-rose-500/10 p-3 text-rose-450 border border-rose-500/20 shadow-md">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-base font-extrabold uppercase tracking-wider text-rose-400">Доступ ограничен</h3>
              
              <div className="space-y-3 text-xs text-slate-300 font-sans leading-relaxed">
                <p>
                  Создавать новые лобби могут только сертифицированные <strong className="text-amber-400">Киберспортсмены</strong> и организаторы соревнований.
                </p>
                <p className="text-slate-400 bg-slate-900/60 p-3 rounded-lg border border-slate-900 font-sans">
                  Вы можете свободно подключаться к готовым комнатам участников в списке и играть в матчи!
                </p>
                <p className="text-blue-400 font-bold text-[11px] leading-tight font-sans">
                  Чтобы получить статус организатора, напишите мне напрямую в личные сообщения.
                </p>
              </div>

              <div className="w-full pt-1.5">
                <button
                  onClick={() => setShowAccessErrorModal(false)}
                  className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 py-3 text-xs font-black uppercase tracking-wider text-white transition-all shadow-lg shadow-blue-600/15 cursor-pointer active:scale-95"
                >
                  Понятно
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Pop-up Information Toast */}
      {infoToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-blue-500/30 bg-slate-900 px-4.5 py-3 text-xs font-bold text-white shadow-2xl shadow-blue-500/10 animate-fade-in animate-duration-300">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="font-sans leading-none">{infoToast}</span>
        </div>
      )}

    </div>
  );
}
