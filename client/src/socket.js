import { io } from 'socket.io-client';

const URL = import.meta.env.PROD ? '' : 'http://localhost:3000';
const socket = io(URL, { autoConnect: false });

// Rooms are not restored after a reconnect, so replay the last join.
let lastJoin = null;
const emit = socket.emit.bind(socket);
socket.emit = (name, ...args) => {
  if (name === 'join-event') lastJoin = args[0];
  return emit(name, ...args);
};
socket.io.on('reconnect', () => {
  if (lastJoin) emit('join-event', lastJoin);
});

export default socket;
