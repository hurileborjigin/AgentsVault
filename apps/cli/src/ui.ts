import chalk from "chalk";
import spinners from "cli-spinners";

export function header(text: string): string {
  return chalk.bold.cyan(text);
}

export function label(key: string): string {
  return chalk.dim(key);
}

export function value(val: string | number | boolean): string {
  return chalk.white(String(val));
}

export function success(text: string): string {
  return chalk.green(`\u2714 ${text}`);
}

export function fail(text: string): string {
  return chalk.red(`\u2718 ${text}`);
}

export function warn(text: string): string {
  return chalk.yellow(`\u26A0 ${text}`);
}

export function info(key: string, val: string | number | boolean): string {
  return `${label(key + ":")} ${value(val)}`;
}

export function divider(): string {
  return chalk.dim("\u2500".repeat(40));
}

const SPINNER = spinners.dots;
const BAR_FILLED = "\u2588";
const BAR_EMPTY = "\u2591";

export class ProgressRenderer {
  private frameIndex = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastText = "";

  start(): void {
    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % SPINNER.frames.length;
      if (this.lastText) this.write(this.lastText);
    }, SPINNER.interval);
  }

  update(opts: {
    phase: string;
    current: number;
    total: number;
    filePath: string;
    parsed: number;
    skipped: number;
    chunks: number;
  }): void {
    if (opts.phase === "scanning") {
      this.lastText = chalk.cyan(` Scanning... ${chalk.bold(opts.total)} files found`);
    } else if (opts.phase === "processing" && opts.total > 0) {
      const pct = Math.round((opts.current / opts.total) * 100);
      const barWidth = 20;
      const filled = Math.round((opts.current / opts.total) * barWidth);
      const bar =
        chalk.green(BAR_FILLED.repeat(filled)) +
        chalk.dim(BAR_EMPTY.repeat(barWidth - filled));
      const pctStr = chalk.bold(`${pct}%`.padStart(4));
      const counter = chalk.dim(`(${opts.current}/${opts.total})`);
      const file = chalk.white(truncatePath(opts.filePath, 30));
      const stats = chalk.dim(
        `${opts.parsed} parsed \u00B7 ${opts.skipped} skipped \u00B7 ${opts.chunks} chunks`,
      );
      this.lastText = ` ${bar} ${pctStr} ${counter} ${file} ${stats}`;
    }
    this.write(this.lastText);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const cols = process.stderr.columns || 80;
    process.stderr.write(`\r${" ".repeat(cols)}\r`);
  }

  private write(text: string): void {
    const spinner = chalk.cyan(SPINNER.frames[this.frameIndex]);
    const cols = process.stderr.columns || 80;
    const line = `\r${spinner}${text}`;
    // Strip ANSI for length calculation
    const plain = line.replace(/\x1b\[[0-9;]*m/g, "");
    const pad = Math.max(0, cols - plain.length);
    process.stderr.write(`${line}${" ".repeat(pad)}`);
  }
}

function truncatePath(p: string, max: number): string {
  if (p.length <= max) return p;
  return "\u2026" + p.slice(p.length - max + 1);
}
