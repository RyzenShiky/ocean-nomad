/**
 * Cylinder / cone solid islands — player can stand on top, cannot pass through.
 * solids: { x, z, radius, baseH, peakH?, kind: 'island'|'volcano'|'story', trees?: [{x,z,r,h}] }
 */
export function resolvePlayerTerrain(player, solids) {
  if (!player || !solids?.length) return;
  const bodyR = 0.38;
  const px = player.position.x;
  const pz = player.position.z;
  let py = player.position.y;

  for (const s of solids) {
    const dx = px - s.x;
    const dz = pz - s.z;
    const d = Math.hypot(dx, dz);
    if (d > s.radius + bodyR + 0.5) continue;

    // Surface height under player
    let surfaceY = s.baseH;
    if (s.kind === 'volcano' && s.peakH != null) {
      // Cone: high at center, 0 at radius
      const t = Math.min(1, d / Math.max(0.01, s.radius));
      surfaceY = Math.max(s.baseH, s.peakH * (1 - t));
    } else if (s.kind === 'island' || s.kind === 'story') {
      // Flat top with soft beach slope near edge
      const edge = Math.max(0, (d - s.radius * 0.75) / (s.radius * 0.25 + 0.01));
      surfaceY = s.baseH * (1 - Math.min(1, edge));
    }

    // Horizontal: keep out of steep core (volcano) or soft edge push when submerged
    if (d < s.radius + bodyR) {
      // If feet clearly below surface → snap up and ground
      if (py < surfaceY + 0.12 && player.velocity.y <= 2) {
        player.position.y = surfaceY;
        player.velocity.y = 0;
        player.onGround = true;
        py = surfaceY;
        player.oxygen = Math.min(100, (player.oxygen ?? 100) + 20 * 0.016);
      }

      // If deep inside volume below the slope (tunneling), push to surface
      if (py < surfaceY - 0.4 && d < s.radius * 0.98) {
        player.position.y = surfaceY;
        player.velocity.y = 0;
        player.onGround = true;
        py = surfaceY;
      }

      // Steep volcano core: horizontal push when below mid-slope
      if (s.kind === 'volcano' && d < s.radius * 0.35 && py < (s.peakH || 8) * 0.5) {
        const need = s.radius * 0.35 + bodyR;
        if (d < need && d > 1e-4) {
          const push = (need - d) / d;
          player.position.x += dx * push;
          player.position.z += dz * push;
        } else if (d <= 1e-4) {
          player.position.x += need;
        }
      }
    }

    // Tree / trunk cylinders
    if (s.trees) {
      for (const tr of s.trees) {
        const tdx = player.position.x - tr.x;
        const tdz = player.position.z - tr.z;
        const td = Math.hypot(tdx, tdz);
        const minD = tr.r + bodyR;
        if (td < minD && player.position.y < tr.h && player.position.y + player.height > tr.y0) {
          if (td > 1e-4) {
            const push = (minD - td) / td;
            player.position.x += tdx * push;
            player.position.z += tdz * push;
          } else {
            player.position.x += minD;
          }
        }
      }
    }
  }
}

/** Build solid descriptors from Game island groups */
export function collectSolids(game) {
  const out = [];
  for (const isl of game.islands || []) {
    const g = isl.group;
    if (!g) continue;
    const x = g.position.x;
    const z = g.position.z;
    const radius = isl.radius ?? 7.5;
    const trees = [];
    if (isl.treePositions) {
      for (const t of isl.treePositions) {
        trees.push({ x: x + t.lx, z: z + t.lz, r: 0.35, h: 3.2, y0: 0 });
      }
    }
    if (isl.volcanic) {
      out.push({
        x, z, radius: isl.volcanoRadius ?? 5.5,
        baseH: 0.5, peakH: 8, kind: 'volcano', trees
      });
      // sand ring around volcano
      out.push({
        x, z, radius, baseH: 0.35, kind: 'island', trees: []
      });
    } else {
      out.push({ x, z, radius, baseH: 0.45, kind: 'island', trees });
    }
  }
  for (const si of game.storyIslands || []) {
    const g = si.group;
    if (!g) continue;
    out.push({
      x: g.position.x, z: g.position.z,
      radius: si.radius ?? 5,
      baseH: 0.4, kind: 'story', trees: []
    });
  }
  return out;
}
