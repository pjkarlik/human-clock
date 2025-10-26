import type { Sheet } from "./sheet";

export class SpriteAnimator {
  private element: HTMLElement;
  private parentEl: HTMLElement;
  private preloadElement: HTMLElement;
  private containerEl: HTMLElement;
  private spriteSheets: Sheet[];
  private frameWidth: number;
  private frameHeight: number;
  private columns: number;
  private totalFrames: number;
  private currentFrame: number = 0;
  private currentSheetIndex: number = 0;
  private currentDigit: number = 0;
  private targetDigit: number = 0;
  private fps: number;
  private intervalId: number | null = null;
  private preloaded: Set<string> = new Set();
  private isTransitioning: boolean = false;
  private isIntermPlaying: boolean = false;
  private mode: string = "digit";
  // constants for sheet index ranges
  private readonly DIGIT_VARIANTS = 4;
  private INTERM_START: number = 0; // interm 1–5
  private INTERM_COUNT: number = 0;

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
    classString?: string
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
    this.mode = classString;

    // container + elements
    this.containerEl = document.createElement("div");
    if (classString) this.containerEl.classList.add(classString);
    this.containerEl.classList.add("container");

    this.element = document.createElement("div");
    this.element.classList.add("sprite");
    this.containerEl.appendChild(this.element);

    this.parentEl.appendChild(this.containerEl);
    //document.body.appendChild(this.containerEl);

    // preload area
    this.preloadElement = document.createElement("div");
    this.preloadElement.classList.add("preload");
    this.containerEl.appendChild(this.preloadElement);

    // start at digit 0
    this.currentDigit = 0;
    this.targetDigit = 0;
    this.currentSheetIndex = this.getRandomVariantIndex(this.currentDigit);
    this.setSpriteSheet(this.currentSheetIndex);

    // preload next digit + a random interm
    this.preload(this.getRandomVariantIndex(1));
    this.preload(this.getRandomIntermIndex());
  }

  /** Pick a random variant (0–3) for a given digit 0–9 */
  private getRandomVariantIndex(digit: number): number {
    const base = digit * this.DIGIT_VARIANTS;
    const offset = Math.floor(Math.random() * this.DIGIT_VARIANTS);
    return base + offset;
  }

  /** Pick random interm sheet (indices 40–44) */
  private getRandomIntermIndex(): number {
    return this.INTERM_START + Math.floor(Math.random() * this.INTERM_COUNT);
  }

  private preload(index: number): Promise<void> {
    return new Promise((resolve) => {
      const sheet = this.spriteSheets[index];
      if (this.preloaded.has(sheet.url)) {
        resolve();
        return;
      }

      const img = new Image();
      img.src = sheet.url;
      img.onload = () => {
        this.preloaded.add(sheet.url);
        resolve();
        if (this.preloaded.size === this.spriteSheets.length) {
          this.preloadElement.remove();
        }
      };
      this.preloadElement.appendChild(img);
    });
  }

  private setSpriteSheet(index: number) {
    const sheet = this.spriteSheets[index];
    this.currentSheetIndex = index;
    this.element.style.backgroundImage = `url(${sheet.url})`;
    this.currentFrame = 0;
  }

  private async updateSprite() {
    const frameIndex = this.currentFrame;
    const col = frameIndex % this.columns;
    const row = Math.floor(frameIndex / this.columns);
    const xOffset = -(col * this.frameWidth);
    const yOffset = -(row * this.frameHeight);
    this.element.style.backgroundPosition = `${xOffset}px ${yOffset}px`;

    this.currentFrame++;

    // pause mid-digit if not transitioning or playing interm
    if (
      !this.isTransitioning &&
      !this.isIntermPlaying &&
      this.currentFrame === 61
    ) {
      this.stop();
      return;
    }

    // when sheet completes
    if (this.currentFrame >= this.totalFrames) {
      this.currentFrame = 0;

      if (this.isIntermPlaying) {
        // just finished an interm
        this.isIntermPlaying = false;
        if (this.targetDigit !== this.currentDigit) {
          this.currentDigit = this.targetDigit;
        }
        const nextIndex = this.getRandomVariantIndex(this.currentDigit);

        this.setSpriteSheet(nextIndex);
        this.isTransitioning = false;

        // preload next digit
        const mods = this.mode == "ampm" ? 2 : 10;
        const nextDigitIndex = this.getRandomVariantIndex(
          (this.currentDigit + 1) % mods
        );
        this.preload(nextDigitIndex);
        return;
      }

      if (this.isTransitioning) {
        // chance to play interm
        if (Math.random() < 0.2) {
          this.playInterm();
        } else {
          this.isTransitioning = false;
          this.currentDigit = this.targetDigit;
          const nextIndex = this.getRandomVariantIndex(this.currentDigit);
          await this.preload(nextIndex);
          this.setSpriteSheet(nextIndex);

          // preload next digit
          const mods = (this.mode=="ampm") ? 2: 10;
          const nextDigitIndex = this.getRandomVariantIndex(
            (this.currentDigit + 1) % mods
          );
          this.preload(nextDigitIndex);
        }
      }
    }
  }

  private async playInterm() {
    this.isIntermPlaying = true;

    // pick random interm
    const intermIndex = this.getRandomIntermIndex();

    // preload interm + next digit
    const nextDigitIndex = this.getRandomVariantIndex(this.targetDigit);
    await Promise.all([
      this.preload(intermIndex),
      this.preload(nextDigitIndex),
    ]);
    this.setSpriteSheet(intermIndex);
    this.currentFrame = 0;
  }

  public async incrementDigit(targetDigit: number) {
    const mods = (this.mode=="ampm") ? 2: 10;
    targetDigit = targetDigit % mods;
    if (this.targetDigit === targetDigit) {
      if (Math.random() > 0.3) return Promise.resolve(false);
    }
    if (this.isTransitioning || this.isIntermPlaying) {
      this.targetDigit = targetDigit; // queue it up
      return;
    }

    this.isTransitioning = true;
    this.targetDigit = targetDigit;

    // resume digit-out phase
    if (this.intervalId === null) {
      this.start();
    }
  }

  public start() {
    if (this.intervalId !== null) return;
    this.intervalId = window.setInterval(
      () => this.updateSprite(),
      1000 / this.fps
    );
  }

  public stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}