#include <cmath>

/* Keep in lockstep with src/world/Ocean.js WAVES + waveHeight() */
static const float WAVES[6][5] = {
  { 1.0f,  0.0f,  0.12f, 0.32f, 1.10f},
  { 0.0f,  1.0f,  0.09f, 0.26f, 0.85f},
  { 0.71f, 0.71f, 0.07f, 0.16f, 0.60f},
  { 0.90f,-0.44f, 0.05f, 0.11f, 0.40f},
  { 0.30f, 0.95f, 0.28f, 0.05f, 1.80f},
  {-0.7f,  0.70f, 0.45f, 0.03f, 2.40f}
};

static float g_storm = 0.f;
static float g_freeze = 0.f;
static float g_sea = 0.f;
static float buf[4096 * 3];

extern "C" {

float* io() { return buf; }

void ocean_set_params(float storm, float freeze, float seaOffset) {
  g_storm = storm;
  g_freeze = freeze < 0.f ? 0.f : (freeze > 1.f ? 1.f : freeze);
  g_sea = seaOffset;
}

static float wave(float x, float z, float t) {
  const float _sf = 1.f + 1.6f * g_storm;
  float h = 0.f;
  for (int i = 0; i < 6; ++i) {
    const float dx = WAVES[i][0];
    const float dz = WAVES[i][1];
    const float k  = WAVES[i][2];
    const float a  = WAVES[i][3];
    const float s  = WAVES[i][4];
    h += a * _sf * std::sin(k * (dx * x + dz * z) + s * t);
  }
  h *= (1.f - 0.9f * g_freeze);
  return g_sea + h;
}

void ocean_batch(int n, float t) {
  if (n > 4096) n = 4096;
  if (n < 0) n = 0;
  for (int i = 0; i < n; ++i)
    buf[i * 3 + 2] = wave(buf[i * 3], buf[i * 3 + 1], t);
}

}
