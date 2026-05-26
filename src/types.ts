/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum GameMode {
  CLASSIC_DM = 'classic_dm',
  COMPETITIVE = 'competitive',
  ALLIES = 'allies',
  CUSTOM_DUEL = 'custom_duel',
  SPRAY_TRAINING = 'spray_training',
}

export enum LobbyStatus {
  ACTIVE = 'active',
  FULL = 'full',
  STARTED = 'started',
  CLOSED = 'closed',
}

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string;
  standoffId: string;
  role: 'user' | 'verified_host' | 'admin';
  joinedAt: any; // Firestore Timestamp
  aimReactionBest?: number; // ms
  aimAccuracyBest?: number; // %
  sprayAccuracyBest?: number; // %
  isBanned?: boolean;
}

export interface Lobby {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  creatorStandoffId: string;
  creatorIsVerified: boolean;
  gameMode: GameMode;
  map: string;
  lobbyCode: string; // The ID of the lobby inside the actual Standoff 2 game
  maxPlayers: number;
  joinedPlayerCount: number;
  description: string;
  status: LobbyStatus;
  joinedPlayers?: {
    id: string;
    displayName: string;
    avatarUrl: string;
    standoffId: string;
    role?: string;
  }[];
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface Weapon {
  name: string;
  type: 'rifle' | 'pistol' | 'sniper' | 'smg';
  damage: number;
  recoilXMultiplier: number; // horizontal drift speed
  recoilYMultiplier: number; // vertical lift height
  sprayPattern: { x: number; y: number }[]; // successive bullet offset multipliers
  ammoCapacity: number;
}
