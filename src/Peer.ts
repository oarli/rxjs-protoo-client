import { Subject, Observable, Observer } from "rxjs";
import {
  Message,
  Request,
  Response,
  FailedResponse,
  Notification,
  CodedError,
  RequestError,
} from "./Message";
import { filter, first, map } from "rxjs/operators";

// Shim until RxJS 7 comes out so we don't get caught with our pants down.
function firstValueFrom<T>(obs: Observable<T>) {
  return obs.pipe(first()).toPromise();
}

export default class extends Observable<Request | Notification>
  implements Observer<[Request, any]> {
  constructor(private readonly transport: Subject<Message>) {
    super((observer) => {
      const subscription = this.transport
        .pipe(
          filter(
            (message): message is Request | Notification =>
              "request" in message || "notification" in message
          )
        )
        .subscribe(observer);
      return () => subscription.unsubscribe();
    });

    this.transport = transport;
  }

  next([request, data]: [Request, any]) {
    this.transport.next({ response: true, id: request.id, ok: true, data });
  }

  error(err: RequestError) {
    this.transport.next({
      response: true,
      id: err.request.id,
      ok: false,
      errorCode: err.code,
      errorReason: err.message,
    });
  }

  complete() {
    this.transport.complete();
  }

  /** Send a protoo request to the server-side Room. */
  request(method: string, data: any = undefined) {
    const id = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
    const request = { request: true, id, method, data } as Request;

    const responses$ = this.transport.pipe(
      filter(
        (message): message is Response =>
          "response" in message && message.id === id
      ),
      map((response) => {
        if (!response.ok) {
          response = response as FailedResponse; // TODO: remove?
          throw new CodedError(response.errorCode, response.errorReason);
        }
        return response.data;
      })
    );

    const response = firstValueFrom(responses$);

    this.transport.next(request);

    return response;
  }

  /** Send a protoo notification to the server-side Room. */
  notify(method: string, data: any = undefined) {
    this.transport.next({ notification: true, method, data });
  }
}
