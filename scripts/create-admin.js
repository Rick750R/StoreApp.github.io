require('dotenv').config();
const readline = require('readline');
const crypto = require('crypto');
const { promisify } = require('util');
const pool = require('../src/config/db');
const scrypt = promisify(crypto.scrypt);

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      ask(question).then(resolve, reject);
      return;
    }
    process.stdout.write(question);
    let value = '';
    const onData = (buffer) => {
      const key = buffer.toString('utf8');
      if (key === '\u0003') {
        process.stdin.setRawMode(false);
        process.stdin.off('data', onData);
        process.stdout.write('\n');
        reject(new Error('Operación cancelada.'));
      } else if (key === '\r' || key === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.off('data', onData);
        process.stdout.write('\n');
        resolve(value);
      } else if (key === '\u007f' || key === '\b') {
        value = value.slice(0, -1);
      } else if (key.length === 1 && key >= ' ') {
        value += key;
      }
    };
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on('data', onData);
    process.stdin.resume();
  });
}

async function main() {
  try {
    const nombre = await ask('Nombre del administrador: ');
    const correo = (await ask('Correo del administrador: ')).toLowerCase();
    const password = await askHidden('Contraseña (mínimo 8 caracteres): ');
    if (nombre.length < 2 || nombre.length > 120) throw new Error('El nombre debe tener entre 2 y 120 caracteres.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new Error('El correo no es válido.');
    if (password.length < 8 || password.length > 128) throw new Error('La contraseña debe tener entre 8 y 128 caracteres.');

    const salt = crypto.randomBytes(16).toString('hex');
    const derived = await scrypt(password, salt, 64);
    const passwordHash = `scrypt$${salt}$${derived.toString('hex')}`;
    await pool.query(
      `INSERT INTO usuarios (nombre, correo, password_hash, rol)
       VALUES (?, ?, ?, 'administrador')`,
      [nombre, correo, passwordHash]
    );
    console.log(`\nAdministrador creado correctamente para ${correo}.`);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') console.error('\nYa existe una cuenta con ese correo.');
    else console.error(`\nNo se pudo crear el administrador: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
