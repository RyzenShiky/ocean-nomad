import * as THREE from 'three';

export const Materials = {
  wood: new THREE.MeshStandardMaterial({
    color: 0xC4956A,
    roughness: 0.72,
    metalness: 0.04,
    flatShading: false
  }),
  woodDark: new THREE.MeshStandardMaterial({
    color: 0x8B5A2B,
    roughness: 0.82,
    metalness: 0.02
  }),
  woodWet: new THREE.MeshStandardMaterial({
    color: 0x9a7040,
    roughness: 0.55,
    metalness: 0.08
  }),
  rope: new THREE.MeshStandardMaterial({
    color: 0xC4A35A,
    roughness: 0.95,
    metalness: 0.0
  }),
  metal: new THREE.MeshStandardMaterial({
    color: 0x8A9A9A,
    roughness: 0.35,
    metalness: 0.85
  }),
  barrel: new THREE.MeshStandardMaterial({
    color: 0x6B3A1F,
    roughness: 0.8,
    metalness: 0.1
  }),
  plastic: new THREE.MeshStandardMaterial({
    color: 0x3A7CA5,
    roughness: 0.4,
    metalness: 0.15
  }),
  rock: new THREE.MeshStandardMaterial({
    color: 0x6E6E6E,
    roughness: 0.95,
    metalness: 0.05
  }),
  sand: new THREE.MeshStandardMaterial({
    color: 0xE8D48B,
    roughness: 1.0,
    metalness: 0.0
  }),
  grass: new THREE.MeshStandardMaterial({
    color: 0x4A7C3F,
    roughness: 0.95,
    metalness: 0.0
  }),
  player: new THREE.MeshStandardMaterial({
    color: 0x2E86AB,
    roughness: 0.6,
    metalness: 0.1
  })
};

// Shared geometries (created once)
export const SharedGeo = {
  plank: null,
  foundation: null,
  barrelSimple: null
};
try {
  const wt = makeWoodTexture();
  Materials.wood.map = wt;
  Materials.wood.color.set(0xffffff);
  Materials.wood.needsUpdate = true;
  Materials.woodDark.map = wt;
  Materials.barrel.map = makeBarrelTexture();
  Materials.barrel.color.set(0xffffff);
  Materials.barrel.needsUpdate = true;
} catch (_) {}
