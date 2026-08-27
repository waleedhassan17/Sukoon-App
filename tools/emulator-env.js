#!/usr/bin/env node
/**
 * Preflight for the Firestore emulator.
 *
 * The emulator requires JDK 21+. This repo pins Java 17 for the Android Gradle
 * build (Sukoon-App/android/gradle.properties), so on a typical dev machine the
 * default `java` is too old and `firebase emulators:*` fails with a message that
 * doesn't mention any of that. This script finds a suitable JDK, exports JAVA_HOME
 * for the child process only, and runs the command — leaving the system default
 * alone so Gradle keeps working.
 *
 * Usage: node tools/emulator-env.js <command> [args...]
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MIN_MAJOR = 21;

/**
 * Parse the major version out of `java -version`.
 *
 * Note the output goes to STDERR, not stdout — every JDK does this, and reading
 * only stdout silently yields an empty string and "no JDK found".
 */
function javaMajor(javaBin) {
  const res = spawnSync(javaBin, ['-version'], { encoding: 'utf8' });
  if (res.error) return null;
  return parseMajor(`${res.stderr ?? ''}${res.stdout ?? ''}`);
}

function parseMajor(text) {
  // Matches both `"21.0.1"` (modern) and `"1.8.0_392"` (legacy) version strings.
  const m = /version "(\d+)(?:\.(\d+))?/.exec(text);
  if (!m) return null;
  const first = Number(m[1]);
  return first === 1 ? Number(m[2] ?? 0) : first;
}

/** Locate a JDK >= MIN_MAJOR: honour JAVA_HOME, then the default java, then scan. */
function findJdk() {
  if (process.env.JAVA_HOME) {
    const bin = path.join(process.env.JAVA_HOME, 'bin', 'java');
    if (fs.existsSync(bin) && (javaMajor(bin) ?? 0) >= MIN_MAJOR) return process.env.JAVA_HOME;
  }

  if ((javaMajor('java') ?? 0) >= MIN_MAJOR) return null; // default is fine as-is

  const roots = ['/usr/lib/jvm', '/usr/java', '/Library/Java/JavaVirtualMachines'];
  for (const root of roots) {
    let entries;
    try { entries = fs.readdirSync(root); } catch { continue; }
    for (const entry of entries) {
      // macOS nests the JDK under Contents/Home.
      for (const home of [path.join(root, entry), path.join(root, entry, 'Contents', 'Home')]) {
        const bin = path.join(home, 'bin', 'java');
        if (fs.existsSync(bin) && (javaMajor(bin) ?? 0) >= MIN_MAJOR) return home;
      }
    }
  }
  return undefined; // nothing suitable found
}

const [, , command, ...args] = process.argv;
if (!command) {
  console.error('usage: node tools/emulator-env.js <command> [args...]');
  process.exit(2);
}

const jdk = findJdk();

if (jdk === undefined) {
  console.error(
    `\n✖ The Firestore emulator needs JDK ${MIN_MAJOR} or newer, and none was found.\n` +
    `  Install one, e.g.:  sudo apt install openjdk-${MIN_MAJOR}-jdk-headless\n` +
    `  Then re-run. Do NOT change the system default java — this repo pins Java 17\n` +
    `  for the Android Gradle build; this script scopes JAVA_HOME to the emulator only.\n`,
  );
  process.exit(1);
}

const env = { ...process.env };
if (jdk) {
  env.JAVA_HOME = jdk;
  env.PATH = `${path.join(jdk, 'bin')}${path.delimiter}${env.PATH}`;
  console.log(`[emulator-env] JAVA_HOME → ${jdk}`);
}

const result = spawnSync(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
