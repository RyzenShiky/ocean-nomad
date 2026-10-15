import * as THREE from 'three';

/**
 * Flat wooden plank lying on XZ plane.
 * length  → along X
 * width   → along Z  
 * height  → thickness along Y
 */
export function createPlankGeometry({
  length = 2.4,
  width = 0.40,
  height = 0.10
} = {}) {
  const geo = new THREE.BoxGeometry(length, height, width);
  // Sit bottom face on y = 0
  geo.translate(0, height * 0.5, 0);
  geo.computeVertexNormals();
  return geo;
}

export function createFoundationGeometry({
  length = 1.0,
  width = 1.0,
  height = 0.14
} = {}) {
  return createPlankGeometry({ length, width, height });
}
