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
    const orig = rl._writeToOutput.bind(rl);
    rl.question(prompt, (password) => {
      rl._writeToOutput = orig;
      process.stdout.write('\n');
      resolve(password);
    });
    rl._writeToOutput = () => {};
  });
}

module.exports = { createInterface, ask, askPassword };
