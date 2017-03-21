const fs = require('fs');
const path = require('path');
const spawn = require('child_process').spawn;
const detectInstalled = require('detect-installed');

// ----------------- Configuration area --------------------

const defaults = {
  name: '',
  email: '',
  website: '',

  moduleName: '',
  camelModuleName: '',
  moduleDescription: '',
  githubUsername: '',
};

// ---------------------------------------------------------

module.exports = options => {
  const settings = Object.assign({}, defaults, options);
  const files = {
    license: path.resolve('./LICENSE'),
    package: path.resolve('./package.json'),
    appReadme: path.resolve('./APP_README.md'),
    readme: path.resolve('./README.md'),
    install: __filename
  };

  const folders = {
    backup: path.resolve('./.backup')
  };

  Promise.resolve(makeBackup())
    .then(() => Promise.all([
      replaceIn(files.license),
      replaceIn(files.package),
      replaceIn(files.appReadme)
    ]))
    .then(() => {
      fs.unlinkSync(files.readme); // instructions
      fs.renameSync(files.appReadme, files.readme);
      fs.unlinkSync(files.install); // delete itself
    }).then(() => {
    installDependencies();
  });

  function copy(from, to) {
    return new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(to);

      writer.on('finish', () => resolve());
      writer.on('error', err => reject(err));

      const reader = fs.createReadStream(from);

      reader.on('error', err => reject(err));
      reader.pipe(writer);
    });
  }

  function makeBackup() {
    if (!fs.existsSync(folders.backup)) fs.mkdirSync(folders.backup, 755);

    const copyResult = [];

    Object.keys(files).forEach(key => {
      const file = files[key];

      copyResult.push(
        copy(file, path.join(folders.backup, path.basename(file)))
      );
    });

    copyResult.push(
      copy(files.install, path.join(folders.backup, path.basename(files.install)))
    );

    return Promise.all(copyResult);
  }

  function replaceIn(filePath) {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, fileContent) => {
        if (err) return reject(err);

        // regexp to find all template groups to replace
        const regExp = new RegExp('<%=\\s([a-zA-Z0-9]+)\\s%>', 'g');
        const res = fileContent.replace(regExp, (match, group) => settings[group]);

        fs.writeFile(filePath, res, 'utf8', err => {
          if (err) return reject(err);

          resolve(res);
        });
      });
    });
  }

  function installDependencies() {
    const pkgManager = detectInstalled('yarn') ? 'yarn' : 'npm';
    const ls = spawn(pkgManager, ['install'], {
      shell: true
    });

    ls.stdout.on('data', (data) => {
      console.log(`⌵ ${data}`);
    });

    ls.stderr.on('data', (data) => {
      console.log(`⨯ ${data}`);
    });

    ls.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
    });

    ls.on('error', err => {
      throw err
    });
  }
};