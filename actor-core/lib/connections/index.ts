import { Conn } from "./base";
import { WebsocketConn } from "./ws";

export { Conn } from "./base";

export class Conns {
  static ws(url: string): Conn {
    return new WebsocketConn(url);
  }
}
