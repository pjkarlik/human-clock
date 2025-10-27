import type { Sheet } from "./sheet";

export class SpriteAnimator {
  // DOM elements
  private element: HTMLElement;
  private parentEl: HTMLElement;
  private preloadElement: HTMLElement;
  private containerEl: HTMLElement;

  // sprite + animation config
  private spriteSheets: Sheet[];
  private frameWidth: number;
  private frameHeight: number;
  private columns: number;
  private totalFrames: number;
  private fps: number;
  private mods: number;

  // animation state
  private currentFrame = 0;
  private currentSheetIndex = 0;
  private currentDigit = 0;
  private targetDigit = 0;
  private intervalId: number | null = null;
  private lastFrameTime = 0;

  // preloading
  private preloaded: Set<string> = new Set();
  private preloadCache: Map<string, Promise<void>> = new Map();

  // flags
  private isTransitioning = false;
  private isIntermPlaying = false;
  private mode: "digit" | "ampm";

  // sprite sheet constants
  private readonly DIGIT_VARIANTS = 4;
  private readonly INTERM_START: number;
  private readonly INTERM_COUNT: number;

  // timing + chance constants
  private readonly HOLD_FRAME = 61;
  private readonly INTERM_PROBABILITY = 0.2;
  private readonly SKIP_PROBABILITY = 0.3;

  constructor(
    parentEl: HTMLElement,
    spriteSheets: Sheet[],
    frameWidth: number,
    frameHeight: number,
    columns: number,
    fps: number = 24,
    intermStart: number = 40,
    intermCount: number = 21,
    totalFrames: number = 121,
    mode: "digit" | "ampm" = "digit"
  ) {
    this.parentEl = parentEl;
    this.spriteSheets = spriteSheets;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.columns = columns;
    this.fps = fps;
    this.totalFrames = totalFrames;
    this.INTERM_START = intermStart;
    this.INTERM_COUNT = intermCount;
    this.mode = mode;
    this.mods = mode === "ampm" ? 2 : 10;

    // container + elements
    this.containerEl = document.createElement("div");
    this.containerEl.classList.add("container", mode);
    this.element = document.createElement("div");
    this.element.classList.add("sprite");
    this.containerEl.appendChild(this.element);
    this.parentEl.appendChild(this.containerEl);

    // preload area (can be hidden in CSS)
    this.preloadElement = document.createElement("div");
    this.preloadElement.classList.add("preload");
    this.containerEl.appendChild(this.preloadElement);

    // initialize first sheet
    this.currentSheetIndex = this.getRandomVariantIndex(this.currentDigit);
    this.setSpriteSheet(this.currentSheetIndex);

    // preload next digit + a random interm
    this.preload(this.getRandomVariantIndex(1));
    this.preload(this.getRandomIntermIndex());
  }

  // --- Utility helpers ---

  private getRandomVariantIndex(digit: number): number {
    const base = digit * this.DIGIT_VARIANTS;
    const offset = Math.floor(Math.random() * this.DIGIT_VARIANTS);
    return base + offset;
  }

  private getRandomIntermIndex(): number {
    return this.INTERM_START + Math.floor(Math.random() * this.INTERM_COUNT);
  }

  private async preload(index: number): Promise<void> {
    const sheet = this.spriteSheets[index];
    if (this.preloaded.has(sheet.url)) return;

    if (this.preloadCache.has(sheet.url)) {
      return this.preloadCache.get(sheet.url)!;
    }

    const promise = new Promise<void>((resolve) => {
      const img = new Image();
      img.src = sheet.url;
      img.onload = () => {
        this.preloaded.add(sheet.url);
        this.preloadCache.delete(sheet.url);
        resolve();
        if (this.preloaded.size === this.spriteSheets.length) {
          this.preloadElement.remove();
        }
      };
      // optional: comment out if you don’t want these in the DOM
      this.preloadElement.appendChild(img);
    });

    this.preloadCache.set(sheet.url, promise);
    return promise;
  }

  private setSpriteSheet(index: number) {
    const sheet = this.spriteSheets[index];
    this.currentSheetIndex = index;
    this.element.style.backgroundImage = `url(${sheet.url})`;
    this.currentFrame = 0;
  }

  private resetState() {
    this.isTransitioning = false;
    this.isIntermPlaying = false;
  }

  private async setNextDigit(index?: number) {
    const nextIndex = index ?? this.getRandomVariantIndex(this.currentDigit);
    await this.preload(nextIndex);
    this.setSpriteSheet(nextIndex);
    this.preload(this.getRandomVariantIndex((this.currentDigit + 1) % this.mods));
  }

  // --- Main animation loop ---

  private updateSprite() {
    const frameIndex = this.currentFrame;
    const col = frameIndex % this.columns;
    const row = Math.floor(frameIndex / this.columns);
    const xOffset = -(col * this.frameWidth);
    const yOffset = -(row * this.frameHeight);
    this.element.style.backgroundPosition = `${xOffset}px ${yOffset}px`;

    this.currentFrame++;

    // pause mid-digit if not transitioning or playing interm
    if (!this.isTransitioning && !this.isIntermPlaying && this.currentFrame === this.HOLD_FRAME) {
      this.stop();
      return;
    }

    // when sheet completes
    if (this.currentFrame >= this.totalFrames) {
      this.currentFrame = 0;

      if (this.isIntermPlaying) {
        this.finishInterm();
        return;
      }

      if (this.isTransitioning) {
        if (Math.random() < this.INTERM_PROBABILITY) {
          this.playInterm();
        } else {
          this.finishTransition();
        }
      }
    }
  }

  private async playInterm() {
    this.isIntermPlaying = true;

    const intermIndex = this.getRandomIntermIndex();
    const nextDigitIndex = this.getRandomVariantIndex(this.targetDigit);

    await Promise.all([this.preload(intermIndex), this.preload(nextDigitIndex)]);
    this.setSpriteSheet(intermIndex);
    this.currentFrame = 0;
  }

  private async finishInterm() {
    this.isIntermPlaying = false;
    if (this.targetDigit !== this.currentDigit) {
      this.currentDigit = this.targetDigit;
    }
    await this.setNextDigit();
    this.isTransitioning = false;
  }

  private async finishTransition() {
    this.isTransitioning = false;
    this.currentDigit = this.targetDigit;
    await this.setNextDigit();
  }

  // --- Public API ---

  public async incrementDigit(targetDigit: number) {
    targetDigit = targetDigit % this.mods;
    if (this.targetDigit === targetDigit && Math.random() > this.SKIP_PROBABILITY) {
      return false;
    }

    if (this.isTransitioning || this.isIntermPlaying) {
      this.targetDigit = targetDigit; // queue for later
      return;
    }

    this.isTransitioning = true;
    this.targetDigit = targetDigit;

    if (this.intervalId === null) {
      this.start();
    }
  }

  // optional: requestAnimationFrame-based loop (smoother)
  private loop = (timestamp: number) => {
    if (timestamp - this.lastFrameTime > 1000 / this.fps) {
      this.updateSprite();
      this.lastFrameTime = timestamp;
    }
    if (this.intervalId !== null) requestAnimationFrame(this.loop);
  };

  public start() {
    if (this.intervalId !== null) return;
    this.intervalId = 1;
    requestAnimationFrame(this.loop);
  }

  public stop() {
    this.intervalId = null;
  }
}
