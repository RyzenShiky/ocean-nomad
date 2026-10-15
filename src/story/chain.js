/** Pure story data — no THREE */
export const CHAIN = [
  { id: 'reef',       dist: 280,  note: 'n1', needs: null,        reward: {} },
  { id: 'palm',       dist: 650,  note: 'n2', needs: 'axe',       reward: { seed: 3 } },
  { id: 'wreck',      dist: 1100, note: 'n3', needs: null,        reward: { unlock: 'smelter' } },
  { id: 'atoll',      dist: 1400, note: 'n4', needs: null,        reward: { rope: 2, plastic: 2 } },
  { id: 'lighthouse', dist: 1700, note: 'n5', needs: 'metal_key', reward: {} },
  { id: 'volcano_bay',dist: 2000, note: 'n6', needs: 'axe_iron',  reward: { metal_ingot: 2 } },
  { id: 'radio',      dist: 2200, note: 'n7', needs: null,        reward: { scrap: 4 } },
  { id: 'harbor',     dist: 2500, note: 'n8', needs: null,        reward: { ending: true } }
];

export const NOTES = {
  n1: {
    title: 'Botol di karang',
    text: 'Arus membawa ke tenggara. Pulau kelapa di depan — bawa kapak untuk kayu.',
    next: 'palm'
  },
  n2: {
    title: 'Ukiran di batang kelapa',
    text: 'Bangkai kapal lebih jauh di hilir. Ada desas-desus tentang tempa di reruntuhan.',
    next: 'wreck'
  },
  n3: {
    title: 'Buku harian kapten',
    text: 'Kami melebur besi tua jadi batangan. Kunci logam membuka cache mercusuar di hulu.',
    next: 'atoll'
  },
  n4: {
    title: 'Peta di atol',
    text: 'Mercusuar masih menyala di malam hari. Bawa kunci logam.',
    next: 'lighthouse'
  },
  n5: {
    title: 'Log mercusuar',
    text: 'Teluk vulkanik lebih jauh. Kapak besi memudahkan menebang kayu keras di sana.',
    next: 'volcano_bay'
  },
  n6: {
    title: 'Prasasti lava',
    text: 'Sinyal radio masih berderak saat senja. Ikuti bearing utara-timur.',
    next: 'radio'
  },
  n7: {
    title: 'Pesan radio',
    text: 'Pelabuhan terakhir terkunci di koordinat. Layar tegak. Laut masih luas.',
    next: 'harbor'
  },
  n8: {
    title: 'Suara pelabuhan',
    text: 'Kamu menemukan pelabuhan terakhir. Perjalananmu tercatat di arus.',
    next: null
  }
};
