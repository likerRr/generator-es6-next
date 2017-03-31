const Generator = require('yeoman-generator');
const path = require('path');
const utils = require('./utils');
const prompts = require('./prompts');
const which = require('which');
const https = require('https');

const OPTIONS = {
  GIT_INIT: 'git-init',
  GIT_PUSH: 'git-push',
  LATEST: 'latest',
  YES: 'yes',
  YES_DEFAULT: 'yes-defaults'
};

const TEMPLATES = {
  BABELRC: '.babelrc',
  EDITORCONFIG: '.editorconfig',
  GIT_ATTRIBUTES: '.gitattributes',
  GIT_IGNORE: '.gitignore',
  TRAVIS: '.travis.yml',

  INDEX: 'index.js',
  LICENSE: 'LICENSE',
  PACKAGE: 'package.json',
  README: 'README.md',
  TEST: 'test.js',
  WEBPACK: 'webpack.config.babel.js',
  YARN: 'yarn.lock'
};

const objValues = obj => Object.keys(obj).map(key => obj[key]);

const isRepoExists = (repo, cb) => {
  const options = {
    headers: {
      'User-Agent': 'Awesome-Octocat-App'
    },
    host: 'api.github.com',
    path: `/repos/${repo}`,
    protocol: 'https:'
  };

  https.get(options, res => cb(res.statusCode === 200));
};

module.exports = class extends Generator {
  get _gitRemote() {
    if (this._authorModule) {
      return `https://github.com/${this._authorModule}`;
    }

    return null;
  }

  get _authorModule() {
    if (this.answers.githubUsername && this.answers.moduleName) {
      return `${this.answers.githubUsername}/${this.answers.moduleName}`;
    }

    return null;
  }

  constructor(args, opts) {
    super(args, opts);

    this.option('yes-default', {
      alias: 'd',
      default: false,
      description: `Ask only questions which don't have default or saved answer`,
      type: Boolean
    });

    this.option(OPTIONS.YES, {
      alias: 'y',
      default: false,
      description: `Agree on every question, don't ask anything`,
      type: Boolean
    });

    this.option(OPTIONS.GIT_INIT, {
      alias: 'g',
      default: true,
      description: `Init git repository and make initial commit`,
      type: Boolean
    });

    this.option(OPTIONS.GIT_PUSH, {
      alias: 'p',
      default: false,
      description: `Push commit`,
      type: Boolean
    });

    this.option(OPTIONS.LATEST, {
      alias: 'l',
      default: false,
      description: `Install latest versions of dependencies. (!) Correct work is not guaranteed`,
      type: Boolean
    });

    this.storedPrompt = this.config.get('promptValues') || {};
    this.defaultAnswers = this._getDefaultAnswers(this.storedPrompt);
    this.answers = {};
  }

  // Lifecycle hook
  initializing() {
    return this._beforeInit()
      .then(() => this._afterInit());
  }

  // Lifecycle hook
  prompting() {
    return this._getAnswers()
      .then(answers => {
        this.answers = answers
      });
  }

  // Lifecycle hook
  configuring() {
    this._fastCopy(TEMPLATES.BABELRC);
    this._fastCopy(TEMPLATES.EDITORCONFIG);
    this._fastCopy(TEMPLATES.GIT_ATTRIBUTES);
    this._fastCopy(TEMPLATES.GIT_IGNORE);
    this._fastCopy(TEMPLATES.TRAVIS);
  }

  // Lifecycle hook
  // default() {}

  // Lifecycle hook
  writing() {
    this._fastCopy(TEMPLATES.INDEX);
    this._fastCopy(TEMPLATES.LICENSE, this.answers);
    this._fastCopy(TEMPLATES.PACKAGE, this.answers);
    this._fastCopy(TEMPLATES.README, this.answers);
    this._fastCopy(TEMPLATES.TEST);
    this._fastCopy(TEMPLATES.WEBPACK);
    this._fastCopy(TEMPLATES.YARN);
  }

  // Lifecycle hook
  // conflicts() {}

  // Lifecycle hook
  install() {
    this._installDependencies({
      isYarn: which.sync('yarn')
    });

    if (which.sync('git')) {
      if (this.options[OPTIONS.GIT_INIT]) {
        this.spawnCommandSync('git', ['init']);
        this.spawnCommandSync('git', ['add'].concat(objValues(TEMPLATES)));
        this.spawnCommandSync('git', ['commit', '-m', 'Initial']);

        if (this.options[OPTIONS.GIT_PUSH]) {
          isRepoExists(this._authorModule, isExists => {
            if (!isExists) {
              return this.log(`Remote url not found`)
            }

            this.spawnCommandSync('git', ['remote', 'add', 'origin', this._gitRemote]);
            this.spawnCommand('git', ['push', '-u', 'origin', 'master']);
          });
        }

      }
    }
  }

  // Lifecycle hook
  // end() {}

  /**
   *
   * @param isYarn
   * @private
   */
  _installDependencies({isYarn}) {
    let dependencies = [];
    let devDependencies = [];

    if (this.options[OPTIONS.LATEST]) {
      const packageJson = require(this.templatePath('package.json'));
      const setLatest = dep => `${dep}@latest`;

      dependencies = Object.keys(packageJson.dependencies).map(setLatest);
      devDependencies = Object.keys(packageJson.devDependencies).map(setLatest);
    }

    isYarn
      ? this.yarnInstall(dependencies)
      : this.npmInstall(dependencies);

    if (devDependencies.length > 0) {
      isYarn
        ? this.yarnInstall(devDependencies, {dev: true})
        : this.npmInstall(devDependencies, {'save-dev': true});
    }
  }

  /**
   * Returns answers either after prompting or on
   * @return {Promise}
   * @private
   */
  _getAnswers() {
    return new Promise((resolve, reject) => {
      try {
        if (this.options[OPTIONS.YES_DEFAULT]) {
          // resolve questions that don't have default or stored answer
          const filtered = this.questions.ALL.filter(q => !this.defaultAnswers[q.name]);

          resolve(this.prompt(filtered).then(answers => {
            // combine answers with defaults
            return Object.assign({}, this.defaultAnswers, answers);
          }));
        } else if (this.options[OPTIONS.YES]) {
          // don't ask anything, just return answers
          resolve(Object.assign({}, this.defaultAnswers));
        } else {
          // ask all the questions
          resolve(this.prompt(this.questions.ALL));
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Copies fileName to destination path with the same name
   * @param fileName
   * @param placeholders
   * @return {*}
   * @private
   */
  _fastCopy(fileName, placeholders) {
    return this.fs.copyTpl(
      this.templatePath(fileName),
      this.destinationPath(fileName),
      placeholders
    );
  }

  /**
   * Returns merged map of stored and default answers
   * @param config
   * @return {{name: *, email: *, website: null, moduleName: *, moduleDescription: *, githubUsername: null, camelModuleName: string, humanModuleName: string}}
   * @private
   */
  _getDefaultAnswers(config) {
    const name = config.name || this.user.git.name();
    const email = config.email || this.user.git.email();
    const website = config.website || null;
    const moduleName = path.basename(process.cwd());
    const moduleDescription = null;
    const githubUsername = config.githubUsername || null;
    const camelModuleName = utils.camelize(moduleName);
    const humanModuleName = utils.humanize(moduleName);

    return {
      name, email, website, moduleName, moduleDescription, githubUsername, camelModuleName, humanModuleName
    };
  }

  /**
   * Async operations before initialing (load data, etc.)
   * @return {*}
   * @private
   */
  _beforeInit() {
    return this._initGithubUsername();
  }

  _initGithubUsername() {
    if (!this.defaultAnswers.githubUsername) {
      return this.user.github.username()
        .then(name => this.defaultAnswers.githubUsername = name);
    }

    return Promise.resolve(this.defaultAnswers.githubUsername);
  }

  _afterInit() {
    this.questions = prompts(this);
  }
};
