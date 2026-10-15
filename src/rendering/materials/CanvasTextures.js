import * as THREE from 'three';

export function makeWoodTexture(w = 128, h = 128) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#a07a48';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    const y = (i / 40) * h + Math.sin(i * 1.7) * 3;
    g.strokeStyle = `rgba(60,35,15,${0.15 + Math.random() * 0.25})`;
    g.lineWidth = 1 + Math.random() * 2;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x < w; x += 8) {
      g.lineTo(x, y + Math.sin(x * 0.08 + i) * 2);
    }
    g.stroke();
  }
  for (let i = 0; i < 200; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeBarrelTexture(w = 64, h = 64) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#6b4423';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = '#3a2818';
    g.fillRect(0, (i / 8) * h, w, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
