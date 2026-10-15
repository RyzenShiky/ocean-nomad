/** Onboarding + progression milestones (Bahasa Indonesia) */
export class TutorialSystem {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.done = false;
    this.t = 0;
    this.steps = null;
    this.prog = {};
  }

  tick(dt) {
    const g = this.game;
    if (!g.running || this.done) {
      this._progressTick();
      return;
    }
    this.t += dt;
    if (!this.steps) {
      this.steps = [
        { t: 2,  msg: '🌊 Selamat datang di lautan. WASD bergerak · Mouse melihat · Spasi loncat.' },
        { t: 12, msg: '📦 Ambil Hook (hotbar). Tahan LMB untuk melempar, tarik puing kayu/tong.' },
        { t: 28, msg: '🎒 Tab = crafting & inventory. 1–0 ganti slot hotbar.' },
        { t: 42, msg: '🔨 Pegang Hammer: RMB menu bangun · LMB pasang lantai · R putar.' },
        { t: 60, msg: '🍖 Haus & lapar turun terus. Craft air/makanan atau pakai station (E).' },
        { t: 80, msg: '🦈 Hiu mengitari rakit. Craft Spear, dekatkan, LMB menusuk.' },
        { t: 110, msg: '🧭 Ikuti kompas ke pulau cerita. E ambil catatan · J buka jurnal.' },
        { t: 150, msg: '⛈️ Badai menaikkan ombak. Perluas rakit & siapkan layar.' },
        { t: 190, msg: '💾 Esc → Simpan. Progress juga tersimpan otomatis tiap 90 detik.' },
        { t: 240, msg: '🎯 Tujuan: bertahan, bangun, jelajahi pulau, temukan pelabuhan. Selamat berlayar!' }
      ];
    }
    for (const s of this.steps) {
      if (!s.shown && this.t >= s.t) {
        s.shown = true;
        g._toast(s.msg, 5200);
        g.audio?.notify?.();
      }
    }
    this._progressTick();
    if (this.t > 280) this.done = true;
  }

  _progressTick() {
    const g = this.game;
    const cells = g.raft?.cells?.size || 0;
    const day = g.days || 1;
    const pt = g.playTime || 0;
    const mark = (id, cond, msg) => {
      if (!this.prog[id] && cond) {
        this.prog[id] = true;
        g._toast(msg, 4000);
        g.audio?.notify?.();
      }
    };
    mark('raft6', cells >= 6, '🏗️ Rakit membesar! Lanjut ke 12 sel untuk stabilitas lebih baik.');
    mark('raft12', cells >= 12, '🏠 Rakit kokoh. Saatnya station: grill, purifier, storage.');
    mark('day2', day >= 2, '🌅 Hari ke-2. Cari pulau di kompas — ada catatan & hadiah.');
    mark('day3', day >= 3, '🗺️ Hari ke-3. Research table membuka alat & bangunan baru.');
    mark('m30', pt >= 1800, '⏱️ 30 menit bertahan. Badai & hiu akan lebih sering — siap-siap.');
    mark('story1', (g.story?.notes?.length || 0) >= 1, '📜 Catatan pertama! Jurnal (J) menyimpan petunjuk pulau berikutnya.');
    mark('story3', (g.story?.notes?.length || 0) >= 3, '⚓ Setengah perjalanan cerita. Teruskan ke mercusuar & pelabuhan.');
  }
}
