import { exec } from "child_process";
import { config } from "../../config";

export function playSound(speech?: string) {
  const text = speech ? speech : config.token_buy.play_sound_text;
  const command = `powershell -Command "(New-Object -com SAPI.SpVoice).speak('${text}')"`;
  exec(command, (error, stdout, stderr) => {
    if (error) {
      return false;
    }
    if (stderr) {
      return false;
    }
    return true;
  });
}
export function openBrowser(url?: string) {
  // (property) NodeJS.Process.platform: "aix" | "android" | "darwin" | "freebsd" | "haiku" | "linux" | "openbsd" | "sunos" | "cygwin" | "netbsd"
  // The process.platform property returns a string identifying the operating system platform for which the Node.js binary was compiled.

  // Currently possible values are:

  // 'aix'
  // 'darwin'
  // 'freebsd'
  // 'linux'
  // 'openbsd'
  // 'sunos'

  const startCmd = process.platform === "win32" ? `start ${url}` : process.platform === "darwin" ? `open ${url}` : `xdg-open ${url}`;
  exec(startCmd);
}
