/**
 * Simulation facade. v1 = main-thread only (Mode A portable).
 * Future: postMessage to worker with plain state snapshots (no THREE objects).
 */
export class SimulationManager {
  constructor({ workerSupported = false } = {}) {
    this.mode = 'main'; // 'main' | 'worker'
    this.workerSupported = workerSupported;
    this.worker = null;
  }

  /** Plain-data step hook — systems still owned by Game for now */
  beginFrame() {}
  endFrame() {}

  dispose() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
