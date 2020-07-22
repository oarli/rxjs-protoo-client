import * as IsomorphicWebSocket from "isomorphic-ws";
import { webSocket, WebSocketSubjectConfig } from "rxjs/webSocket";
import { Message } from "../Message";

const WS_SUBPROTOCOL = "protoo";

export function webSocketTransport(config: WebSocketSubjectConfig<Message>) {
  return webSocket<Message>({
    protocol: WS_SUBPROTOCOL,
    // Aggressive cast to satisfy rxjs/webSocket.
    WebSocketCtor: (IsomorphicWebSocket as unknown) as {
      new (url: string, protocols?: string | string[]): WebSocket;
    },
    ...config,
  });
}
