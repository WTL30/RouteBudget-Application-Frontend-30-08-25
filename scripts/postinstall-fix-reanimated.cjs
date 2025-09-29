// Patch react-native-reanimated CMake to reduce Ninja object path length on Windows
// Adds: set(CMAKE_OBJECT_PATH_MAX 16) to all CMakeLists.txt under the module's android folder

const fs = require('fs');
const path = require('path');

function findFilesRecursive(dir, filename) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name === filename) results.push(full);
    }
  }
  return results;
}

function patchFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const desired = 'set(CMAKE_OBJECT_PATH_MAX 16)';
    if (/CMAKE_OBJECT_PATH_MAX\s+\d+/i.test(content)) {
      // Replace any existing value with the desired one
      const updated = content.replace(/set\(CMAKE_OBJECT_PATH_MAX\s+\d+\)/i, desired);
      if (updated !== content) {
        fs.writeFileSync(filePath, updated, 'utf8');
        console.log('[postinstall-fix-reanimated] Replaced value in', filePath);
        return true;
      } else {
        console.log('[postinstall-fix-reanimated] Already at desired value in', filePath);
        return false;
      }
    }

    const lines = content.split(/\r?\n/);
    let insertIdx = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (l.startsWith('project(')) { insertIdx = i + 1; break; }
      if (l.startsWith('cmake_minimum_required')) { insertIdx = i + 1; }
    }

    const inject = desired;
    lines.splice(insertIdx, 0, inject);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log('[postinstall-fix-reanimated] Injected into', filePath);
    return true;
  } catch (e) {
    console.warn('[postinstall-fix-reanimated] Failed to patch', filePath, e.message);
    return false;
  }
}

function patchReanimatedCMake(root) {
  const base = path.join(root, 'node_modules', 'react-native-reanimated', 'android');
  if (!fs.existsSync(base)) {
    console.warn('[postinstall-fix-reanimated] reanimated android folder not found at', base);
    return;
  }
  const files = findFilesRecursive(base, 'CMakeLists.txt');
  if (!files.length) {
    console.warn('[postinstall-fix-reanimated] No CMakeLists.txt files found under', base);
    return;
  }
  let patched = 0;
  for (const f of files) patched += patchFile(f) ? 1 : 0;
  if (patched === 0) console.log('[postinstall-fix-reanimated] No changes applied');
}

try {
  const root = process.cwd();
  patchReanimatedCMake(root);
} catch (e) {
  console.error('[postinstall-fix-reanimated] Failed:', e);
  process.exitCode = 0; // do not fail install
}
