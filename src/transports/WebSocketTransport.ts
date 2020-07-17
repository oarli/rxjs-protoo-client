import { ConnectableObservable, Observable } from "rxjs";
import { AnonymousSubject } from "rxjs/internal/Subject";
import { publish } from "rxjs/operators";
import { Message, parse } from "../Message";
import * as WebSocket from "isomorphic-ws";

const WS_SUBPROTOCOL = "protoo";

export async function webSocketTransport(url: string) {
  const ws = new WebSocket(url, WS_SUBPROTOCOL);

  await new Promise((resolve) => (ws.onopen = resolve));

  const observable = new Observable<Message>((observer) => {
    ws.onmessage = (e) => observer.next(parse(e.data.toString()));
    ws.onerror = (e) => observer.error(e);
    ws.onclose = (e) => {
      if (e.code === 4000) {
        observer.complete();
      } else {
        observer.error(e);
      }
    };
    return () => ws.close();
  }).pipe(publish()) as ConnectableObservable<Message>;

  const subscription = observable.connect();

  return new AnonymousSubject<Message>(
    {
      next(data) {
        ws.send(JSON.stringify(data));
      },
      error(err) {
        ws.close();
        subscription.unsubscribe();
        throw err;
      },
      complete() {
        ws.close();
        subscription.unsubscribe();
      },
    },
    observable
  );
}
