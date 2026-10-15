import * as THREE from 'three';

/**
 * Procedural barrel — cylinder body + rims + lids.
 * No external model needed.
 */
export function createBarrelGeometry({
  radius = 0.32,
  height = 0.72,
  radialSegments = 12
} = {}) {
  const group = new THREE.Group();

  // Main body (slightly tapered look via scale later if wanted)
  const bodyGeo = new THREE.CylinderGeometry(radius * 0.95, radius, height * 0.85, radialSegments);
  const body = new THREE.Mesh(bodyGeo);
  body.position.y = height * 0.42;
  group.add(body);

  // Top & bottom rims
  const rimGeo = new THREE.TorusGeometry(radius * 0.92, 0.03, 6, radialSegments);
  const topRim = new THREE.Mesh(rimGeo);
  topRim.rotation.x = Math.PI / 2;
  topRim.position.y = height * 0.82;
  group.add(topRim);

  const botRim = new THREE.Mesh(rimGeo);
  botRim.rotation.x = Math.PI / 2;
  botRim.position.y = height * 0.08;
  group.add(botRim);

  // Lids
  const lidGeo = new THREE.CircleGeometry(radius * 0.9, radialSegments);
  const topLid = new THREE.Mesh(lidGeo);
  topLid.rotation.x = -Math.PI / 2;
  topLid.position.y = height * 0.85;
  group.add(topLid);

  const botLid = new THREE.Mesh(lidGeo);
  botLid.rotation.x = Math.PI / 2;
  botLid.position.y = 0.02;
  group.add(botLid);

  // Merge into single geometry for performance when needed
  return group;
}

/**
 * Returns a single BufferGeometry version (for InstancedMesh)
 */
export function createBarrelBufferGeometry(opts = {}) {
  const radius = opts.radius ?? 0.32;
  const height = opts.height ?? 0.72;
  const segs = opts.radialSegments ?? 10;
  return new THREE.CylinderGeometry(radius * 0.95, radius, height, segs);
}