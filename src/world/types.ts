import * as THREE from 'three';

export type IKind = 'hold' | 'pet' | 'look';

export interface Interactable {
  id: string;
  name: string; // Chinese display name
  kind: IKind;
  obj: THREE.Object3D;
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
  seen?: boolean;
  enabled: boolean;
  /** larger reach for lookables */
  range?: number;
  /** velocity for rolling objects */
  vel?: THREE.Vector3;
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
