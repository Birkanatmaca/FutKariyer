const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const childEnv = { ...process.env };
const ascii = value =>
  value.length > 0 && Array.from(value).every(char => char.charCodeAt(0) < 128);
let workingRoot = root;
let tempRoot;

function execute(command, params, cwd) {
  const result = spawnSync(command, params, {
    cwd,
    env: childEnv,
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status === null ? 1 : result.status);
  }
}

if (process.platform === 'win32') {
  // Windows short paths may resolve back to a Unicode path inside Java NIO.
  const base = process.env.PUBLIC || os.tmpdir();
  if (!base || !ascii(base)) {
    throw new Error('Java için ASCII bir geçici dizin gerekli.');
  }
  tempRoot = path.join(base, 'FutCareerGradleTemp');
  fs.mkdirSync(tempRoot, { recursive: true });
  childEnv.TEMP = tempRoot;
  childEnv.TMP = tempRoot;
  childEnv.GRADLE_USER_HOME = path.join(tempRoot, 'gradle');
  const normalized = tempRoot.replaceAll(path.sep, '/');
  childEnv.JAVA_TOOL_OPTIONS =
    (childEnv.JAVA_TOOL_OPTIONS || '') +
    ' -Dfile.encoding=UTF-8 -Djdk.net.unixdomain.tmpdir="' +
    normalized +
    '"' +
    ' -Djava.io.tmpdir="' +
    normalized +
    '"';

  const isAndroid =
    ['run-android', 'build-android'].includes(args[0]) &&
    !args.includes('--help');
  const sdk =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
  if (
    isAndroid &&
    (!ascii(root) || !ascii(sdk) || !ascii(process.env.USERPROFILE || ''))
  ) {
    if (!fs.existsSync(sdk)) {
      throw new Error('Android SDK bulunamadı. ANDROID_HOME değerini ayarla.');
    }
    const hash = crypto.createHash('sha256').update(root).update(sdk);
    const excluded = new Set(['build', '.gradle', '.cxx', 'local.properties']);
    function hashNative(directory) {
      for (const entry of fs
        .readdirSync(directory, { withFileTypes: true })
        .sort((a, b) => a.name.localeCompare(b.name))) {
        if (excluded.has(entry.name)) {
          continue;
        }
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
          hashNative(file);
        } else {
          hash.update(path.relative(root, file));
          hash.update(fs.readFileSync(file));
        }
      }
    }
    hashNative(path.join(root, 'android'));
    hashNative(path.join(root, 'src'));
    for (const name of [
      'App.tsx',
      'index.js',
      'app.json',
      'babel.config.js',
      'metro.config.js',
    ]) {
      hash.update(name);
      hash.update(fs.readFileSync(path.join(root, name)));
    }
    hash.update(fs.readFileSync(path.join(root, 'package-lock.json')));
    const stagingBase = process.env.PUBLIC;
    if (!stagingBase || !ascii(stagingBase)) {
      throw new Error('ASCII derleme klasörü için PUBLIC dizini gerekli.');
    }
    workingRoot = path.join(
      stagingBase,
      'FutCareerBuild',
      hash.digest('hex').slice(0, 10),
    );
    fs.mkdirSync(workingRoot, { recursive: true });
    fs.cpSync(path.join(root, 'android'), path.join(workingRoot, 'android'), {
      recursive: true,
      filter: source =>
        !path
          .relative(path.join(root, 'android'), source)
          .split(path.sep)
          .some(part => excluded.has(part)),
    });
    for (const name of [
      'package.json',
      'package-lock.json',
      'app.json',
      'index.js',
      'App.tsx',
      'babel.config.js',
      'metro.config.js',
      'tsconfig.json',
    ]) {
      fs.copyFileSync(path.join(root, name), path.join(workingRoot, name));
    }
    fs.cpSync(path.join(root, 'src'), path.join(workingRoot, 'src'), {
      recursive: true,
    });
    const sdkAlias = path.join(workingRoot, 'sdk');
    if (!fs.existsSync(sdkAlias)) {
      fs.symlinkSync(sdk, sdkAlias, 'junction');
    }
    fs.writeFileSync(
      path.join(workingRoot, 'android', 'local.properties'),
      'sdk.dir=' + sdkAlias.replaceAll(path.sep, '/') + '\n',
    );
    childEnv.ANDROID_HOME = sdkAlias;
    childEnv.ANDROID_SDK_ROOT = sdkAlias;
    console.log('Windows native derleme klasörü: ' + workingRoot);
    if (
      !fs.existsSync(
        path.join(workingRoot, 'node_modules', '.package-lock.json'),
      )
    ) {
      execute(
        'cmd.exe',
        ['/d', '/s', '/c', 'npm ci --no-audit --no-fund'],
        workingRoot,
      );
    }
    if (args[0] === 'run-android' && !args.includes('--no-packager')) {
      args.push('--no-packager');
    }
  }
}
const cli = path.join(workingRoot, 'node_modules', 'react-native', 'cli.js');
execute(process.execPath, [cli, ...args], workingRoot);
if (
  workingRoot !== root &&
  ['run-android', 'build-android'].includes(args[0])
) {
  const apk = path.join(
    workingRoot,
    'android',
    'app',
    'build',
    'outputs',
    'apk',
    'debug',
    'app-debug.apk',
  );
  if (fs.existsSync(apk)) {
    const output = path.resolve(root, '..', 'artifacts', 'android');
    fs.mkdirSync(output, { recursive: true });
    fs.copyFileSync(apk, path.join(output, 'app-debug.apk'));
    console.log('APK: ' + path.join(output, 'app-debug.apk'));
  }
}
