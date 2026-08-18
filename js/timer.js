import { TIMER_CONFIG } from './constants.js';

/**
 * Precision Turn Timer Controller
 * Manages 20-second turn countdown, warning thresholds, and timeout triggers.
 */
export class TurnTimer {
  constructor(options = {}) {
    this.duration = options.duration || TIMER_CONFIG.TURN_SECONDS;
    this.warningThreshold = options.warningThreshold || TIMER_CONFIG.WARNING_THRESHOLD;
    this.onTick = options.onTick || (() => {});
    this.onWarning = options.onWarning || (() => {});
    this.onTimeout = options.onTimeout || (() => {});

    this.secondsLeft = this.duration;
    this.timerInterval = null;
    this.isRunning = false;
    this.isPaused = false;
  }

  /**
   * Starts or resets the timer to 20 seconds.
   */
  start() {
    this.stop();
    this.secondsLeft = this.duration;
    this.isRunning = true;
    this.isPaused = false;

    this.notifyTick();

    this.timerInterval = setInterval(() => {
      if (this.isPaused) return;

      this.secondsLeft--;
      this.notifyTick();

      if (this.secondsLeft <= this.warningThreshold && this.secondsLeft > 0) {
        this.onWarning(this.secondsLeft);
      }

      if (this.secondsLeft <= 0) {
        this.stop();
        this.onTimeout();
      }
    }, 1000);
  }

  /**
   * Resets the timer back to full 20s.
   */
  reset() {
    this.start();
  }

  /**
   * Pauses the countdown (e.g. during animations or modals).
   */
  pause() {
    this.isPaused = true;
  }

  /**
   * Resumes the paused timer.
   */
  resume() {
    this.isPaused = false;
  }

  /**
   * Halts and clears the timer interval.
   */
  stop() {
    this.isRunning = false;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  notifyTick() {
    const percent = (this.secondsLeft / this.duration) * 100;
    this.onTick(this.secondsLeft, percent);
  }
}
