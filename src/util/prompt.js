'use strict';

const readline = require('readline');

function createInterface() {
  return readline.createInterface({ input: process.stdin, output: process.stdout });
}

function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function askPassword(rl, prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const orig = rl._writeToOutput.bind(rl);
    rl._writeToOutput = () => {};
    rl.question('', (password) => {
      rl._writeToOutput = orig;
      process.stdout.write('\n');
      resolve(password);
    });
  });
}

module.exports = { createInterface, ask, askPassword };
