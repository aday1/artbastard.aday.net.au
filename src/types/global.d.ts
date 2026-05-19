import { Server } from 'socket.io'
import './osc'

declare global {
  var io: Server
  var activeMidiInputs: { [key: string]: any }
  var artnetSender: any
}

declare namespace NodeJS {
  interface Global {
    io: import('socket.io').Server;
    artnetSender?: any;
    activeMidiInputs?: { [name: string]: any };
    artNetPingStatus: string;
  }
}