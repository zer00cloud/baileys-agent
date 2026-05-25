// Daftarkan semua tools di sini.
// Untuk tambah tool baru: import file-nya, spread ke toolDefinitions & toolExecutors.

const { toolDefinitions: productDefs, toolExecutors: productExecutors } = require('./products');

const toolDefinitions = [
  ...productDefs,
  // ...orderDefs,   // nanti saat v1.1
];

const toolExecutors = {
  ...productExecutors,
  // ...orderExecutors,
};

module.exports = { toolDefinitions, toolExecutors };
