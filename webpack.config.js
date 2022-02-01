const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

module.exports = {
  mode: 'development',
  entry: {
    theme__lumo: './vaadin-components-federation.js',
  },
  resolve: {
    symlinks: false,
    alias: {
      // FIXME: missing import in the component
      '@vaadin/app-layout/drawer-toggle.js': '@vaadin/app-layout/vaadin-drawer-toggle.js',
    }
  },
  devtool: 'source-map',
  experiments: {
    outputModule: true,
  },
  output: {
    path: require('path').resolve(__dirname, 'dist'),
    filename: '[name].js',
    library: {
      type: 'module',
    },
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'theme__lumo',
      library: {
        type: 'module',
      },
      exposes: Object.keys(require('./dist/modules.json').modules).map(moduleId => `./node_modules/${moduleId}`),

      // Possible alternative: shared modules instead of “exposes” above
      //
      // Pros:
      // - enables runtime resolution using versions of every module
      // - consumer app can provide its own module instead of the bundled dependency
      // - bundled dependency can override consumer module, e. g., if its old
      //
      // Cons:
      // - more complicated
      // - undocumented API, heavily relies on webpack runtime in the consumer app
      // - more metadata is uncluded, increases the bundle’s file size
      //
      // shared: Object.fromEntries(
      //   Object.keys(require('./dist/modules.json').modules).map(moduleId => [
      //     moduleId, { eager: true, singleton: true, }
      //   ])
      // ),
    }),
  ],
};