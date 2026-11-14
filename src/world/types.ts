import * as THREE from 'three';

export type IKind = 'hold' | 'pet' | 'toggle' | 'climb' | 'look';

export interface Interactable {
  id: string;
  name: string; // Chinese display name
  kind: IKind;
  obj: THREE.Object3D;
  /** custom action verb shown on crosshair & button (e.g. '拉开', '开灯', '扶站') */
  verb?: string;
  /** custom callback for toggle / climb / pet / NPC interactions */
  onUse?: () => void;
  /** where the object sits in the hands (camera space) */
  holdPos?: THREE.Vector3;
  holdRot?: THREE.Euler;
  /** distance from the object's origin down to its resting bottom */
  bottom: number;
  radius: number;
  isBlock?: boolean;
  isBall?: boolean;
  isOrnament?: boolean;
  isTeddy?: boolean;
  isCeramic?: boolean;
  isSoft?: boolean;
  isBook?: boolean;
  isPacifier?: boolean;
  isTissue?: boolean;
  seen?: boolean;
  enabled: boolean;
  /** larger reach for lookables / furniture */
  range?: number;
  /** linear velocity for thrown / rolling objects */
  vel?: THREE.Vector3;
  /** angular velocity for thrown tumbling objects */
  angVel?: THREE.Vector3;
  /** optional climb/stand viewpoint (world x, z, eye height) */
  standAt?: { x: number; z: number; eye: number; label?: string };
}

export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Surface extends AABB {
  y: number;
}
