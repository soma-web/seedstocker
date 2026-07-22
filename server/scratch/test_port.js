import { getServerPort } from '../src/config.js';

console.log('Default/Config Port:', getServerPort());

process.env.PORT = '8080';
console.log('Overridden Env Port:', getServerPort());
