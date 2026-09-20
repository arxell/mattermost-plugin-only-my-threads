const exec = require('child_process').exec;

const path = require('path');

const PLUGIN_ID = require('../plugin.json').id;

const NPM_TARGET = process.env.npm_lifecycle_event; //eslint-disable-line no-process-env

module.exports = (env, argv) => {
    const plugins = [];
    if (NPM_TARGET === 'build:watch' || NPM_TARGET === 'debug:watch') {
        plugins.push({
            apply: (compiler) => {
                compiler.hooks.watchRun.tap('WatchStartPlugin', () => {
                    // eslint-disable-next-line no-console
                    console.log('Change detected. Rebuilding webapp.');
                });
                compiler.hooks.afterEmit.tap('AfterEmitPlugin', () => {
                    exec('cd .. && make deploy-from-watch', (err, stdout, stderr) => {
                        if (stdout) {
                            process.stdout.write(stdout);
                        }
                        if (stderr) {
                            process.stderr.write(stderr);
                        }
                    });
                });
            },
        });
    }

    return {
        entry: [
            './src/index.tsx',
        ],
        resolve: {
            modules: [
                'src',
                'node_modules',
            ],
            extensions: ['*', '.js', '.jsx', '.ts', '.tsx'],
        },
        module: {
            rules: [
                {
                    test: /\.(js|jsx|ts|tsx)$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            cacheDirectory: true,

                            // Babel configuration is in babel.config.js because jest requires it to be there.
                        },
                    },
                },
            ],
        },
        externals: {
            react: 'React',
            'react-dom': 'ReactDOM',
            redux: 'Redux',
            'react-redux': 'ReactRedux',
            'prop-types': 'PropTypes',
            'react-bootstrap': 'ReactBootstrap',
            'react-router-dom': 'ReactRouterDom',
        },
        output: {
            devtoolNamespace: PLUGIN_ID,
            path: path.join(__dirname, '/dist'),
            publicPath: '/',
            filename: 'main.js',
        },
        mode: argv.mode || 'production',
        devtool: argv.mode === 'development' ? 'eval-source-map' : 'source-map',
        plugins,
    };
};
