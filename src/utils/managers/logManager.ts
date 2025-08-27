import chalk from "chalk";
import { appendFileSync } from "fs";

const log = console.log;
type LogColors = "green" | "red" | "yellow" | "blue" | "white";

class LogEngine {
  writeLog(origin: string, message: string, color?: LogColors, newline?: boolean, skipConsole?: boolean) {
    appendFileSync("systemlog.txt", `${origin}: ${message}\n`, "utf8");
    if (skipConsole) return;

    let pickedColor = "ffffff";
    if (color === "green") {
      pickedColor = "1bff00";
    } else if (color === "red") {
      pickedColor = "ff0000";
    } else if (color === "yellow") {
      pickedColor = "fff700";
    } else if (color === "blue") {
      pickedColor = "003eff";
    }

    const setColor = chalk.hex(pickedColor);
    if (!color) color = "white";
    const nl = newline ? "\n[" : "[";
    log(nl + setColor(origin) + "] " + message);
  }
}

export const logEngine = new LogEngine();
export type LogEngineType = typeof logEngine;
